declare module '@capacitor/core' {
  interface PluginRegistry {
    StripeTerminal: StripeTerminalInterface
  }
}

export interface StripeTerminalInterface {
  // setTokenProvider(options: { tokenProvider: () => string }): Promise<void>

  setConnectionToken(options: {
    token?: string
    errorMessage?: string
  }): Promise<void>

  initialize(): Promise<void>
}
