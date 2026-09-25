package io.event1.capacitorstripeterminal;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.os.Build;
import androidx.annotation.NonNull;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.stripe.stripeterminal.Terminal;
import com.stripe.stripeterminal.external.callable.AppsOnDevicesListener;
import com.stripe.stripeterminal.external.api.ApiError;
import com.stripe.stripeterminal.external.callable.Callback;
import com.stripe.stripeterminal.external.callable.Cancelable;
import com.stripe.stripeterminal.external.callable.CollectInputsResultCallback;
import com.stripe.stripeterminal.external.callable.CollectedDataCallback;
import com.stripe.stripeterminal.external.callable.ConnectionTokenCallback;
import com.stripe.stripeterminal.external.callable.ConnectionTokenProvider;
import com.stripe.stripeterminal.external.callable.DiscoveryListener;
import com.stripe.stripeterminal.external.callable.LocationListCallback;
import com.stripe.stripeterminal.external.callable.MobileReaderListener;
import com.stripe.stripeterminal.external.callable.PaymentIntentCallback;
import com.stripe.stripeterminal.external.callable.ReaderCallback;
import com.stripe.stripeterminal.external.callable.ReaderSettingsCallback;
import com.stripe.stripeterminal.external.callable.RefundCallback;
import com.stripe.stripeterminal.external.callable.SetupIntentCallback;
import com.stripe.stripeterminal.external.callable.TapToPayReaderListener;
import com.stripe.stripeterminal.external.callable.TerminalListener;
import com.stripe.stripeterminal.external.models.BatteryStatus;
import com.stripe.stripeterminal.external.models.CaptureMethod;
import com.stripe.stripeterminal.external.models.Cart;
import com.stripe.stripeterminal.external.models.CartLineItem;
import com.stripe.stripeterminal.external.models.CollectDataConfiguration;
import com.stripe.stripeterminal.external.models.CollectInputsParameters;
import com.stripe.stripeterminal.external.models.CollectInputsResult;
import com.stripe.stripeterminal.external.models.CollectPaymentIntentConfiguration;
import com.stripe.stripeterminal.external.models.CollectRefundConfiguration;
import com.stripe.stripeterminal.external.models.CollectSetupIntentConfiguration;
import com.stripe.stripeterminal.external.models.CollectedData;
import com.stripe.stripeterminal.external.models.ConnectionConfiguration.AppsOnDevicesConnectionConfiguration;
import com.stripe.stripeterminal.external.models.ConnectionConfiguration.BluetoothConnectionConfiguration;
import com.stripe.stripeterminal.external.models.ConnectionConfiguration.InternetConnectionConfiguration;
import com.stripe.stripeterminal.external.models.ConnectionConfiguration.TapToPayConnectionConfiguration;
import com.stripe.stripeterminal.external.models.ConnectionConfiguration.UsbConnectionConfiguration;
import com.stripe.stripeterminal.external.models.ConnectionStatus;
import com.stripe.stripeterminal.external.models.ConnectionTokenException;
import com.stripe.stripeterminal.external.models.DeviceType;
import com.stripe.stripeterminal.external.models.DisconnectReason;
import com.stripe.stripeterminal.external.models.DiscoveryConfiguration;
import com.stripe.stripeterminal.external.models.ListLocationsParameters;
import com.stripe.stripeterminal.external.models.Location;
import com.stripe.stripeterminal.external.models.PaymentIntent;
import com.stripe.stripeterminal.external.models.PaymentIntentParameters;
import com.stripe.stripeterminal.external.models.PaymentStatus;
import com.stripe.stripeterminal.external.models.Reader;
import com.stripe.stripeterminal.external.models.ReaderDisplayMessage;
import com.stripe.stripeterminal.external.models.ReaderEvent;
import com.stripe.stripeterminal.external.models.ReaderInputOptions;
import com.stripe.stripeterminal.external.models.ReaderSettings;
import com.stripe.stripeterminal.external.models.ReaderSettingsParameters;
import com.stripe.stripeterminal.external.models.ReaderSoftwareUpdate;
import com.stripe.stripeterminal.external.models.ReaderSupportResult;
import com.stripe.stripeterminal.external.models.Refund;
import com.stripe.stripeterminal.external.models.RefundParameters;
import com.stripe.stripeterminal.external.models.SetupIntent;
import com.stripe.stripeterminal.external.models.SetupIntentCancellationParameters;
import com.stripe.stripeterminal.external.models.SetupIntentParameters;
import com.stripe.stripeterminal.external.models.SimulateReaderUpdate;
import com.stripe.stripeterminal.external.models.SimulatedCard;
import com.stripe.stripeterminal.external.models.SimulatedCardType;
import com.stripe.stripeterminal.external.models.SimulatedCollectInputsResult;
import com.stripe.stripeterminal.external.models.SimulatedCollectInputsSkipBehavior;
import com.stripe.stripeterminal.external.models.SimulatorConfiguration;
import com.stripe.stripeterminal.external.models.TerminalException;
import com.stripe.stripeterminal.log.LogLevel;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(
  name = "StripeTerminal",
  permissions = {
    @Permission(
      strings = { Manifest.permission.ACCESS_FINE_LOCATION },
      alias = "location"
    ),
    @Permission(
      strings = {
        Manifest.permission.BLUETOOTH_CONNECT,
        Manifest.permission.BLUETOOTH_SCAN
      },
      alias = "bluetooth"
    )
  }
)
public class StripeTerminal
  extends Plugin
  implements
    ConnectionTokenProvider,
    TerminalListener,
    DiscoveryListener,
    MobileReaderListener,
    TapToPayReaderListener,
    AppsOnDevicesListener
{

  Cancelable pendingDiscoverReaders = null;
  Cancelable pendingCollectPaymentMethod = null;
  Cancelable pendingCollectData = null;
  Cancelable pendingCollectSetupIntentPaymentMethod = null;
  Cancelable pendingCollectRefundPaymentMethod = null;
  Cancelable pendingCollectInputs = null;
  ConnectionTokenCallback pendingConnectionTokenCallback = null;
  String lastCurrency = null;

  ReaderSoftwareUpdate currentUpdate = null;
  PaymentIntent currentPaymentIntent = null;
  SetupIntent currentSetupIntent = null;

  // The Reader object never carries battery status, so cache what the reader reports.
  Float lastBatteryLevel = null;
  BatteryStatus lastBatteryStatus = null;
  Boolean lastIsCharging = null;
  ReaderEvent lastReaderEvent = ReaderEvent.CARD_REMOVED;
  List<? extends Reader> discoveredReadersList = null;
  Cancelable pendingInstallUpdate = null;
  Cancelable pendingReaderAutoReconnect = null;

  @PluginMethod
  public void getPermissions(PluginCall call) {
    if (getPermissionState("location") != PermissionState.GRANTED) {
      requestPermissions(call);
    } else {
      JSObject result = new JSObject();
      result.put("location", "granted");
      call.resolve(result);
    }
  }

  @PluginMethod
  public void initialize(PluginCall call) {
    if (getPermissionState("location") != PermissionState.GRANTED) {
      requestPermissionForAlias("location", call, "locationPermsCallback");
    } else if (
      getPermissionState("bluetooth") != PermissionState.GRANTED &&
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
    ) {
      requestPermissionForAlias("bluetooth", call, "bluetoothPermsCallback");
    } else {
      _initialize(call);
    }
  }

  @PermissionCallback
  private void bluetoothPermsCallback(PluginCall call) {
    if (
      getPermissionState("bluetooth") == PermissionState.GRANTED ||
      Build.VERSION.SDK_INT < Build.VERSION_CODES.S
    ) {
      _initialize(call);
    } else {
      call.reject("Bluetooth permissions are required.");
    }
  }

  @PermissionCallback
  private void locationPermsCallback(PluginCall call) {
    if (getPermissionState("location") == PermissionState.GRANTED) {
      _initialize(call);
    } else {
      call.reject("Location permission is required.");
    }
  }

  private void _initialize(PluginCall call) {
    // turn on bluetooth
    BluetoothAdapter bluetooth = BluetoothAdapter.getDefaultAdapter();
    if (!bluetooth.isEnabled()) {
      bluetooth.enable();
    }

    // Check if stripe is initialized
    boolean isInitialized = Terminal.isInitialized();
    if (isInitialized) {
      JSObject ret = new JSObject();
      ret.put("isInitialized", true);

      call.resolve(ret);
      return;
    }

    pendingConnectionTokenCallback = null;
    cancelDiscoverReaders();
    cancelInstallUpdate();

    LogLevel logLevel = TerminalUtils.translateJSLogLevel(
      call.getInt("logLevel")
    );
    ConnectionTokenProvider tokenProvider = this;
    TerminalListener terminalListener = this;

    String err = "";
    try {
      Terminal.init(
        this.bridge.getContext(),
        logLevel,
        tokenProvider,
        terminalListener,
        null
      );
      lastReaderEvent = ReaderEvent.CARD_REMOVED;
      isInitialized = true;
    } catch (TerminalException e) {
      //      e.printStackTrace();
      err = e.getErrorMessage();
      isInitialized = false;
    } catch (IllegalStateException ex) {
      ex.printStackTrace();
      err = ex.getMessage();
      isInitialized = true;
    }

    JSObject ret = new JSObject();
    ret.put("isInitialized", isInitialized);

    if (!isInitialized) {
      ret.put("error", err);
      call.reject(err);
      return;
    }

    call.resolve(ret);
  }

  @PluginMethod
  public void setConnectionToken(PluginCall call) {
    String token = call.getString("token");
    String errorMessage = call.getString("errorMessage");

    if (pendingConnectionTokenCallback != null) {
      if (errorMessage != null && !errorMessage.trim().isEmpty()) {
        pendingConnectionTokenCallback.onFailure(
          new ConnectionTokenException(errorMessage)
        );
      } else if (token != null) {
        pendingConnectionTokenCallback.onSuccess(token);
      }

      call.resolve();
    }

    pendingConnectionTokenCallback = null;
  }

  @PluginMethod
  public void discoverReaders(final PluginCall call) {
    try {
      Boolean simulated = call.getBoolean("simulated", true);
      String locationId = call.getString("locationId", null);
      DiscoveryConfiguration discoveryConfiguration = TerminalUtils.translateDiscoveryMethod(
        call.getInt("discoveryMethod", 0),
        simulated,
        locationId
      );
      Callback statusCallback = new Callback() {
        @Override
        public void onSuccess() {
          pendingDiscoverReaders = null;
          call.resolve();
        }

        @Override
        public void onFailure(@NonNull TerminalException e) {
          pendingDiscoverReaders = null;
          call.reject(e.getErrorMessage(), e);
        }
      };

      // Attempt to cancel any pending discoverReader calls first.
      cancelDiscoverReaders();
      pendingDiscoverReaders =
        Terminal
          .getInstance()
          .discoverReaders(discoveryConfiguration, this, statusCallback);
    } catch (Exception e) {
      e.printStackTrace();

      if (e.getMessage() != null) {
        call.reject(e.getMessage(), e);
      }
    }
  }

  @PluginMethod
  public void cancelDiscoverReaders(final PluginCall call) {
    if (
      pendingDiscoverReaders != null && !pendingDiscoverReaders.isCompleted()
    ) {
      pendingDiscoverReaders.cancel(
        new Callback() {
          @Override
          public void onSuccess() {
            pendingDiscoverReaders = null;
            call.resolve();
          }

          @Override
          public void onFailure(@NonNull TerminalException e) {
            call.reject(e.getErrorMessage());
          }
        }
      );
    } else {
      call.resolve();
    }
  }

  public void cancelDiscoverReaders() {
    if (
      pendingDiscoverReaders != null && !pendingDiscoverReaders.isCompleted()
    ) {
      pendingDiscoverReaders.cancel(
        new Callback() {
          @Override
          public void onSuccess() {
            pendingDiscoverReaders = null;
          }

          @Override
          public void onFailure(@NonNull TerminalException e) {}
        }
      );
    }
  }

  private Reader getReaderFromDiscovered(PluginCall call) {
    String serialNumber = call.getString("serialNumber");

    if (serialNumber == null) {
      call.reject("Must provide a serial number");
      return null;
    }

    Reader selectedReader = null;
    if (discoveredReadersList != null && discoveredReadersList.size() > 0) {
      for (Reader reader : discoveredReadersList) {
        if (reader != null) {
          if (reader.getSerialNumber().equals(serialNumber)) {
            selectedReader = reader;
          }
        }
      }
    }

    if (selectedReader == null) {
      call.reject("No reader found");
    }

    return selectedReader;
  }

  private ReaderCallback createReaderCallback(final PluginCall call) {
    return new ReaderCallback() {
      @Override
      public void onSuccess(@NonNull Reader reader) {
        JSObject ret = new JSObject();
        ret.put(
          "reader",
          TerminalUtils.serializeReader(
            reader,
            lastBatteryLevel,
            lastBatteryStatus,
            lastIsCharging
          )
        );
        call.resolve(ret);
      }

      @Override
      public void onFailure(@NonNull TerminalException e) {
        call.reject(e.getErrorMessage(), e);
      }
    };
  }

  @PluginMethod
  public void connectInternetReader(final PluginCall call) {
    Reader reader = getReaderFromDiscovered(call);

    if (reader == null) {
      return;
    }

    Boolean failIfInUse = call.getBoolean("failIfInUse", false);
    // TODO: Add below when supported
    // Boolean allowCustomerCancel = call.getBoolean("allowCustomerCancel", false);

    InternetConnectionConfiguration connectionConfig = new InternetConnectionConfiguration(
      null,
      failIfInUse
    );

    Terminal
      .getInstance()
      .connectReader(reader, connectionConfig, this.createReaderCallback(call));
  }

  @PluginMethod
  public void connectBluetoothReader(final PluginCall call) {
    Reader reader = getReaderFromDiscovered(call);

    if (reader == null) {
      return;
    }

    String locationId = call.getString("locationId");

    if (locationId == null) {
      call.reject("Must provide a location ID");
      return;
    }

    Boolean autoReconnectOnUnexpectedDisconnect = call.getBoolean(
      "autoReconnectOnUnexpectedDisconnect",
      false
    );

    BluetoothConnectionConfiguration connectionConfig = new BluetoothConnectionConfiguration(
      locationId,
      autoReconnectOnUnexpectedDisconnect,
      this
    );

    Terminal
      .getInstance()
      .connectReader(reader, connectionConfig, this.createReaderCallback(call));
  }

  @PluginMethod
  public void connectUsbReader(final PluginCall call) {
    Reader reader = getReaderFromDiscovered(call);

    if (reader == null) {
      return;
    }

    String locationId = call.getString("locationId");

    if (locationId == null) {
      call.reject("Must provide a location ID");
      return;
    }

    UsbConnectionConfiguration connectionConfig = new UsbConnectionConfiguration(
      locationId,
      false,
      this
    );

    Terminal
      .getInstance()
      .connectReader(reader, connectionConfig, this.createReaderCallback(call));
  }

  @PluginMethod
  public void connectAppsOnDevicesReader(final PluginCall call) {
    Reader reader = getReaderFromDiscovered(call);

    if (reader == null) {
      return;
    }

    AppsOnDevicesConnectionConfiguration connectionConfig = new AppsOnDevicesConnectionConfiguration(
      this
    );

    Terminal
      .getInstance()
      .connectReader(reader, connectionConfig, this.createReaderCallback(call));
  }

  @PluginMethod
  public void connectTapToPayReader(final PluginCall call) {
    Reader reader = getReaderFromDiscovered(call);

    if (reader == null) {
      return;
    }

    String locationId = call.getString("locationId");

    if (locationId == null) {
      call.reject("Must provide a location ID");
      return;
    }

    TapToPayConnectionConfiguration connectionConfig = new TapToPayConnectionConfiguration(
      locationId,
      false,
      null
    );

    Terminal
      .getInstance()
      .connectReader(reader, connectionConfig, this.createReaderCallback(call));
  }

  @PluginMethod
  public void rebootReader(final PluginCall call) {
    Terminal.getInstance().rebootReader(
      new Callback() {
        @Override
        public void onSuccess() {
          call.resolve();
        }

        @Override
        public void onFailure(@NonNull TerminalException e) {
          call.reject(e.getErrorMessage(), e.getErrorCode().toString(), e);
        }
      }
    );
  }

  @PluginMethod
  public void getReaderSettings(final PluginCall call) {
    Terminal.getInstance().getReaderSettings(
      createReaderSettingsCallback(call)
    );
  }

  @PluginMethod
  public void setReaderSettings(final PluginCall call) {
    ReaderSettingsParameters.AccessibilityParameters params =
      new ReaderSettingsParameters.AccessibilityParameters(
        Boolean.TRUE.equals(call.getBoolean("textToSpeechViaSpeakers", false))
      );

    Terminal.getInstance().setReaderSettings(
      params,
      createReaderSettingsCallback(call)
    );
  }

  private ReaderSettingsCallback createReaderSettingsCallback(
    final PluginCall call
  ) {
    return new ReaderSettingsCallback() {
      @Override
      public void onSuccess(@NonNull ReaderSettings readerSettings) {
        call.resolve(TerminalUtils.serializeReaderSettings(readerSettings));
      }

      @Override
      public void onFailure(@NonNull TerminalException e) {
        call.reject(e.getErrorMessage(), e.getErrorCode().toString(), e);
      }
    };
  }

  @PluginMethod
  public void collectData(final PluginCall call) {
    CollectDataConfiguration.Builder builder =
      new CollectDataConfiguration.Builder().setType(
        TerminalUtils.translateJSCollectDataType(call.getString("type"))
      );

    String customerCancellation = call.getString("customerCancellation");
    if (customerCancellation != null) {
      builder.setCustomerCancellation(
        TerminalUtils.translateJSCustomerCancellation(customerCancellation)
      );
    }

    pendingCollectData = Terminal.getInstance().collectData(
      builder.build(),
      new CollectedDataCallback() {
        @Override
        public void onSuccess(@NonNull CollectedData collectedData) {
          pendingCollectData = null;

          JSObject ret = new JSObject();
          ret.put("data", TerminalUtils.serializeCollectedData(collectedData));
          call.resolve(ret);
        }

        @Override
        public void onFailure(@NonNull TerminalException e) {
          pendingCollectData = null;
          call.reject(e.getErrorMessage(), e.getErrorCode().toString(), e);
        }
      }
    );
  }

  @PluginMethod
  public void disconnectReader(final PluginCall call) {
    if (Terminal.getInstance().getConnectedReader() == null) {
      call.resolve();
    } else {
      Terminal
        .getInstance()
        .disconnectReader(
          new Callback() {
            @Override
            public void onSuccess() {
              call.resolve();
            }

            @Override
            public void onFailure(@NonNull TerminalException e) {
              call.reject(e.getErrorMessage(), e);
            }
          }
        );
    }
  }

  @PluginMethod
  public void getConnectedReader(PluginCall call) {
    Reader reader = Terminal.getInstance().getConnectedReader();
    JSObject ret = new JSObject();

    if (reader == null) {
      ret.put("reader", JSObject.NULL);
    } else {
      ret.put(
        "reader",
        TerminalUtils.serializeReader(
          reader,
          lastBatteryLevel,
          lastBatteryStatus,
          lastIsCharging
        )
      );
    }

    call.resolve(ret);
  }

  @PluginMethod
  public void getConnectionStatus(PluginCall call) {
    ConnectionStatus status = Terminal.getInstance().getConnectionStatus();

    JSObject ret = new JSObject();
    ret.put(
      "status",
      TerminalUtils.translateConnectionStatusToJS(status.ordinal())
    );
    ret.put("isAndroid", true);
    call.resolve(ret);
  }

  @PluginMethod
  public void getPaymentStatus(PluginCall call) {
    PaymentStatus status = Terminal.getInstance().getPaymentStatus();

    JSObject ret = new JSObject();
    ret.put(
      "status",
      TerminalUtils.translatePaymentStatusToJS(status.ordinal())
    );
    call.resolve(ret);
  }

  @PluginMethod
  public void retrievePaymentIntent(final PluginCall call) {
    String clientSecret = call.getString("clientSecret");

    if (clientSecret != null) {
      Terminal
        .getInstance()
        .retrievePaymentIntent(
          clientSecret,
          new PaymentIntentCallback() {
            @Override
            public void onSuccess(@NonNull PaymentIntent paymentIntent) {
              currentPaymentIntent = paymentIntent;
              JSObject ret = new JSObject();
              ret.put(
                "intent",
                TerminalUtils.serializePaymentIntent(paymentIntent, "")
              );
              call.resolve(ret);
            }

            @Override
            public void onFailure(@NonNull TerminalException e) {
              currentPaymentIntent = null;
              call.reject(e.getErrorMessage(), e);
            }
          }
        );
    } else {
      call.reject("Client secret cannot be null");
    }
  }

  @PluginMethod
  public void collectPaymentMethod(final PluginCall call) {
    Boolean updatePaymentIntent = call.getBoolean("updatePaymentIntent", false);

    CollectPaymentIntentConfiguration collectConfig = new CollectPaymentIntentConfiguration.Builder()
      .updatePaymentIntent(updatePaymentIntent)
      .build();

    if (currentPaymentIntent != null) {
      pendingCollectPaymentMethod =
        Terminal
          .getInstance()
          .collectPaymentMethod(
            currentPaymentIntent,
            new PaymentIntentCallback() {
              @Override
              public void onSuccess(@NonNull PaymentIntent paymentIntent) {
                pendingCollectPaymentMethod = null;
                currentPaymentIntent = paymentIntent;

                JSObject ret = new JSObject();
                ret.put(
                  "intent",
                  TerminalUtils.serializePaymentIntent(
                    paymentIntent,
                    lastCurrency
                  )
                );

                call.resolve(ret);
              }

              @Override
              public void onFailure(@NonNull TerminalException e) {
                pendingCollectPaymentMethod = null;
                call.reject(
                  e.getErrorMessage(),
                  e.getErrorCode().toString(),
                  e
                );
              }
            },
            collectConfig
          );
    } else {
      call.reject(
        "There is no active payment intent. Make sure you called retrievePaymentIntent first"
      );
    }
  }

  @PluginMethod
  public void cancelCollectPaymentMethod(final PluginCall call) {
    if (
      pendingCollectPaymentMethod != null &&
      !pendingCollectPaymentMethod.isCompleted()
    ) {
      pendingCollectPaymentMethod.cancel(
        new Callback() {
          @Override
          public void onSuccess() {
            pendingCollectPaymentMethod = null;
            call.resolve();
          }

          @Override
          public void onFailure(@NonNull TerminalException e) {
            call.reject(e.getErrorMessage());
          }
        }
      );
    } else {
      call.resolve();
    }
  }

  @PluginMethod
  public void confirmPaymentIntent(final PluginCall call) {
    if (currentPaymentIntent != null) {
      Terminal
        .getInstance()
        .confirmPaymentIntent(
          currentPaymentIntent,
          new PaymentIntentCallback() {
            @Override
            public void onSuccess(@NonNull PaymentIntent paymentIntent) {
              currentPaymentIntent = paymentIntent;

              JSObject ret = new JSObject();
              ret.put(
                "intent",
                TerminalUtils.serializePaymentIntent(
                  paymentIntent,
                  lastCurrency
                )
              );
              call.resolve(ret);
            }

            @Override
            public void onFailure(@NonNull TerminalException e) {
              JSObject data = new JSObject();

              PaymentIntent failedIntent = e.getPaymentIntent();
              if (failedIntent != null) {
                data.put(
                  "payment_intent",
                  TerminalUtils.serializePaymentIntent(failedIntent, lastCurrency)
                );
              }

              ApiError apiError = e.getApiError();
              if (apiError != null) {
                String declineCode = apiError.getDeclineCode();
                if (declineCode != null) {
                  data.put("decline_code", declineCode);
                }
              }

              call.reject(e.getErrorMessage(), e.getErrorCode().toString(), e, data);
            }
          }
        );
    } else {
      call.reject(
        "There is no active payment intent. Make sure you called retrievePaymentIntent first"
      );
    }
  }

  @PluginMethod
  public void createPaymentIntent(final PluginCall call) {
    Integer amount = call.getInt("amount");
    String currency = call.getString("currency");

    if (amount == null || currency == null) {
      call.reject("Must provide an amount and a currency");
      return;
    }

    try {
      PaymentIntentParameters.Builder builder =
        new PaymentIntentParameters.Builder(
          TerminalUtils.translateJSPaymentMethodTypes(
            call.getArray("paymentMethodTypes")
          )
        )
          .setAmount(amount)
          .setCurrency(currency);

      String captureMethod = call.getString("captureMethod");
      if (captureMethod != null) {
        builder.setCaptureMethod(
          "manual".equals(captureMethod)
            ? CaptureMethod.Manual
            : CaptureMethod.Automatic
        );
      }

      if (
        call.getString("setupFutureUsage") != null
      ) builder.setSetupFutureUsage(call.getString("setupFutureUsage"));
      if (call.getString("onBehalfOf") != null) builder.setOnBehalfOf(
        call.getString("onBehalfOf")
      );
      if (
        call.getString("transferDataDestination") != null
      ) builder.setTransferDataDestination(
        call.getString("transferDataDestination")
      );
      if (call.getString("transferGroup") != null) builder.setTransferGroup(
        call.getString("transferGroup")
      );
      if (
        call.getInt("applicationFeeAmount") != null
      ) builder.setApplicationFeeAmount(
        call.getInt("applicationFeeAmount").longValue()
      );
      if (call.getString("description") != null) builder.setDescription(
        call.getString("description")
      );
      if (
        call.getString("statementDescriptor") != null
      ) builder.setStatementDescriptor(call.getString("statementDescriptor"));
      if (
        call.getString("statementDescriptorSuffix") != null
      ) builder.setStatementDescriptorSuffix(
        call.getString("statementDescriptorSuffix")
      );
      if (call.getString("receiptEmail") != null) builder.setReceiptEmail(
        call.getString("receiptEmail")
      );
      if (call.getString("customer") != null) builder.setCustomer(
        call.getString("customer")
      );

      Map<String, String> metadata = TerminalUtils.readMetadata(
        call.getObject("metadata")
      );
      if (metadata != null) builder.setMetadata(metadata);

      Terminal.getInstance().createPaymentIntent(
        builder.build(),
        createPaymentIntentCallback(call)
      );
    } catch (JSONException e) {
      call.reject("Unable to read payment intent parameters", e);
    }
  }

  @PluginMethod
  public void cancelPaymentIntent(final PluginCall call) {
    if (currentPaymentIntent == null) {
      call.reject(
        "There is no active payment intent. Make sure you called retrievePaymentIntent or createPaymentIntent first"
      );
      return;
    }

    Terminal.getInstance().cancelPaymentIntent(
      currentPaymentIntent,
      new PaymentIntentCallback() {
        @Override
        public void onSuccess(@NonNull PaymentIntent paymentIntent) {
          currentPaymentIntent = null;

          JSObject ret = new JSObject();
          ret.put(
            "intent",
            TerminalUtils.serializePaymentIntent(paymentIntent, lastCurrency)
          );
          call.resolve(ret);
        }

        @Override
        public void onFailure(@NonNull TerminalException e) {
          call.reject(e.getErrorMessage(), e.getErrorCode().toString(), e);
        }
      }
    );
  }

  private PaymentIntentCallback createPaymentIntentCallback(
    final PluginCall call
  ) {
    return new PaymentIntentCallback() {
      @Override
      public void onSuccess(@NonNull PaymentIntent paymentIntent) {
        currentPaymentIntent = paymentIntent;
        lastCurrency = paymentIntent.getCurrency();

        JSObject ret = new JSObject();
        ret.put(
          "intent",
          TerminalUtils.serializePaymentIntent(paymentIntent, lastCurrency)
        );
        call.resolve(ret);
      }

      @Override
      public void onFailure(@NonNull TerminalException e) {
        call.reject(e.getErrorMessage(), e.getErrorCode().toString(), e);
      }
    };
  }

  @PluginMethod
  public void createSetupIntent(final PluginCall call) {
    try {
      SetupIntentParameters.Builder builder =
        new SetupIntentParameters.Builder();

      JSArray paymentMethodTypes = call.getArray("paymentMethodTypes");
      if (paymentMethodTypes != null) {
        builder.setPaymentMethodTypes(
          TerminalUtils.translateJSPaymentMethodTypes(paymentMethodTypes)
        );
      }

      if (call.getString("customer") != null) builder.setCustomer(
        call.getString("customer")
      );
      if (call.getString("description") != null) builder.setDescription(
        call.getString("description")
      );
      if (call.getString("onBehalfOf") != null) builder.setOnBehalfOf(
        call.getString("onBehalfOf")
      );

      String usage = call.getString("usage");
      if (usage != null) builder.setUsage(
        "offSession".equals(usage) ? "off_session" : "on_session"
      );

      Map<String, String> metadata = TerminalUtils.readMetadata(
        call.getObject("metadata")
      );
      if (metadata != null) builder.setMetadata(metadata);

      Terminal.getInstance().createSetupIntent(
        builder.build(),
        createSetupIntentCallback(call)
      );
    } catch (JSONException e) {
      call.reject("Unable to read setup intent parameters", e);
    }
  }

  @PluginMethod
  public void retrieveSetupIntent(final PluginCall call) {
    String clientSecret = call.getString("clientSecret");

    if (clientSecret == null) {
      call.reject("Client secret cannot be null");
      return;
    }

    Terminal.getInstance().retrieveSetupIntent(
      clientSecret,
      createSetupIntentCallback(call)
    );
  }

  @PluginMethod
  public void collectSetupIntentPaymentMethod(final PluginCall call) {
    if (currentSetupIntent == null) {
      call.reject(
        "There is no active setup intent. Make sure you called retrieveSetupIntent or createSetupIntent first"
      );
      return;
    }

    CollectSetupIntentConfiguration.Builder configBuilder =
      new CollectSetupIntentConfiguration.Builder();

    String customerCancellation = call.getString("customerCancellation");
    if (customerCancellation != null) {
      configBuilder.setCustomerCancellation(
        TerminalUtils.translateJSCustomerCancellation(customerCancellation)
      );
    }

    String collectionReason = call.getString("collectionReason");
    if ("saveCard".equals(collectionReason)) {
      configBuilder.setCollectionReason(
        CollectSetupIntentConfiguration.CollectionReason.SAVE_CARD
      );
    } else if ("verify".equals(collectionReason)) {
      configBuilder.setCollectionReason(
        CollectSetupIntentConfiguration.CollectionReason.VERIFY
      );
    }

    pendingCollectSetupIntentPaymentMethod =
      Terminal.getInstance().collectSetupIntentPaymentMethod(
        currentSetupIntent,
        TerminalUtils.translateJSAllowRedisplay(
          call.getString("allowRedisplay")
        ),
        configBuilder.build(),
        new SetupIntentCallback() {
          @Override
          public void onSuccess(@NonNull SetupIntent setupIntent) {
            pendingCollectSetupIntentPaymentMethod = null;
            currentSetupIntent = setupIntent;

            JSObject ret = new JSObject();
            ret.put("intent", TerminalUtils.serializeSetupIntent(setupIntent));
            call.resolve(ret);
          }

          @Override
          public void onFailure(@NonNull TerminalException e) {
            pendingCollectSetupIntentPaymentMethod = null;
            call.reject(e.getErrorMessage(), e.getErrorCode().toString(), e);
          }
        }
      );
  }

  @PluginMethod
  public void cancelCollectSetupIntentPaymentMethod(final PluginCall call) {
    cancelPending(pendingCollectSetupIntentPaymentMethod, call);
    pendingCollectSetupIntentPaymentMethod = null;
  }

  @PluginMethod
  public void confirmSetupIntent(final PluginCall call) {
    if (currentSetupIntent == null) {
      call.reject(
        "There is no active setup intent. Make sure you called retrieveSetupIntent or createSetupIntent first"
      );
      return;
    }

    Terminal.getInstance().confirmSetupIntent(
      currentSetupIntent,
      createSetupIntentCallback(call)
    );
  }

  @PluginMethod
  public void cancelSetupIntent(final PluginCall call) {
    if (currentSetupIntent == null) {
      call.reject(
        "There is no active setup intent. Make sure you called retrieveSetupIntent or createSetupIntent first"
      );
      return;
    }

    Terminal.getInstance().cancelSetupIntent(
      currentSetupIntent,
      new SetupIntentCancellationParameters.Builder().build(),
      new SetupIntentCallback() {
        @Override
        public void onSuccess(@NonNull SetupIntent setupIntent) {
          currentSetupIntent = null;

          JSObject ret = new JSObject();
          ret.put("intent", TerminalUtils.serializeSetupIntent(setupIntent));
          call.resolve(ret);
        }

        @Override
        public void onFailure(@NonNull TerminalException e) {
          call.reject(e.getErrorMessage(), e.getErrorCode().toString(), e);
        }
      }
    );
  }

  private SetupIntentCallback createSetupIntentCallback(final PluginCall call) {
    return new SetupIntentCallback() {
      @Override
      public void onSuccess(@NonNull SetupIntent setupIntent) {
        currentSetupIntent = setupIntent;

        JSObject ret = new JSObject();
        ret.put("intent", TerminalUtils.serializeSetupIntent(setupIntent));
        call.resolve(ret);
      }

      @Override
      public void onFailure(@NonNull TerminalException e) {
        call.reject(e.getErrorMessage(), e.getErrorCode().toString(), e);
      }
    };
  }

  @PluginMethod
  public void collectRefundPaymentMethod(final PluginCall call) {
    Integer amount = call.getInt("amount");
    String currency = call.getString("currency");

    if (amount == null || currency == null) {
      call.reject("Must provide an amount and a currency");
      return;
    }

    String chargeId = call.getString("chargeId");
    String paymentIntentId = call.getString("paymentIntentId");
    String clientSecret = call.getString("clientSecret");

    Map<String, String> metadata = TerminalUtils.readMetadata(
      call.getObject("metadata")
    );
    boolean reverseTransfer = Boolean.TRUE.equals(
      call.getBoolean("reverseTransfer", false)
    );
    boolean refundApplicationFee = Boolean.TRUE.equals(
      call.getBoolean("refundApplicationFee", false)
    );

    // The fluent setters on RefundParameters.Builder are ambiguous with the property
    // setters, so configure the concrete builder types directly.
    RefundParameters refundParameters;
    if (chargeId != null) {
      RefundParameters.ByChargeId refundBuilder =
        new RefundParameters.ByChargeId(chargeId, amount, currency);
      refundBuilder.setReverseTransfer(reverseTransfer);
      refundBuilder.setRefundApplicationFee(refundApplicationFee);
      if (metadata != null) refundBuilder.setMetadata(metadata);
      refundParameters = refundBuilder.build();
    } else if (paymentIntentId != null && clientSecret != null) {
      RefundParameters.ByPaymentIntentId refundBuilder =
        new RefundParameters.ByPaymentIntentId(
          paymentIntentId,
          clientSecret,
          amount,
          currency
        );
      refundBuilder.setReverseTransfer(reverseTransfer);
      refundBuilder.setRefundApplicationFee(refundApplicationFee);
      if (metadata != null) refundBuilder.setMetadata(metadata);
      refundParameters = refundBuilder.build();
    } else {
      call.reject(
        "Must provide either a chargeId, or a paymentIntentId together with its clientSecret"
      );
      return;
    }

    CollectRefundConfiguration.Builder configBuilder =
      new CollectRefundConfiguration.Builder();
    String customerCancellation = call.getString("customerCancellation");
    if (customerCancellation != null) {
      configBuilder.setCustomerCancellation(
        TerminalUtils.translateJSCustomerCancellation(customerCancellation)
      );
    }

    pendingCollectRefundPaymentMethod =
      Terminal.getInstance().collectRefundPaymentMethod(
        refundParameters,
        configBuilder.build(),
        new Callback() {
          @Override
          public void onSuccess() {
            pendingCollectRefundPaymentMethod = null;
            call.resolve();
          }

          @Override
          public void onFailure(@NonNull TerminalException e) {
            pendingCollectRefundPaymentMethod = null;
            call.reject(e.getErrorMessage(), e.getErrorCode().toString(), e);
          }
        }
      );
  }

  @PluginMethod
  public void cancelCollectRefundPaymentMethod(final PluginCall call) {
    cancelPending(pendingCollectRefundPaymentMethod, call);
    pendingCollectRefundPaymentMethod = null;
  }

  @PluginMethod
  public void confirmRefund(final PluginCall call) {
    Terminal.getInstance().confirmRefund(
      new RefundCallback() {
        @Override
        public void onSuccess(@NonNull Refund refund) {
          JSObject ret = new JSObject();
          ret.put("refund", TerminalUtils.serializeRefund(refund));
          call.resolve(ret);
        }

        @Override
        public void onFailure(@NonNull TerminalException e) {
          call.reject(e.getErrorMessage(), e.getErrorCode().toString(), e);
        }
      }
    );
  }

  @PluginMethod
  public void collectInputs(final PluginCall call) {
    CollectInputsParameters params;
    try {
      params = TerminalUtils.buildCollectInputsParameters(
        call.getArray("inputs")
      );
    } catch (JSONException e) {
      call.reject("Unable to read collect inputs parameters", e);
      return;
    }

    pendingCollectInputs = Terminal.getInstance().collectInputs(
      params,
      new CollectInputsResultCallback() {
        @Override
        public void onSuccess(
          @NonNull List<? extends CollectInputsResult> results
        ) {
          pendingCollectInputs = null;

          JSArray serialized = new JSArray();
          for (CollectInputsResult result : results) {
            serialized.put(TerminalUtils.serializeCollectInputsResult(result));
          }

          JSObject ret = new JSObject();
          ret.put("collectInputResults", serialized);
          call.resolve(ret);
        }

        @Override
        public void onFailure(@NonNull TerminalException e) {
          pendingCollectInputs = null;
          call.reject(e.getErrorMessage(), e.getErrorCode().toString(), e);
        }
      }
    );
  }

  @PluginMethod
  public void cancelCollectInputs(final PluginCall call) {
    cancelPending(pendingCollectInputs, call);
    pendingCollectInputs = null;
  }

  private void cancelPending(Cancelable cancelable, final PluginCall call) {
    if (cancelable == null || cancelable.isCompleted()) {
      call.resolve();
      return;
    }

    cancelable.cancel(
      new Callback() {
        @Override
        public void onSuccess() {
          call.resolve();
        }

        @Override
        public void onFailure(@NonNull TerminalException e) {
          call.reject(e.getErrorMessage(), e.getErrorCode().toString(), e);
        }
      }
    );
  }

  @PluginMethod
  public void clearCachedCredentials(@NonNull PluginCall call) {
    Terminal.getInstance().clearCachedCredentials();
    call.resolve();
  }

  @PluginMethod
  public void installAvailableUpdate(final PluginCall call) {
    if (currentUpdate != null) {
      Terminal.getInstance().installAvailableUpdate();
      call.resolve();
    }
  }

  @PluginMethod
  public void cancelInstallUpdate(final PluginCall call) {
    if (pendingInstallUpdate != null && !pendingInstallUpdate.isCompleted()) {
      pendingInstallUpdate.cancel(
        new Callback() {
          @Override
          public void onSuccess() {
            pendingInstallUpdate = null;
            call.resolve();
          }

          @Override
          public void onFailure(@NonNull TerminalException e) {
            call.reject(e.getErrorMessage(), e);
          }
        }
      );
    } else {
      call.resolve();
    }
  }

  public void cancelInstallUpdate() {
    if (pendingInstallUpdate != null && !pendingInstallUpdate.isCompleted()) {
      pendingInstallUpdate.cancel(
        new Callback() {
          @Override
          public void onSuccess() {
            pendingInstallUpdate = null;
          }

          @Override
          public void onFailure(@NonNull TerminalException e) {}
        }
      );
    }
  }

  @PluginMethod
  public void setReaderDisplay(@NonNull final PluginCall call) {
    JSArray lineItems = call.getArray("lineItems");
    String currency = call.getString("currency", "usd");
    int tax = call.getInt("tax", 0);
    int total = call.getInt("total", 0);

    List<JSONObject> lineItemsList;
    try {
      lineItemsList = lineItems.toList();
    } catch (JSONException e) {
      e.printStackTrace();
      call.reject(e.getLocalizedMessage(), null, e);
      return;
    }

    List<CartLineItem> lineItemsArr = new ArrayList();
    for (JSONObject item : lineItemsList) {
      if (item != null) {
        try {
          JSObject obj = JSObject.fromJSONObject(item);
          String displayName = obj.getString("displayName");
          Integer quantity = obj.getInteger("quantity");
          Integer amount = obj.getInteger("amount");

          CartLineItem li = new CartLineItem(displayName, quantity, amount);
          lineItemsArr.add(li);
        } catch (JSONException e) {
          e.printStackTrace();
          call.reject(e.getLocalizedMessage(), null, e);
          return;
        }
      }
    }

    Cart cart = new Cart(currency, tax, total, lineItemsArr);

    Terminal
      .getInstance()
      .setReaderDisplay(
        cart,
        new Callback() {
          @Override
          public void onSuccess() {
            call.resolve();
          }

          @Override
          public void onFailure(@NonNull TerminalException e) {
            call.reject(e.getErrorMessage(), e.getErrorCode().toString(), e);
          }
        }
      );
  }

  @PluginMethod
  public void clearReaderDisplay(final PluginCall call) {
    Terminal
      .getInstance()
      .clearReaderDisplay(
        new Callback() {
          @Override
          public void onSuccess() {
            call.resolve();
          }

          @Override
          public void onFailure(@NonNull TerminalException e) {
            call.reject(e.getErrorMessage(), e.getErrorCode().toString(), e);
          }
        }
      );
  }

  @PluginMethod
  public void listLocations(@NonNull final PluginCall call) {
    Integer limit = call.getInt("limit");
    String endingBefore = call.getString("endingBefore");
    String startingAfter = call.getString("startingAfter");

    ListLocationsParameters params = new ListLocationsParameters();

    if (limit != null || endingBefore != null || startingAfter != null) {
      params = new ListLocationsParameters(limit, endingBefore, startingAfter);
    }

    Terminal
      .getInstance()
      .listLocations(
        params,
        new LocationListCallback() {
          @Override
          public void onSuccess(@NonNull List<Location> list, boolean hasMore) {
            JSObject object = new JSObject();
            JSArray locationsArray = new JSArray();
            for (Location location : list) {
              if (location != null) {
                locationsArray.put(TerminalUtils.serializeLocation(location));
              }
            }

            object.put("hasMore", hasMore);
            object.put("locations", locationsArray);

            call.resolve(object);
          }

          @Override
          public void onFailure(@NonNull TerminalException e) {
            call.reject(e.getErrorMessage(), e.getErrorCode().toString(), e);
          }
        }
      );
  }

  @PluginMethod
  public void getSimulatorConfiguration(@NonNull final PluginCall call) {
    SimulatorConfiguration config = Terminal
      .getInstance()
      .getSimulatorConfiguration();
    JSObject serialized = TerminalUtils.serializeSimulatorConfiguration(config);

    call.resolve(serialized);
  }

  @PluginMethod
  public void setSimulatorConfiguration(@NonNull final PluginCall call) {
    Integer availableReaderUpdateInt = call.getInt("availableReaderUpdate");
    Integer simulatedCardInt = call.getInt("simulatedCard");

    SimulatorConfiguration currentConfig = Terminal
      .getInstance()
      .getSimulatorConfiguration();

    SimulateReaderUpdate availableReaderUpdate = currentConfig.getUpdate();
    SimulatedCard simulatedCard = currentConfig.getSimulatedCard();

    if (availableReaderUpdateInt != null) {
      availableReaderUpdate =
        SimulateReaderUpdate.values()[availableReaderUpdateInt];
    }

    if (simulatedCardInt != null) {
      SimulatedCardType type = SimulatedCardType.values()[simulatedCardInt];
      simulatedCard = new SimulatedCard(type);
    }

    SimulatorConfiguration newConfig = new SimulatorConfiguration(
      availableReaderUpdate,
      simulatedCard,
      null,
      false,
      new SimulatedCollectInputsResult.SimulatedCollectInputsResultSucceeded(
        SimulatedCollectInputsSkipBehavior.NONE
      )
    );

    Terminal.getInstance().setSimulatorConfiguration(newConfig);

    getSimulatorConfiguration(call);
  }

  @PluginMethod
  public void cancelAutoReconnect(final PluginCall call) {
    if (
      pendingReaderAutoReconnect != null &&
      !pendingReaderAutoReconnect.isCompleted()
    ) {
      pendingReaderAutoReconnect.cancel(
        new Callback() {
          @Override
          public void onSuccess() {
            pendingReaderAutoReconnect = null;
            call.resolve();
          }

          @Override
          public void onFailure(@NonNull TerminalException e) {
            call.reject(e.getErrorMessage(), e);
          }
        }
      );
    } else {
      call.resolve();
    }
  }

  @PluginMethod
  public void supportsReadersOfType(final PluginCall call) {
    Integer deviceTypeInt = call.getInt("deviceType");
    Integer discoveryMethodInt = call.getInt("discoveryMethod", 0);
    Boolean simulated = call.getBoolean("simulated", false);

    if (deviceTypeInt == null) {
      JSObject result = new JSObject();
      result.put("isSupported", false);
      result.put("error", "Must provide a device type");
      call.resolve(result);
      return;
    }

    DeviceType deviceType = TerminalUtils.translateJSDeviceType(deviceTypeInt);
    if (deviceType == null) {
      JSObject result = new JSObject();
      result.put("isSupported", false);
      result.put("error", "Invalid device type: " + deviceTypeInt);
      call.resolve(result);
      return;
    }

    DiscoveryConfiguration discoveryConfiguration = TerminalUtils.translateDiscoveryMethod(
      discoveryMethodInt,
      simulated != null ? simulated : false,
      null
    );

    ReaderSupportResult readerSupportResult = Terminal.getInstance().supportsReadersOfType(
      deviceType,
      discoveryConfiguration
    );

    JSObject result = new JSObject();
    result.put("isSupported", readerSupportResult.isSupported());
    Throwable error = readerSupportResult.getError();
    if (error != null) {
      result.put("error", error.getMessage());
    }
    call.resolve(result);
  }

  @Override
  public void fetchConnectionToken(
    @NonNull ConnectionTokenCallback connectionTokenCallback
  ) {
    pendingConnectionTokenCallback = connectionTokenCallback;

    JSObject ret = new JSObject();
    notifyListeners("requestConnectionToken", ret);
  }

  @Override
  public void onConnectionStatusChange(
    @NonNull ConnectionStatus connectionStatus
  ) {
    JSObject ret = new JSObject();
    ret.put(
      "status",
      TerminalUtils.translateConnectionStatusToJS(connectionStatus.ordinal())
    );
    ret.put("isAndroid", true);
    notifyListeners("didChangeConnectionStatus", ret);
  }

  @Override
  public void onPaymentStatusChange(@NonNull PaymentStatus paymentStatus) {
    JSObject ret = new JSObject();
    ret.put("status", paymentStatus.ordinal());

    notifyListeners("didChangePaymentStatus", ret);
  }

  @Override
  public void onReportLowBatteryWarning() {
    notifyListeners("didReportLowBatteryWarning", new JSObject());
  }

  @Override
  public void onReportReaderEvent(@NonNull ReaderEvent readerEvent) {
    lastReaderEvent = readerEvent;
    JSObject ret = new JSObject();
    ret.put("event", readerEvent.ordinal());
    notifyListeners("didReportReaderEvent", ret);
  }

  @Override
  public void onDisconnect(@NonNull DisconnectReason reason) {
    lastBatteryLevel = null;
    lastBatteryStatus = null;
    lastIsCharging = null;
    notifyListeners("didReportUnexpectedReaderDisconnect", new JSObject());
  }

  @Override
  public void onUpdateDiscoveredReaders(@NonNull List<Reader> list) {
    discoveredReadersList = list;

    JSArray readersDiscoveredArr = new JSArray();
    for (Reader reader : list) {
      if (reader != null) {
        readersDiscoveredArr.put(TerminalUtils.serializeReader(reader));
      }
    }

    JSObject ret = new JSObject();
    ret.put("readers", readersDiscoveredArr);
    ret.put("platform", "android");

    notifyListeners("readersDiscovered", ret);
  }

  @Override
  public void onRequestReaderDisplayMessage(
    @NonNull ReaderDisplayMessage readerDisplayMessage
  ) {
    JSObject ret = new JSObject();
    ret.put(
      "value",
      TerminalUtils.translateReaderDisplayMessageToJS(
        readerDisplayMessage.ordinal()
      )
    );
    ret.put("text", readerDisplayMessage.toString());

    notifyListeners("didRequestReaderDisplayMessage", ret);
  }

  @Override
  public void onRequestReaderInput(
    @NonNull ReaderInputOptions readerInputOptions
  ) {
    JSObject ret = new JSObject();
    ret.put("value", readerInputOptions.toString());
    ret.put("isAndroid", true);

    notifyListeners("didRequestReaderInput", ret);
  }

  @Override
  public void onReportReaderSoftwareUpdateProgress(float v) {
    JSObject ret = new JSObject();
    ret.put("progress", v);

    notifyListeners("didReportReaderSoftwareUpdateProgress", ret);
  }

  @Override
  public void onFinishInstallingUpdate(
    ReaderSoftwareUpdate readerSoftwareUpdate,
    TerminalException e
  ) {
    JSObject ret = new JSObject();
    if (e != null) {
      ret.put("error", e.getErrorMessage());
    } else if (readerSoftwareUpdate != null) {
      ret.put("update", TerminalUtils.serializeUpdate(readerSoftwareUpdate));
      currentUpdate = null;
      pendingInstallUpdate = null;
    }
    notifyListeners("didFinishInstallingUpdate", ret);
  }

  @Override
  public void onReportAvailableUpdate(
    @NonNull ReaderSoftwareUpdate readerSoftwareUpdate
  ) {
    currentUpdate = readerSoftwareUpdate;

    JSObject ret = new JSObject();
    ret.put("update", TerminalUtils.serializeUpdate(readerSoftwareUpdate));
    notifyListeners("didReportAvailableUpdate", ret);
  }

  @Override
  public void onBatteryLevelUpdate(
    float batteryLevel,
    @NonNull BatteryStatus batteryStatus,
    boolean isCharging
  ) {
    // Reader.batteryStatus is always UNKNOWN on Android, so cache what the reader reports here.
    lastBatteryLevel = batteryLevel;
    lastBatteryStatus = batteryStatus;
    lastIsCharging = isCharging;

    JSObject ret = new JSObject();
    ret.put("batteryLevel", batteryLevel);
    ret.put("batteryStatus", batteryStatus.ordinal());
    ret.put("isCharging", isCharging);

    notifyListeners("didUpdateBatteryLevel", ret);
    notifyListeners("didReportBatteryLevel", ret);
  }

  @Override
  public void onStartInstallingUpdate(
    @NonNull ReaderSoftwareUpdate readerSoftwareUpdate,
    Cancelable cancelable
  ) {
    pendingInstallUpdate = cancelable;
    currentUpdate = readerSoftwareUpdate;

    JSObject ret = new JSObject();
    ret.put("update", TerminalUtils.serializeUpdate(readerSoftwareUpdate));
    notifyListeners("didStartInstallingUpdate", ret);
  }

  @Override
  public void onReaderReconnectStarted(
    @NonNull Reader reader,
    @NonNull Cancelable cancelReconnect,
    @NonNull DisconnectReason reason
  ) {
    pendingReaderAutoReconnect = cancelReconnect;
    notifyListeners("didStartReaderReconnect", null);
  }

  @Override
  public void onReaderReconnectSucceeded(@NonNull Reader reader) {
    pendingReaderAutoReconnect = null;
    notifyListeners("didSucceedReaderReconnect", null);
  }

  @Override
  public void onReaderReconnectFailed(@NonNull Reader reader) {
    pendingReaderAutoReconnect = null;
    notifyListeners("didFailReaderReconnect", null);
  }
}
