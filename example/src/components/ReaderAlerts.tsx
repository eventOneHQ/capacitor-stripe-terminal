/**
 * ReaderAlerts: banners for things that go wrong (or change) with the reader
 * connection. Shown on both the Reader and POS tabs so a cashier sees them
 * wherever they are.
 *
 * Each one maps to state kept in TerminalProvider:
 *
 *   connectionStatus 'reconnecting' -> Bluetooth dropped; the SDK is retrying
 *   connectionLost                  -> reader vanished (or reconnect gave up)
 *   connectError                    -> a connect attempt failed
 *   lowBattery                      -> `didReportLowBatteryWarning`
 *   update.error                    -> a reader software update failed
 */
import { IonButton, IonItem, IonLabel, IonSpinner } from '@ionic/react'

import { useTerminal } from '../terminal/useTerminal'

export default function ReaderAlerts() {
  const t = useTerminal()

  return (
    <>
      {/* Bluetooth dropped; the SDK is trying to get the reader back. */}
      {t.connectionStatus === 'reconnecting' && (
        <IonItem color="warning" lines="none">
          <IonSpinner slot="start" name="dots" />
          <IonLabel className="ion-text-wrap">
            Lost the reader. Reconnecting...
          </IonLabel>
          <IonButton
            slot="end"
            size="small"
            onClick={() => void t.cancelReconnect()}
          >
            Give up
          </IonButton>
        </IonItem>
      )}

      {/* The reader is gone and nothing is retrying. */}
      {t.connectionLost && t.connectionStatus !== 'reconnecting' && (
        <IonItem color="danger" lines="none">
          <IonLabel className="ion-text-wrap">{t.connectionLost}</IonLabel>
          <IonButton slot="end" size="small" onClick={t.clearReaderAlerts}>
            Dismiss
          </IonButton>
        </IonItem>
      )}

      {/* A connect attempt failed. The reader is still listed to retry. */}
      {t.connectError && (
        <IonItem color="danger" lines="none">
          <IonLabel className="ion-text-wrap">
            Could not connect: {t.connectError}
          </IonLabel>
          <IonButton slot="end" size="small" onClick={t.clearReaderAlerts}>
            Dismiss
          </IonButton>
        </IonItem>
      )}

      {t.reader && t.lowBattery && (
        <IonItem color="warning" lines="none">
          <IonLabel className="ion-text-wrap">
            The reader's battery is low. Charge it soon.
          </IonLabel>
        </IonItem>
      )}

      {t.update.error && (
        <IonItem color="danger" lines="none">
          <IonLabel className="ion-text-wrap">
            Reader update failed: {t.update.error}
          </IonLabel>
          <IonButton slot="end" size="small" onClick={t.clearReaderAlerts}>
            Dismiss
          </IonButton>
        </IonItem>
      )}
    </>
  )
}
