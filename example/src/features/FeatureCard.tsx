/**
 * FeatureCard: the common frame for each Tools-tab demo.
 *
 * Shows a title, a short explanation (what the SDK feature is for), a
 * platform note, the demo's controls (`children`), and the outcome of the
 * last run (a JSON result or an error). Keeping this consistent makes the
 * Tools tab read like a catalog of SDK capabilities.
 */
import {
  IonBadge,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonSpinner,
  IonText,
} from '@ionic/react'
import type { ReactNode } from 'react'

interface Props {
  title: string
  /** The SDK methods this demo exercises, shown as a small subtitle. */
  methods: string
  description: string
  /** Where it works, e.g. "iOS, Android". Shown as a badge. */
  platforms?: string
  busy?: boolean
  result?: unknown
  error?: string
  children: ReactNode
}

export default function FeatureCard(props: Props) {
  return (
    <IonCard>
      <IonCardHeader>
        <IonCardSubtitle className="mono">{props.methods}</IonCardSubtitle>
        <IonCardTitle>{props.title}</IonCardTitle>
      </IonCardHeader>
      <IonCardContent>
        <p>{props.description}</p>
        {props.platforms && (
          <p>
            <IonBadge color="medium">{props.platforms}</IonBadge>
          </p>
        )}
        {props.children}
        {props.busy && <IonSpinner name="dots" />}
        {props.error && (
          <p>
            <IonText color="danger">{props.error}</IonText>
          </p>
        )}
        {props.result !== undefined && (
          <pre className="result-json">
            {JSON.stringify(props.result, null, 2)}
          </pre>
        )}
      </IonCardContent>
    </IonCard>
  )
}
