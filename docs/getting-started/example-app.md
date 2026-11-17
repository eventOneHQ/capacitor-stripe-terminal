---
title: 'Example app'
description: 'A complete Ionic React app that discovers a reader, connects, and takes a payment.'
---

# Example app

The [`example/`](https://github.com/eventOneHQ/capacitor-stripe-terminal/tree/master/example) folder holds a complete Ionic React + Capacitor app built on this plugin. Every file is heavily commented, so it works as a reference for your own integration.

It has two parts:

- **`src/`**: the app (React, Ionic UI, Vite).
- **`server/`**: a small Express backend that holds your Stripe secret key and creates connection tokens and PaymentIntents. A Terminal integration can't work without one.

## Run it in a browser

The plugin's web implementation can talk to a **simulated internet reader**, so you can try the whole flow without a phone or hardware.

```bash
# from the repo root: build the plugin once (the example installs it from ..)
npm install && npm run build

cd example
npm install
cp .env.example .env      # then put a TEST key (sk_test_...) in STRIPE_SECRET_KEY
npm run server            # terminal 1: backend on :4242
npm run dev               # terminal 2: app on http://localhost:5173
```

Then open the **Reader** tab, choose _Search for readers_, then _Connect_. On the **Charge** tab, enter an amount and choose _Charge_. The **Settings** tab picks which card the simulator presents (including declines), and the **Activity** tab shows a live event log.

## Run it on iOS or Android

```bash
npm run sync           # build web + copy into native projects
npx cap open ios       # or: npx cap open android
```

- Set the backend URL on the **Settings** tab to your computer's LAN IP (for example `http://192.168.1.20:4242`). On the Android emulator use `http://10.0.2.2:4242`.
- On a physical iPhone, pick your own team under Signing & Capabilities in Xcode.
- Bluetooth and Tap to Pay need real devices (Tap to Pay also needs Apple's entitlement). Simulated readers work in the simulator and emulator.

## How the code is organized

```
example/
├── server/index.ts            Express backend: connection token, PaymentIntents
├── capacitor.config.ts        Capacitor app id, web dir, native HTTP
├── vite.config.ts             Dev server + bundler config
└── src/
    ├── main.tsx               React entry point
    ├── App.tsx                Ionic shell, router and the 5 tabs
    ├── terminal/
    │   ├── TerminalProvider.tsx   ★ owns the plugin instance; ALL Stripe logic
    │   ├── useTerminal.ts         hook components use to read state/actions
    │   ├── backend.ts             calls to server/index.ts
    │   └── readers.ts             discovery methods per platform, reader names
    ├── pages/
    │   ├── ReaderPage.tsx     discover + connect + update the reader
    │   ├── ChargePage.tsx     amount, payment options, prompts, result
    │   ├── ActivityPage.tsx   payment history, refunds, SDK event log
    │   ├── ToolsPage.tsx      catalog of the other SDK features
    │   └── SettingsPage.tsx   backend URL, simulator, SDK options
    ├── features/              one self-contained demo per Tools card
    ├── components/            small presentational pieces
    └── lib/                   settings store, money formatting, error helper
```

Start with **`src/terminal/TerminalProvider.tsx`**. It follows the same four phases as every Terminal integration:

1. **Initialize**: `StripeTerminalPlugin.create({ fetchConnectionToken, onUnexpectedReaderDisconnect })`, then register event listeners.
2. **Connect**: `discoverReaders()` (keep the returned handle), then `connectInternetReader` / `connectBluetoothReader` / `connectTapToPayReader` / `connectUsbReader` _while discovery is still running_.
3. **Pay**: backend creates the PaymentIntent, then `retrievePaymentIntent` → `collectPaymentMethod` → `confirmPaymentIntent`.
4. **Clean up**: remove listener handles, `destroy()`.

See [Quickstart](/getting-started/quickstart) for the same flow in a few lines.
