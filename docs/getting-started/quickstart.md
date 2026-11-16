---
title: 'Quickstart'
description: 'Initialize the plugin, find a reader, and collect a payment.'
---

# Quickstart

This is the same flow as [Stripe's integration guide](https://docs.stripe.com/terminal/payments/collect-card-payment), expressed through the plugin's API.

```ts
import {
  StripeTerminalPlugin,
  StripeTerminalError,
} from 'capacitor-stripe-terminal'

// 1. Initialize. Returns a ready-to-use instance.
const terminal = await StripeTerminalPlugin.create({
  fetchConnectionToken: async () => {
    const resp = await fetch('https://your-backend.dev/token', {
      method: 'POST',
    })
    return (await resp.json()).secret
  },
  onUnexpectedReaderDisconnect: (reason) => {
    // the reader went away without your app asking it to
  },
})

// 2. Discover readers. Resolves to a handle; call handle.remove() to stop.
const discoverHandle = await terminal.discoverReaders(
  { simulated: true, discoveryMethod: 'bluetoothScan' },
  async (readers) => {
    if (!readers.length) return

    // connect while discovery is still running
    const reader = await terminal.connectBluetoothReader(readers[0], {
      locationId: '{{LOCATION_ID}}',
    })
    // `reader` is now connected; scanning can stop
    await discoverHandle.remove()
  },
  (error) => console.error('discovery failed', error),
)

// 3. Show reader prompts to the customer.
const displayHandle = await terminal.didRequestReaderDisplayMessage(
  (message) => {
    console.log(message) // e.g. 'insertOrSwipeCard'
  },
)
const inputHandle = await terminal.didRequestReaderInput((options) => {
  console.log(options) // e.g. ['insertCard', 'tapCard']
})

// 4. Collect and confirm.
await terminal.retrievePaymentIntent('{{CLIENT_SECRET}}')
await terminal.collectPaymentMethod()

try {
  await terminal.confirmPaymentIntent()
} catch (err) {
  if (err instanceof StripeTerminalError) {
    console.error(err.decline_code, err.payment_intent)
  }
  throw err
}

// 5. Clean up listeners (for example in ngOnDestroy or a React cleanup).
await displayHandle.remove()
await inputHandle.remove()
await terminal.destroy()
```

::: callout warning "Connect while discovering"
Connect to a reader **while discovery is still running**, as in the Stripe SDKs. `handle.remove()` cancels discovery, so only call it after the connect call has been made.
:::

## Next

- Read [Differences from Stripe's SDKs](../guides/differences-from-stripe.md) for everything that looks different from Stripe's samples.
- Use the [simulator](../guides/payments.md#simulator) while developing.
