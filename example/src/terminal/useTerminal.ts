/**
 * `useTerminal()`: how components access the Terminal state and actions.
 *
 *   const { reader, connectionStatus, charge } = useTerminal()
 *
 * It must be used underneath <TerminalProvider> (see App.tsx).
 */
import { useContext } from 'react'

import { TerminalContext, type TerminalContextValue } from './TerminalProvider'

export function useTerminal(): TerminalContextValue {
  const context = useContext(TerminalContext)
  if (!context) {
    // A clear error beats a confusing "cannot read property of null" later.
    throw new Error('useTerminal() must be used inside <TerminalProvider>.')
  }
  return context
}
