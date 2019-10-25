declare module '@capacitor/core' {
  interface PluginRegistry {
    StripeTerminal: StripeTerminalInterface
  }
}

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

export enum DeviceType {
  /**
   * Chipper 2X
   *
   * @see https://stripe.com/docs/terminal/readers
   */
  Chipper2X
}

export interface StripeTerminalConfig {
  fetchConnectionToken: () => Promise<string>
}

export interface DiscoveryConfiguration {
  simulated: boolean
}

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

export interface StripeTerminalInterface {
  setConnectionToken(options: {
    token?: string
    errorMessage?: string
  }): Promise<void>

  initialize(): Promise<void>

  getConnectionStatus(): Promise<ConnectionStatus>
}
