/**
 * READER & SDK ADMINISTRATION
 *
 * A grab bag of management calls:
 *
 *   - `getConnectedReader` / `getConnectionStatus` / `getPaymentStatus` -
 *     one-time snapshots of SDK state (the app normally uses the event
 *     listeners instead, which push changes)
 *   - `rebootReader` - restarts the reader; it will disconnect (native only)
 *   - `openDeviceSettings` - Apps on Devices: open the Android settings of
 *     the smart reader the app runs on
 *   - `collectData` - read raw magstripe or NFC-UID data (native only)
 *   - `clearCachedCredentials` - forget the cached connection token and
 *     reader session. Call on LOGOUT so the next user starts fresh.
 */
import { IonButton } from '@ionic/react'

import { isNativePlatform } from '../terminal/readers'
import { useTerminal } from '../terminal/useTerminal'
import FeatureCard from './FeatureCard'
import { useAction } from './useAction'

export default function ReaderAdminFeature() {
  const { sdk, initialize, nativeReader } = useTerminal()
  const action = useAction()
  const native = isNativePlatform()

  return (
    <FeatureCard
      title="Reader & SDK admin"
      methods="getConnectedReader · getPaymentStatus · rebootReader · collectData · clearCachedCredentials"
      description="Snapshot the SDK state, reboot the reader, read raw card data, or clear credentials (e.g. on logout)."
      platforms="Mixed; see each button"
      busy={action.busy}
      result={action.result}
      error={action.error}
    >
      <div className="button-row">
        <IonButton
          size="small"
          onClick={() =>
            void action.run(async () => {
              const t = sdk()!
              return {
                connectionStatus: await t.getConnectionStatus(),
                paymentStatus: await t.getPaymentStatus(),
                reader: await t.getConnectedReader(),
              }
            })
          }
        >
          Snapshot state
        </IonButton>
        <IonButton
          size="small"
          fill="outline"
          disabled={!nativeReader}
          onClick={() =>
            void action.run(async () => {
              await sdk()!.rebootReader()
              return 'Reboot requested; the reader will disconnect.'
            })
          }
        >
          Reboot reader
        </IonButton>
        <IonButton
          size="small"
          fill="outline"
          disabled={!nativeReader}
          onClick={() =>
            void action.run(() => sdk()!.collectData({ type: 'nfcUid' }))
          }
        >
          Collect NFC UID
        </IonButton>
        <IonButton
          size="small"
          fill="outline"
          disabled={!native}
          onClick={() =>
            void action.run(async () => {
              await sdk()!.openDeviceSettings({ screen: 'all' })
              return 'Opened device settings'
            })
          }
        >
          Device settings
        </IonButton>
        <IonButton
          size="small"
          color="danger"
          fill="outline"
          onClick={() =>
            void action.run(async () => {
              await sdk()!.clearCachedCredentials()
              // After clearing, re-initialize so a fresh token is fetched.
              await initialize()
              return 'Credentials cleared; SDK re-initialized.'
            })
          }
        >
          Clear credentials
        </IonButton>
      </div>
    </FeatureCard>
  )
}
