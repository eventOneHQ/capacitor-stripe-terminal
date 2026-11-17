/**
 * Activity tab: a read-only window into what the SDK is doing.
 *
 *   - "Payments" lists the attempts made this session.
 *   - "Event log" is a live feed of SDK events (connection changes, reader
 *     prompts, updates, errors).
 *
 * The event log is the single most useful debugging tool when integrating
 * Terminal: you can watch the order in which the SDK emits things.
 */
import {
  IonBadge,
  IonButton,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react'

import { formatMoney, formatTime } from '../lib/format'
import { useTerminal } from '../terminal/useTerminal'

const STATUS_COLOR = {
  succeeded: 'success',
  failed: 'danger',
  canceled: 'medium',
} as const

const LEVEL_COLOR = {
  info: 'medium',
  warn: 'warning',
  error: 'danger',
} as const

export default function ActivityPage() {
  const { payments, log, clearLog, refund, cancelRefund, refundState, reader } =
    useTerminal()
  const refunding = refundState.step === 'collecting'

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Activity</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* Refund progress: shown while the reader waits for the card. */}
        {refundState.step !== 'idle' && (
          <IonItem
            lines="none"
            color={refundState.step === 'failed' ? 'danger' : undefined}
          >
            <IonLabel className="ion-text-wrap">
              {refunding
                ? 'Refund: present the original card on the reader...'
                : refundState.message}
            </IonLabel>
            {refunding && (
              <IonButton
                slot="end"
                size="small"
                onClick={() => void cancelRefund()}
              >
                Cancel
              </IonButton>
            )}
          </IonItem>
        )}

        <IonList inset>
          <IonListHeader>Payments (this session)</IonListHeader>
          {/*
            Terminal refunds (`processRefund`) only work for Interac debit
            cards in Canada. To try it: Settings -> currency CAD and simulated
            card "Interac", take a payment, then refund it.
          */}
          <IonItem lines="none">
            <IonNote className="ion-text-wrap">
              In-person refunds are limited to Interac cards (CAD).
            </IonNote>
          </IonItem>
          {payments.length === 0 && (
            <IonItem lines="none">
              <IonNote>No payments yet.</IonNote>
            </IonItem>
          )}
          {payments.map((p, i) => (
            <IonItem key={`${p.id}-${i}`}>
              <IonLabel>
                <h2>{formatMoney(p.amount, p.currency)}</h2>
                <p className="mono">{p.id}</p>
                {p.cardSummary && <p>{p.cardSummary}</p>}
                {p.detail && <p>{p.detail}</p>}
              </IonLabel>
              {p.offline && (
                <IonBadge slot="end" color="warning">
                  offline
                </IonBadge>
              )}
              {p.refunded ? (
                <IonBadge slot="end" color="tertiary">
                  refunded
                </IonBadge>
              ) : p.status === 'succeeded' && p.chargeId ? (
                /* Refund: the reader asks for the original card again. */
                <IonButton
                  slot="end"
                  size="small"
                  fill="outline"
                  disabled={!reader || refunding}
                  onClick={() => void refund(p)}
                >
                  Refund
                </IonButton>
              ) : (
                <IonBadge slot="end" color={STATUS_COLOR[p.status]}>
                  {p.status}
                </IonBadge>
              )}
            </IonItem>
          ))}
        </IonList>

        <IonList inset>
          <IonListHeader>
            <IonLabel>Event log</IonLabel>
            <IonButton size="small" fill="clear" onClick={clearLog}>
              Clear
            </IonButton>
          </IonListHeader>
          {log.map((entry) => (
            <IonItem key={entry.id} lines="none">
              <IonLabel className="ion-text-wrap">
                <p>
                  <span className="mono">{formatTime(entry.time)}</span>{' '}
                  <IonBadge color={LEVEL_COLOR[entry.level]}>
                    {entry.source}
                  </IonBadge>
                </p>
                <h3>{entry.message}</h3>
              </IonLabel>
            </IonItem>
          ))}
        </IonList>
      </IonContent>
    </IonPage>
  )
}
