/**
 * App entry point: mounts React into <div id="root"> (see index.html).
 *
 * NOTE: we intentionally do NOT wrap <App /> in <React.StrictMode>. In
 * development StrictMode mounts every component twice to surface side-effect
 * bugs. That would initialize the Stripe Terminal SDK twice and register every
 * listener twice, which is confusing in an example meant to be read top to
 * bottom. If you adopt StrictMode in your own app, make initialization
 * idempotent (see `initStarted` in TerminalProvider.tsx).
 */
import { SplashScreen } from '@capacitor/splash-screen'
import { createRoot } from 'react-dom/client'

import App from './App'

createRoot(document.getElementById('root')!).render(<App />)

// The native splash screen (capacitor.config.ts sets `launchAutoHide: false`)
// stays up until we hide it, so there is no blank WebView while the app loads.
// Wait two frames so React has painted its first screen. No-op on the web.
requestAnimationFrame(() =>
  requestAnimationFrame(() => void SplashScreen.hide({ fadeOutDuration: 200 })),
)
