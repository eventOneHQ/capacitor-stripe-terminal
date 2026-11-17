---
title: 'Events and listeners'
description: 'The callback + handle listener model, and the events the plugin exposes.'
---

# Events and listeners

Stripe's native SDKs report events through delegates and the JS SDK through constructor options. The plugin exposes **one method per event**. Each takes a callback and resolves to a `PluginListenerHandle`.

```ts
const handle = await terminal.didDisconnect((reason) => {
  console.log('reader disconnected:', reason)
})

// stop listening
await handle.remove()
```

- Listeners work on both the native and JS SDKs. Events only reach your callback from the SDK that is currently active (see [Differences from Stripe's SDKs](./differences-from-stripe.md#one-api-three-sdks)), so you never see duplicates.
- `terminal.destroy()` removes every listener the **plugin** created for itself. Handles **you** created are yours to remove, so keep them and call `remove()` on unmount.
- `terminal.addListener(...)` was removed in v6.

## Event reference

| Method                                      | Callback argument                                                   | Notes                                                             |
| ------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `connectionStatus(cb)`                      | `ConnectionStatus`                                                  | Called once with the current value, then on every change.         |
| `didRequestReaderDisplayMessage(cb)`        | `ReaderDisplayMessage`                                              | Show this to the customer, e.g. `'insertOrSwipeCard'`.            |
| `didRequestReaderInput(cb)`                 | `ReaderInputOptions[]`                                              | An **array**, e.g. `['insertCard', 'tapCard']` (not a bitmask).   |
| `didDisconnect(cb)`                         | `DisconnectReason`                                                  | Fires on **every** disconnect, including ones your app requested. |
| `didReportReaderEvent(cb)`                  | `'cardInserted' \| 'cardRemoved'`                                   | Bluetooth and USB.                                                |
| `didReportLowBatteryWarning(cb)`            | none                                                                | Bluetooth and USB.                                                |
| `didUpdateBatteryLevel(cb)`                 | `BatteryLevel`                                                      | Bluetooth and Tap to Pay.                                         |
| `didAcceptTermsOfService(cb)`               | none                                                                | Tap to Pay on iOS.                                                |
| `didStartReaderReconnect(cb)`               | none                                                                | Needs `autoReconnectOnUnexpectedDisconnect`.                      |
| `didSucceedReaderReconnect(cb)`             | none                                                                | Same.                                                             |
| `didFailReaderReconnect(cb)`                | none                                                                | Same.                                                             |
| `didReportAvailableUpdate(cb)`              | `ReaderSoftwareUpdate \| null`                                      |                                                                   |
| `didStartInstallingUpdate(cb)`              | `ReaderSoftwareUpdate`                                              |                                                                   |
| `didReportReaderSoftwareUpdateProgress(cb)` | `number`                                                            | 0 to 1.                                                           |
| `didFinishInstallingUpdate(cb)`             | update result                                                       |                                                                   |
| `didChangeOfflineStatus(cb)`                | `OfflineStatus`                                                     | iOS and Android.                                                  |
| `didForwardPaymentIntent(cb)`               | `(paymentIntent, error?)`                                           | iOS and Android.                                                  |
| `didReportForwardingError(cb)`              | `string`                                                            | iOS and Android.                                                  |
| `onPaymentMethodSelectionRequired(handler)` | see [Payments](./payments.md#payment-method-selection-and-qr-codes) |                                                                   |
| `onQrCodeDisplayRequired(handler)`          | see [Payments](./payments.md#payment-method-selection-and-qr-codes) |                                                                   |

## Disconnect handling

There are two distinct disconnect hooks:

|                                              | When it fires                                                                                                                                                                                            |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onUnexpectedReaderDisconnect` (in `create`) | The reader dropped without your app asking. Never fires for `disconnectReader()` or `rebootReader()`. Receives a `DisconnectReason`. Fires on iOS, Android and web, and for internet readers on Android. |
| `terminal.didDisconnect(cb)`                 | Every disconnect, requested or not.                                                                                                                                                                      |

Use `onUnexpectedReaderDisconnect` to show "reader lost" UI, and `didDisconnect` for bookkeeping.

## Software updates

```ts
await terminal.didReportAvailableUpdate((update) => {
  // update.estimatedUpdateTimeString, e.g. "1-2 minutes"
})
await terminal.installAvailableUpdate()
```

`estimatedUpdateTime` is a string union (`'estimateLessThan1Minute'`, …). Use `estimatedUpdateTimeString` for display.
