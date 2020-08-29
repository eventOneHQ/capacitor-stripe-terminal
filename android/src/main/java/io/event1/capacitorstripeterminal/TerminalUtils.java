package io.event1.capacitorstripeterminal;

import com.getcapacitor.JSObject;
import com.stripe.stripeterminal.model.external.Reader;

public class TerminalUtils {

  public static JSObject serializeReader(Reader reader) {
    JSObject object = new JSObject();

    if (reader != null) {
      double batteryLevel = 0;
      if (reader.getBatteryLevel() != null) batteryLevel =
        (double) reader.getBatteryLevel();
      object.put("batteryLevel", batteryLevel);

      int readerType = 0;
      if (reader.getDeviceType() != null) readerType =
        reader.getDeviceType().ordinal();
      object.put("deviceType", readerType);

      String serial = "";

      if (reader.getSerialNumber() != null) serial = reader.getSerialNumber();
      object.put("serialNumber", serial);

      String softwareVersion = "";
      if (reader.getSoftwareVersion() != null) softwareVersion =
        reader.getSoftwareVersion();
      object.put("deviceSoftwareVersion", softwareVersion);
    }
    return object;
  }
}
