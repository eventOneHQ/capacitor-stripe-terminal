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
 * @see https://stripe.com/docs/terminal/readers
 */

/**
 * @category Reader
 */
export enum DeviceType {
  /**
   * Chipper 2X
   *
   * @see https://stripe.com/docs/terminal/readers
   */
  Chipper2X
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
  BluetoothProximity
}

export interface StripeTerminalConfig {
  fetchConnectionToken: () => Promise<string>
}

/**
 * @category Reader
 */
export interface DiscoveryConfiguration {
  /**
   * @default true
   */
  simulated?: boolean
  /**
   * @default DiscoveryMethod.BluetoothScan
   */
  discoveryMethod?: DiscoveryMethod
  /**
   * @default DeviceType.Chipper2X
   */
  deviceType?: DeviceType
}

/**
 * @category Reader
 */
export interface Reader {
  /**
   * The reader's serial number.
   */
  serialNumber: string
  /**
   * The reader's device type.
   */
  deviceType?: string
  /**
   * The reader's current device software version, or `null` if this information is unavailable.
   */
  deviceSoftwareVersion?: string
  /**
   * The reader's battery level, represented as a boxed float in the range `[0, 1]`. If the reader does not have a battery, or the battery level is unknown, this value is `null`.
   */
  batteryLevel?: number

  /**
   * True if this is a simulated reader.
   *
   * `DiscoveryConfiguration` objects with `simulated = true` produce simulated Readers.
   */
  simulated: boolean
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
 */
export interface ReaderDisplayMessage {
  text: string
}

/**
 * This represents all of the input methods available to your user when the reader begins waiting for input.
 */
export interface ReaderInputOptions {
  text: string
}

export interface PaymentIntent {
  stripeId: string
  created: number
  status: string
  amount: number
  currency: string
}

export interface StripeTerminalInterface {
  setConnectionToken(options: {
    token?: string
    errorMessage?: string
  }): Promise<void>

  initialize(): Promise<void>

  getConnectionStatus(): Promise<ConnectionStatus>
}
