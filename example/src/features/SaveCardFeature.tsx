/**
 * SAVE A CARD (SetupIntent)
 *
 * Instead of charging a card, a SetupIntent collects it and creates a
 * reusable PaymentMethod you can charge later (e.g. a membership or tab).
 *
 *   backend: create SetupIntent ->  SDK: retrieveSetupIntent(clientSecret)
 *   SDK: collectSetupIntentPaymentMethod()  <- customer presents the card
 *   SDK: confirmSetupIntent()               -> status 'succeeded'
 *
 * `cancelCollectSetupIntentPaymentMethod()` aborts while waiting for a card.
 * On iOS/Android you can also create the SetupIntent on the device with
 * `createSetupIntent()` instead of calling the backend.
 */
import { IonButton } from '@ionic/react'
import type { SetupIntent } from 'capacitor-stripe-terminal'

import { createSetupIntent } from '../terminal/backend'
import { useTerminal } from '../terminal/useTerminal'
import FeatureCard from './FeatureCard'
import { useAction } from './useAction'

export default function SaveCardFeature() {
  const { sdk, reader, nativeReader } = useTerminal()
  const action = useAction<SetupIntent | null>()

  /** The full flow, with the setup intent created by our backend. */
  async function saveViaBackend() {
    const t = sdk()!
    const created = await createSetupIntent()
    await t.retrieveSetupIntent(created.clientSecret)
    return collectAndConfirm()
  }

  /** Same flow, but the SDK creates the SetupIntent itself (native only). */
  async function saveOnDevice() {
    await sdk()!.createSetupIntent({ usage: 'offSession' })
    return collectAndConfirm()
  }

  async function collectAndConfirm() {
    const t = sdk()!
    await t.collectSetupIntentPaymentMethod({
      // Record the customer's consent to re-use the card.
      allowRedisplay: 'always',
      // 'saveCard' is the default reason; 'verify' (native only) just checks
      // the card is valid without saving it.
      collectionReason: 'saveCard',
    })
    return t.confirmSetupIntent()
  }

  return (
    <FeatureCard
      title="Save a card"
      methods="retrieveSetupIntent · collectSetupIntentPaymentMethod · confirmSetupIntent"
      description="Collect a card without charging it, creating a reusable payment method."
      platforms="All; on-device creation needs a Bluetooth / Tap to Pay reader"
      busy={action.busy}
      result={action.result}
      error={action.error}
    >
      <div className="button-row">
        <IonButton
          size="small"
          disabled={!reader || action.busy}
          onClick={() => void action.run(saveViaBackend)}
        >
          Save card
        </IonButton>
        {/* On-device creation needs a reader driven by the native SDK. */}
        <IonButton
          size="small"
          fill="outline"
          disabled={!nativeReader || action.busy}
          onClick={() => void action.run(saveOnDevice)}
        >
          Create on device
        </IonButton>
        <IonButton
          size="small"
          color="medium"
          fill="outline"
          disabled={!action.busy}
          onClick={() => void sdk()?.cancelCollectSetupIntentPaymentMethod()}
        >
          Cancel
        </IonButton>
      </div>
    </FeatureCard>
  )
}
