/**
 * Turn "whatever was thrown" into a string we can show to a person.
 *
 * Errors from the plugin can arrive in several shapes:
 *  - `StripeTerminalError` (a real `Error`): thrown by `confirmPaymentIntent`.
 *  - A plain object `{ message, code, data }`: how Capacitor rejects when a
 *    native iOS/Android call fails.
 *  - A bare string: some code paths reject with a string (e.g. "You must
 *    initialize StripeTerminalPlugin first.").
 *
 * Because the shape varies, never assume `err instanceof Error`.
 */
export function errorMessage(err: unknown): string {
  if (typeof err === 'string') return err
  if (err && typeof err === 'object') {
    const message = (err as { message?: unknown }).message
    if (typeof message === 'string' && message) return message
  }
  return 'Something went wrong.'
}
