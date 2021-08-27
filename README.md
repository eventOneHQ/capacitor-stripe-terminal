<p align="center"><br><img src="https://user-images.githubusercontent.com/236501/85893648-1c92e880-b7a8-11ea-926d-95355b8175c7.png" width="128" height="128" /></p>
<h3 align="center">Capacitor Stripe Terminal</h3>
<p align="center"><strong><code>capacitor-stripe-terminal</code></strong></p>
<p align="center">
  Capacitor plugin for <a href="https://stripe.com/terminal">Stripe Terminal</a> (unofficial)
</p>

<p align="center">
  <img src="https://img.shields.io/maintenance/yes/2021?style=flat-square" />
  <a href="https://github.com/eventonehq/capacitor-stripe-terminal/actions?query=workflow%3A%22Release%22"><img src="https://img.shields.io/github/workflow/status/eventonehq/capacitor-stripe-terminal/Release?style=flat-square" /></a>
  <a href="https://www.npmjs.com/package/capacitor-stripe-terminal"><img src="https://img.shields.io/npm/l/capacitor-stripe-terminal?style=flat-square" /></a>
<br>
  <a href="https://www.npmjs.com/package/capacitor-stripe-terminal"><img src="https://img.shields.io/npm/dw/capacitor-stripe-terminal?style=flat-square" /></a>
  <a href="https://www.npmjs.com/package/capacitor-stripe-terminal"><img src="https://img.shields.io/npm/v/capacitor-stripe-terminal?style=flat-square" /></a>
<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
<a href="#contributors-"><img src="https://img.shields.io/badge/all%20contributors-0-orange?style=flat-square" /></a>
<!-- ALL-CONTRIBUTORS-BADGE:END -->
</p>

**[Current project status](https://github.com/eventOneHQ/capacitor-stripe-terminal/discussions/42)**

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

On Android, you must also make sure that Location permission has been granted by the user:

```javascript
const response = await StripeTerminalPlugin.getPermissions()

if (!response.granted) {
  throw new Error('Location permission is required.')
}

const terminal = await StripeTerminalPlugin.create({ ... })
```

If the user does not grant permission, `StripeTerminalPlugin` will throw an error when you try to initialize it so you will have to handle that.

_Hint: If the user denies Location permission the first time you ask for it, Android will not display a prompt to the user on subsequent requests for permission and `response.granted` will always be `false`. You will have to ask the user to go into the app's settings to allow Location permission._

## Usage

```javascript
import {
  StripeTerminalPlugin,
  DeviceType,
  DiscoveryMethod
} from 'capacitor-stripe-terminal'

// First, initialize the SDK
const terminal = await StripeTerminalPlugin.create({
  fetchConnectionToken: async () => {
    const resp = await fetch('https://your-backend.dev/token', {
      method: 'POST'
    })
    const data = await resp.json()

    return data.secret
  },
  onUnexpectedReaderDisconnect: () => {
    // handle reader disconnect
  }
})

// Start scanning for readers
// capacitor-stripe-terminal uses Observables for any data streams
// To stop scanning, unsubscribe from the Observable.
// You must connect to a reader while scanning
terminal
  .discoverReaders({
    simulated: false,
    deviceType: DeviceType.Chipper2X,
    discoveryMethod: DiscoveryMethod.BluetoothProximity
  })
  .subscribe(readers => {
    if (readers.length) {
      terminal
        .connectReader({ serialNumber: readers[0].serialNumber })
        .then(connectedReader => {
          // the reader is now connected and usable
        })
    }
  })

// Once the reader is connected, collect a payment intent!

// subscribe to user instructions - these should be displayed to the user
const displaySubscription = terminal
  .readerDisplayMessage()
  .subscribe(displayMessage => {
    console.log('displayMessage', displayMessage)
  })
const inputSubscription = terminal.readerInput().subscribe(inputOptions => {
  console.log('inputOptions', inputOptions)
})

// retrieve the payment intent
await terminal.retrievePaymentIntent('your client secret created server side')

// collect the payment method
await terminal.collectPaymentMethod()

// and finally, process the payment
await terminal.processPayment()

// once you are done, make sure to unsubscribe (e.g. in ngOnDestroy)
displaySubscription.unsubscribe()
inputSubscription.unsubscribe()
```

## API Reference

See the full API docs [here](https://oss.eventone.page/capacitor-stripe-terminal).

## Acknowledgements

- Thanks [Stripe](https://stripe.com/terminal) for creating such an amazing product
- Thanks [react-native-stripe-terminal](https://github.com/theopolisme/react-native-stripe-terminal) for quite a few borrowed concepts
