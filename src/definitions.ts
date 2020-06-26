import { Plugin } from '@capacitor/core/dist/esm/definitions'

declare module '@capacitor/core' {
  interface PluginRegistry {
    StripeTerminal: StripeTerminalInterface
  }
}

/**
 * @category Terminal
 */
export enum ConnectionStatus {
  /**
   * The SDK is not connected to a reader.
   */
  NotConnected = 0,
  /**
   * The SDK is connected to a reader.
   */
  Connected = 1,
  /**
   * The SDK is currently connecting to a reader.
   */
  Connecting = 2
}

/**
 * The possible device types for a reader.
 *
 * @category Reader
 * @see https://stripe.com/docs/terminal/readers
 */
export enum DeviceType {
  /**
   * The BBPOS Chipper 2X BT mobile reader.
   *
   * @see https://stripe.com/docs/terminal/readers/bbpos-chipper2xbt
   */
  Chipper2X,

  /**
   * The Verifone P400 countertop reader.
   *
   * @see https://stripe.com/docs/terminal/readers/verifone-p400
   */
  VerifoneP400
}

/**
 * The possible methods for discovering a reader.
 *
 * @category Reader
 * @see https://stripe.com/docs/terminal/readers/connecting
 */
export enum DiscoveryMethod {
  /**
   * Bluetooth Scan
   *
   * When discovering a reader using this method, the `discoverReaders` Observable will be called multiple times as the Bluetooth scan proceeds.
   */
  BluetoothScan,

  /**
   * Bluetooth Proximity
   *
   * If your app will be used in a busy environment with multiple iOS devices pairing to multiple available readers at the same time, we recommend using this discovery method.
   *
   * After a reader has been discovered using this method, the LEDs located above the reader's power button will start flashing multiple colors. After discovering the reader, your app should prompt the user to confirm that the reader is flashing, and require a user action (e.g. tapping a button) to connect to the reader.
   *
   * When discovering a reader using this method, the `discoverReaders` Observable will be called twice. It will be called for the first time when the reader is initially discovered. The reader's LEDs will begin flashing. After a short delay, `discoverReaders` will be called a second time with an updated reader object, populated with additional info about the device, like its battery level.
   */
  BluetoothProximity,

  /**
   * Internet
   *
   * When discovering a reader with this method, the `discoverReaders` Observable will only be called once with a list of readers from `/v1/termina/readers`. Note that this will include readers that are both online and offline. This discovery method can only be used with the VerifoneP400 reader.
   *
   * @see https://stripe.com/docs/api/terminal/readers/list
   */
  Internet
}

/**
 * The possible networking statuses of a reader.
 *
 * @category Reader
 * @see https://stripe.com/docs/api/terminal/readers/object
 */
export enum ReaderNetworkStatus {
  /**
   * The reader is offline. Note that Chipper2x will also default to ‘offline’.
   */
  Offline,
  /**
   * The reader is online.
   */
  Online
}

export interface StripeTerminalConfig {
  fetchConnectionToken: () => Promise<string>
}

/**
 * @category Reader
 */
export interface DiscoveryConfiguration {
  /**
   * Whether to use simulated discovery to discover a device simulator.
   *
   * The Terminal SDK comes with the ability to simulate behavior without using physical hardware. This makes it easy to quickly test your integration end-to-end, from pairing with a reader to taking payments.
   *
   * @default true
   */
  simulated?: boolean

  /**
   * The method by which to discover readers.
   *
   * @default DiscoveryMethod.BluetoothScan
   */
  discoveryMethod?: DiscoveryMethod

  /**
   * The reader device type to discover.
   *
   * @default DeviceType.Chipper2X
   */
  deviceType?: DeviceType

  /**
   * A location ID that can be used to filter discovery result so only readers registered to that location are returned. Currently this is only applicable to VerifoneP400 readers.
   */
  locationId?: string
}

/**
 * @category Reader
 */
export interface Reader {
  /**
   * The IP address of the reader. (Verifone P400 only.)
   */
  ipAddress?: string

  /**
   * The location ID of the reader. (Verifone P400 only.)
   *
   * @see https://stripe.com/docs/api/terminal/locations
   */
  locationId?: string

  /**
   * The networking status of the reader: either offline or online. Note that the Chipper 2X’s status will always be offline. (Verifone P400 only.)
   */
  status: ReaderNetworkStatus

  /**
   * A custom label that may be given to a reader for easier identification. (Verifone P400 only.)
   */
  label?: string
  /**
   * The reader's battery level, represented as a boxed float in the range `[0, 1]`. If the reader does not have a battery, or the battery level is unknown, this value is `null`. (Chipper 2X only.)
   */
  batteryLevel?: number

  /**
   * The Stripe unique identifier for the reader.
   */
  stripeId?: string

  /**
   * The reader's device type.
   */
  deviceType: string

  /**
   * True if this is a simulated reader.
   *
   * `DiscoveryConfiguration` objects with `simulated = true` produce simulated Readers.
   */
  simulated: boolean

  /**
   * The reader's serial number.
   */
  serialNumber: string

  /**
   * The reader's current device software version, or `null` if this information is unavailable.
   */
  deviceSoftwareVersion?: string
}

/**
 * @category Reader Updates
 */
export interface ReaderSoftwareUpdate {
  /**
   * The estimated amount of time for the update.
   */
  estimatedUpdateTime: string

  /**
   * The target version for the update.
   */
  deviceSoftwareVersion: string
}

/**
 * The display messages that a reader may request be displayed by your app.
 *
 * @category Reader
 * @see https://stripe.dev/stripe-terminal-ios/docs/Enums/SCPReaderDisplayMessage
 */
export enum ReaderDisplayMessage {
  /**
   * Retry the presented card.
   */
  RetryCard,

  /**
   * Insert the presented card.
   */
  InsertCard,

  /**
   * Insert or swipe the presented card.
   */
  InsertOrSwipeCard,

  /**
   * Swipe the presented card.
   */
  SwipeCard,

  /**
   * Remove the presented card.
   */
  RemoveCard,

  /**
   * The reader detected multiple contactless cards. Make sure only one contactless card or NFC device is near the reader.
   */
  MultipleContactlessCardsDetected,

  /**
   * The card could not be read. Try another read method on the same card, or use a different card.
   */
  TryAnotherReadMethod,

  /**
   * The card is invalid. Try another card.
   */
  TryAnotherCard
}

/**
 * This represents all of the input methods available to your user when the reader begins waiting for input.
 *
 * @category Reader
 * @see https://stripe.dev/stripe-terminal-ios/docs/Enums/SCPReaderInputOptions
 */
export enum ReaderInputOptions {
  /**
   * No input options are available on the reader.
   */
  None = 0,

  /**
   * Swipe a magstripe card.
   */
  SwipeCard = 1 << 0,

  /**
   * Insert a chip card.
   */
  InsertCard = 1 << 1,

  /**
   * Tap a contactless card.
   */
  TapCard = 1 << 2
}

export interface PaymentIntent {
  stripeId: string
  created: number
  status: string
  amount: number
  currency: string
}

export interface StripeTerminalInterface extends Plugin {
  setConnectionToken(
    options: {
      token?: string
    },
    errorMessage?: string
  ): Promise<void>

  initialize(): Promise<void>

  discoverReaders(options: DiscoveryConfiguration): Promise<void>

  abortDiscoverReaders(): Promise<void>

  connectReader(reader: Reader): Promise<{ reader: Reader }>

  getConnectedReader(): Promise<{ reader: Reader }>

  getConnectionStatus(): Promise<{ status: ConnectionStatus }>

  disconnectReader(): Promise<void>

  checkForUpdate(): Promise<{ update: ReaderSoftwareUpdate }>

  installUpdate(): Promise<void>

  abortInstallUpdate(): Promise<void>

  retrievePaymentIntent(options: {
    clientSecret: string
  }): Promise<{ intent: PaymentIntent }>

  collectPaymentMethod(): Promise<{ intent: PaymentIntent }>

  abortCollectPaymentMethod(): Promise<void>

  processPayment(): Promise<{ intent: PaymentIntent }>

  clearCachedCredentials(): Promise<void>
}
