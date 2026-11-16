<p align="center"><br><img src="https://user-images.githubusercontent.com/236501/85893648-1c92e880-b7a8-11ea-926d-95355b8175c7.png" width="128" height="128" /></p>
<h3 align="center">Capacitor Stripe Terminal</h3>
<p align="center"><strong><code>capacitor-stripe-terminal</code></strong></p>
<p align="center">
  Accept in-person card payments in your Capacitor app with <a href="https://stripe.com/terminal">Stripe Terminal</a> (unofficial)
</p>

<p align="center">
  <img src="https://img.shields.io/maintenance/yes/2026?style=flat-square" />
  <a href="https://github.com/eventOneHQ/capacitor-stripe-terminal/actions/workflows/release.yml"><img src="https://img.shields.io/github/actions/workflow/status/eventOneHQ/capacitor-stripe-terminal/release.yml?style=flat-square" /></a>
  <a href="https://www.npmjs.com/package/capacitor-stripe-terminal"><img src="https://img.shields.io/npm/l/capacitor-stripe-terminal?style=flat-square" /></a>
<br>
  <a href="https://www.npmjs.com/package/capacitor-stripe-terminal"><img src="https://img.shields.io/npm/dw/capacitor-stripe-terminal?style=flat-square" /></a>
  <a href="https://www.npmjs.com/package/capacitor-stripe-terminal"><img src="https://img.shields.io/npm/v/capacitor-stripe-terminal?style=flat-square" /></a>
<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
<a href="#contributors-"><img src="https://img.shields.io/badge/all%20contributors-0-orange?style=flat-square" /></a>
<!-- ALL-CONTRIBUTORS-BADGE:END -->
</p>

<p align="center">
  <a href="https://eventonehq.github.io/capacitor-stripe-terminal/"><strong>Documentation</strong></a> ·
  <a href="https://eventonehq.github.io/capacitor-stripe-terminal/getting-started/quickstart/">Quickstart</a> ·
  <a href="https://eventonehq.github.io/capacitor-stripe-terminal/api/">API Reference</a> ·
  <a href="https://eventonehq.github.io/capacitor-stripe-terminal/migration/">Migration Guides</a>
</p>

## Features

- **iOS, Android and web** from one TypeScript API, built on the native Stripe Terminal SDKs and `@stripe/terminal-js`.
- **Every reader type**: Bluetooth, internet (WisePOS E, Stripe S700), USB, Tap to Pay and [Apps on Devices](https://eventonehq.github.io/capacitor-stripe-terminal/guides/apps-on-devices/).
- **Bluetooth + internet discovery at once** with the plugin-only `both` mode.
- **Payments, refunds, SetupIntents, offline payments, on-reader forms and printing**.
- **Consistent across platforms**.

## Requirements

| Component                   | Version                           |
| --------------------------- | --------------------------------- |
| Capacitor                   | 8.x                               |
| Stripe Terminal iOS SDK     | 6.0.0 (iOS 16.0+)                 |
| Stripe Terminal Android SDK | 6.0.0 (API 23+, `compileSdk` 35+) |

## Install

```bash
npm install capacitor-stripe-terminal
npx cap sync
```

Then follow the [installation guide](https://eventonehq.github.io/capacitor-stripe-terminal/getting-started/installation/) to configure iOS, Android and location permissions.

## Usage

```ts
import { StripeTerminalPlugin } from 'capacitor-stripe-terminal'

const terminal = await StripeTerminalPlugin.create({
  fetchConnectionToken: async () => {
    const resp = await fetch('https://your-backend.dev/token', {
      method: 'POST',
    })
    return (await resp.json()).secret
  },
  onUnexpectedReaderDisconnect: () => {
    // the reader disconnected unexpectedly
  },
})

// discover and connect to a reader first, see the quickstart

await terminal.retrievePaymentIntent('{CLIENT_SECRET}')
await terminal.collectPaymentMethod()
await terminal.confirmPaymentIntent()
```

The [quickstart](https://eventonehq.github.io/capacitor-stripe-terminal/getting-started/quickstart/) walks through reader discovery, connection and error handling.

## Coming from Stripe's SDKs?

The plugin follows Stripe's API closely, so the [Stripe Terminal docs](https://docs.stripe.com/terminal) still apply. The docs here only cover what's different, starting with [Differences from Stripe's SDKs](https://eventonehq.github.io/capacitor-stripe-terminal/guides/differences-from-stripe/) and the [platform support matrix](https://eventonehq.github.io/capacitor-stripe-terminal/guides/platform-support/).

## Upgrading

See the [migration guides](https://eventonehq.github.io/capacitor-stripe-terminal/migration/): [v5 to v6](https://eventonehq.github.io/capacitor-stripe-terminal/migration/v6/) and [v3 to v5](https://eventonehq.github.io/capacitor-stripe-terminal/migration/v5/).

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). Docs live in [`docs/`](docs) and preview with `npm run docs:dev`.

## Maintainers

| Maintainer | GitHub                              | Social                                      |
| ---------- | ----------------------------------- | ------------------------------------------- |
| Noah Prail | [nprail](https://github.com/nprail) | [@NoahPrail](https://twitter.com/NoahPrail) |

## Sponsors

<p>
    <a href="https://event1.io/?utm_medium=opensource&utm_source=capacitor-stripe-terminal">
        <img src="https://brand.event1.io/wordmark/wm-white.svg" width="200px">
    </a>
</p>

## Acknowledgements

- Thanks [Stripe](https://stripe.com/terminal) for creating such an amazing product
- Thanks [react-native-stripe-terminal](https://github.com/theopolisme/react-native-stripe-terminal) for quite a few borrowed concepts
