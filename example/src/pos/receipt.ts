/**
 * Draw a paper receipt on an offscreen canvas for the reader's printer
 * (`terminal.print`). Printers want an image, so a canvas is the simplest way
 * to turn "some text and numbers" into one without any server.
 */
import { formatMoney } from '../lib/format'
import type { CartLine, Totals } from './useCart'

export interface ReceiptData {
  orderNumber: number
  currency: string
  lines: CartLine[]
  totals: Totals
  tip: number
  total: number
  cardSummary?: string
}

/** Returns a PNG data URI, 384px wide (a common thermal-printer width). */
export function renderReceipt(r: ReceiptData): string {
  const rowH = 30
  const height = 220 + r.lines.length * rowH + 4 * rowH
  const canvas = document.createElement('canvas')
  canvas.width = 384
  canvas.height = height
  const g = canvas.getContext('2d')!
  g.fillStyle = '#fff'
  g.fillRect(0, 0, canvas.width, height)
  g.fillStyle = '#000'

  let y = 48
  g.font = 'bold 28px sans-serif'
  g.fillText('Terminal Example Cafe', 24, y)
  g.font = '18px monospace'
  y += 32
  g.fillText(`Order #${r.orderNumber}`, 24, y)
  y += 26
  g.fillText(new Date().toLocaleString(), 24, y)
  y += 40

  /** One "label ........ amount" row. */
  const row = (label: string, amount: string, bold = false) => {
    g.font = `${bold ? 'bold ' : ''}20px monospace`
    g.fillText(label, 24, y)
    g.fillText(amount, 360 - g.measureText(amount).width, y)
    y += rowH
  }

  for (const l of r.lines) {
    row(
      `${l.quantity}x ${l.product.name}`.slice(0, 20),
      formatMoney(l.amount, r.currency),
    )
  }
  y += 8
  row('Subtotal', formatMoney(r.totals.subtotal, r.currency))
  row('Tax', formatMoney(r.totals.tax, r.currency))
  if (r.tip > 0) row('Tip', formatMoney(r.tip, r.currency))
  row('TOTAL', formatMoney(r.total, r.currency), true)
  if (r.cardSummary) {
    y += 8
    g.font = '16px monospace'
    g.fillText(r.cardSummary, 24, y)
  }
  return canvas.toDataURL('image/png')
}
