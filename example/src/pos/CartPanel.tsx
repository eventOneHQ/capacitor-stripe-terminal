/**
 * The cart: line items, totals, checkout options and the Charge button.
 * Pure presentation; PosPage owns the state and the payment flow.
 */
import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonToggle,
} from '@ionic/react'
import {
  addCircleOutline,
  removeCircleOutline,
  trashOutline,
} from 'ionicons/icons'

import { formatMoney } from '../lib/format'
import type { useCart } from './useCart'
import { TAX_RATE } from './useCart'

interface Props {
  cart: ReturnType<typeof useCart>
  currency: string
  /** Show the tip screen on the reader. */
  tipping: boolean
  onTipping: (value: boolean) => void
  /** Ask for a receipt email on the reader before charging. */
  askEmail: boolean
  onAskEmail: (value: boolean) => void
  /** What the connected reader supports; unsupported options are disabled. */
  tippingSupported: boolean
  emailSupported: boolean
  /** Why checkout is unavailable (shown instead of enabling the button). */
  blockedReason?: string
  onCheckout: () => void
}

export default function CartPanel({
  cart,
  currency,
  tipping,
  onTipping,
  askEmail,
  onAskEmail,
  tippingSupported,
  emailSupported,
  blockedReason,
  onCheckout,
}: Props) {
  const { lines, totals } = cart
  const money = (n: number) => formatMoney(n, currency)

  return (
    <div className="pos-cart-body">
      <div className="pos-cart-header">
        <h2>Order</h2>
        {lines.length > 0 && (
          <IonButton
            size="small"
            fill="clear"
            color="medium"
            onClick={cart.clear}
          >
            <IonIcon slot="start" icon={trashOutline} />
            Clear
          </IonButton>
        )}
      </div>

      {lines.length === 0 ? (
        <IonNote className="ion-padding">Tap a product to add it.</IonNote>
      ) : (
        <IonList lines="full">
          {lines.map((l) => (
            <IonItem key={l.product.id}>
              <IonLabel>
                <h3>
                  {l.product.emoji} {l.product.name}
                </h3>
                <p>{money(l.unitAmount)} each</p>
              </IonLabel>
              <IonButton
                fill="clear"
                slot="end"
                aria-label={`Remove one ${l.product.name}`}
                onClick={() => cart.remove(l.product.id)}
              >
                <IonIcon slot="icon-only" icon={removeCircleOutline} />
              </IonButton>
              <span slot="end" className="pos-qty">
                {l.quantity}
              </span>
              <IonButton
                fill="clear"
                slot="end"
                aria-label={`Add one ${l.product.name}`}
                onClick={() => cart.add(l.product.id)}
              >
                <IonIcon slot="icon-only" icon={addCircleOutline} />
              </IonButton>
              <span slot="end" className="pos-line-amount">
                {money(l.amount)}
              </span>
            </IonItem>
          ))}
        </IonList>
      )}

      <div className="pos-totals">
        <div>
          <span>Subtotal</span>
          <span>{money(totals.subtotal)}</span>
        </div>
        <div>
          <span>Tax ({Math.round(TAX_RATE * 100)}%)</span>
          <span>{money(totals.tax)}</span>
        </div>
        <div className="pos-total">
          <span>Total</span>
          <span>{money(totals.total)}</span>
        </div>
      </div>

      <IonList lines="none">
        <IonItem>
          <IonToggle
            checked={tipping && tippingSupported}
            disabled={!tippingSupported}
            onIonChange={(e) => tippingSupported && onTipping(e.detail.checked)}
          >
            Ask for a tip on the reader
          </IonToggle>
        </IonItem>
        <IonItem>
          <IonToggle
            checked={askEmail && emailSupported}
            disabled={!emailSupported}
            onIonChange={(e) => emailSupported && onAskEmail(e.detail.checked)}
          >
            Ask for receipt email on the reader
          </IonToggle>
        </IonItem>
      </IonList>
      {/* Only explain when a reader IS connected but lacks a screen. */}
      {!blockedReason && (!tippingSupported || !emailSupported) && (
        <IonNote
          className="ion-padding-horizontal"
          style={{ display: 'block' }}
        >
          {tippingSupported
            ? 'Receipt email forms on the reader are not available when this app runs on the reader itself (Apps on Devices).'
            : 'Tipping and receipt email need a smart reader (T600, S700, WisePOS E). This reader skips them.'}
        </IonNote>
      )}

      <div className="ion-padding">
        <IonButton
          expand="block"
          size="large"
          disabled={!!blockedReason || totals.total <= 0}
          onClick={onCheckout}
        >
          {totals.total > 0 ? `Charge ${money(totals.total)}` : 'Charge'}
        </IonButton>
        {blockedReason && (
          <IonNote
            className="ion-text-center"
            style={{ display: 'block', marginTop: 8 }}
          >
            {blockedReason}
          </IonNote>
        )}
      </div>
    </div>
  )
}
