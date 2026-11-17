---
title: 'Installation'
description: 'Install capacitor-stripe-terminal and configure iOS and Android.'
---

# Installation

```bash
npm install capacitor-stripe-terminal
npx cap sync
```

## iOS

Follow Stripe's [Configure your app](https://docs.stripe.com/terminal/payments/setup-integration?terminal-sdk-platform=ios#configure) instructions: add the Bluetooth, location and background-mode entries to `Info.plist`, and enable the Tap to Pay capability if you use it.

::: callout info "Swift Package Manager only"
The plugin no longer ships a CocoaPods podspec, because Stripe no longer publishes Terminal releases to CocoaPods. It resolves the SDK from [`stripe-terminal-ios-spm`](https://github.com/stripe/stripe-terminal-ios-spm), which is Capacitor 8's default package manager. The minimum deployment target is **iOS 16.0**.
:::

## Android

Add the location permission to your app's `AndroidManifest.xml`. The Terminal SDK requires it for Bluetooth scanning.

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

The plugin's own manifest already declares the Bluetooth, USB and `MODIFY_AUDIO_SETTINGS` (Tap to Pay) permissions it needs.

::: callout tip "Test a minified build"
The Terminal SDK 6.0 ships narrower consumer ProGuard rules. Always test a minified release build before shipping.
:::

### Runtime permissions

On Android you must have the user grant location permission **before** calling `StripeTerminalPlugin.create`. The plugin exposes static helpers for this (the old `getPermissions()` was removed in v6):

```ts
import { Capacitor } from '@capacitor/core'
import { StripeTerminalPlugin } from 'capacitor-stripe-terminal'

if (Capacitor.getPlatform() === 'android') {
  let status = await StripeTerminalPlugin.checkPermissions()

  if (status.location === 'prompt') {
    status = await StripeTerminalPlugin.requestPermissions()
  }

  if (status.location !== 'granted') {
    throw new Error('Location permission is required.')
  }
}
```

If the user denies the prompt once, Android will not show it again and `status.location` stays `denied`. You have to send them to the app's system settings.

## Apps on Devices (Android)

To run your Capacitor app directly on a Stripe Android reader such as the S700 or T600, see [Apps on Devices](./../guides/apps-on-devices.md).

## Web

On the web only **internet readers** are supported, through `@stripe/terminal-js`. Bluetooth, USB, Tap to Pay, offline payments and several other features are native-only. See the [platform support matrix](../guides/platform-support.md).
