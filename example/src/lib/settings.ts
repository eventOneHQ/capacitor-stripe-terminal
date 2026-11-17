/**
 * App settings: a tiny persisted store.
 *
 * Settings are the knobs a developer wants to tweak while testing (backend URL,
 * simulated vs. real readers, which discovery method to use, and so on). They
 * are saved in `localStorage` so they survive an app restart.
 *
 * WHY NOT REDUX / CONTEXT / A STATE LIBRARY?
 * The app only needs one small bag of settings. A module-level object plus
 * React's built-in `useSyncExternalStore` gives us a global store that any
 * component can read and that re-renders subscribers on change, with no extra
 * dependency. Non-React code (like `backend.ts`) can also read the current
 * value synchronously with `getSettings()`.
 *
 * In a production app you might use `@capacitor/preferences` instead of
 * `localStorage`; the native Preferences plugin is not cleared when the OS
 * evicts web storage under memory pressure.
 */
import type {
  AllowRedisplay,
  CustomerCancellation,
  DiscoveryMethod,
  LogLevel,
  OfflineBehavior,
  SimulatedCardType,
  SimulateReaderUpdate,
} from 'capacitor-stripe-terminal'
import { useSyncExternalStore } from 'react'

export interface AppSettings {
  /** Base URL of the example backend (see example/server/index.ts). */
  backendUrl: string

  /**
   * Use Stripe's simulated reader instead of real hardware. Great for
   * development: no reader needed, and you can force specific card outcomes.
   */
  simulated: boolean

  /** How to look for readers (Bluetooth, internet, Tap to Pay, ...). */
  discoveryMethod: DiscoveryMethod

  /**
   * The Stripe Terminal Location readers are registered to when connecting.
   * Empty string means "use whatever location the reader reports".
   */
  locationId: string

  /** ISO currency code for new payments (lowercase, e.g. "usd"). */
  currency: string

  /** Which card the *simulated* reader pretends to be tapped. */
  simulatedCard: SimulatedCardType

  /** Which software update the simulated reader offers on connect. */
  simulatedUpdate: SimulateReaderUpdate

  /** Simulate the device being offline (iOS/Android simulator only). */
  simulatedOffline: boolean

  /* ---- SDK initialization options (applied by re-initializing the SDK) ---- */

  /** Native SDK log verbosity. Logs appear in Xcode / Logcat. */
  logLevel: LogLevel

  /** Fixed locale for SDK error messages (e.g. "en-US"); "" = automatic. */
  locale: string

  /* ---- Payment options (see ChargePage "Options") ---- */

  /**
   * 'automatic' captures funds immediately when the payment is confirmed.
   * 'manual' only AUTHORIZES; the app captures afterwards (needed for tips
   * added after the fact, incremental auth, etc).
   */
  captureMethod: 'automatic' | 'manual'

  /** Hide the on-reader tipping screen. */
  skipTipping: boolean

  /** Ask the reader to show tip choices based on the amount. */
  onReaderTipping: boolean

  /** Whether the saved card may be shown to the customer again later. */
  allowRedisplay: AllowRedisplay

  /** Whether the customer may cancel on the reader itself. */
  customerCancellation: CustomerCancellation

  /**
   * Create the PaymentIntent on the device with the SDK instead of on the
   * backend. (iOS/Android only; needed for offline payments.)
   */
  createOnDevice: boolean

  /** What an on-device PaymentIntent does when the network is down. */
  offlineBehavior: OfflineBehavior
}

const STORAGE_KEY = 'terminal-example:settings:v1'

const DEFAULTS: AppSettings = {
  backendUrl: import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:4242',
  simulated: true,
  // 'internet' is the one method that also works in a plain browser, so it is
  // the friendliest default for first-time users.
  discoveryMethod: 'internet',
  locationId: '',
  currency: 'usd',
  simulatedCard: 'visa',
  simulatedUpdate: 'none',
  simulatedOffline: false,
  logLevel: 'verbose',
  locale: '',
  captureMethod: 'automatic',
  skipTipping: true,
  onReaderTipping: false,
  allowRedisplay: 'unspecified',
  customerCancellation: 'enableIfAvailable',
  createOnDevice: false,
  offlineBehavior: 'prefer_online',
}

/** Read persisted settings, falling back to defaults if storage is empty/broken. */
function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    // Spread over DEFAULTS so settings added in newer app versions get a value.
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    // Storage can be unavailable (private mode) or contain bad JSON.
    return DEFAULTS
  }
}

let current: AppSettings = load()
const listeners = new Set<() => void>()

/** Synchronous read for non-React code. */
export function getSettings(): AppSettings {
  return current
}

/**
 * Merge `patch` into the settings, persist, and notify subscribers.
 * We always create a NEW object: `useSyncExternalStore` detects changes by
 * reference equality, so mutating in place would not trigger a re-render.
 */
export function updateSettings(patch: Partial<AppSettings>): void {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Persisting is best-effort; the in-memory value still works.
  }
  listeners.forEach((l) => l())
}

/** Reset everything to the built-in defaults. */
export function resetSettings(): void {
  updateSettings({ ...DEFAULTS })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** React hook: returns the live settings and re-renders when they change. */
export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribe, getSettings)
}
