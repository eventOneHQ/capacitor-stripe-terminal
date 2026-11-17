/**
 * ReaderItem: one row in a list of readers (discovered or connected).
 *
 * A `Reader` object comes straight from the plugin. Notable fields:
 *   - `label`        Name assigned in the Stripe Dashboard (internet readers).
 *   - `serialNumber` Always present; the printed serial on the device.
 *   - `deviceType`   Model, e.g. 'wisePosE'. See `deviceTypeLabel()`.
 *   - `simulated`    True for Stripe's built-in fake reader.
 *   - `batteryLevel` 0..1, or null if unknown / not battery powered.
 *   - `status`       'online' | 'offline' | 'unknown' (internet readers).
 */
import { IonBadge, IonItem, IonLabel, IonNote } from '@ionic/react'
import type { ReactNode } from 'react'
import type { Reader } from 'capacitor-stripe-terminal'

import { deviceTypeLabel } from '../terminal/readers'

interface Props {
  reader: Reader
  /** Optional trailing element, usually a Connect/Disconnect button. */
  action?: ReactNode
}

export default function ReaderItem({ reader, action }: Props) {
  return (
    <IonItem>
      <IonLabel>
        <h2>{reader.label || deviceTypeLabel(reader.deviceType)}</h2>
        <p>
          {deviceTypeLabel(reader.deviceType)} ·{' '}
          <span className="mono">{reader.serialNumber}</span>
        </p>
        {/* Small facts, shown only when the SDK provides them. */}
        <p>
          {reader.simulated && <IonBadge color="tertiary">Simulated</IonBadge>}{' '}
          {reader.status && reader.status !== 'unknown' && (
            <IonBadge color={reader.status === 'online' ? 'success' : 'medium'}>
              {reader.status}
            </IonBadge>
          )}
        </p>
      </IonLabel>
      {reader.batteryLevel != null && (
        <IonNote slot="end">{Math.round(reader.batteryLevel * 100)}%</IonNote>
      )}
      {action}
    </IonItem>
  )
}
