# Migration Guide: Stripe Terminal SDK v6

This release upgrades the native Stripe Terminal SDKs to **6.0.0** (iOS and Android), following the
[official SDK migration guide](https://docs.stripe.com/terminal/references/sdk-migration-guide).
`@stripe/terminal-js` is versioned separately and is unchanged.

| Component                     | Before | After  |
| ----------------------------- | ------ | ------ |
| Stripe Terminal SDK (iOS)     | 5.8.0  | 6.0.0  |
| Stripe Terminal SDK (Android) | 5.8.1  | 6.0.0  |
| Minimum iOS                   | 15.0   | 16.0   |
| `compileSdk` (Android)        | 35     | 35+    |

## Platform changes

- **iOS**: the minimum deployment target is now iOS 16.0. The SDK is resolved from
  `https://github.com/stripe/stripe-terminal-ios-spm` (Swift Package Manager). Stripe no longer publishes
  new releases to CocoaPods, so the podspec's `StripeTerminal 6.0.0` dependency will not resolve from the
  public CocoaPods trunk; use Swift Package Manager (Capacitor 8's default).
- **Android**: all `com.stripe:stripeterminal-*` artifacts are `6.0.0` (built with Kotlin 2.3.21). The
  `android.permission.MODIFY_AUDIO_SETTINGS` permission is added to the plugin manifest for Tap to Pay.
  Test a minified release build, since the SDK's consumer ProGuard rules are narrower.

## JavaScript API changes

### Refunds: `processRefund`

The two-step refund flow was removed from the native SDKs. Replace `collectRefundPaymentMethod` +
`confirmRefund` with a single `processRefund` call, and `cancelCollectRefundPaymentMethod` with
`cancelProcessRefund`.

```ts
// Before
await terminal.collectRefundPaymentMethod({ chargeId, amount, currency })
const refund = await terminal.confirmRefund()

// After
const refund = await terminal.processRefund({ chargeId, amount, currency })
```

### `captureMethod` default

`createPaymentIntent` no longer defaults to manual capture on native; the SDK default is now
`automaticAsync`. Pass `captureMethod: 'manual'` explicitly for on-receipt tipping, incremental
authorizations and extended authorizations. `'automaticAsync'` is now an accepted value.

### Removed `allowCustomerCancel`

`allowCustomerCancel` was removed from `connectInternetReader`. Use `customerCancellation` on the
individual collect calls instead (default `enableIfAvailable`).

### New `locale` option

`StripeTerminalPlugin.create({ locale: 'en-US' })` sets a fixed locale for API error messages. Without it the
SDK uses the card's language preference when available. Branch on error codes, not message text.

### Simulated reader updates

`setSimulatorConfiguration({ availableReaderUpdate })` is now applied through the connection configuration
(`testReaderUpdate`), so it takes effect the **next time a reader is connected** (sandbox only).
`getSimulatorConfiguration()` reports the value last set. USB/iOS-specific limitations are unchanged.

### Payment interactions

QR code and payment method selection callbacks (`onQrCodeDisplayRequired`,
`onPaymentMethodSelectionRequired`) keep the same JavaScript API. Natively they are delivered through
`ReaderPaymentInteractionDelegate` / `ReaderPaymentInteractionListener`, which the plugin now sets on the
Bluetooth, USB and Tap to Pay (iOS) connection configurations. Tap to Pay on Android does not accept an
interaction listener in 6.0.

### Payment intent `charges`

`PaymentIntent.charges` was removed natively. The plugin still returns a `charges` array, populated from the
latest charge (zero or one element).

## Not covered / limitations

- Android Tap to Pay now connects with `TapUseCase.Pay(locationId)`.
- Android `TapToPayUxConfiguration` renames and `TapUseCase.Verify` are not exposed by this plugin.
