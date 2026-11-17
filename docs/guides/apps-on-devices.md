---
title: 'Apps on Devices'
description: 'Run your Capacitor app directly on a Stripe Android reader such as the S700 or T600.'
---

# Apps on Devices (Android)

[Apps on Devices](https://docs.stripe.com/terminal/features/apps-on-devices/build) lets your app run on the reader itself. The plugin bundles `stripeterminal-appsondevices`. You need to do two extra things.

## 1. Add an Application subclass

```java
public class MyApplication extends Application {
  @Override
  public void onCreate() {
    super.onCreate();
    TerminalApplicationDelegate.onCreate(this);
  }
}
```

Register it on `<application>` in your manifest:

```xml
<application android:name=".MyApplication" ...>
```

The app module also needs the Terminal SDK on its own compile classpath, because the plugin includes it privately. In `android/app/build.gradle`:

```groovy
implementation "com.stripe:stripeterminal-core:6.0.0"
```

On the Stripe T600, lock the activity to the reader's landscape orientation in your manifest:

```xml
<activity android:name=".MainActivity" android:screenOrientation="nosensor" ... />
```

## 2. Discover and connect

The discovery list contains only the device itself.

```ts
const handle = await terminal.discoverReaders(
  { discoveryMethod: 'appsOnDevices', simulated: false },
  async ([reader]) => {
    if (!reader) return
    await terminal.connectAppsOnDevicesReader(reader, {
      // optional, reader software 2.42+
      appTransitionAnimation: { type: 'preset', preset: 'slideFromBottom' },
    })
  },
)
```

`appTransitionAnimation` accepts `{ type: 'systemDefault' }`, `{ type: 'preset', preset: 'slideFromBottom' }` or `{ type: 'custom', enterAnim, exitAnim }` using Android resource IDs.

## Admin settings

`openDeviceSettings({ screen, bypassAdminPasscode })` opens a screen of the reader's settings. `all`, `network`, `advanced` and `registrationCode` always require the admin PIN. `appearance`, `language` and `bugReport` may skip it.

## Deployment

- Register the device as a Reader first, using the pairing code from its admin settings.
- Production devices must be deployed through the Stripe Dashboard. Use `adb install` only for DevKits.
- `appsOnDevices` rejects on iOS and isn't available on web.
