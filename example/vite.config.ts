import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * Vite configuration.
 *
 * Vite is the dev server + bundler. `npm run dev` serves the app in a browser
 * (handy for UI work, and the plugin's web implementation can talk to
 * *simulated* internet readers there). `npm run build` writes the production
 * bundle to `dist/`, which is what Capacitor copies into the native iOS and
 * Android projects (see `webDir` in capacitor.config.ts).
 */
export default defineConfig({
  plugins: [react()],

  resolve: {
    /**
     * IMPORTANT: `capacitor-stripe-terminal` is installed from the parent
     * folder (`"file:.."`), so npm symlinks it. Without `dedupe`, the plugin
     * could end up importing its *own* copy of `@capacitor/core` from the repo
     * root instead of the one this app uses. Two copies of Capacitor core means
     * two plugin registries, and the plugin would silently fail to find the
     * native bridge. Forcing a single copy avoids that.
     *
     * You do NOT need this when installing the plugin from npm.
     */
    dedupe: ['@capacitor/core'],
  },

  server: {
    port: 5173,
  },
})
