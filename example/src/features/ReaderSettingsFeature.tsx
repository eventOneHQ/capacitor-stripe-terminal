/**
 * READER SETTINGS (accessibility)
 *
 * Some readers support text-to-speech so visually impaired customers can
 * complete a payment. `getReaderSettings` reads the current value;
 * `setReaderSettings` changes it. The accessibility field is a union: either
 * `{ textToSpeechStatus }` or `{ error }` (when the reader can't report it).
 */
import { IonButton } from '@ionic/react'
import type { ReaderSettings } from 'capacitor-stripe-terminal'

import { useTerminal } from '../terminal/useTerminal'
import FeatureCard from './FeatureCard'
import { useAction } from './useAction'

export default function ReaderSettingsFeature() {
  const { sdk, reader } = useTerminal()
  const action = useAction<ReaderSettings>()

  return (
    <FeatureCard
      title="Reader settings"
      methods="getReaderSettings · setReaderSettings"
      description="Read or change text-to-speech output on the connected reader."
      platforms="Readers that support accessibility settings"
      busy={action.busy}
      result={action.result}
      error={action.error}
    >
      <div className="button-row">
        <IonButton
          size="small"
          disabled={!reader || action.busy}
          onClick={() => void action.run(() => sdk()!.getReaderSettings())}
        >
          Get
        </IonButton>
        <IonButton
          size="small"
          fill="outline"
          disabled={!reader || action.busy}
          onClick={() =>
            void action.run(() =>
              sdk()!.setReaderSettings({ textToSpeechViaSpeakers: true }),
            )
          }
        >
          Speak via speakers
        </IonButton>
        <IonButton
          size="small"
          fill="outline"
          disabled={!reader || action.busy}
          onClick={() =>
            void action.run(() =>
              sdk()!.setReaderSettings({ textToSpeechViaSpeakers: false }),
            )
          }
        >
          Headphones only
        </IonButton>
      </div>
    </FeatureCard>
  )
}
