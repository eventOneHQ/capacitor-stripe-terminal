/**
 * ConnectionBadge: a small colored chip showing the SDK's connection status.
 *
 * `ConnectionStatus` is one of five strings from the plugin. Handle ALL of
 * them in your UI; 'reconnecting' in particular is easy to forget and happens
 * when a Bluetooth reader briefly drops.
 */
import { IonBadge } from '@ionic/react'
import type { ConnectionStatus } from 'capacitor-stripe-terminal'

const STYLES: Record<ConnectionStatus, { color: string; label: string }> = {
  notConnected: { color: 'medium', label: 'Not connected' },
  discovering: { color: 'warning', label: 'Discovering' },
  connecting: { color: 'warning', label: 'Connecting' },
  connected: { color: 'success', label: 'Connected' },
  reconnecting: { color: 'danger', label: 'Reconnecting' },
}

export default function ConnectionBadge({
  status,
}: {
  status: ConnectionStatus
}) {
  const { color, label } = STYLES[status]
  return <IonBadge color={color}>{label}</IonBadge>
}
