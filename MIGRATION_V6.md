# Migration Guide: Stripe Terminal SDK v6

This release upgrades the native Stripe Terminal SDKs to **6.0.0** (iOS and Android), following the
[official SDK migration guide](https://docs.stripe.com/terminal/references/sdk-migration-guide).
`@stripe/terminal-js` is versioned separately and is unchanged.

| Component                     | Before | After |
| ----------------------------- | ------ | ----- |
| Stripe Terminal SDK (iOS)     | 5.8.0  | 6.0.0 |
| Stripe Terminal SDK (Android) | 5.8.1  | 6.0.0 |
| Minimum iOS                   | 15.0   | 16.0  |
| `compileSdk` (Android)        | 35     | 35+   |

## Platform changes

- **iOS**: the minimum deployment target is now iOS 16.0. The SDK is resolved from
  `https://github.com/stripe/stripe-terminal-ios-spm` (Swift Package Manager). Stripe no longer publishes
  new releases to CocoaPods, so the podspec's `StripeTerminal 6.0.0` dependency will not resolve from the
  public CocoaPods trunk; use Swift Package Manager (Capacitor 8's default).
- **Android**: all `com.stripe:stripeterminal-*` artifacts are `6.0.0` (built with Kotlin 2.3.21). The
  `android.permission.MODIFY_AUDIO_SETTINGS` permission is added to the plugin manifest for Tap to Pay.
  Test a minified release build, since the SDK's consumer ProGuard rules are narrower.

## JavaScript API changes

### Enums replaced with string unions

All numeric enums have been replaced with string union types, matching the [Stripe Terminal React Native SDK](https://github.com/stripe/stripe-terminal-react-native). Values are the same on iOS, Android and web, and are readable when logged. Previously, some values were mapped by position and came out wrong on Android (for example, several simulated card types and `SimulateReaderUpdate.LowBattery`).

Replace enum members with their string values, and remove the enum imports:

```typescript
// Before
import { DiscoveryMethod, ConnectionStatus } from 'capacitor-stripe-terminal'

terminal.discoverReaders({ discoveryMethod: DiscoveryMethod.BluetoothScan }, cb)
if (status === ConnectionStatus.Connected) { ... }

// After
terminal.discoverReaders({ discoveryMethod: 'bluetoothScan' }, cb)
if (status === 'connected') { ... }
```

The type names are unchanged, so you can still annotate with them, e.g. `let status: ConnectionStatus`.

| Type                   | Values                                                                                                                                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ConnectionStatus`     | `'notConnected'`, `'discovering'`, `'connecting'`, `'connected'`, `'reconnecting'`                                                                                                                                      |
| `PaymentStatus`        | `'notReady'`, `'ready'`, `'waitingForInput'`, `'processing'`                                                                                                                                                            |
| `DiscoveryMethod`      | `'bluetoothScan'`, `'bluetoothProximity'`, `'internet'`, `'both'`, `'usb'`, `'appsOnDevices'`, `'tapToPay'`                                                                                                             |
| `DeviceType`           | `'chipper2X'`, `'stripeM2'`, `'wisePad3'`, `'wisePosE'`, `'wisePosEDevkit'`, `'stripeS700'`, `'stripeS700Devkit'`, `'stripeS710'`, `'stripeS710Devkit'`, `'tapToPay'`, `'unknown'`, and more                            |
| `ReaderNetworkStatus`  | `'online'`, `'offline'`, `'unknown'`                                                                                                                                                                                    |
| `BatteryStatus`        | `'critical'`, `'low'`, `'nominal'`, `'unknown'`                                                                                                                                                                         |
| `LocationStatus`       | `'notSet'`, `'set'`, `'unknown'`                                                                                                                                                                                        |
| `LogLevel`             | `'none'`, `'error'`, `'warning'`, `'info'`, `'verbose'`                                                                                                                                                                 |
| `ReaderDisplayMessage` | `'retryCard'`, `'insertCard'`, `'insertOrSwipeCard'`, `'swipeCard'`, `'removeCard'`, `'multipleContactlessCardsDetected'`, `'tryAnotherReadMethod'`, `'tryAnotherCard'`, `'checkMobileDevice'`, `'cardRemovedTooEarly'` |
| `ReaderInputOptions`   | `'swipeCard'`, `'insertCard'`, `'tapCard'`                                                                                                                                                                              |
| `PaymentIntentStatus`  | `'requiresPaymentMethod'`, `'requiresConfirmation'`, `'requiresCapture'`, `'requiresAction'`, `'requiresReauthorization'`, `'processing'`, `'canceled'`, `'succeeded'`, `'unknown'`                                     |
| `ChargeStatus`         | `'succeeded'`, `'pending'`, `'failed'`                                                                                                                                                                                  |
| `SimulatedCardType`    | Camel-cased versions of the old names, e.g. `'visa'`, `'masterDebit'`, `'chargeDeclinedInsufficientFunds'`                                                                                                              |
| `SimulateReaderUpdate` | `'available'`, `'none'`, `'required'`, `'lowBattery'`, `'random'`                                                                                                                                                       |
| `DeviceStyle`          | `'internet'`, `'bluetooth'`, `'local'`                                                                                                                                                                                  |

Other changes that come with this:

- `ConnectionStatus` has two new values: `'discovering'` and `'reconnecting'` (an auto-reconnect is in progress). If you `switch` on the status, add cases for them.
- `charge.status` used to be an integer on iOS and a string on Android and web. It is now the same `ChargeStatus` string on every platform.
- `terminal.didRequestReaderInput(callback)` now passes an array, e.g. `['insertCard', 'tapCard']`, instead of a `ReaderInputOptions` bitmask.
- `DeviceType` values ending in `DevKit` are now spelled `Devkit`, e.g. `'wisePosEDevkit'`, matching the React Native SDK.
- `getConnectionStatus` no longer returns `isAndroid`.
- `setSimulatorConfiguration({ simulatedCard: 'refundFailed' })` now rejects on Android, which has no such simulated card. Previously it silently picked a different card.

### Reader types reported accurately

Readers are now reported with their actual device type, including the Stripe S700/S710, T600/T610, U200 and Verifone readers (see the `DeviceType` values above).

### Reader disconnect and reader event changes

These events now fire the same way on iOS, Android and web. Their payloads match the [Stripe Terminal React Native SDK](https://github.com/stripe/stripe-terminal-react-native).

- `onUnexpectedReaderDisconnect` now fires on iOS. It also now fires for Internet readers on Android. It no longer fires on Android when your app calls `disconnectReader()` or `rebootReader()`. The callback now receives a `DisconnectReason` argument.
- New `terminal.didDisconnect(callback)`. It fires on every disconnect, including ones your app requested, and passes the `DisconnectReason`.
- New `terminal.didReportReaderEvent(callback)` (`'cardInserted' | 'cardRemoved'`) and `terminal.didReportLowBatteryWarning(callback)`. Both work on iOS and Android.
- The Tap to Pay terms-of-service event (`localMobileReaderDidAcceptTermsOfService` in v3, `tapToPayReaderDidAcceptTermsOfService` in earlier v5 betas) is now `didAcceptTermsOfService`. Use `terminal.didAcceptTermsOfService(callback)` to listen for it.
- The Android-only `didReportBatteryLevel` event has been removed. Use `terminal.didUpdateBatteryLevel(callback)` instead.
- If you listen to raw native events with `addListener`, these payloads have changed:
  - `didReportUnexpectedReaderDisconnect` is now `{ reason }` (it used to be `{ reader }`).
  - `didRequestReaderInput` is now `{ result: ('swipeCard' | 'insertCard' | 'tapCard')[] }`.
  - `didRequestReaderDisplayMessage` is now `{ result }` (it used to be `{ value }`).
  - `didReportReaderEvent` is now `{ result: 'cardInserted' | 'cardRemoved' }`.

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
