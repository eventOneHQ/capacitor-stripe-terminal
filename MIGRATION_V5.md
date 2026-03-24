# Migration Guide: v3 → v5 (Capacitor v8 + Stripe Terminal SDK v5)

This guide covers the breaking changes when upgrading to `capacitor-stripe-terminal` v5.

> **Note on version numbering:** `capacitor-stripe-terminal` jumps from v3 directly to v5, skipping v4. This was intentional — the version was bumped to v5 to stay in sync with the Stripe Terminal native SDKs, which are also on v5.

## What Changed

| Package                       | Before  | After   |
| ----------------------------- | ------- | ------- |
| `capacitor-stripe-terminal`   | v3.x    | v5.x    |
| Capacitor                     | v4.0.0  | v8.0.2  |
| Stripe Terminal SDK (iOS)     | v2.17.1 | v5.3.0  |
| Stripe Terminal SDK (Android) | v2.17.1 | v5.3.0  |
| `@stripe/terminal-js`         | v0.11.0 | v0.26.0 |

## Requirements

### iOS

- **Minimum deployment target**: iOS 15.0 (up from 13.0)
- **Xcode**: 16.0+

### Android

- **Minimum SDK**: API 23 (Android 6.0)
- **Target SDK**: API 35 (Android 15)
- **Gradle**: 8.3.2+

### Capacitor

- **Capacitor**: 8.x

## Upgrade Steps

1. Update dependencies:

```bash
npm install capacitor-stripe-terminal@latest
npm install @capacitor/core@8 @capacitor/ios@8 @capacitor/android@8
```

2. Sync native files:

```bash
npx cap sync
```

3. Update the iOS deployment target:
   - Open your project in Xcode
   - Select your app target → **General** → **Deployment Info**
   - Set **Minimum Deployments** to **iOS 15.0**

4. Apply the breaking changes listed below.

## Breaking Changes

### 1. `rxjs` removed — Observable API replaced with callbacks

`rxjs` has been removed as a dependency. All methods that previously returned an `Observable` now accept a callback and return `Promise<PluginListenerHandle>`. Call `handle.remove()` to stop listening instead of `subscription.unsubscribe()`.

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
import { Observable } from 'rxjs'

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

const inputSub = terminal.didRequestReaderInput().subscribe((options) => {
  console.log('inputOptions', options)
})

// Later...
discoverSub.unsubscribe()
displaySub.unsubscribe()
inputSub.unsubscribe()

// After
const discoverHandle = await terminal.discoverReaders(
  { simulated: false, discoveryMethod: DiscoveryMethod.BluetoothScan },
  (readers) => {
    console.log('readers', readers)
  },
)

const displayHandle = await terminal.didRequestReaderDisplayMessage(
  (message) => {
    console.log('displayMessage', message)
  },
)

const inputHandle = await terminal.didRequestReaderInput((options) => {
  console.log('inputOptions', options)
})

// Later...
discoverHandle.remove()
displayHandle.remove()
inputHandle.remove()
```

### 2. `processPayment` renamed to `confirmPaymentIntent`

`processPayment` has been renamed to `confirmPaymentIntent` to match the underlying Stripe Terminal SDK.

| Before             | After                    |
| ------------------ | ------------------------ |
| `processPayment()` | `confirmPaymentIntent()` |

```typescript
// Before
await terminal.processPayment()

// After
await terminal.confirmPaymentIntent()
```

### 3. `LocalMobile` renamed to `TapToPay`

All `LocalMobile` identifiers have been renamed to `TapToPay` to align with the Stripe Terminal SDK.

| Before                                            | After                                          |
| ------------------------------------------------- | ---------------------------------------------- |
| `DiscoveryMethod.LocalMobile`                     | `DiscoveryMethod.TapToPay`                     |
| `LocalMobileConnectionConfiguration`              | `TapToPayConnectionConfiguration`              |
| `connectLocalMobileReader()`                      | `connectTapToPayReader()`                      |
| event: `localMobileReaderDidAcceptTermsOfService` | event: `tapToPayReaderDidAcceptTermsOfService` |

```typescript
// Before
import {
  DiscoveryMethod,
  LocalMobileConnectionConfiguration,
} from 'capacitor-stripe-terminal'

terminal.discoverReaders({ discoveryMethod: DiscoveryMethod.LocalMobile })
terminal.connectLocalMobileReader(
  reader,
  config as LocalMobileConnectionConfiguration,
)
terminal.addListener('localMobileReaderDidAcceptTermsOfService', handler)

// After
import {
  DiscoveryMethod,
  TapToPayConnectionConfiguration,
} from 'capacitor-stripe-terminal'

terminal.discoverReaders({ discoveryMethod: DiscoveryMethod.TapToPay })
terminal.connectTapToPayReader(
  reader,
  config as TapToPayConnectionConfiguration,
)
terminal.addListener('tapToPayReaderDidAcceptTermsOfService', handler)
```

### 4. `DeviceType.AppleBuiltIn` renamed to `DeviceType.TapToPay`; new device types added

`DeviceType.AppleBuiltIn` has been renamed to `DeviceType.TapToPay` to reflect that it now covers both iOS and Android Tap to Pay. The numeric value (`11`) is unchanged.

New device type values have also been added:

| Change                      | Name                          | Value |
| --------------------------- | ----------------------------- | ----- |
| Added                       | `DeviceType.StripeS700DevKit` | `10`  |
| Renamed from `AppleBuiltIn` | `DeviceType.TapToPay`         | `11`  |
| Added                       | `DeviceType.StripeS710`       | `12`  |
| Added                       | `DeviceType.StripeS710DevKit` | `13`  |

```typescript
// Before
if (reader.deviceType === DeviceType.AppleBuiltIn) { ... }

// After
if (reader.deviceType === DeviceType.TapToPay) { ... }
```

### 5. `Embedded` and `Handoff` discovery methods replaced by `AppsOnDevices` (Android)

The `Embedded` and `Handoff` discovery methods have been removed. They are replaced by `DiscoveryMethod.AppsOnDevices`, the Stripe Terminal Android SDK v5's unified method for apps running directly on a reader device (e.g. Stripe Reader S700). This method is Android-only.

`connectHandoffReader` has been replaced by `connectAppsOnDevicesReader`.

| Before                           | After                                  |
| -------------------------------- | -------------------------------------- |
| `DiscoveryMethod.Embedded`       | `DiscoveryMethod.AppsOnDevices`        |
| `DiscoveryMethod.Handoff`        | `DiscoveryMethod.AppsOnDevices`        |
| `HandoffConnectionConfiguration` | `AppsOnDevicesConnectionConfiguration` |
| `connectHandoffReader()`         | `connectAppsOnDevicesReader()`         |

```typescript
// Before
discoverReaders({ discoveryMethod: DiscoveryMethod.Embedded })
discoverReaders({ discoveryMethod: DiscoveryMethod.Handoff })
connectHandoffReader(reader, config as HandoffConnectionConfiguration)

// After
discoverReaders({ discoveryMethod: DiscoveryMethod.AppsOnDevices })
connectAppsOnDevicesReader(reader)
```

### 6. `DeviceType.VerifoneP400` removed

The Verifone P400 is no longer supported by Stripe Terminal SDK v5. `DeviceType.VerifoneP400` has been removed.

```typescript
// Before
if (reader.deviceType === DeviceType.VerifoneP400) {
  // handle Verifone P400
}

// After — remove this code path entirely
```

### 7. New `ConnectionStatus.Reconnecting` value

A new `Reconnecting` value has been added to the `ConnectionStatus` enum to represent an in-progress auto-reconnect.

```typescript
export enum ConnectionStatus {
  NotConnected = 0,
  Connected = 1,
  Connecting = 2,
  Reconnecting = 3, // new in v5
}
```

If you handle all connection status values (e.g. in a `switch` statement), add a case for `ConnectionStatus.Reconnecting`.

```typescript
const handle = await terminal.connectionStatus((status) => {
  switch (status) {
    case ConnectionStatus.NotConnected:
      break
    case ConnectionStatus.Connected:
      break
    case ConnectionStatus.Connecting:
      break
    case ConnectionStatus.Reconnecting: // new
      // auto-reconnect is in progress
      break
  }
})
```

### 8. `confirmPaymentIntent` now surfaces structured decline data

`confirmPaymentIntent` now populates `decline_code` and `payment_intent` on the thrown `StripeTerminalError` when a card is declined. Previously these fields were always `undefined` because the native layers did not attach structured data to their rejections.

```typescript
try {
  await terminal.confirmPaymentIntent()
} catch (error) {
  if (error instanceof StripeTerminalError) {
    console.log(error.message) // human-readable reason, always present
    console.log(error.decline_code) // e.g. "insufficient_funds" (now populated on declines)
    console.log(error.payment_intent) // updated PaymentIntent (status: requires_payment_method)
  }
}
```

No code changes are required to benefit from this fix, but you may want to add handling for `decline_code` and `payment_intent` if your app does not already.

> **Note:** Error wrapping is also more consistent. Previously, if the native side returned an error without a data payload, the raw error was re-thrown without being wrapped in `StripeTerminalError`. Now, any error with a message is always wrapped in `StripeTerminalError`.

### 9. `Charge.status` is now a `ChargeStatus` enum

`charge.status` was previously inconsistent across platforms:

- **iOS**: raw integer (`SCPChargeStatus` enum `rawValue`, e.g. `0`)
- **Android**: raw string (e.g. `"succeeded"`)
- **Web**: raw string passed through from the Stripe JS SDK (e.g. `"succeeded"`)

All platforms now return the same `ChargeStatus` enum value:

```typescript
export enum ChargeStatus {
  Succeeded = 0,
  Pending = 1,
  Failed = 2,
}
```

Update any code that compares `charge.status` to a raw string or integer:

```typescript
// Before — platform-dependent, unreliable
if (charge.status === 'succeeded') { ... }  // Android/Web only
if (charge.status === 0) { ... }            // iOS only

// After — consistent across all platforms
import { ChargeStatus } from 'capacitor-stripe-terminal'

if (charge.status === ChargeStatus.Succeeded) { ... }
```

### 10. `PaymentIntent.charges` type changed from `Stripe.Charge[]` to `Charge[]`

`PaymentIntent.charges` now uses the plugin-defined `Charge` interface instead of `Stripe.Charge` from the `stripe` Node.js package. This ensures a consistent shape across iOS, Android, and Web, and avoids importing a server-side type in client code.

The `Charge` interface covers all fields already serialized by the native platforms:

```typescript
export interface Charge {
  stripeId: string
  amount: number
  currency: string
  status: ChargeStatus
  metadata: { [key: string]: string }
  stripeDescription: string | null
  statementDescriptorSuffix: string | null
  calculatedStatementDescriptor: string | null
  authorizationCode: string | null
  amountRefunded: number
  created: number | null // Unix timestamp (seconds)
  captured: boolean
  paid: boolean
  refunded: boolean
  customer: string | null
  paymentIntentId: string | null
  receiptEmail: string | null
  receiptNumber: string | null
  receiptUrl: string | null
  livemode: boolean
}
```

If you were typing charges with `Stripe.Charge`, switch to the plugin's `Charge` type:

```typescript
// Before
import { Stripe } from 'stripe'
const charge: Stripe.Charge = paymentIntent.charges[0]

// After
import { Charge } from 'capacitor-stripe-terminal'
const charge: Charge = paymentIntent.charges[0]
```

### 11. iOS minimum deployment target increased to 15.0

The minimum iOS deployment target has been raised from 13.0 to 15.0.

Update your app's iOS deployment target in Xcode to **15.0** or higher (see [Upgrade Steps](#upgrade-steps) above).

### 12. Capacitor v4 → v8 upgrade

This plugin upgrades the peer dependency from Capacitor v4 to Capacitor v8. Follow the [official Capacitor v8 migration guide](https://capacitorjs.com/docs/updating/8-0) to update your app.

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
- [Capacitor v8 Update Guide](https://capacitorjs.com/docs/updating/8-0)

## Getting Help

If you encounter issues during migration:

1. Check the [GitHub Issues](https://github.com/eventOneHQ/capacitor-stripe-terminal/issues)
2. Review the [Stripe Terminal documentation](https://stripe.com/docs/terminal)
3. Open a new issue with details about your problem

## Summary

This upgrade primarily updates the underlying SDKs while maintaining most API compatibility. The main actions required are:

- Update your iOS deployment target to 15.0
- Handle the new `Reconnecting` connection status if you monitor connection state
- On Android: replace `DiscoveryMethod.Embedded` and `DiscoveryMethod.Handoff` with `DiscoveryMethod.AppsOnDevices`; replace `connectHandoffReader` calls with `connectAppsOnDevicesReader`
- Remove any usage of `DeviceType.VerifoneP400` — the Verifone P400 reader is no longer supported
- Rename `DiscoveryMethod.LocalMobile` → `DiscoveryMethod.TapToPay`, `LocalMobileConnectionConfiguration` → `TapToPayConnectionConfiguration`, `connectLocalMobileReader()` → `connectTapToPayReader()`, and the `localMobileReaderDidAcceptTermsOfService` event → `tapToPayReaderDidAcceptTermsOfService`
- Rename `DeviceType.AppleBuiltIn` → `DeviceType.TapToPay` (now covers both iOS and Android Tap to Pay readers)
- **Remove `rxjs` from your dependencies** and update all Observable-based call sites to use the new callback + `PluginListenerHandle` pattern (call `handle.remove()` instead of `subscription.unsubscribe()`)
- Rename `processPayment()` → `confirmPaymentIntent()` (matches the native Stripe Terminal SDK function name)
- `confirmPaymentIntent` errors are now always thrown as `StripeTerminalError`; `decline_code` and `payment_intent` fields are now populated on card declines (no action required, but you may now read these fields in your catch handler)
