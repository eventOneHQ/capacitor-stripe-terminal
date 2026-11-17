/**
 * CART DISPLAY
 *
 * Smart readers can show the customer what they're buying (line items, tax,
 * total) while the cashier rings things up. `setReaderDisplay` pushes a Cart;
 * `clearReaderDisplay` returns the reader to its idle screen.
 *
 * Amounts are in minor units, like every Stripe amount. Note the plugin
 * ignores `setReaderDisplay` while a payment method is being collected (the
 * reader owns the screen then).
 */
import { IonButton } from '@ionic/react'
import type { Cart } from 'capacitor-stripe-terminal'

import { useSettings } from '../lib/settings'
import { useTerminal } from '../terminal/useTerminal'
import FeatureCard from './FeatureCard'
import { useAction } from './useAction'

export default function CartDisplayFeature() {
  const { sdk, reader } = useTerminal()
  const { currency } = useSettings()
  const action = useAction<string>()

  const cart: Cart = {
    currency,
    tax: 120,
    total: 1620,
    lineItems: [
      { displayName: 'Coffee', quantity: 2, amount: 800 },
      { displayName: 'Croissant', quantity: 1, amount: 700 },
    ],
  }

  return (
    <FeatureCard
      title="Cart display"
      methods="setReaderDisplay · clearReaderDisplay"
      description="Show line items and a total on the reader's screen."
      platforms="Internet smart readers"
      busy={action.busy}
      result={action.result}
      error={action.error}
    >
      <div className="button-row">
        <IonButton
          size="small"
          disabled={!reader || action.busy}
          onClick={() =>
            void action.run(async () => {
              await sdk()!.setReaderDisplay(cart)
              return 'Cart sent to reader'
            })
          }
        >
          Show sample cart
        </IonButton>
        <IonButton
          size="small"
          fill="outline"
          disabled={!reader || action.busy}
          onClick={() =>
            void action.run(async () => {
              await sdk()!.clearReaderDisplay()
              return 'Reader display cleared'
            })
          }
        >
          Clear
        </IonButton>
      </div>
    </FeatureCard>
  )
}
