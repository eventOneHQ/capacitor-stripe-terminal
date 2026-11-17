---
title: 'Payments'
description: 'Plugin-specific behavior for PaymentIntents, refunds, offline payments, SetupIntents and the simulator.'
---

# Payments

Collecting a payment works the way [Stripe describes it](https://docs.stripe.com/terminal/payments/collect-card-payment). The plugin keeps one active intent, so the collect and confirm calls take no intent argument.

```ts
await terminal.retrievePaymentIntent(clientSecret)
await terminal.collectPaymentMethod({ skipTipping: true })
const intent = await terminal.confirmPaymentIntent()
```

Capture on your server (or let it auto-capture). The plugin does not capture.

## Collect options

`collectPaymentMethod(config?)` accepts `skipTipping`, `tipping`, `updatePaymentIntent`, `customerCancellation`, `allowRedisplay` and `requestDynamicCurrencyConversion`. These map to Stripe's `CollectConfiguration`. On the JS SDK, `customerCancellation: 'disableIfAvailable'` is not supported and throws.

## Capture method default

`createPaymentIntent` (creating the intent on the device) defaults to `captureMethod: 'automaticAsync'`, matching Terminal SDK 6.0. Pass `captureMethod: 'manual'` explicitly for on-receipt tipping, incremental authorizations and extended authorizations.

`createPaymentIntent` is available on iOS and Android only. Most integrations should create intents server-side and use `retrievePaymentIntent`.

## Refunds

A refund is a single call. `collectRefundPaymentMethod` and `confirmRefund` no longer exist (removed in Terminal SDK 6.0):

```ts
const refund = await terminal.processRefund({ chargeId, amount, currency })
await terminal.cancelProcessRefund() // to abort
```

Refunding by `paymentIntentId` is supported on iOS and Android only. On the JS SDK, pass `chargeId`.

## Card declines

`confirmPaymentIntent` throws a `StripeTerminalError` on declines. See [Data and errors](./data-and-errors.md).

## Payment method selection and QR codes

Mobile readers can offer more than one payment option, such as card or a QR code payment. Register handlers if you want to support this:

```ts
await terminal.onPaymentMethodSelectionRequired(
  (
    paymentIntent,
    options,
    { selectPaymentOption, failPaymentMethodSelection },
  ) => {
    // let the customer pick, then:
    selectPaymentOption('card') // or options[n].paymentMethodType
  },
)

await terminal.onQrCodeDisplayRequired(
  (paymentIntent, qrData, { confirmQrCodeDisplayed, failQrCodeDisplay }) => {
    // render qrData, then:
    confirmQrCodeDisplayed()
  },
)
```

If you don't register a selection handler, card is chosen automatically. If you don't register a QR handler, QR payments fail. Supported on Bluetooth and USB readers and Tap to Pay on iOS. Tap to Pay on Android doesn't accept an interaction listener in SDK 6.0.

## Offline payments (iOS and Android)

Set `offlineBehavior` (`'prefer_online'`, `'require_online'`, `'force_offline'`) on `createPaymentIntent`. Observe with `getOfflineStatus()`, `didChangeOfflineStatus`, `didForwardPaymentIntent` and `didReportForwardingError`. See Stripe's [offline payments guide](https://docs.stripe.com/terminal/features/operate-offline/overview). Not available on the JS SDK.

## SetupIntents

`createSetupIntent`, `retrieveSetupIntent`, `collectSetupIntentPaymentMethod`, `confirmSetupIntent` and `cancelSetupIntent` follow Stripe's [Save cards guide](https://docs.stripe.com/terminal/features/saving-payment-details/save-directly). Creating a SetupIntent on-device, `cancelSetupIntent` and `collectionReason: 'verify'` are iOS and Android only. The rest also work on the JS SDK.

## Other reader features

| Method                                    | Notes                                                              |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `collectInputs` / `cancelCollectInputs`   | On-reader forms. Internet smart readers only.                      |
| `collectData`                             | Raw magstripe or NFC UID data. iOS and Android only.               |
| `setReaderDisplay` / `clearReaderDisplay` | Cart display. Ignored while a payment method is being collected.   |
| `print`                                   | Prints a base64 PNG/JPEG or `data:` URI on readers with a printer. |
| `getReaderSettings` / `setReaderSettings` | Text to speech and accessibility.                                  |
| `rebootReader`                            | iOS and Android only.                                              |

## Simulator

`simulated` defaults to `true` in `discoverReaders`. Control the simulated reader with:

```ts
await terminal.setSimulatorConfiguration({
  simulatedCard: 'chargeDeclinedInsufficientFunds',
  availableReaderUpdate: 'required',
  offlineEnabled: true, // simulate being offline (iOS and Android)
})
```

- Pass `locationId` of the simulated reader's mock location when connecting.
- `availableReaderUpdate` is applied through the connection configuration, so it takes effect the **next time a reader is connected**.
- `simulatedCard: 'refundFailed'` is supported on iOS and web only. It rejects on Android.
- The native SDKs can't report the simulated card back, so `getSimulatorConfiguration()` returns the last value you set.

Use Stripe's [test card numbers](https://docs.stripe.com/terminal/references/testing) for simulated readers.
