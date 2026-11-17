/**
 * Money and time formatting helpers.
 *
 * IMPORTANT STRIPE CONCEPT: Stripe amounts are integers in the currency's
 * SMALLEST unit ("minor units"). $10.50 is `1050` cents. Some currencies have
 * no minor unit (JPY: 1 yen is `1`), and a few have three decimals. We ask
 * `Intl` how many fraction digits a currency uses so the app handles all of
 * them instead of hard-coding "divide by 100".
 */

/** How many decimal places does this currency use? (usd -> 2, jpy -> 0) */
export function fractionDigits(currency: string): number {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).resolvedOptions().maximumFractionDigits!
}

/** Format minor units for display: `formatMoney(1050, 'usd')` -> "$10.50". */
export function formatMoney(minorUnits: number, currency: string): string {
  const digits = fractionDigits(currency)
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(minorUnits / 10 ** digits)
}

/**
 * Convert what a person typed ("10.50") into minor units (1050).
 * Returns `null` for anything that isn't a positive number.
 *
 * `Math.round` guards against floating point error: 19.99 * 100 is
 * 1998.9999999999998 in JavaScript.
 */
export function parseToMinorUnits(
  input: string,
  currency: string,
): number | null {
  const value = Number(input.replace(/,/g, ''))
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value * 10 ** fractionDigits(currency))
}

/** Short clock time for log lines, e.g. "14:03:07". */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour12: false })
}
