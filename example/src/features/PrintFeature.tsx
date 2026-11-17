/**
 * PRINT
 *
 * Readers with a built-in printer (e.g. Stripe S710) can print an image.
 * `print` takes a PNG/JPEG as base64 or a `data:` URI. Here we DRAW a tiny
 * receipt on an offscreen <canvas> and print that, which shows how to turn
 * any content into something printable without a server.
 */
import { IonButton } from '@ionic/react'

import { formatMoney } from '../lib/format'
import { useSettings } from '../lib/settings'
import { unsupportedNote } from '../terminal/capabilities'
import { useTerminal } from '../terminal/useTerminal'
import FeatureCard from './FeatureCard'
import { useAction } from './useAction'

/** Render a simple receipt to a PNG data URI (384px wide, a common printer width). */
function renderReceipt(currency: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = 384
  canvas.height = 260
  const g = canvas.getContext('2d')!
  g.fillStyle = '#fff'
  g.fillRect(0, 0, canvas.width, canvas.height)
  g.fillStyle = '#000'
  g.font = 'bold 28px sans-serif'
  g.fillText('Terminal Example', 24, 50)
  g.font = '20px monospace'
  g.fillText(new Date().toLocaleString(), 24, 85)
  g.fillText('Coffee x2', 24, 135)
  g.fillText(formatMoney(800, currency), 250, 135)
  g.fillText('Croissant', 24, 165)
  g.fillText(formatMoney(700, currency), 250, 165)
  g.font = 'bold 22px monospace'
  g.fillText('TOTAL', 24, 215)
  g.fillText(formatMoney(1500, currency), 250, 215)
  return canvas.toDataURL('image/png')
}

export default function PrintFeature() {
  const { sdk, reader, capabilities } = useTerminal()
  const { currency } = useSettings()
  const action = useAction<string>()

  return (
    <FeatureCard
      title="Print a receipt"
      methods="print"
      description="Draws a sample receipt on a canvas and prints it on the reader's printer."
      platforms="Readers with a printer (S710)"
      unsupported={
        reader && !capabilities.print
          ? unsupportedNote(capabilities)
          : undefined
      }
      busy={action.busy}
      result={action.result}
      error={action.error}
    >
      <IonButton
        size="small"
        disabled={!capabilities.print || action.busy}
        onClick={() =>
          void action.run(async () => {
            await sdk()!.print(renderReceipt(currency))
            return 'Sent to printer'
          })
        }
      >
        Print
      </IonButton>
    </FeatureCard>
  )
}
