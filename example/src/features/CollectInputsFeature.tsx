/**
 * COLLECT INPUTS (on-reader forms)
 *
 * Smart readers (WisePOS E, Stripe S700/S710, ...) have a touchscreen, so you
 * can show forms on the reader itself: an email field for a receipt, a
 * signature pad, a phone number, a multiple-choice question, and so on.
 * `collectInputs` takes an ordered list of screens and resolves to one result
 * per screen. A person can skip a screen if you allow it.
 */
import { IonButton } from '@ionic/react'
import {
  FormType,
  SelectionButtonStyle,
  ToggleValue,
  type ICollectInputsResult,
} from 'capacitor-stripe-terminal'

import { useTerminal } from '../terminal/useTerminal'
import FeatureCard from './FeatureCard'
import { useAction } from './useAction'

export default function CollectInputsFeature() {
  const { sdk, reader } = useTerminal()
  const action = useAction<ICollectInputsResult[]>()

  async function collect() {
    return sdk()!.collectInputs({
      inputs: [
        // A yes/no style question with two buttons.
        {
          formType: FormType.SELECTION,
          title: 'How was your visit?',
          required: true,
          selectionButtons: [
            { style: SelectionButtonStyle.PRIMARY, text: 'Great', id: 'great' },
            { style: SelectionButtonStyle.SECONDARY, text: 'Okay', id: 'okay' },
          ],
        },
        // Email, skippable, with an opt-in toggle underneath.
        {
          formType: FormType.EMAIL,
          title: 'Email your receipt?',
          required: false,
          skipButtonText: 'No thanks',
          submitButtonText: 'Send',
          toggles: [
            {
              title: 'Subscribe to news',
              description: 'Occasional updates.',
              defaultValue: ToggleValue.DISABLED,
            },
          ],
        },
        { formType: FormType.PHONE, title: 'Phone number', required: false },
        { formType: FormType.SIGNATURE, title: 'Please sign', required: false },
      ],
    })
  }

  return (
    <FeatureCard
      title="Collect inputs"
      methods="collectInputs · cancelCollectInputs"
      description="Show a survey, email, phone and signature form on the reader's screen."
      platforms="Internet smart readers (S700/S710, WisePOS E)"
      busy={action.busy}
      result={action.result}
      error={action.error}
    >
      <div className="button-row">
        <IonButton
          size="small"
          disabled={!reader || action.busy}
          onClick={() => void action.run(collect)}
        >
          Show form
        </IonButton>
        <IonButton
          size="small"
          color="medium"
          fill="outline"
          disabled={!action.busy}
          onClick={() => void sdk()?.cancelCollectInputs()}
        >
          Cancel
        </IonButton>
      </div>
    </FeatureCard>
  )
}
