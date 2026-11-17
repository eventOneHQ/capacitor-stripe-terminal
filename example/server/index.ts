/**
 * Example backend for the Terminal app.
 *
 * WHY DO YOU NEED A BACKEND?
 * Stripe Terminal requires a few operations that need your Stripe SECRET key.
 * That key must never ship inside a mobile app (anyone could extract it), so
 * these calls live on a server you control:
 *
 *   1. Connection tokens  - short-lived credentials the Terminal SDK uses to
 *                           talk to Stripe. The SDK asks the app for one
 *                           whenever it needs it (see `fetchConnectionToken`
 *                           in src/terminal/TerminalProvider.tsx).
 *   2. PaymentIntents     - created server-side so the amount can't be
 *                           tampered with by the client.
 *   3. Capture            - only needed if you create intents with
 *                           `capture_method: 'manual'`.
 *   4. SetupIntents       - for saving a card instead of charging it.
 *
 * (Locations need no backend route: the plugin's `listLocations()` fetches
 * them using the connection token.)
 *
 * THIS IS A DEMO. A production backend needs authentication (so strangers
 * can't mint connection tokens or charge amounts), input validation, logging,
 * and HTTPS. Never expose these endpoints unauthenticated on the internet.
 *
 * Run with:  npm run server
 */
import cors from 'cors'
import 'dotenv/config'
import express from 'express'
import Stripe from 'stripe'

const secretKey = process.env.STRIPE_SECRET_KEY
if (!secretKey || secretKey.includes('replace_me')) {
  console.error(
    '\nMissing STRIPE_SECRET_KEY.\n' +
      'Copy example/.env.example to example/.env and add a test-mode key (sk_test_...).\n',
  )
  process.exit(1)
}

const stripe = new Stripe(secretKey)
const app = express()

// Parse JSON request bodies and allow the browser dev server (a different
// origin) to call us. Native apps are not subject to CORS, but `npm run dev`
// in a browser is.
app.use(express.json())
app.use(cors())

/** Small helper so every route reports errors the same way. */
const route =
  (
    handler: (req: express.Request, res: express.Response) => Promise<unknown>,
  ): express.RequestHandler =>
  async (req, res) => {
    try {
      await handler(req, res)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`${req.method} ${req.path} failed:`, message)
      res.status(500).json({ error: message })
    }
  }

/** Health check. The app's Settings tab calls this to verify the URL. */
app.get(
  '/health',
  route(async (_req, res) => {
    res.json({ ok: true, livemode: secretKey.startsWith('sk_live') })
  }),
)

/**
 * POST /connection_token
 * Returns `{ secret }`. The app passes the secret to the Terminal SDK.
 * https://docs.stripe.com/terminal/payments/setup-integration#connection-token
 */
app.post(
  '/connection_token',
  route(async (_req, res) => {
    const token = await stripe.terminal.connectionTokens.create()
    res.json({ secret: token.secret })
  }),
)

/**
 * POST /payment_intents
 * Body: { amount: number (minor units, e.g. cents), currency: string,
 *         captureMethod?: 'automatic' | 'manual', description?: string,
 *         metadata?: Record<string,string>, receiptEmail?: string }
 * Returns `{ id, clientSecret }`. The app hands `clientSecret` to the SDK's
 * `retrievePaymentIntent`.
 *
 * `payment_method_types: ['card_present']` is what marks this intent as an
 * in-person payment.
 * https://docs.stripe.com/terminal/payments/collect-card-payment
 */
app.post(
  '/payment_intents',
  route(async (req, res) => {
    const {
      amount,
      currency = 'usd',
      captureMethod = 'automatic',
      description,
      metadata,
      receiptEmail,
    } = req.body

    if (!Number.isInteger(amount) || amount < 50) {
      res.status(400).json({ error: 'amount must be an integer >= 50' })
      return
    }

    const intent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method_types: ['card_present'],
      capture_method: captureMethod,
      // Optional order details (the POS tab sends these). Stripe emails a
      // receipt to `receipt_email` in live mode.
      description,
      metadata,
      receipt_email: receiptEmail,
    })

    res.json({ id: intent.id, clientSecret: intent.client_secret })
  }),
)

/**
 * POST /setup_intents
 * Creates a SetupIntent for saving a card-present card for later use. The
 * SDK collects the card; once confirmed, Stripe creates a reusable
 * PaymentMethod (a `generated_card`) you can attach to a Customer.
 * https://docs.stripe.com/terminal/features/saving-payment-details/save-directly
 */
app.post(
  '/setup_intents',
  route(async (_req, res) => {
    const intent = await stripe.setupIntents.create({
      payment_method_types: ['card_present'],
    })
    res.json({ id: intent.id, clientSecret: intent.client_secret })
  }),
)

/**
 * POST /payment_intents/:id/capture
 * Captures a manually-captured intent after the reader has authorized it.
 * Not used by default; the app creates auto-capture intents.
 */
app.post(
  '/payment_intents/:id/capture',
  route(async (req, res) => {
    const intent = await stripe.paymentIntents.capture(String(req.params.id))
    res.json({ id: intent.id, status: intent.status })
  }),
)

/**
 * POST /terminal/tipping
 * Turns ON on-reader tipping by adding tip options to your Terminal
 * Configuration(s). WITHOUT THIS THE READER NEVER SHOWS A TIP SCREEN, even if
 * the app asks for one: tip choices come from the configuration, not from the
 * app. (In your own account you would normally set this once in the Dashboard:
 * Terminal -> Configurations -> Tipping.)
 *
 * Body (optional): { currencies?: string[] }
 * Test mode only: it rewrites account settings, so it refuses live keys.
 * https://docs.stripe.com/terminal/features/collecting-tips/on-reader
 */
app.post(
  '/terminal/tipping',
  route(async (req, res) => {
    if (secretKey.startsWith('sk_live')) {
      res
        .status(400)
        .json({ error: 'Refusing to change a live-mode configuration.' })
      return
    }
    const currencies: string[] = req.body?.currencies ?? [
      'usd',
      'cad',
      'gbp',
      'eur',
      'aud',
      'jpy',
    ]
    // 10 / 15 / 20 percent. (Fixed amounts and a "smart tip" threshold are
    // also available; see the docs above.)
    const tipping = Object.fromEntries(
      currencies.map((c) => [c, { percentages: [10, 15, 20] }]),
    )

    const updated: string[] = []
    for await (const config of stripe.terminal.configurations.list({
      limit: 100,
    })) {
      await stripe.terminal.configurations.update(config.id, { tipping })
      updated.push(config.id)
    }
    res.json({ updated, currencies })
  }),
)

const port = Number(process.env.PORT ?? 4242)
// No host argument: Node binds all interfaces on IPv6 AND IPv4, so a phone on
// your Wi-Fi can reach the server, and `localhost` works even when the OS
// resolves it to ::1 first (as the iOS simulator does).
app.listen(port, () => {
  console.log(`Terminal example backend listening on http://localhost:${port}`)
})
