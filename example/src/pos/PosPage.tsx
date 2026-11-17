/**
 * POS tab: a small point-of-sale built on the same Terminal context as the
 * other tabs. Everything runs in the app; the backend is only asked to create
 * PaymentIntents (it holds the secret key).
 *
 * What it shows, and the SDK feature behind each:
 *
 *   - Catalog + cart ........ plain React state (src/pos/useCart.ts)
 *   - Customer-facing cart .. `setReaderDisplay` / `clearReaderDisplay`: the
 *                             reader's screen mirrors the cart as it changes
 *   - Receipt email ......... `collectInputs` (an email form on the reader)
 *   - Order details ......... description + metadata on the PaymentIntent
 *   - Payment + tip ......... `charge()` -> collectPaymentMethod with on-reader
 *                             tipping, then confirmPaymentIntent
 *   - Print receipt ......... `print` (readers with a printer, e.g. S710)
 *   - Refund ................ `processRefund` (see the Interac note on Activity)
 *   - Status ................ connection badge + battery from SDK events
 *
 * Layout: on a tablet (>= 768px wide) the catalog and the order sit side by
 * side. On a phone the order is a bottom sheet opened from a bar at the bottom.
 */
import {
  IonButton,
  IonContent,
  IonHeader,
  IonItem,
  IonModal,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonTitle,
  IonToolbar,
  useIonRouter,
} from '@ionic/react'
import { FormType } from 'capacitor-stripe-terminal'
import { useEffect, useRef, useState } from 'react'

import ConnectionBadge from '../components/ConnectionBadge'
import ReaderAlerts from '../components/ReaderAlerts'
import { errorMessage } from '../lib/errors'
import { formatMoney } from '../lib/format'
import { useSettings } from '../lib/settings'
import type { ChargeResult } from '../terminal/TerminalProvider'
import { useTerminal } from '../terminal/useTerminal'
import { CATEGORIES, PRODUCTS, toMinor, type Category } from './catalog'
import CartPanel from './CartPanel'
import CheckoutModal, { type Order, type Phase } from './CheckoutModal'
import { renderReceipt } from './receipt'
import { useCart } from './useCart'

/** True when the viewport matches a CSS media query (tablet vs phone layout). */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

export default function PosPage() {
  const t = useTerminal()
  const { currency } = useSettings()
  const router = useIonRouter()
  const cart = useCart(currency)
  const wide = useMediaQuery('(min-width: 768px)')

  const [category, setCategory] = useState<Category>('Drinks')
  const [cartOpen, setCartOpen] = useState(false)
  const [tipping, setTipping] = useState(true)
  const [askEmail, setAskEmail] = useState(false)

  // Checkout flow state. `phase` null = not checking out.
  const [phase, setPhase] = useState<Phase | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [result, setResult] = useState<ChargeResult | null>(null)
  const [email, setEmail] = useState<string>()
  const [printNotice, setPrintNotice] = useState<string>()
  const orderNumber = useRef(1001)

  const ready = t.connectionStatus === 'connected' && !!t.reader

  /* ---------------- Mirror the cart on the reader's screen ---------------- */
  // Debounced so tapping quickly doesn't flood the reader. The SDK ignores
  // display updates while a payment is being collected, so skip checkout too.
  // Not every reader has a display (Bluetooth readers don't), so failures are
  // expected and ignored: the POS works without it.
  useEffect(() => {
    // Only readers with a screen can show a cart (an M2 rejects the call).
    if (!ready || phase || !t.capabilities.cartDisplay) return
    const id = setTimeout(() => {
      const sdk = t.sdk()
      if (!sdk) return
      const show =
        cart.lines.length === 0
          ? sdk.clearReaderDisplay()
          : sdk.setReaderDisplay({
              currency,
              tax: cart.totals.tax,
              total: cart.totals.total,
              lineItems: cart.lines.map((l) => ({
                displayName: l.product.name,
                quantity: l.quantity,
                amount: l.amount,
              })),
            })
      void show.catch(() => undefined)
    }, 400)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ready,
    phase,
    t.capabilities.cartDisplay,
    cart.lines,
    cart.totals,
    currency,
  ])

  /* ---------------- Checkout ---------------- */
  async function checkout() {
    const snapshot: Order = {
      number: orderNumber.current,
      currency,
      lines: cart.lines,
      totals: cart.totals,
    }
    setOrder(snapshot)
    setResult(null)
    setEmail(undefined)
    setPrintNotice(undefined)
    setCartOpen(false)

    // 1. Optional: collect a receipt email on the reader's own screen.
    let receiptEmail: string | undefined
    if (askEmail && t.capabilities.collectInputs) {
      setPhase('email')
      try {
        const [form] = await t.sdk()!.collectInputs({
          inputs: [
            {
              formType: FormType.EMAIL,
              title: 'Email your receipt?',
              required: false,
              skipButtonText: 'No thanks',
              submitButtonText: 'Send',
            },
          ],
        })
        receiptEmail = (!form?.skipped && form?.email) || undefined
        setEmail(receiptEmail)
      } catch {
        // No form screen on this reader (or the cashier skipped): carry on.
      }
    }

    // 2. Charge. `metadata` and `description` appear in the Stripe Dashboard,
    //    so a payment can be matched back to the order. Metadata values are
    //    limited to 500 characters.
    setPhase('pay')
    const charged = await t.charge(snapshot.totals.total, currency, {
      description: `POS order #${snapshot.number}`,
      metadata: {
        order_number: String(snapshot.number),
        items: snapshot.lines
          .map((l) => `${l.quantity}x ${l.product.name}`)
          .join(', ')
          .slice(0, 500),
        tax: String(snapshot.totals.tax),
      },
      receiptEmail,
      tipping: tipping && t.capabilities.onReaderTipping,
      // Tip on the pre-tax subtotal, as is usual.
      tipEligibleAmount: snapshot.totals.subtotal,
    })

    if (charged) {
      orderNumber.current += 1
      setResult(charged)
      setPhase('receipt')
    }
    // On failure/cancel the modal shows the SDK's message with a Back button.
  }

  /** The receipt screen's "Print" button. */
  async function print() {
    if (!order || !result || !t.capabilities.print) return
    setPrintNotice('Printing...')
    try {
      await t.sdk()!.print(
        renderReceipt({
          orderNumber: order.number,
          currency,
          lines: order.lines,
          totals: order.totals,
          tip: result.tip,
          total: result.total,
          cardSummary: result.cardSummary,
        }),
      )
      setPrintNotice("Sent to the reader's printer.")
    } catch (err) {
      setPrintNotice(`Could not print: ${errorMessage(err)}`)
    }
  }

  /** Refund the paid order (the reader asks for the original card). */
  async function refund() {
    const record = t.payments.find((p) => p.id === result?.intentId)
    if (record) {
      setPrintNotice(undefined)
      await t.refund(record)
    }
  }

  /** Close the receipt and ring up the next customer. */
  function newSale() {
    t.resetPayment()
    cart.clear()
    setPhase(null)
    setOrder(null)
    setResult(null)
  }

  /** Close a failed/canceled payment; keep the cart so they can retry. */
  function back() {
    t.resetPayment()
    setPhase(null)
  }

  const refundNotice =
    t.refundState.step === 'succeeded' || t.refundState.step === 'failed'
      ? t.refundState.message
      : undefined

  const blockedReason = ready
    ? undefined
    : 'Connect a reader on the Reader tab to take payment.'
  const cartPanel = (
    <CartPanel
      cart={cart}
      currency={currency}
      tipping={tipping}
      onTipping={setTipping}
      askEmail={askEmail}
      onAskEmail={setAskEmail}
      tippingSupported={t.capabilities.onReaderTipping}
      emailSupported={t.capabilities.collectInputs}
      blockedReason={blockedReason}
      onCheckout={() => void checkout()}
    />
  )

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>POS</IonTitle>
          <div
            slot="end"
            style={{
              paddingRight: 16,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            {ready && t.battery && (
              <span>{Math.round(t.battery.batteryLevel * 100)}%</span>
            )}
            <ConnectionBadge status={t.connectionStatus} />
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent scrollY={false}>
        <ReaderAlerts />
        {!ready && (
          <IonItem color="warning" lines="none">
            <IonLabel className="ion-text-wrap">No reader connected.</IonLabel>
            <IonButton
              slot="end"
              size="small"
              onClick={() => router.push('/reader')}
            >
              Connect
            </IonButton>
          </IonItem>
        )}

        <div className={wide ? 'pos pos-wide' : 'pos'}>
          {/* ---------------- Catalog ---------------- */}
          <div className="pos-catalog">
            <IonSegment
              value={category}
              onIonChange={(e) => setCategory(e.detail.value as Category)}
            >
              {CATEGORIES.map((c) => (
                <IonSegmentButton key={c} value={c}>
                  <IonLabel>{c}</IonLabel>
                </IonSegmentButton>
              ))}
            </IonSegment>
            <div className="pos-grid">
              {PRODUCTS.filter((p) => p.category === category).map((p) => {
                const qty = cart.quantities[p.id] ?? 0
                return (
                  <button
                    key={p.id}
                    className="pos-tile"
                    onClick={() => cart.add(p.id)}
                  >
                    {qty > 0 && <span className="pos-badge">{qty}</span>}
                    <span className="pos-emoji">{p.emoji}</span>
                    <span className="pos-name">{p.name}</span>
                    <span className="pos-price">
                      {formatMoney(toMinor(p.price, currency), currency)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ---------------- Order: side panel (tablet) ---------------- */}
          {wide && <div className="pos-cart">{cartPanel}</div>}
        </div>

        {/* ---------------- Order: bottom bar + sheet (phone) ---------------- */}
        {!wide && (
          <div className="pos-bar">
            <IonButton expand="block" onClick={() => setCartOpen(true)}>
              {cart.totals.count > 0
                ? `View order · ${cart.totals.count} item${
                    cart.totals.count === 1 ? '' : 's'
                  } · ${formatMoney(cart.totals.total, currency)}`
                : 'View order'}
            </IonButton>
          </div>
        )}
        {!wide && (
          <IonModal
            isOpen={cartOpen}
            onDidDismiss={() => setCartOpen(false)}
            initialBreakpoint={0.85}
            breakpoints={[0, 0.85, 1]}
          >
            <IonContent>{cartPanel}</IonContent>
          </IonModal>
        )}

        <CheckoutModal
          phase={phase}
          order={order}
          result={result}
          email={email}
          notice={refundNotice ?? printNotice}
          onCancelEmail={() => void t.sdk()?.cancelCollectInputs()}
          canPrint={t.capabilities.print}
          onPrint={() => void print()}
          onRefund={() => void refund()}
          onDone={newSale}
          onBack={back}
        />
      </IonContent>
    </IonPage>
  )
}
