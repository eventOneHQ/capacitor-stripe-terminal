/**
 * Client for the example backend (see example/server/index.ts).
 *
 * These are the only network calls the app makes itself. Everything else goes
 * through the Stripe Terminal plugin. Each function maps 1:1 to a server route.
 *
 * Security note: the app NEVER holds a Stripe secret key. The backend does,
 * and hands the app only short-lived or single-purpose values (a connection
 * token, a PaymentIntent client secret).
 */
import { getSettings } from '../lib/settings'

/** Shared fetch wrapper: JSON in/out, with readable errors. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Read the URL at call time (not import time) so changing it on the Settings
  // tab takes effect immediately.
  const base = getSettings().backendUrl.replace(/\/$/, '')

  let response: Response
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    // fetch only throws on network failure (server down, wrong URL, no CORS).
    throw new Error(
      `Could not reach the backend at ${base}. Is \`npm run server\` running, ` +
        `and is the URL on the Settings tab reachable from this device?`,
    )
  }

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body?.error ?? `Backend returned HTTP ${response.status}`)
  }
  return body as T
}

/**
 * Ask the backend for a Stripe Terminal connection token.
 * The SDK calls this (via `fetchConnectionToken`) on startup and again
 * whenever its token expires, so it must always return a FRESH token.
 */
export async function fetchConnectionToken(): Promise<string> {
  const { secret } = await request<{ secret: string }>('/connection_token', {
    method: 'POST',
  })
  return secret
}

export interface CreatedPaymentIntent {
  id: string
  /** Pass this to `terminal.retrievePaymentIntent()`. */
  clientSecret: string
}

/** Optional order info attached to a PaymentIntent (used by the POS tab). */
export interface OrderDetails {
  description?: string
  metadata?: Record<string, string>
  receiptEmail?: string
}

/**
 * Create a card-present PaymentIntent for `amount` minor units.
 * 'manual' capture only authorizes; call `capturePaymentIntent` afterwards.
 */
export function createPaymentIntent(
  amount: number,
  currency: string,
  captureMethod: 'automatic' | 'manual' = 'automatic',
  details: OrderDetails = {},
): Promise<CreatedPaymentIntent> {
  return request('/payment_intents', {
    method: 'POST',
    body: JSON.stringify({ amount, currency, captureMethod, ...details }),
  })
}

/**
 * Create a SetupIntent, used to SAVE a card for future use instead of
 * charging it. Returns the client secret for `retrieveSetupIntent`.
 */
export function createSetupIntent(): Promise<{
  id: string
  clientSecret: string
}> {
  return request('/setup_intents', { method: 'POST' })
}

/** Capture a manually-captured PaymentIntent (not needed for auto-capture). */
export function capturePaymentIntent(id: string): Promise<{ status: string }> {
  return request(`/payment_intents/${id}/capture`, { method: 'POST' })
}

/**
 * Add tip options (10/15/20%) to your TEST-mode Terminal configurations.
 * Needed once, otherwise readers never show a tip screen.
 */
export function enableTipping(): Promise<{ updated: string[] }> {
  return request('/terminal/tipping', { method: 'POST', body: '{}' })
}

/** Used by the Settings tab's "Test connection" button. */
export function checkHealth(): Promise<{ ok: boolean; livemode: boolean }> {
  return request('/health')
}
