package io.event1.capacitorstripeterminal;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.stripe.stripeterminal.external.models.Address;
import com.stripe.stripeterminal.external.models.AllowRedisplay;
import com.stripe.stripeterminal.external.models.AmountDetails;
import com.stripe.stripeterminal.external.models.BatteryStatus;
import com.stripe.stripeterminal.external.models.CardDetails;
import com.stripe.stripeterminal.external.models.CardPresentDetails;
import com.stripe.stripeterminal.external.models.Charge;
import com.stripe.stripeterminal.external.models.CollectDataType;
import com.stripe.stripeterminal.external.models.CollectInputsParameters;
import com.stripe.stripeterminal.external.models.CollectInputsResult;
import com.stripe.stripeterminal.external.models.CollectedData;
import com.stripe.stripeterminal.external.models.ConnectionStatus;
import com.stripe.stripeterminal.external.models.CustomerCancellation;
import com.stripe.stripeterminal.external.models.DeviceType;
import com.stripe.stripeterminal.external.models.DiscoveryConfiguration;
import com.stripe.stripeterminal.external.models.EmailInput;
import com.stripe.stripeterminal.external.models.EmailResult;
import com.stripe.stripeterminal.external.models.Input;
import com.stripe.stripeterminal.external.models.Location;
import com.stripe.stripeterminal.external.models.NumericInput;
import com.stripe.stripeterminal.external.models.NumericResult;
import com.stripe.stripeterminal.external.models.PaymentIntent;
import com.stripe.stripeterminal.external.models.PaymentIntentStatus;
import com.stripe.stripeterminal.external.models.PaymentMethod;
import com.stripe.stripeterminal.external.models.PaymentMethodDetails;
import com.stripe.stripeterminal.external.models.PaymentMethodType;
import com.stripe.stripeterminal.external.models.PaymentStatus;
import com.stripe.stripeterminal.external.models.PhoneInput;
import com.stripe.stripeterminal.external.models.PhoneResult;
import com.stripe.stripeterminal.external.models.Reader;
import com.stripe.stripeterminal.external.models.ReaderAccessibility;
import com.stripe.stripeterminal.external.models.ReaderDisplayMessage;
import com.stripe.stripeterminal.external.models.ReaderInputOptions;
import com.stripe.stripeterminal.external.models.ReaderSettings;
import com.stripe.stripeterminal.external.models.ReaderSoftwareUpdate;
import com.stripe.stripeterminal.external.models.ReaderTextToSpeechStatus;
import com.stripe.stripeterminal.external.models.ReceiptDetails;
import com.stripe.stripeterminal.external.models.Refund;
import com.stripe.stripeterminal.external.models.SelectionButton;
import com.stripe.stripeterminal.external.models.SelectionButtonStyle;
import com.stripe.stripeterminal.external.models.SelectionInput;
import com.stripe.stripeterminal.external.models.SelectionResult;
import com.stripe.stripeterminal.external.models.SetupAttempt;
import com.stripe.stripeterminal.external.models.SetupIntent;
import com.stripe.stripeterminal.external.models.SetupIntentCardPresentDetails;
import com.stripe.stripeterminal.external.models.SetupIntentPaymentMethodDetails;
import com.stripe.stripeterminal.external.models.SetupIntentStatus;
import com.stripe.stripeterminal.external.models.SetupIntentUsage;
import com.stripe.stripeterminal.external.models.SignatureInput;
import com.stripe.stripeterminal.external.models.SignatureResult;
import com.stripe.stripeterminal.external.models.SimulatorConfiguration;
import com.stripe.stripeterminal.external.models.TextInput;
import com.stripe.stripeterminal.external.models.TextResult;
import com.stripe.stripeterminal.external.models.Tip;
import com.stripe.stripeterminal.external.models.Toggle;
import com.stripe.stripeterminal.external.models.ToggleResult;
import com.stripe.stripeterminal.external.models.ToggleValue;
import com.stripe.stripeterminal.external.models.Wallet;
import com.stripe.stripeterminal.log.LogLevel;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class TerminalUtils {

  public static LogLevel translateJSLogLevel(Integer level) {
    if (level == null) {
      return LogLevel.NONE;
    }

    switch (level) {
      case 1:
        return LogLevel.ERROR;
      case 2:
        return LogLevel.WARNING;
      case 3:
        return LogLevel.INFO;
      case 4:
        return LogLevel.VERBOSE;
      default:
        return LogLevel.NONE;
    }
  }

  public static CollectDataType translateJSCollectDataType(String type) {
    return "nfcUid".equals(type)
      ? CollectDataType.NFC_UID
      : CollectDataType.MAGSTRIPE;
  }

  public static JSObject serializeReaderSettings(ReaderSettings settings) {
    JSObject accessibility = new JSObject();

    ReaderAccessibility readerAccessibility = settings.getReaderAccessibility();
    if (readerAccessibility instanceof ReaderAccessibility.Accessibility) {
      ReaderTextToSpeechStatus status = (
        (ReaderAccessibility.Accessibility) readerAccessibility
      ).getTextToSpeechStatus();
      switch (status) {
        case HEADPHONES:
          accessibility.put("textToSpeechStatus", "headphones");
          break;
        case SPEAKERS:
          accessibility.put("textToSpeechStatus", "speakers");
          break;
        default:
          accessibility.put("textToSpeechStatus", "off");
          break;
      }
    } else if (readerAccessibility instanceof ReaderAccessibility.Error) {
      Throwable throwable = (
        (ReaderAccessibility.Error) readerAccessibility
      ).getError();
      accessibility.put(
        "error",
        throwable != null ? throwable.getMessage() : "Unknown error"
      );
    } else {
      accessibility.put("error", "Unknown text-to-speech status");
    }

    JSObject object = new JSObject();
    object.put("accessibility", accessibility);

    return object;
  }

  public static JSObject serializeCollectedData(CollectedData data) {
    JSObject object = new JSObject();

    object.put("created", data.getCreated());
    object.put("livemode", data.getLivemode());

    if (data instanceof CollectedData.Magstripe) {
      object.put("id", ((CollectedData.Magstripe) data).getId());
      object.put("stripeId", ((CollectedData.Magstripe) data).getId());
    } else if (data instanceof CollectedData.NfcUid) {
      object.put("uid", ((CollectedData.NfcUid) data).getUid());
    }

    return object;
  }

  public static CustomerCancellation translateJSCustomerCancellation(
    String value
  ) {
    return "disableIfAvailable".equals(value)
      ? CustomerCancellation.DISABLE_IF_AVAILABLE
      : CustomerCancellation.ENABLE_IF_AVAILABLE;
  }

  public static AllowRedisplay translateJSAllowRedisplay(String value) {
    if ("always".equals(value)) {
      return AllowRedisplay.ALWAYS;
    } else if ("limited".equals(value)) {
      return AllowRedisplay.LIMITED;
    }

    return AllowRedisplay.UNSPECIFIED;
  }

  public static PaymentMethodType translateJSPaymentMethodType(String value) {
    if ("interacPresent".equals(value)) {
      return PaymentMethodType.INTERAC_PRESENT;
    } else if ("card".equals(value)) {
      return PaymentMethodType.CARD;
    } else if ("wechatPay".equals(value)) {
      return PaymentMethodType.WECHAT_PAY;
    } else if ("affirm".equals(value)) {
      return PaymentMethodType.AFFIRM;
    }

    return PaymentMethodType.CARD_PRESENT;
  }

  public static List<PaymentMethodType> translateJSPaymentMethodTypes(
    JSArray values
  ) throws JSONException {
    List<PaymentMethodType> types = new ArrayList<>();

    if (values == null) {
      types.add(PaymentMethodType.CARD_PRESENT);
      return types;
    }

    for (Object value : values.toList()) {
      types.add(translateJSPaymentMethodType(String.valueOf(value)));
    }

    if (types.isEmpty()) {
      types.add(PaymentMethodType.CARD_PRESENT);
    }

    return types;
  }

  public static String serializePaymentMethodType(PaymentMethodType type) {
    if (type == null) {
      return null;
    }

    switch (type) {
      case INTERAC_PRESENT:
        return "interacPresent";
      case CARD:
        return "card";
      case WECHAT_PAY:
        return "wechatPay";
      case AFFIRM:
        return "affirm";
      default:
        return "cardPresent";
    }
  }

  private static PaymentMethodType translateApiPaymentMethodType(String value) {
    if ("interac_present".equals(value)) {
      return PaymentMethodType.INTERAC_PRESENT;
    } else if ("card".equals(value)) {
      return PaymentMethodType.CARD;
    } else if ("wechat_pay".equals(value)) {
      return PaymentMethodType.WECHAT_PAY;
    } else if ("affirm".equals(value)) {
      return PaymentMethodType.AFFIRM;
    }

    return PaymentMethodType.CARD_PRESENT;
  }

  public static Map<String, String> readMetadata(JSObject metadata) {
    if (metadata == null) {
      return null;
    }

    Map<String, String> map = new HashMap<>();
    Iterator<String> keys = metadata.keys();
    while (keys.hasNext()) {
      String key = keys.next();
      map.put(key, metadata.optString(key));
    }

    return map;
  }

  private static JSObject serializeMetadata(Map<String, String> metadata) {
    if (metadata == null) {
      return null;
    }

    JSObject object = new JSObject();
    for (Map.Entry<String, String> entry : metadata.entrySet()) {
      object.put(entry.getKey(), entry.getValue());
    }

    return object;
  }

  private static String serializeSetupIntentStatus(SetupIntentStatus status) {
    if (status == null) {
      return "unknown";
    }

    switch (status) {
      case REQUIRES_PAYMENT_METHOD:
        return "requiresPaymentMethod";
      case REQUIRES_CONFIRMATION:
        return "requiresConfirmation";
      case REQUIRES_ACTION:
        return "requiresAction";
      case PROCESSING:
        return "processing";
      case SUCCEEDED:
        return "succeeded";
      case CANCELLED:
        return "canceled";
      default:
        return "unknown";
    }
  }

  private static String serializeSetupIntentUsage(SetupIntentUsage usage) {
    if (usage == null) {
      return null;
    }

    return usage == SetupIntentUsage.OFF_SESSION ? "offSession" : "onSession";
  }

  public static JSObject serializeSetupAttempt(SetupAttempt attempt) {
    if (attempt == null) {
      return null;
    }

    JSObject object = new JSObject();
    object.put("id", attempt.getId());
    object.put("applicationId", attempt.getApplicationId());
    object.put("created", attempt.getCreated());
    object.put("customer", attempt.getCustomerId());
    object.put("livemode", attempt.isLiveMode());
    object.put("onBehalfOfId", attempt.getOnBehalfOfId());
    object.put("paymentMethodId", attempt.getPaymentMethodId());
    object.put("setupIntentId", attempt.getSetupIntentId());
    object.put(
      "status",
      attempt.getStatus() != null
        ? attempt.getStatus().toString().toLowerCase(Locale.ROOT)
        : null
    );
    object.put("usage", serializeSetupIntentUsage(attempt.getUsage()));

    SetupIntentPaymentMethodDetails paymentMethodDetails =
      attempt.getPaymentMethodDetails();
    if (paymentMethodDetails != null) {
      JSObject details = new JSObject();
      details.put(
        "cardPresent",
        serializeSetupAttemptCardPresentDetails(
          paymentMethodDetails.getCardPresentDetails()
        )
      );
      details.put(
        "interacPresent",
        serializeSetupAttemptCardPresentDetails(
          paymentMethodDetails.getInteracPresentDetails()
        )
      );
      object.put("paymentMethodDetails", details);
    }

    return object;
  }

  private static JSObject serializeSetupAttemptCardPresentDetails(
    SetupIntentCardPresentDetails details
  ) {
    if (details == null) {
      return null;
    }

    JSObject object = new JSObject();
    object.put("emvAuthData", details.getEmvAuthData());
    object.put("generatedCard", details.getGeneratedCard());

    return object;
  }

  public static Object serializeSetupIntent(SetupIntent intent) {
    if (intent == null) {
      return JSObject.NULL;
    }

    JSObject object = new JSObject();
    object.put("id", intent.getId());
    object.put("created", intent.getCreated());
    object.put("customer", intent.getCustomerId());
    object.put("description", intent.getDescription());
    object.put("livemode", intent.isLiveMode());
    object.put("onBehalfOf", intent.getOnBehalfOfId());
    object.put("paymentMethodId", intent.getPaymentMethodId());
    object.put("status", serializeSetupIntentStatus(intent.getStatus()));
    object.put("usage", serializeSetupIntentUsage(intent.getUsage()));

    Map<String, String> metadata = intent.getMetadata();
    if (metadata != null) {
      object.put("metadata", serializeMetadata(metadata));
    }

    List<String> paymentMethodTypes = intent.getPaymentMethodTypes();
    if (paymentMethodTypes != null) {
      JSArray types = new JSArray();
      for (String type : paymentMethodTypes) {
        // Android reports the raw API value (e.g. card_present); iOS reports camelCase.
        types.put(
          serializePaymentMethodType(translateApiPaymentMethodType(type))
        );
      }
      object.put("paymentMethodTypes", types);
    }

    JSObject latestAttempt = serializeSetupAttempt(intent.getLatestAttempt());
    if (latestAttempt != null) {
      object.put("latestAttempt", latestAttempt);
    }

    return object;
  }

  public static Object serializeRefund(Refund refund) {
    if (refund == null) {
      return JSObject.NULL;
    }

    JSObject object = new JSObject();
    object.put("id", refund.getId());
    object.put("amount", refund.getAmount());
    object.put("balanceTransaction", refund.getBalanceTransaction());
    object.put("chargeId", refund.getChargeId());
    object.put("created", refund.getCreated());
    object.put("currency", refund.getCurrency());
    object.put("description", refund.getDescription());
    object.put(
      "failureBalanceTransaction",
      refund.getFailureBalanceTransaction()
    );
    object.put("failureReason", refund.getFailureReason());
    object.put("paymentIntentId", refund.getPaymentIntentId());
    object.put("reason", refund.getReason());
    object.put("receiptNumber", refund.getReceiptNumber());
    object.put("sourceTransferReversal", refund.getSourceTransferReversal());
    object.put("transferReversal", refund.getTransferReversal());

    String status = refund.getStatus();
    object.put("status", status != null ? status : "unknown");

    Map<String, String> metadata = refund.getMetadata();
    if (metadata != null) {
      object.put("metadata", serializeMetadata(metadata));
    }

    return object;
  }

  private static List<Toggle> buildToggles(JSONArray raw) throws JSONException {
    List<Toggle> toggles = new ArrayList<>();

    if (raw == null) {
      return toggles;
    }

    for (int i = 0; i < raw.length(); i++) {
      JSONObject toggle = raw.getJSONObject(i);
      ToggleValue defaultValue = "disabled".equals(
        toggle.optString("defaultValue")
      )
        ? ToggleValue.DISABLED
        : ToggleValue.ENABLED;

      toggles.add(
        new Toggle(
          toggle.isNull("title") ? null : toggle.optString("title"),
          toggle.isNull("description") ? null : toggle.optString("description"),
          defaultValue
        )
      );
    }

    return toggles;
  }

  public static CollectInputsParameters buildCollectInputsParameters(
    JSArray rawInputs
  ) throws JSONException {
    List<Input> inputs = new ArrayList<>();

    if (rawInputs != null) {
      for (int i = 0; i < rawInputs.length(); i++) {
        inputs.add(buildInput(rawInputs.getJSONObject(i)));
      }
    }

    return new CollectInputsParameters(inputs);
  }

  private static Input buildInput(JSONObject input) throws JSONException {
    String formType = input.optString("formType");
    String title = input.optString("title");
    boolean required = input.optBoolean("required", false);
    String description = input.isNull("description")
      ? null
      : input.optString("description");
    String skipButtonText = input.isNull("skipButtonText")
      ? null
      : input.optString("skipButtonText");
    String submitButtonText = input.isNull("submitButtonText")
      ? null
      : input.optString("submitButtonText");
    List<Toggle> toggles = buildToggles(input.optJSONArray("toggles"));

    switch (formType) {
      case "selection": {
        List<SelectionButton> buttons = new ArrayList<>();
        JSONArray rawButtons = input.optJSONArray("selectionButtons");
        if (rawButtons != null) {
          for (int i = 0; i < rawButtons.length(); i++) {
            JSONObject button = rawButtons.getJSONObject(i);
            SelectionButtonStyle style = "secondary".equals(
              button.optString("style")
            )
              ? SelectionButtonStyle.SECONDARY
              : SelectionButtonStyle.PRIMARY;

            buttons.add(
              new SelectionButton(
                style,
                button.optString("text"),
                button.optString("id")
              )
            );
          }
        }

        SelectionInput.Builder builder = new SelectionInput.Builder(title)
          .setRequired(required)
          .setToggles(toggles)
          .setSelectionButtons(buttons);
        if (description != null) builder.setDescription(description);
        if (skipButtonText != null) builder.setSkipButtonText(skipButtonText);
        return builder.build();
      }
      case "signature": {
        SignatureInput.Builder builder = new SignatureInput.Builder(title)
          .setRequired(required)
          .setToggles(toggles);
        if (description != null) builder.setDescription(description);
        if (skipButtonText != null) builder.setSkipButtonText(skipButtonText);
        if (submitButtonText != null) builder.setSubmitButtonText(
          submitButtonText
        );
        return builder.build();
      }
      case "phone": {
        PhoneInput.Builder builder = new PhoneInput.Builder(title)
          .setRequired(required)
          .setToggles(toggles);
        if (description != null) builder.setDescription(description);
        if (skipButtonText != null) builder.setSkipButtonText(skipButtonText);
        if (submitButtonText != null) builder.setSubmitButtonText(
          submitButtonText
        );
        return builder.build();
      }
      case "email": {
        EmailInput.Builder builder = new EmailInput.Builder(title)
          .setRequired(required)
          .setToggles(toggles);
        if (description != null) builder.setDescription(description);
        if (skipButtonText != null) builder.setSkipButtonText(skipButtonText);
        if (submitButtonText != null) builder.setSubmitButtonText(
          submitButtonText
        );
        return builder.build();
      }
      case "numeric": {
        NumericInput.Builder builder = new NumericInput.Builder(title)
          .setRequired(required)
          .setToggles(toggles);
        if (description != null) builder.setDescription(description);
        if (skipButtonText != null) builder.setSkipButtonText(skipButtonText);
        if (submitButtonText != null) builder.setSubmitButtonText(
          submitButtonText
        );
        return builder.build();
      }
      default: {
        TextInput.Builder builder = new TextInput.Builder(title)
          .setRequired(required)
          .setToggles(toggles);
        if (description != null) builder.setDescription(description);
        if (skipButtonText != null) builder.setSkipButtonText(skipButtonText);
        if (submitButtonText != null) builder.setSubmitButtonText(
          submitButtonText
        );
        return builder.build();
      }
    }
  }

  private static JSArray serializeToggleResults(List<ToggleResult> toggles) {
    JSArray array = new JSArray();

    if (toggles != null) {
      for (ToggleResult toggle : toggles) {
        if (toggle == ToggleResult.ENABLED) {
          array.put("enabled");
        } else if (toggle == ToggleResult.DISABLED) {
          array.put("disabled");
        } else {
          array.put("skipped");
        }
      }
    }

    return array;
  }

  public static JSObject serializeCollectInputsResult(
    CollectInputsResult result
  ) {
    JSObject object = new JSObject();
    object.put("skipped", result.getSkipped());

    if (result instanceof SelectionResult) {
      SelectionResult selection = (SelectionResult) result;
      object.put("formType", "selection");
      object.put("toggles", serializeToggleResults(selection.getToggles()));
      object.put("selection", selection.getSelection());
      object.put("selectionId", selection.getSelectionId());
    } else if (result instanceof SignatureResult) {
      SignatureResult signature = (SignatureResult) result;
      object.put("formType", "signature");
      object.put("toggles", serializeToggleResults(signature.getToggles()));
      object.put("signatureSvg", signature.getSignatureSvg());
    } else if (result instanceof PhoneResult) {
      PhoneResult phone = (PhoneResult) result;
      object.put("formType", "phone");
      object.put("toggles", serializeToggleResults(phone.getToggles()));
      object.put("phone", phone.getPhone());
    } else if (result instanceof EmailResult) {
      EmailResult email = (EmailResult) result;
      object.put("formType", "email");
      object.put("toggles", serializeToggleResults(email.getToggles()));
      object.put("email", email.getEmail());
    } else if (result instanceof NumericResult) {
      NumericResult numeric = (NumericResult) result;
      object.put("formType", "numeric");
      object.put("toggles", serializeToggleResults(numeric.getToggles()));
      object.put("numericString", numeric.getNumericString());
    } else if (result instanceof TextResult) {
      TextResult text = (TextResult) result;
      object.put("formType", "text");
      object.put("toggles", serializeToggleResults(text.getToggles()));
      object.put("text", text.getText());
    }

    return object;
  }

  public static Object serializeReader(Reader reader) {
    return serializeReader(reader, null, null, null);
  }

  public static Object serializeReader(
    Reader reader,
    Float batteryLevel,
    BatteryStatus batteryStatus,
    Boolean isCharging
  ) {
    if (reader == null) {
      return JSObject.NULL;
    }

    JSObject object = new JSObject();

    // device type
    object.put(
      "deviceType",
      translateDeviceTypeToJS(reader.getDeviceType().ordinal())
    );

    // simulated
    object.put("simulated", reader.isSimulated());

    // stripe id
    object.put("id", reader.getId());
    object.put("stripeId", reader.getId());

    // location id
    String locationId = null;
    if (reader.getLocation() != null) locationId = reader.getLocation().getId();
    object.put("locationId", locationId);

    if (reader.getLocation() != null) {
      object.put("location", serializeLocation(reader.getLocation()));
    }

    // location status
    object.put("locationStatus", reader.getLocationStatus().ordinal());

    // serial number
    String serial = null;
    if (reader.getSerialNumber() != null) serial = reader.getSerialNumber();
    object.put("serialNumber", serial);

    //
    // BLUETOOTH READER PROPS
    //

    // software version
    object.put("deviceSoftwareVersion", reader.getSoftwareVersion());

    // is update available
    object.put("isAvailableUpdate", reader.getAvailableUpdate() != null);

    if (reader.getAvailableUpdate() != null) {
      object.put(
        "availableUpdate",
        serializeUpdate(reader.getAvailableUpdate())
      );
    }

    // battery level
    Float level =
      batteryLevel != null ? batteryLevel : reader.getBatteryLevel();
    if (level != null) {
      object.put("batteryLevel", (double) level);
    } else {
      object.put("batteryLevel", JSObject.NULL);
    }

    // The Reader object never carries a battery status, so fall back to the
    // last value reported by MobileReaderListener.onBatteryLevelUpdate.
    object.put(
      "batteryStatus",
      (batteryStatus != null ? batteryStatus : BatteryStatus.UNKNOWN).ordinal()
    );

    // isCharging
    object.put(
      "isCharging",
      isCharging != null ? isCharging : reader.isCharging()
    );

    //
    // INTERNET READER PROPS
    //

    // ipAddress
    object.put("ipAddress", reader.getIpAddress());

    // status
    int status = Reader.NetworkStatus.OFFLINE.ordinal();
    if (reader.getNetworkStatus() != null) status =
      reader.getNetworkStatus().ordinal();
    object.put("status", translateNetworkStatusToJS(status));

    // label
    String label = null;
    if (reader.getLabel() != null) label = reader.getLabel();
    object.put("label", label);

    object.put("livemode", reader.getLivemode());

    //
    // ANDROID-ONLY HARDWARE PROPS
    //

    object.put("firmwareVersion", reader.getFirmwareVersion());
    object.put("configVersion", reader.getConfigVersion());
    object.put("hardwareVersion", reader.getHardwareVersion());
    object.put("bootloaderVersion", reader.getBootloaderVersion());
    object.put("settingsVersion", reader.getSettingsVersion());
    object.put("baseUrl", reader.getBaseUrl());
    object.put("emvKeyProfileId", reader.getEmvKeyProfileId());
    object.put("macKeyProfileId", reader.getMacKeyProfileId());
    object.put("pinKeyProfileId", reader.getPinKeyProfileId());
    object.put("trackKeyProfileId", reader.getTrackKeyProfileId());
    object.put("pinKeysetId", reader.getPinKeysetId());

    return object;
  }

  private static JSObject serializeReceiptDetails(ReceiptDetails receipt) {
    if (receipt == null) {
      return null;
    }

    JSObject object = new JSObject();
    object.put("accountType", receipt.getAccountType());
    object.put("applicationCryptogram", receipt.getApplicationCryptogram());
    object.put(
      "applicationPreferredName",
      receipt.getApplicationPreferredName()
    );
    object.put("authorizationCode", receipt.getAuthorizationCode());
    object.put(
      "authorizationResponseCode",
      receipt.getAuthorizationResponseCode()
    );
    object.put("cvm", receipt.getCvm());
    object.put("dedicatedFileName", receipt.getDedicatedFileName());
    object.put("terminalVerificationResult", receipt.getTvr());
    object.put("transactionStatusInformation", receipt.getTsi());

    return object;
  }

  private static JSObject serializeCardPresentDetails(
    CardPresentDetails details
  ) {
    if (details == null) {
      return null;
    }

    JSObject object = new JSObject();
    object.put("last4", details.getLast4());
    object.put("expMonth", details.getExpMonth());
    object.put("expYear", details.getExpYear());
    object.put("cardholderName", details.getCardholderName());
    object.put("funding", details.getFunding());
    object.put("brand", details.getBrand());
    object.put("generatedCard", details.getGeneratedCard());
    object.put("emvAuthData", details.getEmvAuthData());
    object.put("country", details.getCountry());
    object.put("issuer", details.getIssuer());
    object.put("iin", details.getIin());
    object.put("network", details.getNetwork());
    object.put("description", details.getDescription());
    object.put("location", details.getLocation());
    object.put("reader", details.getReader());
    object.put("readMethod", details.getReadMethod());

    List<String> preferredLocales = details.getPreferredLocales();
    if (preferredLocales != null) {
      JSArray locales = new JSArray();
      for (String locale : preferredLocales) {
        locales.put(locale);
      }
      object.put("preferredLocales", locales);
    }

    JSObject receipt = serializeReceiptDetails(details.getReceiptDetails());
    if (receipt != null) {
      object.put("receipt", receipt);
    }

    Wallet wallet = details.getWallet();
    if (wallet != null) {
      JSObject walletJson = new JSObject();
      walletJson.put("type", wallet.getType());
      object.put("wallet", walletJson);
    }

    return object;
  }

  private static JSObject serializePaymentMethodDetails(
    PaymentMethodDetails details
  ) {
    if (details == null) {
      return null;
    }

    JSObject object = new JSObject();
    object.put("type", serializePaymentMethodType(details.getType()));

    JSObject cardPresent = serializeCardPresentDetails(
      details.getCardPresentDetails()
    );
    if (cardPresent != null) {
      object.put("cardPresentDetails", cardPresent);
    }

    JSObject interacPresent = serializeCardPresentDetails(
      details.getInteracPresentDetails()
    );
    if (interacPresent != null) {
      object.put("interacPresentDetails", interacPresent);
    }

    CardDetails card = details.getCardDetails();
    if (card != null) {
      JSObject cardJson = new JSObject();
      cardJson.put("brand", card.getBrand());
      cardJson.put("country", card.getCountry());
      cardJson.put("expMonth", card.getExpMonth());
      cardJson.put("expYear", card.getExpYear());
      cardJson.put("funding", card.getFunding());
      cardJson.put("last4", card.getLast4());
      object.put("cardDetails", cardJson);
    }

    return object;
  }

  public static Object serializePaymentIntent(
    PaymentIntent paymentIntent,
    String currency
  ) {
    if (paymentIntent == null) {
      return JSObject.NULL;
    }

    JSObject object = new JSObject();

    object.put("id", paymentIntent.getId());
    object.put("stripeId", paymentIntent.getId());
    object.put("created", paymentIntent.getCreated());
    object.put(
      "status",
      translatePaymentIntentStatusToJS(paymentIntent.getStatus().ordinal())
    );
    object.put("amount", paymentIntent.getAmount());
    object.put("currency", currency);
    object.put("amountTip", paymentIntent.getAmountTip());
    object.put("statementDescriptor", paymentIntent.getStatementDescriptor());
    object.put(
      "statementDescriptorSuffix",
      paymentIntent.getStatementDescriptorSuffix()
    );
    object.put("amountCapturable", paymentIntent.getAmountCapturable());
    object.put("amountReceived", paymentIntent.getAmountReceived());
    object.put("amountRequested", paymentIntent.getAmountRequested());
    object.put("applicationFeeAmount", paymentIntent.getApplicationFeeAmount());
    object.put("canceledAt", paymentIntent.getCanceledAt());
    object.put("cancellationReason", paymentIntent.getCancellationReason());
    object.put("captureMethod", paymentIntent.getCaptureMethod());
    object.put("clientSecret", paymentIntent.getClientSecret());
    object.put("confirmationMethod", paymentIntent.getConfirmationMethod());
    object.put("customer", paymentIntent.getCustomer());
    object.put("description", paymentIntent.getDescription());
    object.put("livemode", paymentIntent.getLivemode());
    object.put("onBehalfOf", paymentIntent.getOnBehalfOf());
    object.put("paymentMethodId", paymentIntent.getPaymentMethodId());
    object.put("receiptEmail", paymentIntent.getReceiptEmail());
    object.put("setupFutureUsage", paymentIntent.getSetupFutureUsage());
    object.put("transferGroup", paymentIntent.getTransferGroup());

    List<PaymentMethodType> intentPaymentMethodTypes =
      paymentIntent.getPaymentMethodTypes();
    if (intentPaymentMethodTypes != null) {
      JSArray types = new JSArray();
      for (PaymentMethodType type : intentPaymentMethodTypes) {
        types.put(serializePaymentMethodType(type));
      }
      object.put("paymentMethodTypes", types);
    }

    PaymentMethod paymentMethod = paymentIntent.getPaymentMethod();
    AmountDetails amountDetails = paymentIntent.getAmountDetails();

    if (amountDetails != null) {
      JSObject amountDetailsJson = new JSObject();
      Tip tip = amountDetails.getTip();
      if (tip != null) {
        JSObject tipJson = new JSObject();
        tipJson.put("amount", tip.getAmount());
        amountDetailsJson.put("tip", tipJson);
      }
      object.put("amountDetails", amountDetailsJson);
    }

    if (paymentMethod != null) {
      JSObject paymentMethodJson = new JSObject();
      paymentMethodJson.put("id", paymentMethod.getId());
      paymentMethodJson.put("stripeId", paymentMethod.getId());
      paymentMethodJson.put("type", paymentMethod.getType().ordinal());
      paymentMethodJson.put("customer", paymentMethod.getCustomer());
      JSObject pmMetadata = new JSObject();
      if (paymentMethod.getMetadata() != null) {
        for (String key : paymentMethod.getMetadata().keySet()) {
          pmMetadata.put(key, String.valueOf(paymentMethod.getMetadata().get(key)));
        }
      }
      paymentMethodJson.put("metadata", pmMetadata);
      paymentMethodJson.put("livemode", paymentMethod.getLivemode());
      paymentMethodJson.put("created", paymentMethod.getCreated());
      object.put("paymentMethod", paymentMethodJson);
    }

    JSArray charges = new JSArray();
    if (paymentIntent.getCharges() != null) {
      for (Charge charge : paymentIntent.getCharges()) {
        JSObject chargeJson = new JSObject();
        chargeJson.put("id", charge.getId());
        chargeJson.put("stripeId", charge.getId());
        chargeJson.put("amount", charge.getAmount());
        chargeJson.put("currency", charge.getCurrency());
        chargeJson.put("status", translateChargeStatusToJS(charge.getStatus()));
        JSObject chargeMetadata = new JSObject();
        if (charge.getMetadata() != null) {
          for (String key : charge.getMetadata().keySet()) {
            chargeMetadata.put(key, String.valueOf(charge.getMetadata().get(key)));
          }
        }
        chargeJson.put("metadata", chargeMetadata);
        chargeJson.put("stripeDescription", charge.getDescription());
        chargeJson.put("statementDescriptorSuffix", charge.getStatementDescriptorSuffix());
        chargeJson.put("calculatedStatementDescriptor", charge.getCalculatedStatementDescriptor());
        chargeJson.put("authorizationCode", charge.getAuthorizationCode());
        chargeJson.put("amountRefunded", charge.getAmountRefunded());
        chargeJson.put("created", charge.getCreated());
        chargeJson.put("captured", charge.getCaptured());
        chargeJson.put("paid", charge.getPaid());
        chargeJson.put("refunded", charge.getRefunded());
        chargeJson.put("customer", charge.getCustomer());
        chargeJson.put("paymentIntentId", charge.getPaymentIntentId());
        chargeJson.put("receiptEmail", charge.getReceiptEmail());
        chargeJson.put("receiptNumber", charge.getReceiptNumber());
        chargeJson.put("receiptUrl", charge.getReceiptUrl());
        chargeJson.put("livemode", charge.getLivemode());
        chargeJson.put("balanceTransaction", charge.getBalanceTransaction());
        chargeJson.put("applicationFee", charge.getApplicationFee());
        chargeJson.put(
          "applicationFeeAmount",
          charge.getApplicationFeeAmount()
        );
        chargeJson.put("onBehalfOf", charge.getOnBehalfOf());

        JSObject paymentMethodDetails = serializePaymentMethodDetails(
          charge.getPaymentMethodDetails()
        );
        if (paymentMethodDetails != null) {
          chargeJson.put("paymentMethodDetails", paymentMethodDetails);
        }

        charges.put(chargeJson);
      }
    }
    object.put("charges", charges);

    JSObject metaData = new JSObject();
    if (paymentIntent.getMetadata() != null) {
      for (String key : paymentIntent.getMetadata().keySet()) {
        metaData.put(key, String.valueOf(paymentIntent.getMetadata().get(key)));
      }
    }
    object.put("metadata", metaData);

    return object;
  }

  public static Object serializeUpdate(
    ReaderSoftwareUpdate readerSoftwareUpdate
  ) {
    if (readerSoftwareUpdate == null) {
      return JSObject.NULL;
    }

    JSObject object = new JSObject();

    ReaderSoftwareUpdate.UpdateDurationEstimate durationEstimate = readerSoftwareUpdate.getDurationEstimate();

    String estimatedUpdateTime;
    switch (durationEstimate) {
      case ONE_TO_TWO_MINUTES:
        estimatedUpdateTime = "estimate1To2Minutes";
        break;
      case TWO_TO_FIVE_MINUTES:
        estimatedUpdateTime = "estimate2To5Minutes";
        break;
      case FIVE_TO_FIFTEEN_MINUTES:
        estimatedUpdateTime = "estimate5To15Minutes";
        break;
      default:
        estimatedUpdateTime = "estimateLessThan1Minute";
        break;
    }

    JSArray components = new JSArray();
    Set<ReaderSoftwareUpdate.UpdateComponent> updateComponents =
      readerSoftwareUpdate.getComponents();
    if (updateComponents != null) {
      for (ReaderSoftwareUpdate.UpdateComponent component : updateComponents) {
        components.put(component.name().toLowerCase(Locale.ROOT));
      }
    }

    object.put("estimatedUpdateTime", estimatedUpdateTime);
    object.put("estimatedUpdateTimeString", durationEstimate.getDescription());
    object.put("deviceSoftwareVersion", readerSoftwareUpdate.getVersion());
    object.put("components", components);
    object.put("requiredAt", readerSoftwareUpdate.getRequiredAtMs() / 1000.0);

    return object;
  }

  public static Object serializeLocation(Location location) {
    if (location == null) {
      return JSObject.NULL;
    }

    JSObject object = new JSObject();

    object.put("id", location.getId());
    object.put("stripeId", location.getId());
    object.put("displayName", location.getDisplayName());
    object.put("livemode", location.getLivemode());

    Address address = location.getAddress();
    if (address != null) {
      object.put("address", serializeAddress(address));
    }
    JSObject metaData = new JSObject();
    if (location.getMetadata() != null) {
      for (String key : location.getMetadata().keySet()) {
        metaData.put(key, String.valueOf(location.getMetadata().get(key)));
      }
    }
    object.put("metadata", metaData);

    return object;
  }

  public static Object serializeAddress(Address address) {
    if (address == null) {
      return JSObject.NULL;
    }

    JSObject object = new JSObject();

    object.put("city", address.getCity());
    object.put("country", address.getCountry());
    object.put("line1", address.getLine1());
    object.put("line2", address.getLine2());
    object.put("postalCode", address.getPostalCode());
    object.put("state", address.getState());

    return object;
  }

  public static JSObject serializeSimulatorConfiguration(
    SimulatorConfiguration config
  ) {
    JSObject object = new JSObject();

    object.put("availableReaderUpdate", config.getUpdate().ordinal());
    //      object.put("simulatedCard", config.getSimulatedCard().getEmvBlob().toString());

    return object;
  }

  // translate Android charge status string to JS ChargeStatus enum ordinal
  // matches iOS SCPChargeStatus: 0=Succeeded, 1=Pending, 2=Failed
  public static int translateChargeStatusToJS(String status) {
    if (status == null) return 2; // Failed as safe default
    switch (status) {
      case "succeeded": return 0;
      case "pending":   return 1;
      case "failed":    return 2;
      default:          return 2;
    }
  }

  public static DiscoveryConfiguration translateDiscoveryMethod(
    Integer method,
    boolean simulated,
    String locationId
  ) {
    if (method == 2) {
      return new DiscoveryConfiguration.InternetDiscoveryConfiguration(
        0,
        locationId,
        simulated,
        null
      );
    } else if (method == 4) {
      return new DiscoveryConfiguration.UsbDiscoveryConfiguration(0, simulated);
    } else if (method == 5) {
      return new DiscoveryConfiguration.AppsOnDevicesDiscoveryConfiguration();
    } else if (method == 6) {
      return new DiscoveryConfiguration.TapToPayDiscoveryConfiguration(
        simulated
      );
    } else {
      // Default: Bluetooth scan (methods 0, 1, and any others)
      return new DiscoveryConfiguration.BluetoothDiscoveryConfiguration(
        0,
        simulated
      );
    }
  }
  // translate the JS device type enum ordinal to the Android DeviceType enum
  public static DeviceType translateJSDeviceType(int type) {
    if (type == 0) {
      return DeviceType.CHIPPER_2X;
    } else if (type == 2) {
      return DeviceType.WISEPAD_3;
    } else if (type == 3) {
      return DeviceType.STRIPE_M2;
    } else if (type == 4) {
      return DeviceType.WISEPOS_E;
    } else if (type == 9) {
      return DeviceType.STRIPE_S700;
    } else if (type == 10) {
      return DeviceType.STRIPE_S700_DEVKIT;
    } else if (type == 11) {
      return DeviceType.TAP_TO_PAY_DEVICE;
    } else if (type == 12) {
      return DeviceType.STRIPE_S710;
    } else if (type == 13) {
      return DeviceType.STRIPE_S710_DEVKIT;
    } else {
      return null;
    }
  }
  // translate the android device type enum to the JS device type enum
  public static Integer translateDeviceTypeToJS(int type) {
    if (type == DeviceType.CHIPPER_2X.ordinal()) {
      return 0;
    } else if (type == DeviceType.STRIPE_M2.ordinal()) {
      return 3;
    } else if (type == DeviceType.WISEPAD_3.ordinal()) {
      return 2;
    } else if (type == DeviceType.WISEPOS_E.ordinal()) {
      return 4;
    } else if (type == DeviceType.STRIPE_S700.ordinal()) {
      return 9;
    } else if (type == DeviceType.STRIPE_S700_DEVKIT.ordinal()) {
      return 10;
    } else if (type == DeviceType.TAP_TO_PAY_DEVICE.ordinal()) {
      return 11;
    } else if (type == DeviceType.STRIPE_S710.ordinal()) {
      return 12;
    } else if (type == DeviceType.STRIPE_S710_DEVKIT.ordinal()) {
      return 13;
    } else {
      return 6;
    }
  }

  // translate the android status enum to the JS status enum
  public static Integer translatePaymentIntentStatusToJS(int status) {
    if (status == PaymentIntentStatus.REQUIRES_PAYMENT_METHOD.ordinal()) {
      return 0;
    } else if (status == PaymentIntentStatus.REQUIRES_CONFIRMATION.ordinal()) {
      return 1;
    } else if (status == PaymentIntentStatus.REQUIRES_CAPTURE.ordinal()) {
      return 2;
    } else if (status == PaymentIntentStatus.PROCESSING.ordinal()) {
      return 3;
    } else if (status == PaymentIntentStatus.CANCELED.ordinal()) {
      return 4;
    } else if (status == PaymentIntentStatus.SUCCEEDED.ordinal()) {
      return 5;
    } else {
      return 0;
    }
  }

  // translate the android status enum to the JS status enum
  public static Integer translatePaymentStatusToJS(int status) {
    if (status == PaymentStatus.NOT_READY.ordinal()) {
      return 0;
    } else if (status == PaymentStatus.READY.ordinal()) {
      return 1;
    } else if (status == PaymentStatus.WAITING_FOR_INPUT.ordinal()) {
      return 2;
    } else if (status == PaymentStatus.PROCESSING.ordinal()) {
      return 3;
    } else {
      return PaymentStatus.NOT_READY.ordinal();
    }
  }

  public static Integer translateNetworkStatusToJS(int status) {
    if (status == Reader.NetworkStatus.ONLINE.ordinal()) {
      return 1;
    } else if (status == Reader.NetworkStatus.OFFLINE.ordinal()) {
      return 0;
    } else {
      return 0;
    }
  }

  public static Integer translateConnectionStatusToJS(int status) {
    if (status == ConnectionStatus.NOT_CONNECTED.ordinal()) {
      return 0;
    } else if (status == ConnectionStatus.CONNECTED.ordinal()) {
      return 1;
    } else if (status == ConnectionStatus.CONNECTING.ordinal()) {
      return 2;
    } else {
      return 0;
    }
  }

  public static Integer translateReaderDisplayMessageToJS(int message) {
    if (message == ReaderDisplayMessage.RETRY_CARD.ordinal()) {
      return 0;
    } else if (message == ReaderDisplayMessage.INSERT_CARD.ordinal()) {
      return 1;
    } else if (message == ReaderDisplayMessage.INSERT_OR_SWIPE_CARD.ordinal()) {
      return 2;
    } else if (message == ReaderDisplayMessage.SWIPE_CARD.ordinal()) {
      return 3;
    } else if (message == ReaderDisplayMessage.REMOVE_CARD.ordinal()) {
      return 4;
    } else if (
      message ==
      ReaderDisplayMessage.MULTIPLE_CONTACTLESS_CARDS_DETECTED.ordinal()
    ) {
      return 5;
    } else if (
      message == ReaderDisplayMessage.TRY_ANOTHER_READ_METHOD.ordinal()
    ) {
      return 6;
    } else if (message == ReaderDisplayMessage.TRY_ANOTHER_CARD.ordinal()) {
      return 7;
    } else {
      return 0;
    }
  }
}
