package io.event1.capacitorstripeterminal;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.squareup.moshi.Moshi;
import com.stripe.stripeterminal.external.models.Address;
import com.stripe.stripeterminal.external.models.AmountDetails;
import com.stripe.stripeterminal.external.models.AmountDetailsJsonAdapter;
import com.stripe.stripeterminal.external.models.Charge;
import com.stripe.stripeterminal.external.models.ChargeJsonAdapter;
import com.stripe.stripeterminal.external.models.ConnectionStatus;
import com.stripe.stripeterminal.external.models.DeviceType;
import com.stripe.stripeterminal.external.models.DiscoveryMethod;
import com.stripe.stripeterminal.external.models.Location;
import com.stripe.stripeterminal.external.models.PaymentIntent;
import com.stripe.stripeterminal.external.models.PaymentIntentStatus;
import com.stripe.stripeterminal.external.models.PaymentMethod;
import com.stripe.stripeterminal.external.models.PaymentMethodJsonAdapter;
import com.stripe.stripeterminal.external.models.PaymentStatus;
import com.stripe.stripeterminal.external.models.Reader;
import com.stripe.stripeterminal.external.models.ReaderDisplayMessage;
import com.stripe.stripeterminal.external.models.ReaderInputOptions;
import com.stripe.stripeterminal.external.models.ReaderSoftwareUpdate;
import com.stripe.stripeterminal.external.models.SimulatorConfiguration;

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
    double batteryLevel = 0;
    if (level != null) batteryLevel = (double) level;
    object.put("batteryLevel", batteryLevel);

    //
    // INTERNET READER PROPS
    //

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

    Moshi moshi = new Moshi.Builder().build();

    PaymentMethod paymentMethod = paymentIntent.getPaymentMethod();
    AmountDetails amountDetails = paymentIntent.getAmountDetails();

    if (amountDetails != null) {
      AmountDetailsJsonAdapter adapter = new AmountDetailsJsonAdapter(moshi);
      String amountDetailsString = adapter.toJson(amountDetails);
      object.put("amountDetails", amountDetailsString);
    }

    if (paymentMethod != null) {
      PaymentMethodJsonAdapter paymentMethodAdapter = new PaymentMethodJsonAdapter(
        moshi
      );
      String paymentMethodString = paymentMethodAdapter.toJson(paymentMethod);
      object.put("paymentMethod", paymentMethodString);
    }

    JSArray charges = new JSArray();
    if (paymentIntent.getCharges() != null) {
      ChargeJsonAdapter adapter = new ChargeJsonAdapter(moshi);

      for (Charge charge : paymentIntent.getCharges()) {
        charges.put(adapter.toJson(charge));
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

    ReaderSoftwareUpdate.UpdateTimeEstimate updateTimeEstimate = readerSoftwareUpdate.getTimeEstimate();

    object.put(
      "estimatedUpdateTimeString",
      updateTimeEstimate.getDescription()
    );
    object.put("estimatedUpdateTime", updateTimeEstimate.ordinal());
    object.put("deviceSoftwareVersion", readerSoftwareUpdate.getVersion());
    object.put("components", readerSoftwareUpdate.getComponents());
    object.put("requiredAt", readerSoftwareUpdate.getRequiredAt().getTime());

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

  public static DiscoveryMethod translateDiscoveryMethod(Integer method) {
    if (method == 0) {
      return DiscoveryMethod.BLUETOOTH_SCAN;
    } else if (method == 1) {
      return DiscoveryMethod.BLUETOOTH_SCAN;
    } else if (method == 2) {
      return DiscoveryMethod.INTERNET;
    } else if (method == 4) {
      return DiscoveryMethod.USB;
    } else if (method == 5) {
      return DiscoveryMethod.EMBEDDED;
    } else if (method == 6) {
      return DiscoveryMethod.HANDOFF;
    } else if (method == 7) {
      return DiscoveryMethod.LOCAL_MOBILE;
    } else {
      return DiscoveryMethod.BLUETOOTH_SCAN;
    }
  }

  // translate the android device type enum to the JS device type enum
  public static Integer translateDeviceTypeToJS(int type) {
    if (type == DeviceType.CHIPPER_2X.ordinal()) {
      return 0;
    } else if (type == DeviceType.STRIPE_M2.ordinal()) {
      return 3;
    } else if (type == DeviceType.VERIFONE_P400.ordinal()) {
      return 1;
    } else if (type == DeviceType.WISEPAD_3.ordinal()) {
      return 2;
    } else if (type == DeviceType.WISEPOS_E.ordinal()) {
      return 4;
    } else if (type == DeviceType.STRIPE_S700.ordinal()) {
      return 9;
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
    } else if (status == 5) { // PaymentIntentStatus seems to be missing a value for Processing??
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
