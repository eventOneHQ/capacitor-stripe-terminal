declare module '@capacitor/core' {
  interface PluginRegistry {
    StripeTerminal: StripeTerminalInterface
  }
}

export enum ConnectionStatus {
  /**
   The SDK is not connected to a reader.
   */
  SCPConnectionStatusNotConnected,
  /**
   The SDK is connected to a reader.
   */
  SCPConnectionStatusConnected,
  /**
   The SDK is currently connecting to a reader.
   */
  SCPConnectionStatusConnecting
}

export interface StripeTerminalConfig {
  fetchConnectionToken: () => Promise<string>
}

export interface DiscoveryConfiguration {
  simulated: boolean
}

export interface Reader {
  serialNumber: string
  deviceType?: string
  deviceSoftwareVersion?: string
  batteryLevel?: number
}

export interface StripeTerminalInterface {
  setConnectionToken(options: {
    token?: string
    errorMessage?: string
  }): Promise<void>

  initialize(): Promise<void>
  
  getConnectionStatus(): Promise<ConnectionStatus> 
}
