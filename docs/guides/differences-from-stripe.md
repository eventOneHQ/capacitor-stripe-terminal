---
title: "Differences from Stripe's SDKs"
description: "How the plugin's API differs from the Stripe Terminal iOS, Android, JS and React Native SDKs."
---

# Differences from Stripe's SDKs

If you know Stripe Terminal's SDKs, most of this plugin will feel familiar. Method names, parameters and data shapes follow Stripe's, and the plugin tracks the [React Native SDK](https://github.com/stripe/stripe-terminal-react-native) where the native SDKs disagree. This page lists everything that is _not_ the same.

## Initialization

| Stripe SDK                                                                              | This plugin                                                                                              |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Native: `Terminal.initWithTokenProvider` / `Terminal.initTerminal`, a global singleton. | `await StripeTerminalPlugin.create(config)` returns an **instance**. All other methods are called on it. |
| JS: `StripeTerminal.create({ onFetchConnectionToken, onUnexpectedReaderDisconnect })`.  | `create({ fetchConnectionToken, onUnexpectedReaderDisconnect, logLevel?, locale? })`.                    |
| Tear down by dropping delegates / calling `clearCachedCredentials`.                     | `await terminal.destroy()` removes every listener and resets the instance. Call it on unmount.           |

`fetchConnectionToken` resolves to the token **string**, not an object. Rejecting is reported to the SDK as a token failure.

Calling methods after `destroy()` throws `StripeTerminalPlugin must be initialized before you can use any methods.` Create a new instance if you need to start again.

## One API, three SDKs

The plugin bundles the native iOS and Android SDKs **and** `@stripe/terminal-js`, and routes each call to one of them:

| Reader type                                 | SDK used                            |
| ------------------------------------------- | ----------------------------------- |
| Bluetooth, USB, Tap to Pay, Apps on Devices | Native SDK                          |
| Internet (WisePOS E, Stripe S700 and so on) | **JS SDK, even on iOS and Android** |

Routing is automatic and driven by your last discovery or connect call (`connectInternetReader` selects JS; every other `connect*` selects native). This means internet readers behave the same in a browser and in a native app. See [Readers and discovery](./readers.md).

## Discovery and connection

- `discoverReaders(config, onReaders, onError?)` takes **callbacks** and returns a handle. There is no delegate, observable or `Cancelable` to hold on to. Call `handle.remove()` to cancel.
- `onReaders` receives the full current list each time it changes.
- `discoveryMethod: 'both'` is plugin-only. It scans Bluetooth with the native SDK and internet readers with the JS SDK at once and merges the results.
- Connect with the method that matches the reader: `connectBluetoothReader`, `connectInternetReader`, `connectUsbReader`, `connectTapToPayReader`, `connectAppsOnDevicesReader`. Each takes `(reader, config)`.
- `simulated` defaults to **`true`**. Set `simulated: false` in production.
- Native Stripe SDKs call connect configuration classes (`BluetoothConnectionConfiguration`). Here they are plain objects.
- Reader field normalization: an unknown battery level is `null` rather than `0`, and an unknown software version is `null` rather than `'unknown'`, on every platform.

## Callbacks instead of delegates and events

| Stripe SDK                                                                                                                                                            | This plugin                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `TerminalDelegate`, `ReaderDisplayDelegate`, `MobileReaderListener`, `ReaderReconnectionListener` (native); `onConnectionStatusChange`, `onPaymentStatusChange` (JS). | One `terminal.didXxx(callback)` method per event. Each returns `Promise<PluginListenerHandle>`. |
| Stop by nil-ing the delegate or calling `.cancel()`.                                                                                                                  | `await handle.remove()`.                                                                        |

See [Events and listeners](./events.md) for the full list and the semantics that differ.

`terminal.addListener(name, fn)` does not exist. Use the dedicated methods.

## Payments

The flow is the same as Stripe's: _retrieve → collect → confirm → (capture on your server)_.

| Stripe SDK                                                                    | This plugin                                                                                                                                                |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `retrievePaymentIntent(clientSecret)`                                         | `retrievePaymentIntent(clientSecret)`                                                                                                                      |
| `collectPaymentMethod(paymentIntent)` takes the intent.                       | `collectPaymentMethod(config?)` takes **only** the optional collect config. The plugin remembers the active intent.                                        |
| `confirmPaymentIntent(paymentIntent)` (native) / `processPayment` (older JS). | `confirmPaymentIntent()` with no arguments.                                                                                                                |
| `cancelPaymentIntent(paymentIntent)`                                          | `cancelPaymentIntent()`                                                                                                                                    |
| `collectPaymentMethod` can run concurrently.                                  | A second call while one is in flight resolves to `null` instead of starting another. `setReaderDisplay`/`clearReaderDisplay` are ignored while collecting. |

One intent is active at a time. Call `retrievePaymentIntent` again to switch.

More detail, including the `captureMethod` default and `processRefund`, is in [Payments](./payments.md).

## Errors

Errors from `confirmPaymentIntent` are always thrown as `StripeTerminalError`, with `decline_code` and `payment_intent` populated on card declines. Other methods reject with the platform's raw error (`message`, and sometimes `code`/`data`).

See [Data and errors](./data-and-errors.md).

## Data shapes

- Enums are **string unions** (`'bluetoothScan'`, `'connected'`) rather than numeric enums, and they are identical on every platform.
- IDs are `id` (never `stripeId`).
- `PaymentIntent.charges` is a plugin-defined `Charge[]` with zero or one element. Stripe's native SDKs no longer expose `charges`.
- Types come from the plugin (`Reader`, `PaymentIntent`, `Charge`, …), not from the `stripe` Node package.

## Features that are plugin-only or platform-limited

| Feature                                                          | Notes                                                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `discoveryMethod: 'both'`                                        | Plugin-only. Bluetooth (native) + internet (JS).                                            |
| `supportsReadersOfType(deviceType, discoveryMethod, simulated?)` | Accepts `'both'`. Returns `true` if either underlying method is supported.                  |
| `getDeviceStyleFromDeviceType(type)`                             | Plugin-only helper. Returns `'bluetooth'`, `'internet'` or `'local'`.                       |
| `getSimulatorConfiguration` / `setSimulatorConfiguration`        | The native SDKs can't report the simulated card. The plugin remembers the last one you set. |
| `checkPermissions()` / `requestPermissions()`                    | Static. Android location permission. Not needed on iOS or web.                              |

Everything else is listed in the [platform support matrix](./platform-support.md).
