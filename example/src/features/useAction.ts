/**
 * `useAction`: run an async SDK call and track its state for the UI.
 *
 * Every feature demo on the Tools tab does the same dance: show a spinner
 * while a call is in flight, then show either its result or its error. This
 * hook packages that so each demo can focus on the SDK call itself.
 *
 *   const { run, busy, result, error } = useAction()
 *   <IonButton onClick={() => run(() => sdk.getReaderSettings())}>
 */
import { useCallback, useState } from 'react'

import { errorMessage } from '../lib/errors'

export function useAction<T = unknown>() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<T | undefined>()
  const [error, setError] = useState<string | undefined>()

  const run = useCallback(async (fn: () => Promise<T>) => {
    setBusy(true)
    setError(undefined)
    try {
      setResult(await fn())
    } catch (err) {
      setResult(undefined)
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }, [])

  const reset = useCallback(() => {
    setResult(undefined)
    setError(undefined)
  }, [])

  return { run, reset, busy, result, error }
}
