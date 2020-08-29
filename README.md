<p align="center"><br><img src="https://user-images.githubusercontent.com/236501/85893648-1c92e880-b7a8-11ea-926d-95355b8175c7.png" width="128" height="128" /></p>
<h3 align="center">Capacitor Stripe Terminal</h3>
<p align="center"><strong><code>capacitor-stripe-terminal</code></strong></p>
<p align="center">
  Capacitor plugin for <a href="https://stripe.com/terminal">Stripe Terminal</a> (unofficial)
</p>

<p align="center">
  <img src="https://img.shields.io/maintenance/yes/2020?style=flat-square" />
  <a href="https://github.com/eventonehq/capacitor-stripe-terminal/actions?query=workflow%3A%22Release%22"><img src="https://img.shields.io/github/workflow/status/eventonehq/capacitor-stripe-terminal/Release?style=flat-square" /></a>
  <a href="https://www.npmjs.com/package/capacitor-stripe-terminal"><img src="https://img.shields.io/npm/l/capacitor-stripe-terminal?style=flat-square" /></a>
<br>
  <a href="https://www.npmjs.com/package/capacitor-stripe-terminal"><img src="https://img.shields.io/npm/dw/capacitor-stripe-terminal?style=flat-square" /></a>
  <a href="https://www.npmjs.com/package/capacitor-stripe-terminal"><img src="https://img.shields.io/npm/v/capacitor-stripe-terminal?style=flat-square" /></a>
<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
<a href="#contributors-"><img src="https://img.shields.io/badge/all%20contributors-0-orange?style=flat-square" /></a>
<!-- ALL-CONTRIBUTORS-BADGE:END -->
</p>

**[Current project status](https://github.com/eventOneHQ/capacitor-stripe-terminal/issues/2)**

**WARNING:** Until this project reaches 1.0, the API is subject to breaking changes.

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

Follow all Stripe instructions under ["Configure your app"](https://stripe.com/docs/terminal/sdk/android#configure).

Add the plugin to your `MainActivity.java`.

```java
// import it at the top
import io.event1.capacitorstripeterminal.StripeTerminal;

this.init(savedInstanceState, new ArrayList<Class<? extends Plugin>>() {{
  // Additional plugins you've installed go here
  // Ex: add(TotallyAwesomePlugin.class);
  add(StripeTerminal.class);
}});
```

## Usage

```javascript
import {
  StripeTerminalPlugin,
  DeviceType,
  DiscoveryMethod
} from 'capacitor-stripe-terminal'

// First, initialize the SDK
const terminal = new StripeTerminalPlugin({
  fetchConnectionToken: async () => {
    const resp = await fetch('https://your-backend.dev/token', {
      method: 'POST'
    })
    const data = await resp.json()

    return data.secret
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
;(async () => {
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
})()
```

## API Reference

See the full API docs [here](https://oss.eventone.page/capacitor-stripe-terminal).

## Acknowledgements

- Thanks [Stripe](https://stripe.com/terminal) for creating such an amazing product
- Thanks [react-native-stripe-terminal](https://github.com/theopolisme/react-native-stripe-terminal) for quite a few borrowed concepts
