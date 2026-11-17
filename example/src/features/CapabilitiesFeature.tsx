/**
 * CAPABILITY CHECKS
 *
 * Before offering a feature, ask the SDK whether THIS device can do it:
 *
 *   - `supportsReadersOfType(deviceType, discoveryMethod, simulated)` -
 *     e.g. "can this phone do Tap to Pay?" (needs NFC, a recent OS, ...)
 *   - `StripeTerminalPlugin.checkPermissions()` / `requestPermissions()` -
 *     location + Bluetooth runtime permissions (static, no instance needed)
 *   - `getDeviceStyleFromDeviceType()` - classifies a reader model as
 *     'internet', 'bluetooth' or 'local' so you know which connect call fits
 */
import { IonButton } from '@ionic/react'
import {
  StripeTerminalPlugin,
  type DeviceType,
  type DiscoveryMethod,
} from 'capacitor-stripe-terminal'

import { Capacitor } from '@capacitor/core'
import { useTerminal } from '../terminal/useTerminal'
import FeatureCard from './FeatureCard'
import { useAction } from './useAction'

/** The reader families worth checking, with the discovery method each needs. */
const CHECKS: { deviceType: DeviceType; method: DiscoveryMethod }[] = [
  { deviceType: 'tapToPay', method: 'tapToPay' },
  { deviceType: 'stripeM2', method: 'bluetoothScan' },
  { deviceType: 'wisePad3', method: 'bluetoothScan' },
  { deviceType: 'stripeS700', method: 'internet' },
  { deviceType: 'wisePosE', method: 'internet' },
]

export default function CapabilitiesFeature() {
  const { sdk } = useTerminal()
  const support = useAction<Record<string, boolean | string>>()
  const perms = useAction()

  async function checkSupport() {
    const t = sdk()!
    const out: Record<string, boolean | string> = {}
    for (const { deviceType, method } of CHECKS) {
      const key = `${deviceType} via ${method} (${t.getDeviceStyleFromDeviceType(deviceType)})`
      try {
        // `simulated: false` asks about REAL hardware support.
        out[key] = await t.supportsReadersOfType(deviceType, method, false)
      } catch (err) {
        out[key] = err instanceof Error ? err.message : 'unsupported'
      }
    }
    return out
  }

  return (
    <FeatureCard
      title="Capability & permission checks"
      methods="supportsReadersOfType · checkPermissions · requestPermissions"
      description="Ask whether this device can use each reader type, and manage runtime permissions."
      platforms="Support check: native. Permissions: Android only"
      busy={support.busy || perms.busy}
      result={support.result ?? perms.result}
      error={support.error ?? perms.error}
    >
      <div className="button-row">
        <IonButton
          size="small"
          disabled={support.busy}
          onClick={() => void support.run(checkSupport)}
        >
          Check reader support
        </IonButton>
        <IonButton
          size="small"
          fill="outline"
          disabled={Capacitor.getPlatform() !== 'android'}
          onClick={() =>
            void perms.run(() => StripeTerminalPlugin.checkPermissions())
          }
        >
          Check permissions
        </IonButton>
        <IonButton
          size="small"
          fill="outline"
          disabled={Capacitor.getPlatform() !== 'android'}
          onClick={() =>
            void perms.run(() => StripeTerminalPlugin.requestPermissions())
          }
        >
          Request permissions
        </IonButton>
      </div>
    </FeatureCard>
  )
}
