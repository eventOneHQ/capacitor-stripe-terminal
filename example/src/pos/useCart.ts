/**
 * Cart state and totals for the POS.
 *
 * All money here is in MINOR units. Tax is computed once on the whole
 * subtotal (not per line) so rounding errors don't add up.
 */
import { useCallback, useMemo, useState } from 'react'

import { PRODUCTS, toMinor, type Product } from './catalog'

/** A flat 8% sales tax. A real app would use Stripe Tax or its own rules. */
export const TAX_RATE = 0.08

export interface CartLine {
  product: Product
  quantity: number
  /** Unit price in minor units. */
  unitAmount: number
  /** quantity * unitAmount. */
  amount: number
}

export interface Totals {
  subtotal: number
  tax: number
  total: number
  count: number
}

export function useCart(currency: string) {
  // productId -> quantity
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const add = useCallback(
    (id: string) => setQuantities((q) => ({ ...q, [id]: (q[id] ?? 0) + 1 })),
    [],
  )
  const remove = useCallback(
    (id: string) =>
      setQuantities((q) => {
        const next = { ...q, [id]: (q[id] ?? 0) - 1 }
        if (next[id] <= 0) delete next[id]
        return next
      }),
    [],
  )
  const clear = useCallback(() => setQuantities({}), [])

  const lines: CartLine[] = useMemo(
    () =>
      PRODUCTS.filter((p) => quantities[p.id]).map((product) => {
        const unitAmount = toMinor(product.price, currency)
        const quantity = quantities[product.id]
        return { product, quantity, unitAmount, amount: unitAmount * quantity }
      }),
    [quantities, currency],
  )

  const totals: Totals = useMemo(() => {
    const subtotal = lines.reduce((sum, l) => sum + l.amount, 0)
    const tax = Math.round(subtotal * TAX_RATE)
    return {
      subtotal,
      tax,
      total: subtotal + tax,
      count: lines.reduce((sum, l) => sum + l.quantity, 0),
    }
  }, [lines])

  return { quantities, lines, totals, add, remove, clear }
}
