/**
 * Static knowledge about readers and discovery methods.
 *
 * Which discovery methods work depends on the platform the app is running on.
 * This file centralizes that table so the UI can show only valid choices
 * instead of letting a user pick something that will fail.
 * (Source of truth: docs/guides/readers.md in this repo.)
 */
import { Capacitor } from '@capacitor/core'
import type { DeviceType, DiscoveryMethod } from 'capacitor-stripe-terminal'

type Platform = 'ios' | 'android' | 'web'

export interface DiscoveryOption {
  method: DiscoveryMethod
  label: string
  description: string
  /** Platforms where this method is available. */
  platforms: Platform[]
}

export const DISCOVERY_OPTIONS: DiscoveryOption[] = [
  {
    method: 'internet',
    label: 'Internet',
    description: 'WisePOS E, Stripe S700/S710. Works everywhere, even web.',
    platforms: ['ios', 'android', 'web'],
  },
  {
    method: 'bluetoothScan',
    label: 'Bluetooth',
    description: 'Stripe M2, WisePad 3/3s, Chipper 2X BT.',
    platforms: ['ios', 'android'],
  },
  {
    method: 'both',
    label: 'Bluetooth + Internet',
    description: 'Search both at once and merge the results.',
    platforms: ['ios', 'android'],
  },
  {
    method: 'tapToPay',
    label: 'Tap to Pay',
    description: "Use this phone's own NFC chip as the reader.",
    platforms: ['ios', 'android'],
  },
  {
    method: 'appsOnDevices',
    label: 'Apps on Devices',
    description: 'This app is running ON a Stripe smart reader (S700).',
    platforms: ['android'],
  },
  {
    method: 'usb',
    label: 'USB',
    description: 'A reader plugged into this Android device.',
    platforms: ['android'],
  },
]

/** The platform we're running on: 'ios', 'android' or 'web'. */
export function currentPlatform(): Platform {
  return Capacitor.getPlatform() as Platform
}

/** Discovery methods that make sense on this device. */
export function availableDiscoveryOptions(): DiscoveryOption[] {
  const platform = currentPlatform()
  return DISCOVERY_OPTIONS.filter((o) => o.platforms.includes(platform))
}

/** True when running inside the iOS/Android app (not a desktop browser). */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform()
}

/** Friendly names for the `deviceType` values most people will meet. */
const DEVICE_LABELS: Partial<Record<DeviceType, string>> = {
  stripeM2: 'Stripe Reader M2',
  stripeS700: 'Stripe Reader S700',
  stripeS700Devkit: 'Stripe Reader S700 (devkit)',
  stripeS710: 'Stripe Reader S710',
  stripeS710Devkit: 'Stripe Reader S710 (devkit)',
  stripeT600: 'Stripe Reader T600',
  stripeT610: 'Stripe Reader T610',
  stripeU200: 'Stripe Reader U200',
  wisePad3: 'BBPOS WisePad 3',
  wisePad3s: 'BBPOS WisePad 3s',
  wisePosE: 'BBPOS WisePOS E',
  wisePosEDevkit: 'BBPOS WisePOS E (devkit)',
  chipper2X: 'BBPOS Chipper 2X BT',
  tapToPay: 'Tap to Pay on this device',
}

/** Human-readable name for a reader's device type. */
export function deviceTypeLabel(deviceType: DeviceType): string {
  return DEVICE_LABELS[deviceType] ?? deviceType
}
