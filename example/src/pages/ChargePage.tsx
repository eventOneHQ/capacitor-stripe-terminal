/**
 * Charge tab: enter an amount and collect a card payment.
 *
 * The screen has two modes, driven entirely by `payment.step` from the
 * Terminal context:
 *
 *   - idle:     show the amount entry and a "Charge" button
 *   - anything else: show a progress / result panel for the in-flight payment
 *
 * All Stripe logic lives in `charge()` (TerminalProvider.tsx). This component
 * only collects input and renders state.
 */
import {
  IonAccordion,
  IonAccordionGroup,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonNote,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/react'
import {
  alertCircleOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
} from 'ionicons/icons'
import { useState } from 'react'

import ConnectionBadge from '../components/ConnectionBadge'
import { formatMoney, parseToMinorUnits } from '../lib/format'
import { updateSettings, useSettings } from '../lib/settings'
import { useTerminal } from '../terminal/useTerminal'

/**
 * Plain-English text for the prompts a reader can request. The SDK gives us
 * an identifier ('retryCard'); showing it to the customer is our job.
 * See docs/guides/events.md.
 */
const MESSAGE_TEXT: Record<string, string> = {
  retryCard: 'Please try the card again.',
  insertCard: 'Please insert the card.',
  insertOrSwipeCard: 'Please insert or swipe the card.',
  swipeCard: 'Please swipe the card.',
  removeCard: 'Please remove the card.',
  multipleContactlessCardsDetected:
    'Multiple cards detected. Present just one.',
  tryAnotherReadMethod: 'Please try another way of paying with this card.',
  tryAnotherCard: 'Please try a different card.',
  checkMobileDevice: 'Please check your phone.',
  cardRemovedTooEarly: 'Card removed too early. Please try again.',
}

/** Readable labels for the input methods a reader may be accepting. */
const INPUT_TEXT: Record<string, string> = {
  tapCard: 'Tap',
  insertCard: 'Insert',
  swipeCard: 'Swipe',
}

export default function ChargePage() {
  const t = useTerminal()
  const settings = useSettings()
  const { currency } = settings
  const [amountText, setAmountText] = useState('10.00')

  const amount = parseToMinorUnits(amountText, currency)
  const ready = t.connectionStatus === 'connected' && !!t.reader
  const { payment } = t
  const inFlight = [
    'creating',
    'collecting',
    'confirming',
    'capturing',
  ].includes(payment.step)

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Charge</IonTitle>
          <div slot="end" style={{ paddingRight: 16 }}>
            <ConnectionBadge status={t.connectionStatus} />
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {/* ---------------- Amount entry ---------------- */}
        {payment.step === 'idle' && (
          <>
            <div className="status-panel">
              <div className="amount-display">
                {amount ? formatMoney(amount, currency) : '--'}
              </div>
            </div>

            <IonItem>
              <IonInput
                label={`Amount (${currency.toUpperCase()})`}
                type="text"
                inputmode="decimal"
                value={amountText}
                onIonInput={(e) => setAmountText(String(e.detail.value ?? ''))}
              />
            </IonItem>
            {/* Stripe enforces a minimum charge (50 cents in USD). */}
            <IonItem lines="none">
              <IonNote>
                Test mode: use the simulated reader, or Stripe's test cards.
              </IonNote>
            </IonItem>

            {/* ---- Payment options: each maps to an SDK parameter ---- */}
            <IonAccordionGroup>
              <IonAccordion value="options">
                <IonItem slot="header">
                  <IonLabel>Payment options</IonLabel>
                </IonItem>
                <div slot="content">
                  <IonItem>
                    <IonSelect
                      label="Capture"
                      value={settings.captureMethod}
                      onIonChange={(e) =>
                        updateSettings({ captureMethod: e.detail.value })
                      }
                    >
                      <IonSelectOption value="automatic">
                        Automatic
                      </IonSelectOption>
                      <IonSelectOption value="manual">
                        Manual (authorize, then capture)
                      </IonSelectOption>
                    </IonSelect>
                  </IonItem>
                  <IonItem>
                    <IonToggle
                      checked={settings.skipTipping}
                      onIonChange={(e) =>
                        updateSettings({ skipTipping: e.detail.checked })
                      }
                    >
                      Skip tipping screen
                    </IonToggle>
                  </IonItem>
                  <IonItem>
                    <IonToggle
                      checked={settings.onReaderTipping}
                      onIonChange={(e) =>
                        updateSettings({ onReaderTipping: e.detail.checked })
                      }
                    >
                      On-reader tipping
                    </IonToggle>
                  </IonItem>
                  <IonItem>
                    <IonSelect
                      label="Allow redisplay"
                      value={settings.allowRedisplay}
                      onIonChange={(e) =>
                        updateSettings({ allowRedisplay: e.detail.value })
                      }
                    >
                      <IonSelectOption value="unspecified">
                        Unspecified
                      </IonSelectOption>
                      <IonSelectOption value="limited">Limited</IonSelectOption>
                      <IonSelectOption value="always">Always</IonSelectOption>
                    </IonSelect>
                  </IonItem>
                  <IonItem>
                    <IonSelect
                      label="Customer cancel"
                      value={settings.customerCancellation}
                      onIonChange={(e) =>
                        updateSettings({ customerCancellation: e.detail.value })
                      }
                    >
                      <IonSelectOption value="enableIfAvailable">
                        Enable if available
                      </IonSelectOption>
                      <IonSelectOption value="disableIfAvailable">
                        Disable if available
                      </IonSelectOption>
                    </IonSelect>
                  </IonItem>
                  {/* On-device intents and offline modes are native-only. */}
                  <IonItem>
                    <IonToggle
                      checked={settings.createOnDevice}
                      disabled={!t.nativeReader}
                      onIonChange={(e) =>
                        updateSettings({ createOnDevice: e.detail.checked })
                      }
                    >
                      Create intent on device (Bluetooth / Tap to Pay)
                    </IonToggle>
                  </IonItem>
                  <IonItem>
                    <IonSelect
                      label="Offline"
                      value={settings.offlineBehavior}
                      disabled={!settings.createOnDevice}
                      onIonChange={(e) =>
                        updateSettings({ offlineBehavior: e.detail.value })
                      }
                    >
                      <IonSelectOption value="prefer_online">
                        prefer_online
                      </IonSelectOption>
                      <IonSelectOption value="require_online">
                        require_online
                      </IonSelectOption>
                      <IonSelectOption value="force_offline">
                        force_offline
                      </IonSelectOption>
                    </IonSelect>
                  </IonItem>
                </div>
              </IonAccordion>
            </IonAccordionGroup>

            <IonButton
              expand="block"
              className="ion-margin-top"
              disabled={!ready || !amount}
              onClick={() => amount && void t.charge(amount, currency)}
            >
              {amount ? `Charge ${formatMoney(amount, currency)}` : 'Charge'}
            </IonButton>
            {!ready && (
              <IonText color="medium">
                <p className="ion-text-center">
                  Connect a reader on the Reader tab first.
                </p>
              </IonText>
            )}
          </>
        )}

        {/* ---------------- Payment in progress ---------------- */}
        {inFlight && (
          <div className="status-panel">
            <div className="amount-display">
              {formatMoney(payment.amount, payment.currency)}
            </div>
            <IonSpinner />

            {payment.step === 'creating' && <p>Creating payment...</p>}

            {payment.step === 'collecting' && (
              <>
                {/*
                  `readerMessage` (a prompt such as "retry card") takes
                  priority over the generic instruction, because it's the
                  reader's answer to what just happened.
                */}
                <h2>
                  {t.readerMessage
                    ? MESSAGE_TEXT[t.readerMessage]
                    : 'Present a card'}
                </h2>
                {t.readerInput.length > 0 && (
                  <p>
                    Accepting:{' '}
                    {t.readerInput.map((i) => INPUT_TEXT[i] ?? i).join(' · ')}
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

        {/* ---------------- Result ---------------- */}
        {payment.step === 'succeeded' && (
          <div className="status-panel">
            <IonIcon icon={checkmarkCircleOutline} color="success" />
            <h2>Payment successful</h2>
            <div className="amount-display">
              {formatMoney(payment.amount, payment.currency)}
            </div>
            <p className="mono">{payment.intentId}</p>
            {t.payments[0]?.cardSummary && <p>{t.payments[0].cardSummary}</p>}
            {t.payments[0]?.offline && (
              <IonText color="warning">
                Stored offline; will be forwarded when the network returns.
              </IonText>
            )}
            <IonButton onClick={t.resetPayment}>New charge</IonButton>
          </div>
        )}

        {payment.step === 'failed' && (
          <div className="status-panel">
            <IonIcon icon={closeCircleOutline} color="danger" />
            <h2>Payment failed</h2>
            <p>{payment.error}</p>
            {/* `declineCode` is the card issuer's reason, when provided. */}
            {payment.declineCode && (
              <p className="mono">decline_code: {payment.declineCode}</p>
            )}
            <IonButton onClick={t.resetPayment}>Try again</IonButton>
          </div>
        )}

        {payment.step === 'canceled' && (
          <div className="status-panel">
            <IonIcon icon={alertCircleOutline} color="warning" />
            <h2>Payment canceled</h2>
            <IonButton onClick={t.resetPayment}>Back</IonButton>
          </div>
        )}

        {/*
          Some readers accept non-card payments. The SDK asks us to pick;
          a card-only reader never triggers this.
        */}
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

        {/* QR payments: we render the code the SDK hands us, then confirm. */}
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
      </IonContent>
    </IonPage>
  )
}
