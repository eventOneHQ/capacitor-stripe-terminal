package io.event1.capacitorstripeterminal;

import com.getcapacitor.JSObject;
import com.stripe.stripeterminal.external.models.Address;
import com.stripe.stripeterminal.external.models.DeviceType;
import com.stripe.stripeterminal.external.models.DiscoveryMethod;
import com.stripe.stripeterminal.external.models.Location;
import com.stripe.stripeterminal.external.models.PaymentIntent;
import com.stripe.stripeterminal.external.models.Reader;
import com.stripe.stripeterminal.external.models.ReaderSoftwareUpdate;
import com.stripe.stripeterminal.external.models.SimulatorConfiguration;

public class TerminalUtils {

  public static JSObject serializeReader(Reader reader) {
    JSObject object = new JSObject();

    if (reader != null) {
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
      if (reader.getLocation() != null) locationId =
        reader.getLocation().getId();
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
    }
    return object;
  }

  public static JSObject serializePaymentIntent(
    PaymentIntent paymentIntent,
    String currency
  ) {
    JSObject object = new JSObject();

    object.put("stripeId", paymentIntent.getId());
    object.put("created", paymentIntent.getCreated());
    object.put(
      "status",
      translatePaymentIntentStatusToJS(paymentIntent.getStatus().ordinal())
    );
    object.put("amount", paymentIntent.getAmount());
    object.put("currency", currency);

    JSObject metaData = new JSObject();
    if (paymentIntent.getMetadata() != null) {
      for (String key : paymentIntent.getMetadata().keySet()) {
        metaData.put(key, String.valueOf(paymentIntent.getMetadata().get(key)));
      }
    }
    object.put("metadata", metaData);

    return object;
  }

  public static JSObject serializeUpdate(
    ReaderSoftwareUpdate readerSoftwareUpdate
  ) {
    JSObject object = new JSObject();

    if (readerSoftwareUpdate != null) {
      ReaderSoftwareUpdate.UpdateTimeEstimate updateTimeEstimate = readerSoftwareUpdate.getTimeEstimate();

      object.put(
        "estimatedUpdateTimeString",
        updateTimeEstimate.getDescription()
      );
      object.put("estimatedUpdateTime", updateTimeEstimate.ordinal());
      object.put("deviceSoftwareVersion", readerSoftwareUpdate.getVersion());
      object.put("components", readerSoftwareUpdate.getComponents());
      object.put("requiredAt", readerSoftwareUpdate.getRequiredAt().getTime());
    }

    return object;
  }

  public static JSObject serializeLocation(Location location) {
    JSObject object = new JSObject();

    if (location != null) {
      object.put("stripeId", location.getId());
      object.put("displayName", location.getDisplayName());
      object.put("livemode", location.getLivemode());

      Address address = location.getAddress();
      if (address != null) {
        object.put("address", serializeAddress(address));
      }
    }

    return object;
  }

  public static JSObject serializeAddress(Address address) {
    JSObject object = new JSObject();

    if (address != null) {
      object.put("city", address.getCity());
      object.put("country", address.getCountry());
      object.put("line1", address.getLine1());
      object.put("line2", address.getLine2());
      object.put("postalCode", address.getPostalCode());
      object.put("state", address.getState());
    }

    return object;
  }

  public static JSObject serializeSimulatorConfiguration(
    SimulatorConfiguration config
  ) {
    JSObject object = new JSObject();

    if (config != null) {
      object.put("availableReaderUpdate", config.getUpdate().ordinal());
      //      object.put("simulatedCard", config.getSimulatedCard().getEmvBlob().toString());
    }

    return object;
  }

  public static DiscoveryMethod translateDiscoveryMethod(Integer method) {
    if (method == 0) {
      return DiscoveryMethod.BLUETOOTH_SCAN;
    } else if (method == 1) {
      return DiscoveryMethod.BLUETOOTH_SCAN;
    } else if (method == 2) {
      return DiscoveryMethod.INTERNET;
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
    } else {
      return 5;
    }
  }

  // translate the android status enum to the JS status enum
  public static Integer translatePaymentIntentStatusToJS(int status) {
    if (status == 0) {
      return 4;
    } else if (status == 1) {
      return 2;
    } else if (status == 2) {
      return 1;
    } else if (status == 3) {
      return 0;
    } else if (status == 4) {
      return 5;
    } else {
      return 5;
    }
  }

  // translate the android status enum to the JS status enum
  public static Integer translatePaymentStatusToJS(int status) {
    if (status == 0) {
      return 3;
    } else if (status == 1) {
      return 2;
    } else if (status == 2) {
      return 1;
    } else if (status == 3) {
      return 0;
    } else {
      return 0;
    }
  }

  public static Integer translateNetworkStatusToJS(int status) {
    if (status == 0) {
      return 1; // online
    } else {
      return 0; // offline
    }
  }
}
