/**
 * Reader tab: initialize status, discover readers, connect, manage the
 * connected reader.
 *
 * This screen covers phase 2 of a Terminal integration. The flow:
 *
 *   [Search for readers]  ->  list of discovered readers  ->  [Connect]
 *                                                                |
 *       connected reader card (battery, update, disconnect)  <---+
 */
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonItem,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonProgressBar,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/react'

import ConnectionBadge from '../components/ConnectionBadge'
import ReaderItem from '../components/ReaderItem'
import { updateSettings, useSettings } from '../lib/settings'
import {
  DISCOVERY_OPTIONS,
  availableDiscoveryOptions,
} from '../terminal/readers'
import { useTerminal } from '../terminal/useTerminal'

export default function ReaderPage() {
  const t = useTerminal()
  const settings = useSettings()
  const options = availableDiscoveryOptions()
  const selected = DISCOVERY_OPTIONS.find(
    (o) => o.method === settings.discoveryMethod,
  )
  const connected = t.connectionStatus === 'connected' && t.reader

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Reader</IonTitle>
          <div slot="end" style={{ paddingRight: 16 }}>
            <ConnectionBadge status={t.connectionStatus} />
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* ---- SDK startup problems (usually a backend/token issue) ---- */}
        {t.sdkState === 'initializing' && (
          <IonItem lines="none">
            <IonSpinner slot="start" />
            Initializing Terminal SDK...
          </IonItem>
        )}
        {t.sdkState === 'error' && (
          <IonCard color="danger">
            <IonCardHeader>
              <IonCardTitle>Terminal failed to start</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              {t.sdkError}
              <IonButton
                expand="block"
                fill="outline"
                color="light"
                onClick={() => void t.initialize()}
              >
                Retry
              </IonButton>
            </IonCardContent>
          </IonCard>
        )}

        {/* Bluetooth dropped; the SDK is trying to get the reader back. */}
        {t.connectionStatus === 'reconnecting' && (
          <IonItem color="warning" lines="none">
            Reconnecting to the reader...
            <IonButton
              slot="end"
              size="small"
              onClick={() => void t.cancelReconnect()}
            >
              Give up
            </IonButton>
          </IonItem>
        )}

        {/* ---- Connected reader ---- */}
        {connected && t.reader && (
          <IonCard>
            <IonCardHeader>
              <IonCardSubtitle>Connected reader</IonCardSubtitle>
            </IonCardHeader>
            <ReaderItem reader={t.reader} />
            <IonCardContent>
              {/*
                Battery info arrives through the `didUpdateBatteryLevel`
                listener (Bluetooth and Tap to Pay readers).
              */}
              {t.battery && (
                <p>
                  Battery: {Math.round(t.battery.batteryLevel * 100)}%
                  {t.battery.isCharging ? ' (charging)' : ''}
                </p>
              )}

              {/* A reader software update, when the SDK reports one. */}
              {t.update.available && !t.update.installing && (
                <p>
                  <IonText color="warning">
                    Update {t.update.available.deviceSoftwareVersion} available
                    (~{t.update.available.estimatedUpdateTimeString}).
                  </IonText>
                  <IonButton
                    size="small"
                    onClick={() => void t.installUpdate()}
                  >
                    Install
                  </IonButton>
                </p>
              )}
              {t.update.installing && (
                <>
                  <p>Installing update. Keep the reader powered on.</p>
                  <IonProgressBar value={t.update.progress} />
                  <IonButton
                    size="small"
                    fill="clear"
                    onClick={() => void t.cancelUpdate()}
                  >
                    Cancel update
                  </IonButton>
                </>
              )}

              <IonButton
                expand="block"
                color="medium"
                fill="outline"
                onClick={() => void t.disconnect()}
              >
                Disconnect
              </IonButton>
            </IonCardContent>
          </IonCard>
        )}

        {/* ---- Discovery controls (hidden once connected) ---- */}
        {!connected && (
          <>
            <IonList inset>
              <IonItem>
                <IonSelect
                  label="Find readers via"
                  value={settings.discoveryMethod}
                  onIonChange={(e) =>
                    updateSettings({ discoveryMethod: e.detail.value })
                  }
                >
                  {options.map((o) => (
                    <IonSelectOption key={o.method} value={o.method}>
                      {o.label}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>

              {/*
                Locations: Bluetooth readers MUST be registered to a Stripe
                Location when connecting. Leave on "Reader's own" for the
                simulator, which brings its own mock location.
              */}
              <IonItem>
                <IonSelect
                  label="Location"
                  value={settings.locationId}
                  onIonFocus={() => void t.loadLocations()}
                  onIonChange={(e) =>
                    updateSettings({ locationId: e.detail.value })
                  }
                >
                  <IonSelectOption value="">Reader's own</IonSelectOption>
                  {t.locations.map((l) => (
                    <IonSelectOption key={l.id} value={l.id}>
                      {l.displayName ?? l.id}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
              {selected && (
                <IonItem lines="none">
                  <IonNote>{selected.description}</IonNote>
                </IonItem>
              )}
            </IonList>

            <div className="ion-padding-horizontal">
              {t.isDiscovering ? (
                <IonButton
                  expand="block"
                  color="medium"
                  onClick={() => void t.stopDiscovery()}
                >
                  <IonSpinner slot="start" name="dots" />
                  Stop searching
                </IonButton>
              ) : (
                <IonButton
                  expand="block"
                  disabled={t.sdkState !== 'ready'}
                  onClick={() => void t.discover()}
                >
                  Search for readers
                </IonButton>
              )}
            </div>

            {t.discoveryError && (
              <IonItem lines="none">
                <IonText color="danger">{t.discoveryError}</IonText>
              </IonItem>
            )}

            {/* ---- Results ---- */}
            {t.discoveredReaders.length > 0 && (
              <IonList inset>
                <IonListHeader>Readers found</IonListHeader>
                {t.discoveredReaders.map((r) => (
                  <ReaderItem
                    key={r.serialNumber}
                    reader={r}
                    action={
                      <IonButton
                        slot="end"
                        size="small"
                        disabled={t.connectionStatus === 'connecting'}
                        onClick={() => void t.connect(r)}
                      >
                        Connect
                      </IonButton>
                    }
                  />
                ))}
              </IonList>
            )}
          </>
        )}
      </IonContent>
    </IonPage>
  )
}
