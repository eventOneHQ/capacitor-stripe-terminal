<p align="center"><br><img src="https://user-images.githubusercontent.com/236501/85893648-1c92e880-b7a8-11ea-926d-95355b8175c7.png" width="128" height="128" /></p>
<h3 align="center">Capacitor Stripe Terminal</h3>
<p align="center"><strong><code>capacitor-stripe-terminal</code></strong></p>
<p align="center">
  Capacitor plugin for <a href="https://stripe.com/terminal">Stripe Terminal</a> (unofficial)
</p>

<p align="center">
  <img src="https://img.shields.io/maintenance/yes/2026?style=flat-square" />
  <a href="https://github.com/eventOneHQ/capacitor-stripe-terminal/actions/workflows/release.yml"><img src="https://img.shields.io/github/actions/workflow/status/eventOneHQ/capacitor-stripe-terminal/release.yml?style=flat-square" /></a>
  <a href="https://www.npmjs.com/package/capacitor-stripe-terminal"><img src="https://img.shields.io/npm/l/capacitor-stripe-terminal?style=flat-square" /></a>
<br>
  <a href="https://www.npmjs.com/package/capacitor-stripe-terminal"><img src="https://img.shields.io/npm/dw/capacitor-stripe-terminal?style=flat-square" /></a>
  <a href="https://www.npmjs.com/package/capacitor-stripe-terminal"><img src="https://img.shields.io/npm/v/capacitor-stripe-terminal?style=flat-square" /></a>
<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
<a href="#contributors-"><img src="https://img.shields.io/badge/all%20contributors-0-orange?style=flat-square" /></a>
<!-- ALL-CONTRIBUTORS-BADGE:END -->
</p>

## Requirements

- **Capacitor**: 8.x
- **Stripe Terminal SDK**:
  - iOS: 6.0.0 (requires iOS 16.0+)
  - Android: 6.0.0 (requires Android API 23+, compileSdk 35+)

> **📝 Upgrading from an earlier version?** See the [v6 Migration Guide](MIGRATION_V6.md) (and the [v5 Migration Guide](MIGRATION_V5.md)) for details on breaking changes and upgrade instructions.

## Maintainers

| Maintainer | GitHub                              | Social                                      |
| ---------- | ----------------------------------- | ------------------------------------------- |
| Noah Prail | [nprail](https://github.com/nprail) | [@NoahPrail](https://twitter.com/NoahPrail) |

## Installation

Using npm:

```bash
npm install capacitor-stripe-terminal
```

Using yarn:

```bash
yarn add capacitor-stripe-terminal
```

Sync native files:

```bash
npx cap sync
```

## Configuration

### iOS

Follow all Stripe instructions under ["Configure your app"](https://stripe.com/docs/terminal/sdk/ios#configure).

### Android

Add the `ACCESS_FINE_LOCATION` permission to your app's manifest:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools"
    package="com.stripe.example.app">

    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
</manifest>
```

#### Apps on Devices

To run your Capacitor app directly on a Stripe Android reader (e.g. S700, T600), see [Apps on Devices](https://docs.stripe.com/terminal/features/apps-on-devices/build). The plugin bundles `stripeterminal-appsondevices`; you also need to:

1. Create an `Application` subclass that calls `TerminalApplicationDelegate.onCreate(this)` and register it as `android:name` on `<application>` in your manifest:

```java
public class MyApplication extends Application {
  @Override
  public void onCreate() {
    super.onCreate();
    TerminalApplicationDelegate.onCreate(this);
  }
}
```

2. Discover and connect (the discovery list contains only the device itself):

```ts
await StripeTerminal.discoverReaders({ discoveryMethod: 'appsOnDevices' }) // listen for `readersDiscovered`
await StripeTerminal.connectAppsOnDevicesReader(reader, {
  appTransitionAnimation: { type: 'preset', preset: 'slideFromBottom' }, // optional, reader software 2.42+
})
```

Register the device as a Reader first, using the pairing code from its admin settings. Production devices must be deployed via the Dashboard; use `adb install` only for DevKits.

On Android, you must also make sure that Location permission has been granted by the user:

```javascript
if (Capacitor.getPlatform() === 'android') {
  // check if permission is required
  let response = await StripeTerminalPlugin.checkPermissions();

  if (response.location === 'prompt') {
    // if it is required, request it
    response = await StripeTerminalPlugin.requestPermissions();

    if (response.location !== 'granted') {
      // if the request fails, show a message to the user
      throw new Error('Location permission is required.')
    }
  }
}

const terminal = await StripeTerminalPlugin.create({ ... })
```

If the user does not grant permission, `StripeTerminalPlugin` will throw an error when you try to initialize it so you will have to handle that.

_Hint: If the user denies Location permission the first time you ask for it, Android will not display a prompt to the user on subsequent requests for permission and `response` will always be `denied`. You will have to ask the user to go into the app's settings to allow Location permission._

## Usage

```javascript
import {
  StripeTerminalPlugin,
  StripeTerminalError,
} from 'capacitor-stripe-terminal'

// First, initialize the SDK
const terminal = await StripeTerminalPlugin.create({
  fetchConnectionToken: async () => {
    const resp = await fetch('https://your-backend.dev/token', {
      method: 'POST',
    })
    const data = await resp.json()

    return data.secret
  },
  onUnexpectedReaderDisconnect: () => {
    // handle reader disconnect
  },
})

// Start scanning for readers
// To stop scanning, call handle.remove() on the returned handle.
// You must connect to a reader while scanning
const discoverHandle = await terminal.discoverReaders(
  {
    simulated: false,
    discoveryMethod: 'bluetoothScan',
  },
  (readers) => {
    if (readers.length) {
      const selectedReader = readers[0]
      const connectionConfig = {
        locationId: '{{LOCATION_ID}}',
      }
      terminal
        .connectBluetoothReader(selectedReader, connectionConfig)
        .then((connectedReader) => {
          // the reader is now connected and usable
        })
    }
  },
  (error) => {
    console.error('discoverReaders error', error)
  },
)

// Once the reader is connected, collect a payment intent!

// listen to user instructions - these should be displayed to the user
const displayHandle = await terminal.didRequestReaderDisplayMessage(
  (displayMessage) => {
    console.log('displayMessage', displayMessage)
  },
)
const inputHandle = await terminal.didRequestReaderInput((inputOptions) => {
  console.log('inputOptions', inputOptions)
})

// retrieve the payment intent
await terminal.retrievePaymentIntent('your client secret created server side')

// collect the payment method
await terminal.collectPaymentMethod()

// and finally, confirm the payment intent
try {
  await terminal.confirmPaymentIntent()
} catch (err) {
  if (err instanceof StripeTerminalError) {
    // structured decline data is available on card declines
    console.error('decline_code', err.decline_code)
  }
  throw err
}

// once you are done, call destroy() to remove all listeners and reset the plugin (e.g. in ngOnDestroy)
await terminal.destroy()
```

## API Reference

See the full API docs [here](https://oss.eventone.page/capacitor-stripe-terminal).

## Sponsors

<p>
    <a href="https://event1.io/?utm_medium=opensource&utm_source=capacitor-stripe-terminal">
        <img src="https://brand.event1.io/wordmark/wm-white.svg" width="200px">
    </a>
</p>

## Acknowledgements

- Thanks [Stripe](https://stripe.com/terminal) for creating such an amazing product
- Thanks [react-native-stripe-terminal](https://github.com/theopolisme/react-native-stripe-terminal) for quite a few borrowed concepts
