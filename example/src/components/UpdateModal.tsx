/**
 * UpdateModal: full-attention progress screen for reader software updates.
 *
 * Installing an update takes minutes, and the reader must stay powered on and
 * in range the whole time (unplugging it can leave it unusable), so this is a
 * modal the user cannot swipe away, on whichever tab they are on.
 *
 * It follows the SDK's update events (see TerminalProvider.tsx):
 *
 *   didStartInstallingUpdate              -> modal opens
 *   didReportReaderSoftwareUpdateProgress -> progress bar (0..1)
 *   didFinishInstallingUpdate             -> success or error screen
 *
 * Cancelling is offered for optional updates only; a REQUIRED update (the SDK
 * sets `requiredAt`) must finish before the reader can take payments.
 */
import {
  IonButton,
  IonContent,
  IonIcon,
  IonModal,
  IonProgressBar,
  IonText,
} from '@ionic/react'
import { checkmarkCircleOutline, closeCircleOutline } from 'ionicons/icons'
import { useEffect, useRef, useState } from 'react'

import { useTerminal } from '../terminal/useTerminal'

export default function UpdateModal() {
  const { update, reader, installUpdate, cancelUpdate } = useTerminal()
  const [open, setOpen] = useState(false)

  // Remember what is being installed: `update.available` is cleared once the
  // install succeeds, but the success screen still wants to name the version.
  const installing = useRef(update.available)
  if (update.available) installing.current = update.available

  // Open when an install starts; it stays open until the user closes it, so
  // the result (success or failure) is not missed.
  useEffect(() => {
    if (update.installing) setOpen(true)
  }, [update.installing])

  const info = installing.current
  const percent = Math.round(update.progress * 100)
  const required = !!info?.requiredAt
  const failed = !update.installing && !!update.error
  const done = !update.installing && !!update.done && !update.error

  return (
    <IonModal isOpen={open} backdropDismiss={false}>
      <IonContent className="ion-padding">
        <div className="status-panel update-modal">
          {update.installing && (
            <>
              <h2>Updating reader</h2>
              <p>
                {reader?.label ?? 'The reader'}
                {info ? ` · version ${info.deviceSoftwareVersion}` : ''}
              </p>
              <IonProgressBar
                value={update.progress}
                style={{ width: '100%' }}
              />
              <div className="amount-display">{percent}%</div>
              <IonText color="warning">
                <p>
                  Keep the reader powered on and nearby. It may restart several
                  times.
                  {info
                    ? ` This usually takes about ${info.estimatedUpdateTimeString}.`
                    : ''}
                </p>
              </IonText>
              {required ? (
                <IonText color="medium">
                  <p>This update is required and cannot be cancelled.</p>
                </IonText>
              ) : (
                <IonButton
                  fill="outline"
                  color="medium"
                  onClick={() => void cancelUpdate()}
                >
                  Cancel update
                </IonButton>
              )}
            </>
          )}

          {done && (
            <>
              <IonIcon icon={checkmarkCircleOutline} color="success" />
              <h2>Reader updated</h2>
              <p>The reader is up to date and ready to use.</p>
              <IonButton onClick={() => setOpen(false)}>Done</IonButton>
            </>
          )}

          {failed && (
            <>
              <IonIcon icon={closeCircleOutline} color="danger" />
              <h2>Update failed</h2>
              <p>{update.error}</p>
              <div className="button-row">
                <IonButton onClick={() => void installUpdate()}>
                  Retry
                </IonButton>
                <IonButton
                  fill="outline"
                  color="medium"
                  onClick={() => setOpen(false)}
                >
                  Close
                </IonButton>
              </div>
            </>
          )}

          {/* Installing stopped without a result (cancelled, or the reader
              disconnected): don't leave the user on a dead screen. */}
          {!update.installing && !done && !failed && (
            <>
              <h2>Update stopped</h2>
              <p>
                The update did not finish. You can try again from the Reader
                tab.
              </p>
              <IonButton onClick={() => setOpen(false)}>Close</IonButton>
            </>
          )}
        </div>
      </IonContent>
    </IonModal>
  )
}
