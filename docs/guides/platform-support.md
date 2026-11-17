---
title: 'Platform support'
description: 'Which plugin features work on iOS, Android and web.'
---

# Platform support

The web implementation wraps `@stripe/terminal-js`, which only talks to internet readers. In native apps, internet readers also use the JS SDK.

| Feature                                      |            iOS             |     Android      |         Web         |
| -------------------------------------------- | :------------------------: | :--------------: | :-----------------: |
| Bluetooth readers (`bluetoothScan`)          |             ✅             |        ✅        |         ❌          |
| `bluetoothProximity`                         |             ✅             |        ❌        |         ❌          |
| Internet readers (`internet`)                |        ✅ (JS SDK)         |   ✅ (JS SDK)    |         ✅          |
| `both` discovery                             |             ✅             |        ✅        |         ❌          |
| USB readers                                  |             ❌             |        ✅        |         ❌          |
| Tap to Pay                                   |             ✅             |        ✅        |         ❌          |
| Apps on Devices                              |             ❌             |        ✅        |         ❌          |
| `openDeviceSettings`                         |             ❌             |        ✅        |         ❌          |
| Offline payments                             |             ✅             |        ✅        |         ❌          |
| `createPaymentIntent`, `cancelPaymentIntent` |             ✅             |        ✅        |         ❌          |
| `createSetupIntent`, `cancelSetupIntent`     |             ✅             |        ✅        |         ❌          |
| `collectData`                                |             ✅             |        ✅        |         ❌          |
| `rebootReader`                               |             ✅             |        ✅        |         ❌          |
| `collectInputs`                              |      internet readers      | internet readers |  internet readers   |
| `processRefund` by `paymentIntentId`         |             ✅             |        ✅        | ❌ (use `chargeId`) |
| `customerCancellation: 'disableIfAvailable'` |             ✅             |        ✅        |         ❌          |
| Payment method selection and QR codes        | Bluetooth, USB, Tap to Pay |  Bluetooth, USB  |         ❌          |
| `checkPermissions` / `requestPermissions`    |            n/a             |        ✅        |         n/a         |
| `simulatedCard: 'refundFailed'`              |             ✅             |        ❌        |         ✅          |

::: callout warning "Verify against your target"
This matrix reflects the plugin's source at the time of writing. Reader hardware also limits features (a Chipper 2X has no display, for instance). The [Stripe reader comparison](https://docs.stripe.com/terminal/payments/setup-reader) is the authority for hardware.
:::

Unsupported calls either reject with `... is only available on iOS and Android.` or, for connect methods on web, log a warning. Use `supportsReadersOfType` to check at runtime whether this device can use a reader type.
