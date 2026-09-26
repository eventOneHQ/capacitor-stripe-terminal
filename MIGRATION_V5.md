# Migration Guide: v3 → v5 (Capacitor v8 + Stripe Terminal SDK v5)

This guide covers the breaking changes when upgrading to `capacitor-stripe-terminal` v5.

> **Note on version numbering:** `capacitor-stripe-terminal` jumps from v3 directly to v5, skipping v4. This was intentional — the version was bumped to v5 to stay in sync with the Stripe Terminal native SDKs, which are also on v5.

## What Changed

| Package                       | Before  | After   |
| ----------------------------- | ------- | ------- |
| `capacitor-stripe-terminal`   | v3.x    | v5.x    |
| Capacitor                     | v4.0.0  | v8.0.2  |
| Stripe Terminal SDK (iOS)     | v2.17.1 | v5.8.0  |
| Stripe Terminal SDK (Android) | v2.17.1 | v5.8.1  |
| `@stripe/terminal-js`         | v0.11.0 | v0.26.0 |

## Requirements

- **iOS**: minimum deployment target iOS 15.0 (up from 13.0), Xcode 16.0+
- **Android**: minimum SDK API 23 (Android 6.0), target SDK API 35 (Android 15), Gradle 8.3.2+
- **Capacitor**: 8.x

## Upgrade Steps

1. Upgrade your app to Capacitor v8 by following the [official Capacitor v8 update guide](https://capacitorjs.com/docs/updating/8-0).

2. Update dependencies:

```bash
npm install capacitor-stripe-terminal@latest
npm install @capacitor/core@8 @capacitor/ios@8 @capacitor/android@8
```

3. Sync native files:

```bash
npx cap sync
```

4. Update the iOS deployment target:
   - Open your project in Xcode
   - Select your app target → **General** → **Deployment Info**
   - Set **Minimum Deployments** to **iOS 15.0**

5. Apply the breaking changes below. They are ordered by how likely they are to affect your app.

## Breaking Changes

### 1. Enums replaced with string unions

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

### 2. Observable API replaced with callbacks (`rxjs` removed)

`rxjs` has been removed as a dependency. All methods that previously returned an `Observable` now accept a callback and return `Promise<PluginListenerHandle>`. Call `handle.remove()` to stop listening instead of `subscription.unsubscribe()`. You can remove `rxjs` from your own dependencies if nothing else uses it.

| Method                                  | Before                                                               | After                                                                            |
| --------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `discoverReaders`                       | `discoverReaders(options): Observable<Reader[]>`                     | `discoverReaders(options, callback): Promise<PluginListenerHandle>`              |
| `connectionStatus`                      | `connectionStatus(): Observable<ConnectionStatus>`                   | `connectionStatus(callback): Promise<PluginListenerHandle>`                      |
| `didRequestReaderInput`                 | `didRequestReaderInput(): Observable<ReaderInputOptions>`            | `didRequestReaderInput(callback): Promise<PluginListenerHandle>`                 |
| `didRequestReaderDisplayMessage`        | `didRequestReaderDisplayMessage(): Observable<ReaderDisplayMessage>` | `didRequestReaderDisplayMessage(callback): Promise<PluginListenerHandle>`        |
| `didReportAvailableUpdate`              | `didReportAvailableUpdate(): Observable<ReaderSoftwareUpdate>`       | `didReportAvailableUpdate(callback): Promise<PluginListenerHandle>`              |
| `didStartInstallingUpdate`              | `didStartInstallingUpdate(): Observable<ReaderSoftwareUpdate>`       | `didStartInstallingUpdate(callback): Promise<PluginListenerHandle>`              |
| `didReportReaderSoftwareUpdateProgress` | `didReportReaderSoftwareUpdateProgress(): Observable<number>`        | `didReportReaderSoftwareUpdateProgress(callback): Promise<PluginListenerHandle>` |
| `didFinishInstallingUpdate`             | `didFinishInstallingUpdate(): Observable<...>`                       | `didFinishInstallingUpdate(callback): Promise<PluginListenerHandle>`             |
| `didStartReaderReconnect`               | `didStartReaderReconnect(): Observable<void>`                        | `didStartReaderReconnect(callback): Promise<PluginListenerHandle>`               |
| `didSucceedReaderReconnect`             | `didSucceedReaderReconnect(): Observable<void>`                      | `didSucceedReaderReconnect(callback): Promise<PluginListenerHandle>`             |
| `didFailReaderReconnect`                | `didFailReaderReconnect(): Observable<void>`                         | `didFailReaderReconnect(callback): Promise<PluginListenerHandle>`                |

```typescript
// Before
const discoverSub = terminal
  .discoverReaders({
    simulated: false,
    discoveryMethod: DiscoveryMethod.BluetoothScan,
  })
  .subscribe((readers) => {
    console.log('readers', readers)
  })

const displaySub = terminal
  .didRequestReaderDisplayMessage()
  .subscribe((message) => {
    console.log('displayMessage', message)
  })

// Later...
discoverSub.unsubscribe()
displaySub.unsubscribe()

// After
const discoverHandle = await terminal.discoverReaders(
  { simulated: false, discoveryMethod: 'bluetoothScan' },
  (readers) => {
    console.log('readers', readers)
  },
)

const displayHandle = await terminal.didRequestReaderDisplayMessage(
  (message) => {
    console.log('displayMessage', message)
  },
)

// Later...
discoverHandle.remove()
displayHandle.remove()
```

### 3. `processPayment` renamed to `confirmPaymentIntent`

`processPayment()` has been renamed to `confirmPaymentIntent()` to match the underlying Stripe Terminal SDK.

```typescript
// Before
await terminal.processPayment()

// After
await terminal.confirmPaymentIntent()
```

Errors are now always thrown as `StripeTerminalError`. On card declines, `decline_code` and `payment_intent` are now populated; previously they were always `undefined`.

```typescript
try {
  await terminal.confirmPaymentIntent()
} catch (error) {
  if (error instanceof StripeTerminalError) {
    console.log(error.message) // human-readable reason, always present
    console.log(error.decline_code) // e.g. "insufficient_funds"
    console.log(error.payment_intent) // updated PaymentIntent (status: requires_payment_method)
  }
}
```

### 4. Reader types and discovery methods renamed or removed

| Before                                                | After                                                  |
| ----------------------------------------------------- | ------------------------------------------------------ |
| `DiscoveryMethod.LocalMobile`                         | `'tapToPay'`                                           |
| `LocalMobileConnectionConfiguration`                  | `TapToPayConnectionConfiguration`                      |
| `connectLocalMobileReader()`                          | `connectTapToPayReader()`                              |
| `DeviceType.AppleBuiltIn`                             | `'tapToPay'` (now covers both iOS and Android)         |
| `DiscoveryMethod.Embedded`, `DiscoveryMethod.Handoff` | `'appsOnDevices'` (Android only)                       |
| `HandoffConnectionConfiguration`                      | `AppsOnDevicesConnectionConfiguration`                 |
| `connectHandoffReader()`                              | `connectAppsOnDevicesReader()`                         |
| `DeviceType.VerifoneP400`                             | Removed. The P400 is not supported by Terminal SDK v5. |

```typescript
// Before
terminal.discoverReaders({ discoveryMethod: DiscoveryMethod.LocalMobile }, cb)
terminal.connectLocalMobileReader(reader, config)
if (reader.deviceType === DeviceType.AppleBuiltIn) { ... }

terminal.discoverReaders({ discoveryMethod: DiscoveryMethod.Handoff }, cb)
terminal.connectHandoffReader(reader, config)

// After
terminal.discoverReaders({ discoveryMethod: 'tapToPay' }, cb)
terminal.connectTapToPayReader(reader, config)
if (reader.deviceType === 'tapToPay') { ... }

terminal.discoverReaders({ discoveryMethod: 'appsOnDevices' }, cb)
terminal.connectAppsOnDevicesReader(reader)
```

The `'usb'` and `'appsOnDevices'` discovery methods, `connectUsbReader` and `connectAppsOnDevicesReader` are Android-only. On iOS they now reject with a clear message; previously `'usb'` silently fell back to a Bluetooth scan.

Readers are now reported with their actual device type, including the Stripe S700/S710, T600/T610, U200 and Verifone readers.

### 5. Reader disconnect and reader event changes

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

### 6. `PaymentIntent.charges` uses the plugin's `Charge` type

`PaymentIntent.charges` now uses the plugin-defined `Charge` interface instead of `Stripe.Charge` from the `stripe` Node.js package. This gives a consistent shape across iOS, Android and web, and avoids importing a server-side type in client code.

```typescript
// Before
import { Stripe } from 'stripe'
const charge: Stripe.Charge = paymentIntent.charges[0]

// After
import { Charge } from 'capacitor-stripe-terminal'
const charge: Charge = paymentIntent.charges[0]
```

### 7. `ReaderSoftwareUpdate.estimatedUpdateTime` is now a string union

`estimatedUpdateTime` was typed as `string`, but the native SDKs actually sent a number. It is now a proper string union, and the fields the native layers were already sending are now declared.

```typescript
interface ReaderSoftwareUpdate {
  estimatedUpdateTime:
    | 'estimateLessThan1Minute'
    | 'estimate1To2Minutes'
    | 'estimate2To5Minutes'
    | 'estimate5To15Minutes'
  estimatedUpdateTimeString: string // e.g. "1-2 minutes"
  deviceSoftwareVersion: string
  components: ('firmware' | 'config' | 'keys' | 'incremental')[]
  requiredAt?: number | null
}
```

If you were displaying `estimatedUpdateTime` directly, switch to `estimatedUpdateTimeString`.

### 8. Native logging now defaults to off

Android previously hardcoded verbose logging, and iOS had logging disabled entirely. Both now default to `'none'`. Pass `logLevel` to opt in:

```typescript
const terminal = await StripeTerminalPlugin.create({
  fetchConnectionToken,
  onUnexpectedReaderDisconnect,
  logLevel: 'verbose',
})
```

## Deprecations

### `stripeId` deprecated in favour of `id`

`Reader`, `PaymentIntent`, `Charge`, `Location` and `CollectedData` now expose an `id` field, matching the Stripe API and the JS/React Native SDKs. `stripeId` is still populated for the whole of v5, but it is deprecated and **will be removed in v6**.

```typescript
// Before
const id = paymentIntent.stripeId

// After
const id = paymentIntent.id
```

## Testing Your Migration

After upgrading, test the following scenarios:

1. **Reader Discovery**: Ensure you can discover readers
2. **Reader Connection**: Test connecting to different reader types
3. **Payment Collection**: Verify payment collection works
4. **Reader Disconnection**: Test disconnection and auto-reconnection
5. **Connection Status**: Verify connection status updates work correctly

## Additional Resources

- [Stripe Terminal iOS SDK v5 Migration Guide](https://docs.stripe.com/terminal/references/sdk-migration-guide?terminal-sdk-platform=ios)
- [Stripe Terminal Android SDK v5 Changelog](https://github.com/stripe/stripe-terminal-android/blob/master/CHANGELOG.md)

## Getting Help

If you encounter issues during migration:

1. Check the [GitHub Issues](https://github.com/eventOneHQ/capacitor-stripe-terminal/issues)
2. Review the [Stripe Terminal documentation](https://stripe.com/docs/terminal)
3. Open a new issue with details about your problem
