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
import com.stripe.stripeterminal.external.callable.BluetoothReaderListener;
import com.stripe.stripeterminal.external.callable.BluetoothReaderReconnectionListener;
import com.stripe.stripeterminal.external.callable.Callback;
import com.stripe.stripeterminal.external.callable.Cancelable;
import com.stripe.stripeterminal.external.callable.ConnectionTokenCallback;
import com.stripe.stripeterminal.external.callable.ConnectionTokenProvider;
import com.stripe.stripeterminal.external.callable.DiscoveryListener;
import com.stripe.stripeterminal.external.callable.HandoffReaderListener;
import com.stripe.stripeterminal.external.callable.LocationListCallback;
import com.stripe.stripeterminal.external.callable.PaymentIntentCallback;
import com.stripe.stripeterminal.external.callable.ReaderCallback;
import com.stripe.stripeterminal.external.callable.TerminalListener;
import com.stripe.stripeterminal.external.callable.UsbReaderListener;
import com.stripe.stripeterminal.external.models.BatteryStatus;
import com.stripe.stripeterminal.external.models.Cart;
import com.stripe.stripeterminal.external.models.CartLineItem;
import com.stripe.stripeterminal.external.models.CollectConfiguration;
import com.stripe.stripeterminal.external.models.ConnectionConfiguration.BluetoothConnectionConfiguration;
import com.stripe.stripeterminal.external.models.ConnectionConfiguration.HandoffConnectionConfiguration;
import com.stripe.stripeterminal.external.models.ConnectionConfiguration.InternetConnectionConfiguration;
import com.stripe.stripeterminal.external.models.ConnectionConfiguration.LocalMobileConnectionConfiguration;
import com.stripe.stripeterminal.external.models.ConnectionConfiguration.UsbConnectionConfiguration;
import com.stripe.stripeterminal.external.models.ConnectionStatus;
import com.stripe.stripeterminal.external.models.ConnectionTokenException;
import com.stripe.stripeterminal.external.models.DiscoveryConfiguration;
import com.stripe.stripeterminal.external.models.DiscoveryMethod;
import com.stripe.stripeterminal.external.models.ListLocationsParameters;
import com.stripe.stripeterminal.external.models.Location;
import com.stripe.stripeterminal.external.models.PaymentIntent;
import com.stripe.stripeterminal.external.models.PaymentStatus;
import com.stripe.stripeterminal.external.models.Reader;
import com.stripe.stripeterminal.external.models.ReaderDisplayMessage;
import com.stripe.stripeterminal.external.models.ReaderEvent;
import com.stripe.stripeterminal.external.models.ReaderInputOptions;
import com.stripe.stripeterminal.external.models.ReaderSoftwareUpdate;
import com.stripe.stripeterminal.external.models.SimulateReaderUpdate;
import com.stripe.stripeterminal.external.models.SimulatedCard;
import com.stripe.stripeterminal.external.models.SimulatedCardType;
import com.stripe.stripeterminal.external.models.SimulatorConfiguration;
import com.stripe.stripeterminal.external.models.TerminalException;
import com.stripe.stripeterminal.log.LogLevel;
import java.util.ArrayList;
import java.util.List;
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
    UsbReaderListener,
    HandoffReaderListener,
    BluetoothReaderListener,
    BluetoothReaderReconnectionListener {

  Cancelable pendingDiscoverReaders = null;
  Cancelable pendingCollectPaymentMethod = null;
  ConnectionTokenCallback pendingConnectionTokenCallback = null;
  String lastCurrency = null;

  ReaderSoftwareUpdate currentUpdate = null;
  PaymentIntent currentPaymentIntent = null;
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

    LogLevel logLevel = LogLevel.VERBOSE;
    ConnectionTokenProvider tokenProvider = this;
    TerminalListener terminalListener = this;

    String err = "";
    try {
      Terminal.initTerminal(
        this.bridge.getActivity(),
        logLevel,
        tokenProvider,
        terminalListener
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
      DiscoveryMethod discoveryMethod = TerminalUtils.translateDiscoveryMethod(
        call.getInt("discoveryMethod", 0)
      );

      DiscoveryConfiguration discoveryConfiguration = new DiscoveryConfiguration(
        0,
        discoveryMethod,
        simulated
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
        ret.put("reader", TerminalUtils.serializeReader(reader));
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
      failIfInUse
    );

    Terminal
      .getInstance()
      .connectInternetReader(
        reader,
        connectionConfig,
        this.createReaderCallback(call)
      );
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
      .connectBluetoothReader(
        reader,
        connectionConfig,
        this,
        this.createReaderCallback(call)
      );
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
      locationId
    );

    Terminal
      .getInstance()
      .connectUsbReader(
        reader,
        connectionConfig,
        this,
        this.createReaderCallback(call)
      );
  }

  @PluginMethod
  public void connectLocalMobileReader(final PluginCall call) {
    Reader reader = getReaderFromDiscovered(call);

    if (reader == null) {
      return;
    }

    String locationId = call.getString("locationId");

    if (locationId == null) {
      call.reject("Must provide a location ID");
      return;
    }

    LocalMobileConnectionConfiguration connectionConfig = new LocalMobileConnectionConfiguration(
      locationId
    );

    Terminal
      .getInstance()
      .connectLocalMobileReader(
        reader,
        connectionConfig,
        this.createReaderCallback(call)
      );
  }

  @PluginMethod
  public void connectHandoffReader(final PluginCall call) {
    Reader reader = getReaderFromDiscovered(call);

    if (reader == null) {
      return;
    }

    String locationId = call.getString("locationId");

    if (locationId == null) {
      call.reject("Must provide a location ID");
      return;
    }

    HandoffConnectionConfiguration connectionConfig = new HandoffConnectionConfiguration(
      locationId
    );

    Terminal
      .getInstance()
      .connectHandoffReader(
        reader,
        connectionConfig,
        this,
        this.createReaderCallback(call)
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
      ret.put("reader", TerminalUtils.serializeReader(reader));
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

    CollectConfiguration collectConfig = new CollectConfiguration.Builder()
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
  public void processPayment(final PluginCall call) {
    if (currentPaymentIntent != null) {
      Terminal
        .getInstance()
        .processPayment(
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
              call.reject(e.getErrorMessage(), e.getErrorCode().toString(), e);
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
      null
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
  public void onUnexpectedReaderDisconnect(@NonNull Reader reader) {
    JSObject ret = new JSObject();
    ret.put("reader", TerminalUtils.serializeReader(reader));
    notifyListeners("didReportUnexpectedReaderDisconnect", ret);
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
    JSObject ret = new JSObject();
    ret.put("batteryLevel", batteryLevel);
    ret.put("batteryStatus", batteryStatus.ordinal());
    ret.put("isCharging", isCharging);

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
  public void onReaderReconnectStarted(@NonNull Cancelable cancelReconnect) {
    pendingReaderAutoReconnect = cancelReconnect;
    notifyListeners("didStartReaderReconnect", null);
  }

  @Override
  public void onReaderReconnectSucceeded() {
    pendingReaderAutoReconnect = null;
    notifyListeners("didSucceedReaderReconnect", null);
  }

  @Override
  public void onReaderReconnectFailed(@NonNull Reader reader) {
    pendingReaderAutoReconnect = null;
    notifyListeners("didFailReaderReconnect", null);
  }
}
