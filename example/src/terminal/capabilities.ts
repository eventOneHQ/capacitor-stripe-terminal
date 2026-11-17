/**
 * What the CONNECTED reader can do.
 *
 * Stripe Terminal readers are very different devices. A Stripe M2 is a small
 * Bluetooth card reader with no screen: calling `setReaderDisplay` on it
 * fails, as do `collectInputs`, `print` and on-reader tipping. A smart reader
 * (S700, WisePOS E) has a touchscreen and supports all of those.
 *
 * The SDK does not tell you up front, so check BEFORE calling. Every screen
 * in this app asks `capabilities` (from useTerminal) and disables or skips a
 * feature the reader can't do, instead of calling it and handling the failure.
 *
 * The lists below follow Stripe's reader comparison, which marks on-reader
 * tipping and on-screen input collection as supported on the T600, S700/S710
 * and WisePOS E, but not on the M2 (and tipping only on the WisePad 3):
 * https://docs.stripe.com/terminal/payments/setup-reader
 * Verify them against your own hardware; unknown models get the conservative
 * answer (no).
 */
import type { DeviceType, Reader } from 'capacitor-stripe-terminal'

/** Readers with a touchscreen the app can draw on. */
const SMART_READERS: DeviceType[] = [
  'stripeS700',
  'stripeS700Devkit',
  'stripeS710',
  'stripeS710Devkit',
  'wisePosE',
  'wisePosEDevkit',
  'stripeT600',
  'stripeT600Devkit',
]

// On-reader tipping also works on the BBPOS WisePad 3, but only outside the US,
// so it is not listed here. On every reader it ALSO needs tip options in your
// Terminal Configuration (see server/index.ts, POST /terminal/tipping).

/** Smart readers with a built-in receipt printer. */
const PRINTER_READERS: DeviceType[] = ['stripeS710', 'stripeS710Devkit']

export interface Capabilities {
  /** The app runs ON the reader (Apps on Devices); there is no separate screen. */
  appsOnDevices: boolean
  /** `setReaderDisplay` / `clearReaderDisplay`: show the cart on the reader. */
  cartDisplay: boolean
  /** `collectInputs`: forms (email, signature, ...) on the reader. */
  collectInputs: boolean
  /** On-reader tip selection (`collectPaymentMethod` `tipping`). */
  onReaderTipping: boolean
  /** `print`: the reader has a printer. */
  print: boolean
  /** `getReaderSettings` / `setReaderSettings` (text-to-speech). */
  readerSettings: boolean
  /** Driven by the native SDK: on-device intents, offline, reboot, collectData. */
  native: boolean
  /** A short name for messages, e.g. "Stripe M2". */
  readerName: string
}

/** Everything off: no reader connected. */
export const NO_CAPABILITIES: Capabilities = {
  appsOnDevices: false,
  cartDisplay: false,
  collectInputs: false,
  onReaderTipping: false,
  print: false,
  readerSettings: false,
  native: false,
  readerName: 'the reader',
}

export function getCapabilities(
  reader: Reader | null,
  native: boolean,
  appsOnDevices = false,
): Capabilities {
  if (!reader) return NO_CAPABILITIES

  const smart = SMART_READERS.includes(reader.deviceType)
  return {
    appsOnDevices,
    // When the app runs ON the reader ("handoff mode") its own UI fills the
    // idle screen, so the cart mirror is left off (Stripe documents no
    // cart-display support there). Tipping works: the Stripe reader app shows
    // it during the payment (verified on a T600 devkit). Input forms do NOT:
    // the Android SDK rejects `collectInputs` with "Collect inputs not
    // supported in handoff mode", even though the T600 supports forms when
    // driven from a separate device.
    cartDisplay: smart && !appsOnDevices,
    collectInputs: smart && !appsOnDevices,
    onReaderTipping: smart,
    print: PRINTER_READERS.includes(reader.deviceType),
    readerSettings: smart,
    native,
    readerName: reader.label ?? reader.deviceType,
  }
}

/** Standard wording for a disabled control. */
export function unsupportedNote(c: Capabilities): string {
  return `Not supported by ${c.readerName}.`
}
