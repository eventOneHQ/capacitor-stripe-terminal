---
title: 'Migration guides'
description: 'Upgrade paths between capacitor-stripe-terminal versions.'
---

# Migration guides

| From | To  | Guide                                                                                                 |
| ---- | --- | ----------------------------------------------------------------------------------------------------- |
| v3   | v5  | [Migrating to v5](./v5.md): Capacitor 8, Stripe Terminal SDK 5, callbacks replace RxJS                |
| v5   | v6  | [Migrating to v6](./v6.md): Stripe Terminal SDK 6, string unions, `processRefund`, `stripeId` removed |

::: callout info "Version numbers"
`capacitor-stripe-terminal` skips v4 and tracks the major version of the Stripe Terminal native SDKs: v5 uses Terminal SDK 5.x and v6 uses Terminal SDK 6.x.
:::

## Coming from v3?

Do the guides in order: v3 to v5, then v5 to v6. The v5 guide's code samples use the v5 API (numeric enums), so apply the v6 changes as you go to avoid writing code you'll immediately rewrite.

## Quick checklist for v6

1. Update to iOS 16.0 as your minimum deployment target.
2. Replace enum members with strings (`DiscoveryMethod.BluetoothScan` becomes `'bluetoothScan'`).
3. Replace `stripeId` with `id`.
4. Replace `collectRefundPaymentMethod` + `confirmRefund` with `processRefund`.
5. Replace `getPermissions()` with `checkPermissions()` / `requestPermissions()`.
6. Pass `captureMethod: 'manual'` explicitly if you relied on the old default.
7. Replace `terminal.addListener(...)` and `didReportBatteryLevel` with the dedicated listener methods.
8. Add `'discovering'` and `'reconnecting'` cases wherever you switch on `ConnectionStatus`.

## Related upgrade guides

- [Stripe Terminal SDK migration guide](https://docs.stripe.com/terminal/references/sdk-migration-guide)
- [Capacitor 8 update guide](https://capacitorjs.com/docs/updating/8-0)
