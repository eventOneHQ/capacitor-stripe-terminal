declare module "@capacitor/core" {
  interface PluginRegistry {
    StripeTerminal: StripeTerminalPlugin;
  }
}

export interface StripeTerminalPlugin {
  echo(options: { value: string }): Promise<{value: string}>;
}
