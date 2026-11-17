---
title: 'Capacitor Stripe Terminal'
description: "An unofficial Capacitor plugin for Stripe Terminal. These docs cover what differs from Stripe's own SDKs."
---

# Capacitor Stripe Terminal

`capacitor-stripe-terminal` wraps the native [Stripe Terminal](https://stripe.com/terminal) SDKs for iOS and Android, and the [Terminal JS SDK](https://docs.stripe.com/terminal/references/api/js-sdk), behind one TypeScript API for [Capacitor](https://capacitorjs.com) apps.

::: callout info "These docs only cover what's different"
This plugin follows Stripe's SDKs closely, so we don't repeat [Stripe's Terminal documentation](https://docs.stripe.com/terminal). Concepts like readers, locations, connection tokens, PaymentIntents, tipping and refunds work the way Stripe describes them. These pages cover how the plugin's API **differs**, where behavior differs across platforms, and how to migrate between versions.
:::

## Requirements

| Component                   | Version                            |
| --------------------------- | ---------------------------------- |
| Capacitor                   | 8.x                                |
| Stripe Terminal iOS SDK     | 6.0.0 (iOS 16.0+)                  |
| Stripe Terminal Android SDK | 6.0.0 (API 23+, `compileSdk` 35+)  |
| `@stripe/terminal-js`       | 0.26.x (used for internet readers) |

## Where to start

::: grid
::: card "Install and configure" icon:download
Add the plugin, set up iOS and Android, and request permissions.

[Installation →](./getting-started/installation.md){.docmd-button}
:::

::: card "Take a payment" icon:credit-card
Initialize, discover, connect and collect a payment in about 40 lines.

[Quickstart →](./getting-started/quickstart.md){.docmd-button}
:::

::: card "Coming from Stripe's SDKs?" icon:arrow-left-right
A side-by-side look at how the plugin's API differs from the native and JS SDKs.

[Differences from Stripe →](./guides/differences-from-stripe.md){.docmd-button}
:::

::: card "Upgrading?" icon:git-branch
Breaking changes and upgrade steps for v5 and v6.

[Migration guides →](./migration/index.md){.docmd-button}
:::
:::

## What the plugin adds on top of Stripe's SDKs

- **One API for three SDKs.** Bluetooth, USB, Tap to Pay and Apps on Devices readers use the native SDKs. Internet readers (WisePOS E, Stripe S700 and others) use the JS SDK, even inside a native app. The plugin picks the right one for you. See [Readers and discovery](./guides/readers.md).
- **A `both` discovery mode** that scans Bluetooth and internet readers at once.
- **Callback listeners with handles** instead of delegates, observables or event emitters. See [Events and listeners](./guides/events.md).
- **Consistent data across platforms**: string unions instead of enums, one `Reader`/`PaymentIntent`/`Charge` shape, and `StripeTerminalError` with decline data. See [Data and errors](./guides/data-and-errors.md).

## Links

- [GitHub repository](https://github.com/eventOneHQ/capacitor-stripe-terminal)
- [npm package](https://www.npmjs.com/package/capacitor-stripe-terminal)
- [Typedoc API reference](./api-reference.md)
- [Stripe Terminal documentation](https://docs.stripe.com/terminal)
