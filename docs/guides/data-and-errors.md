---
title: 'Data and errors'
description: 'String unions, consistent object shapes, and StripeTerminalError.'
---

# Data and errors

## String unions instead of enums

All enums are string unions with the same values on every platform. They match the [Stripe Terminal React Native SDK](https://github.com/stripe/stripe-terminal-react-native).

```ts
terminal.discoverReaders({ discoveryMethod: 'bluetoothScan' }, cb)
if (status === 'connected') {
  /* ... */
}
```

The type names exist for annotations (`let status: ConnectionStatus`), but you never import a runtime value. The full value list is in the [v6 migration guide](../migration/v6.md#enums-replaced-with-string-unions) and the [API reference](../api-reference.md).

`DeviceType` mirrors Stripe's reader list, including Stripe S700/S710, T600/T610, U200 and Verifone readers. Development readers end in `Devkit` (for example `'wisePosEDevkit'`).

## Consistent object shapes

- **IDs** are `id`. `stripeId` was removed in v6.
- **`Charge.status`** is always `'succeeded' | 'pending' | 'failed'`. It used to be an integer on iOS.
- **`PaymentIntent.charges`** contains zero or one `Charge`, populated from the latest charge. Native SDK 6.0 dropped `charges`.
- **Reader fields** are normalized: unknown `batteryLevel` and `deviceSoftwareVersion` are `null`.
- **Types are plugin-defined.** `Charge` is not `Stripe.Charge`, so you don't need the `stripe` Node package in client code.

## Errors

```ts
import { StripeTerminalError } from 'capacitor-stripe-terminal'

try {
  await terminal.confirmPaymentIntent()
} catch (err) {
  if (err instanceof StripeTerminalError) {
    err.message // human-readable reason, always present
    err.decline_code // e.g. 'insufficient_funds'
    err.payment_intent // updated PaymentIntent
  }
}
```

- `confirmPaymentIntent` always wraps errors that have a message in `StripeTerminalError`.
- `decline_code` and `payment_intent` are populated on card declines.
- Other methods reject with the platform's error object. Don't assume `instanceof StripeTerminalError` elsewhere.
- Error **messages** are localized by the native SDK. Branch on codes, not text. Pass `locale: 'en-US'` to `StripeTerminalPlugin.create` to fix the locale (iOS and Android).

## Logging

The native SDK logs nothing by default. Opt in with `logLevel` in `create`:

```ts
await StripeTerminalPlugin.create({
  fetchConnectionToken,
  onUnexpectedReaderDisconnect,
  logLevel: 'verbose',
})
```

iOS only distinguishes `none` from verbose, so every level other than `'none'` is verbose there.
