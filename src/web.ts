import { WebPlugin } from '@capacitor/core';
import { StripeTerminalPlugin } from './definitions';

export class StripeTerminalWeb extends WebPlugin implements StripeTerminalPlugin {
  constructor() {
    super({
      name: 'StripeTerminal',
      platforms: ['web']
    });
  }

  async echo(options: { value: string }): Promise<{value: string}> {
    console.log('ECHO', options);
    return options;
  }
}

const StripeTerminal = new StripeTerminalWeb();

export { StripeTerminal };

import { registerWebPlugin } from '@capacitor/core';
registerWebPlugin(StripeTerminal);
