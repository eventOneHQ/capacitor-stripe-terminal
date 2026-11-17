/**
 * Settings tab: developer-facing options.
 *
 * Everything here is stored via `updateSettings()` (src/lib/settings.ts), which
 * persists to localStorage and re-renders any screen that reads the setting.
 */
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/react'
import type {
  SimulatedCardType,
  SimulateReaderUpdate,
} from 'capacitor-stripe-terminal'
import { useState } from 'react'

import { isNativePlatform } from '../terminal/readers'
import { useTerminal } from '../terminal/useTerminal'

import { errorMessage } from '../lib/errors'
import { resetSettings, updateSettings, useSettings } from '../lib/settings'
import { checkHealth, enableTipping } from '../terminal/backend'

/**
 * Cards the simulated reader can "tap". The decline cards are the useful ones:
 * they let you test your error handling without a real declined card.
 * https://docs.stripe.com/terminal/references/testing#simulated-test-card-numbers
 */
const SIMULATED_CARDS: { value: SimulatedCardType; label: string }[] = [
  { value: 'visa', label: 'Visa (approved)' },
  { value: 'visaDebit', label: 'Visa debit (approved)' },
  { value: 'mastercard', label: 'Mastercard (approved)' },
  { value: 'amex', label: 'American Express (approved)' },
  { value: 'discover', label: 'Discover (approved)' },
  { value: 'interac', label: 'Interac (approved, CAD)' },
  { value: 'chargeDeclined', label: 'Declined: generic' },
  {
    value: 'chargeDeclinedInsufficientFunds',
    label: 'Declined: insufficient funds',
  },
  { value: 'chargeDeclinedLostCard', label: 'Declined: lost card' },
  { value: 'chargeDeclinedStolenCard', label: 'Declined: stolen card' },
  { value: 'chargeDeclinedExpiredCard', label: 'Declined: expired card' },
  {
    value: 'chargeDeclinedProcessingError',
    label: 'Declined: processing error',
  },
]

/** Software updates the simulated reader can pretend to have on connect. */
const SIMULATED_UPDATES: { value: SimulateReaderUpdate; label: string }[] = [
  { value: 'none', label: 'No update' },
  { value: 'available', label: 'Optional update' },
  { value: 'required', label: 'Required update' },
  { value: 'lowBattery', label: 'Update blocked by low battery' },
  { value: 'random', label: 'Random' },
]

const CURRENCIES = ['usd', 'cad', 'gbp', 'eur', 'aud', 'jpy']

export default function SettingsPage() {
  const settings = useSettings()
  const [health, setHealth] = useState<string>()
  const [tipSetup, setTipSetup] = useState<string>()
  const { initialize } = useTerminal()

  /** Ping the backend so a wrong URL is caught before trying to connect. */
  async function testBackend() {
    setHealth('Checking...')
    try {
      const result = await checkHealth()
      setHealth(`Backend OK (${result.livemode ? 'LIVE mode' : 'test mode'})`)
    } catch (err) {
      setHealth(errorMessage(err))
    }
  }

  /** One-time: give your Terminal configuration tip options. */
  async function setupTipping() {
    setTipSetup('Updating...')
    try {
      const { updated } = await enableTipping()
      setTipSetup(`Tipping enabled on ${updated.length} configuration(s).`)
    } catch (err) {
      setTipSetup(errorMessage(err))
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* ---------------- Backend ---------------- */}
        <IonList inset>
          <IonListHeader>Backend</IonListHeader>
          <IonItem>
            <IonInput
              label="URL"
              type="url"
              value={settings.backendUrl}
              placeholder="http://192.168.1.20:4242"
              onIonChange={(e) =>
                updateSettings({ backendUrl: String(e.detail.value ?? '') })
              }
            />
          </IonItem>
          <IonItem lines="none">
            <IonNote>
              On a phone use your computer's LAN IP (not localhost). On the
              Android emulator use http://10.0.2.2:4242.
            </IonNote>
          </IonItem>
          <IonItem lines="none">
            <IonButton size="small" onClick={() => void testBackend()}>
              Test connection
            </IonButton>
            {health && <IonNote slot="end">{health}</IonNote>}
          </IonItem>
        </IonList>

        {/* ---------------- Payments ---------------- */}
        <IonList inset>
          <IonListHeader>Payments</IonListHeader>
          <IonItem>
            <IonSelect
              label="Currency"
              value={settings.currency}
              onIonChange={(e) => updateSettings({ currency: e.detail.value })}
            >
              {CURRENCIES.map((c) => (
                <IonSelectOption key={c} value={c}>
                  {c.toUpperCase()}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        </IonList>

        {/* ---------------- Tipping ---------------- */}
        <IonList inset>
          <IonListHeader>On-reader tipping</IonListHeader>
          <IonItem lines="none">
            <IonNote className="ion-text-wrap">
              Smart readers only show a tip screen if your Terminal
              Configuration has tip options. This adds 10/15/20% to your
              test-mode configurations (the same as Dashboard, Terminal,
              Configurations, Tipping).
            </IonNote>
          </IonItem>
          <IonItem lines="none">
            <IonButton size="small" onClick={() => void setupTipping()}>
              Enable tipping (test mode)
            </IonButton>
            {tipSetup && <IonNote slot="end">{tipSetup}</IonNote>}
          </IonItem>
        </IonList>

        {/* ---------------- Simulator ---------------- */}
        <IonList inset>
          <IonListHeader>Simulator</IonListHeader>
          <IonItem>
            <IonToggle
              checked={settings.simulated}
              onIonChange={(e) =>
                updateSettings({ simulated: e.detail.checked })
              }
            >
              Use simulated reader
            </IonToggle>
          </IonItem>
          <IonItem>
            <IonSelect
              label="Card"
              value={settings.simulatedCard}
              disabled={!settings.simulated}
              onIonChange={(e) =>
                updateSettings({ simulatedCard: e.detail.value })
              }
            >
              {SIMULATED_CARDS.map((c) => (
                <IonSelectOption key={c.value} value={c.value}>
                  {c.label}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
          <IonItem>
            <IonSelect
              label="Reader update"
              value={settings.simulatedUpdate}
              disabled={!settings.simulated}
              onIonChange={(e) =>
                updateSettings({ simulatedUpdate: e.detail.value })
              }
            >
              {SIMULATED_UPDATES.map((u) => (
                <IonSelectOption key={u.value} value={u.value}>
                  {u.label}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
          <IonItem>
            <IonToggle
              checked={settings.simulatedOffline}
              disabled={!settings.simulated || !isNativePlatform()}
              onIonChange={(e) =>
                updateSettings({ simulatedOffline: e.detail.checked })
              }
            >
              Simulate offline (iOS/Android)
            </IonToggle>
          </IonItem>
          <IonItem lines="none">
            <IonNote>
              Reader-update changes apply the next time you connect a reader.
              Turn simulation OFF to use real hardware.
            </IonNote>
          </IonItem>
        </IonList>

        {/* ---------------- SDK initialization ---------------- */}
        <IonList inset>
          <IonListHeader>SDK</IonListHeader>
          <IonItem>
            <IonSelect
              label="Log level"
              value={settings.logLevel}
              onIonChange={(e) => updateSettings({ logLevel: e.detail.value })}
            >
              {['none', 'error', 'warning', 'info', 'verbose'].map((l) => (
                <IonSelectOption key={l} value={l}>
                  {l}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
          <IonItem>
            <IonInput
              label="Locale"
              placeholder="auto (e.g. en-US)"
              value={settings.locale}
              onIonChange={(e) =>
                updateSettings({ locale: String(e.detail.value ?? '') })
              }
            />
          </IonItem>
          <IonItem lines="none">
            <IonNote>
              Log level and locale are read when the SDK starts. Re-initialize
              to apply them.
            </IonNote>
          </IonItem>
          <IonItem lines="none">
            <IonButton size="small" onClick={() => void initialize()}>
              Re-initialize SDK
            </IonButton>
          </IonItem>
        </IonList>

        <div className="ion-padding">
          <IonButton
            expand="block"
            color="medium"
            fill="outline"
            onClick={resetSettings}
          >
            Reset to defaults
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  )
}
