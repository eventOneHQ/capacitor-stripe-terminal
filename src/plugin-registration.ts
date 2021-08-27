import { registerPlugin } from '@capacitor/core'

import type { StripeTerminalInterface } from './definitions'

/**
 * This should NOT be used directly.
 * @ignore
 */
export const StripeTerminal = registerPlugin<StripeTerminalInterface>(
  'StripeTerminal',
  {
    web: () => import('./web').then(m => new m.StripeTerminalWeb())
  }
)
