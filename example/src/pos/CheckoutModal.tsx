/**
 * Full-screen checkout: shows what the payment is waiting on, then the
 * receipt. Which screen appears is decided by `phase` (PosPage's flow) and
 * `payment.step` (the SDK's progress from the Terminal context).
 */
import {
  IonButton,
  IonContent,
  IonIcon,
  IonModal,
  IonNote,
  IonSpinner,
} from '@ionic/react'
import {
  alertCircleOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
} from 'ionicons/icons'

import { formatMoney } from '../lib/format'
import { INPUT_TEXT, MESSAGE_TEXT } from '../terminal/messages'
import { useTerminal } from '../terminal/useTerminal'
import type { ChargeResult } from '../terminal/TerminalProvider'
import type { CartLine, Totals } from './useCart'

/** A frozen copy of the order being paid, so the receipt survives cart edits. */
export interface Order {
  number: number
  currency: string
  lines: CartLine[]
  totals: Totals
}

export type Phase = 'email' | 'pay' | 'receipt'

interface Props {
  phase: Phase | null
  order: Order | null
  result: ChargeResult | null
  /** Receipt email collected on the reader, if any. */
  email?: string
  /** Result of the last print/refund tap, shown under the receipt. */
  notice?: string
  onCancelEmail: () => void
  /** The reader has a printer (else the button is disabled). */
  canPrint: boolean
  onPrint: () => void
  onRefund: () => void
  /** Leave the receipt: start a fresh sale. */
  onDone: () => void
  /** Leave a failed/canceled payment: back to the cart. */
  onBack: () => void
}

export default function CheckoutModal(props: Props) {
  const { phase, order, result, email, notice } = props
  const t = useTerminal()
  const { payment } = t
  const money = (n: number) => formatMoney(n, order?.currency ?? 'usd')

  return (
    <IonModal isOpen={phase !== null} backdropDismiss={false}>
      <IonContent className="ion-padding">
        <div className="pos-checkout">
          {/* ---- Waiting for the receipt-email form on the reader ---- */}
          {phase === 'email' && (
            <div className="status-panel">
              <IonSpinner />
              <h2>Customer: enter an email on the reader</h2>
              <p>They can skip it to get no emailed receipt.</p>
              <IonButton
                color="medium"
                fill="outline"
                onClick={props.onCancelEmail}
              >
                Skip
              </IonButton>
            </div>
          )}

          {/* ---- Payment in progress ---- */}
          {phase === 'pay' &&
            order &&
            [
              'idle',
              'creating',
              'collecting',
              'confirming',
              'capturing',
            ].includes(payment.step) && (
              <div className="status-panel">
                <div className="amount-display">
                  {money(order.totals.total)}
                </div>
                <IonSpinner />
                {payment.step === 'creating' && <p>Creating payment...</p>}
                {payment.step === 'collecting' && (
                  <>
                    {/* The reader's latest prompt wins over the generic text. */}
                    <h2>
                      {t.readerMessage
                        ? MESSAGE_TEXT[t.readerMessage]
                        : 'Present a card'}
                    </h2>
                    {t.readerInput.length > 0 && (
                      <p>
                        Accepting:{' '}
                        {t.readerInput
                          .map((i) => INPUT_TEXT[i] ?? i)
                          .join(' · ')}
                      </p>
                    )}
                    <IonButton
                      color="medium"
                      fill="outline"
                      onClick={() => void t.cancelCharge()}
                    >
                      Cancel
                    </IonButton>
                  </>
                )}
                {payment.step === 'confirming' && <p>Authorizing...</p>}
                {payment.step === 'capturing' && <p>Capturing...</p>}
              </div>
            )}

          {phase === 'pay' && payment.step === 'failed' && (
            <div className="status-panel">
              <IonIcon icon={closeCircleOutline} color="danger" />
              <h2>Payment failed</h2>
              <p>{payment.error}</p>
              {payment.declineCode && (
                <p className="mono">decline_code: {payment.declineCode}</p>
              )}
              <IonButton onClick={props.onBack}>Back to order</IonButton>
            </div>
          )}

          {phase === 'pay' && payment.step === 'canceled' && (
            <div className="status-panel">
              <IonIcon icon={alertCircleOutline} color="warning" />
              <h2>Payment canceled</h2>
              <IonButton onClick={props.onBack}>Back to order</IonButton>
            </div>
          )}

          {/* ---- Receipt ---- */}
          {phase === 'receipt' && order && result && (
            <div className="pos-receipt">
              <div className="status-panel">
                <IonIcon icon={checkmarkCircleOutline} color="success" />
                <h2>Paid {money(result.total)}</h2>
              </div>
              <div className="pos-totals">
                <p>
                  <strong>Order #{order.number}</strong>
                </p>
                {order.lines.map((l) => (
                  <div key={l.product.id}>
                    <span>
                      {l.quantity}x {l.product.name}
                    </span>
                    <span>{money(l.amount)}</span>
                  </div>
                ))}
                <div>
                  <span>Subtotal</span>
                  <span>{money(order.totals.subtotal)}</span>
                </div>
                <div>
                  <span>Tax</span>
                  <span>{money(order.totals.tax)}</span>
                </div>
                {result.tip > 0 && (
                  <div>
                    <span>Tip</span>
                    <span>{money(result.tip)}</span>
                  </div>
                )}
                <div className="pos-total">
                  <span>Total</span>
                  <span>{money(result.total)}</span>
                </div>
              </div>
              {result.cardSummary && (
                <p className="ion-text-center">{result.cardSummary}</p>
              )}
              <p className="ion-text-center mono">{result.intentId}</p>
              {email && (
                <p className="ion-text-center">Receipt email: {email}</p>
              )}
              {result.offline && (
                <p className="ion-text-center">
                  Stored offline; it will be forwarded when the network returns.
                </p>
              )}

              <div className="button-row pos-receipt-actions">
                <IonButton
                  fill="outline"
                  disabled={!props.canPrint}
                  onClick={props.onPrint}
                >
                  Print receipt
                </IonButton>
                <IonButton
                  fill="outline"
                  color="medium"
                  disabled={
                    !result.chargeId || t.refundState.step === 'collecting'
                  }
                  onClick={props.onRefund}
                >
                  Refund
                </IonButton>
                <IonButton onClick={props.onDone}>New sale</IonButton>
              </div>
              {t.refundState.step === 'collecting' && (
                <IonNote
                  className="ion-text-center"
                  style={{ display: 'block' }}
                >
                  Refund: present the original card on the reader...
                </IonNote>
              )}
              {notice && (
                <IonNote
                  className="ion-text-center"
                  style={{ display: 'block', marginTop: 8 }}
                >
                  {notice}
                </IonNote>
              )}
            </div>
          )}
        </div>
      </IonContent>
    </IonModal>
  )
}
