/**
 * The POS product catalog.
 *
 * In a real app this would come from your database or the Stripe Products
 * API. Here it is a hard-coded list so the example needs no extra backend:
 * the only thing the server is asked to do is create PaymentIntents.
 *
 * Prices are in MAJOR units (4.5 = $4.50). `toMinor` converts to the minor
 * units Stripe wants, using the currency selected on the Settings tab.
 */
import { fractionDigits } from '../lib/format'

export type Category = 'Drinks' | 'Food' | 'Retail'

export interface Product {
  id: string
  name: string
  /** Price in major units of the selected currency. */
  price: number
  category: Category
  /** An emoji stands in for a product photo. */
  emoji: string
}

export const CATEGORIES: Category[] = ['Drinks', 'Food', 'Retail']

export const PRODUCTS: Product[] = [
  { id: 'latte', name: 'Latte', price: 4.5, category: 'Drinks', emoji: '☕' },
  { id: 'tea', name: 'Iced tea', price: 3.5, category: 'Drinks', emoji: '🧋' },
  {
    id: 'juice',
    name: 'Orange juice',
    price: 4,
    category: 'Drinks',
    emoji: '🍊',
  },
  {
    id: 'water',
    name: 'Sparkling water',
    price: 2.5,
    category: 'Drinks',
    emoji: '💧',
  },
  {
    id: 'croissant',
    name: 'Croissant',
    price: 3.75,
    category: 'Food',
    emoji: '🥐',
  },
  { id: 'bagel', name: 'Bagel', price: 3, category: 'Food', emoji: '🥯' },
  {
    id: 'sandwich',
    name: 'Sandwich',
    price: 8.5,
    category: 'Food',
    emoji: '🥪',
  },
  {
    id: 'salad',
    name: 'Garden salad',
    price: 9,
    category: 'Food',
    emoji: '🥗',
  },
  { id: 'mug', name: 'Mug', price: 14, category: 'Retail', emoji: '🫖' },
  {
    id: 'beans',
    name: 'Coffee beans',
    price: 16,
    category: 'Retail',
    emoji: '🫘',
  },
  { id: 'tote', name: 'Tote bag', price: 12, category: 'Retail', emoji: '👜' },
  { id: 'card', name: 'Gift card', price: 25, category: 'Retail', emoji: '🎁' },
]

/** 4.5 -> 450 (usd) or 5 (jpy). Math.round avoids float error. */
export function toMinor(price: number, currency: string): number {
  return Math.round(price * 10 ** fractionDigits(currency))
}
