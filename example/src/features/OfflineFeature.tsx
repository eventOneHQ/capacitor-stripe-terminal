/**
 * OFFLINE PAYMENTS
 *
 * The native SDKs can accept payments while the network is down, store them
 * encrypted on the device, and forward them to Stripe when connectivity
 * returns. To try it with the simulator:
 *
 *   1. Reader tab -> find readers via Bluetooth (simulated)
 *   2. Settings -> turn on "Simulate offline"
 *   3. Charge tab -> Payment options -> "Create intent on device" with
 *      offline behavior "force_offline" (or "prefer_online")
 *   4. Take a payment; it succeeds but is marked "offline"
 *   5. Turn the simulation off; watch the Activity log for "Forwarded ...".
 *
 * Listeners wired up in TerminalProvider: `didChangeOfflineStatus`,
 * `didForwardPaymentIntent`, `didReportForwardingError`.
 * Here `getOfflineStatus` reads the current numbers on demand.
 */
import { IonButton } from '@ionic/react'
import type { OfflineStatus } from 'capacitor-stripe-terminal'

import { useTerminal } from '../terminal/useTerminal'
import FeatureCard from './FeatureCard'
import { useAction } from './useAction'

export default function OfflineFeature() {
  const { sdk, offlineStatus, nativeReader } = useTerminal()
  const action = useAction<OfflineStatus>()

  return (
    <FeatureCard
      title="Offline payments"
      methods="getOfflineStatus · didChangeOfflineStatus · didForwardPaymentIntent"
      description="Inspect the SDK's offline queue. Pending payments are forwarded automatically when the network returns."
      platforms="Bluetooth / Tap to Pay readers (iOS, Android)"
      busy={action.busy}
      result={action.result ?? offlineStatus ?? undefined}
      error={action.error}
    >
      <IonButton
        size="small"
        disabled={!nativeReader || action.busy}
        onClick={() => void action.run(() => sdk()!.getOfflineStatus())}
      >
        Get offline status
      </IonButton>
    </FeatureCard>
  )
}
