/**
 * Tools tab: a catalog of the SDK's other features, each as a small
 * self-contained demo (see src/features/). Payments and reader connection
 * live on their own tabs; everything else is here.
 *
 * Most demos need a connected reader; their buttons are disabled otherwise.
 * Each card names the SDK methods it uses and where they are supported, since
 * several features depend on the platform or reader model.
 */
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react'

import ConnectionBadge from '../components/ConnectionBadge'
import CapabilitiesFeature from '../features/CapabilitiesFeature'
import CartDisplayFeature from '../features/CartDisplayFeature'
import CollectInputsFeature from '../features/CollectInputsFeature'
import OfflineFeature from '../features/OfflineFeature'
import PrintFeature from '../features/PrintFeature'
import ReaderAdminFeature from '../features/ReaderAdminFeature'
import ReaderSettingsFeature from '../features/ReaderSettingsFeature'
import SaveCardFeature from '../features/SaveCardFeature'
import { useTerminal } from '../terminal/useTerminal'

export default function ToolsPage() {
  const { connectionStatus } = useTerminal()
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Tools</IonTitle>
          <div slot="end" style={{ paddingRight: 16 }}>
            <ConnectionBadge status={connectionStatus} />
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <SaveCardFeature />
        <CollectInputsFeature />
        <CartDisplayFeature />
        <PrintFeature />
        <ReaderSettingsFeature />
        <OfflineFeature />
        <CapabilitiesFeature />
        <ReaderAdminFeature />
      </IonContent>
    </IonPage>
  )
}
