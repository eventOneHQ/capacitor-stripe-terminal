/**
 * Modals the SDK can ask us to show in the middle of ANY payment (Charge tab
 * or POS tab), so they live once at the app level instead of on a page.
 *
 *   - paymentChoice: some readers accept more than a card; the SDK asks the
 *     app which payment method the customer wants.
 *   - qrChoice: for QR wallets we render the code the SDK hands us, then
 *     confirm it is on screen.
 *
 * A card-only reader never triggers either.
 */
import { IonButton, IonModal } from '@ionic/react'

import { useTerminal } from '../terminal/useTerminal'

export default function PaymentModals() {
  const t = useTerminal()

  return (
    <>
      <IonModal isOpen={!!t.paymentChoice} backdropDismiss={false}>
        <div className="ion-padding">
          <h2>How would the customer like to pay?</h2>
          {t.paymentChoice?.options.map((o, i) => (
            <IonButton
              key={i}
              expand="block"
              onClick={() =>
                void t.paymentChoice?.select(o.paymentMethodType ?? 'card')
              }
            >
              {o.type === 'card' ? 'Card' : (o.paymentMethodType ?? 'Other')}
            </IonButton>
          ))}
          <IonButton
            expand="block"
            color="medium"
            fill="outline"
            onClick={() => void t.paymentChoice?.fail('Cancelled by cashier')}
          >
            Cancel
          </IonButton>
        </div>
      </IonModal>

      <IonModal isOpen={!!t.qrChoice} backdropDismiss={false}>
        <div className="ion-padding ion-text-center">
          <h2>Scan to pay</h2>
          {t.qrChoice && (
            <img
              src={t.qrChoice.qr.imageUrlPng}
              alt="Payment QR code"
              width={260}
            />
          )}
          <IonButton
            expand="block"
            onClick={() => void t.qrChoice?.confirmDisplayed()}
          >
            QR code is displayed
          </IonButton>
          <IonButton
            expand="block"
            color="medium"
            fill="outline"
            onClick={() => void t.qrChoice?.fail('QR code failed to display')}
          >
            Cancel
          </IonButton>
        </div>
      </IonModal>
    </>
  )
}
