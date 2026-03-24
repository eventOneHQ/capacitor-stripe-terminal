package io.event1.capacitorstripeterminal;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.stripe.stripeterminal.external.models.Address;
import com.stripe.stripeterminal.external.models.AmountDetails;
import com.stripe.stripeterminal.external.models.BatteryStatus;
import com.stripe.stripeterminal.external.models.Charge;
import com.stripe.stripeterminal.external.models.ConnectionStatus;
import com.stripe.stripeterminal.external.models.DeviceType;
import com.stripe.stripeterminal.external.models.DiscoveryConfiguration;
import com.stripe.stripeterminal.external.models.Location;
import com.stripe.stripeterminal.external.models.PaymentIntent;
import com.stripe.stripeterminal.external.models.PaymentIntentStatus;
import com.stripe.stripeterminal.external.models.PaymentMethod;
import com.stripe.stripeterminal.external.models.PaymentStatus;
import com.stripe.stripeterminal.external.models.Reader;
import com.stripe.stripeterminal.external.models.ReaderDisplayMessage;
import com.stripe.stripeterminal.external.models.ReaderInputOptions;
import com.stripe.stripeterminal.external.models.ReaderSoftwareUpdate;
import com.stripe.stripeterminal.external.models.SimulatorConfiguration;
import com.stripe.stripeterminal.external.models.Tip;

public class TerminalUtils {

  public static Object serializeReader(Reader reader) {
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
    object.put("stripeId", reader.getId());

    // location id
    String locationId = null;
    if (reader.getLocation() != null) locationId = reader.getLocation().getId();
    object.put("locationId", locationId);

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

    // battery level
    Float level = reader.getBatteryLevel();
    if (level != null) {
      object.put("batteryLevel", (double) level);
    } else {
      object.put("batteryLevel", JSObject.NULL);
    }

    // batteryStatus is not available on the Reader object in the Android SDK
    object.put("batteryStatus", BatteryStatus.UNKNOWN.ordinal());

    // isCharging
    object.put("isCharging", reader.isCharging());

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

    object.put("estimatedUpdateTimeString", durationEstimate.getDescription());
    object.put("estimatedUpdateTime", durationEstimate.ordinal());
    object.put("deviceSoftwareVersion", readerSoftwareUpdate.getVersion());
    object.put("components", readerSoftwareUpdate.getComponents());
    object.put("requiredAt", readerSoftwareUpdate.getRequiredAtMs() / 1000.0);

    return object;
  }

  public static Object serializeLocation(Location location) {
    if (location == null) {
      return JSObject.NULL;
    }

    JSObject object = new JSObject();

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
