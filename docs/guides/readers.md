---
title: 'Readers and discovery'
description: 'How discovery methods map to SDKs, and how to connect each reader type.'
---

# Readers and discovery

For how readers work in general, see Stripe's [reader documentation](https://docs.stripe.com/terminal/readers). This page covers how the plugin exposes them.

## Discovery methods

| `discoveryMethod`         | Reader types                                                    | Platform          | SDK used    |
| ------------------------- | --------------------------------------------------------------- | ----------------- | ----------- |
| `bluetoothScan` (default) | Stripe M2, BBPOS WisePad 3 / 3s, Chipper 2X BT                  | iOS, Android      | Native      |
| `bluetoothProximity`      | Chipper 2X BT, held close to the device                         | iOS               | Native      |
| `internet`                | WisePOS E, Stripe S700 / S710, Verifone                         | iOS, Android, web | **JS**      |
| `both`                    | Union of `bluetoothScan` and `internet`                         | iOS, Android      | Native + JS |
| `usb`                     | Readers connected over USB                                      | Android           | Native      |
| `appsOnDevices`           | The device itself (see [Apps on Devices](./apps-on-devices.md)) | Android           | Native      |
| `tapToPay`                | The phone's own NFC reader                                      | iOS, Android      | Native      |

::: callout warning "iOS limitations"
`usb` and `appsOnDevices` reject on iOS with a clear error. They don't silently fall back to Bluetooth. USB is gated behind a private preview in the public iOS SDK.
:::

## Discovering

```ts
const handle = await terminal.discoverReaders(
  { simulated: false, discoveryMethod: 'both', locationId: 'tml_123' },
  (readers) => {
    /* the complete, merged list each time */
  },
  (error) => {
    /* discovery failed */
  },
)

// later
await handle.remove()
```

- `locationId` filters **internet** results only. For `both` it applies to the internet half and is stripped from the Bluetooth scan.
- The discovery promise returned by the underlying SDK is not exposed. The `error` callback is the only failure signal, so always provide it.
- Starting a new discovery removes the previous discovery listeners, so you don't get duplicate callbacks.

## Connecting

```ts
// Bluetooth
await terminal.connectBluetoothReader(reader, {
  locationId: 'tml_123',
  autoReconnectOnUnexpectedDisconnect: true,
})

// Internet
await terminal.connectInternetReader(reader, { failIfInUse: true })

// Tap to Pay
await terminal.connectTapToPayReader(reader, {
  locationId: 'tml_123',
  onBehalfOf: 'acct_123', // destination charges with on_behalf_of
  tosAcceptancePermitted: true, // iOS: may present the Apple ToS flow
})

// USB (Android)
await terminal.connectUsbReader(reader, { locationId: 'tml_123' })
```

Each resolves to the connected `Reader`, or `null` if the SDK returned nothing.

Connecting selects the SDK for all later calls. If you connect an internet reader and then call, say, `collectPaymentMethod`, the JS SDK handles it.

## Auto-reconnect

`autoReconnectOnUnexpectedDisconnect` on Bluetooth and USB connection configs enables the SDK's reconnection. While it runs, `connectionStatus` reports `'reconnecting'`, and `didStartReaderReconnect`, `didSucceedReaderReconnect` and `didFailReaderReconnect` fire. Call `cancelAutoReconnect()` to stop it.

## Connection status

`connectionStatus(callback)` calls back immediately with the current status and then on every change. Handle all five values: `'notConnected'`, `'discovering'`, `'connecting'`, `'connected'`, `'reconnecting'`.

`getConnectionStatus()` and `getPaymentStatus()` return one-time values.

## Feature checks

`supportsReadersOfType(deviceType, discoveryMethod, simulated?)` asks the native SDK whether this phone can use a reader type, for example whether Tap to Pay is available on this device.
