/**
 * TerminalProvider: the heart of the example app.
 *
 * This React context owns the ONE `StripeTerminalPlugin` instance and turns the
 * plugin's imperative, event-driven API into plain React state that screens
 * can render. Pages never talk to the plugin directly; they call the actions
 * exposed here (`discover`, `connect`, `charge`, ...) and read state
 * (`connectionStatus`, `reader`, `payment`, ...).
 *
 * THE BIG PICTURE (a Terminal integration has four phases):
 *
 *   1. INITIALIZE  `StripeTerminalPlugin.create()` once. Give it a function that
 *                  fetches connection tokens from your backend.
 *   2. CONNECT     Discover readers, then connect to one.
 *   3. PAY         Create a PaymentIntent (backend) -> retrieve it -> collect a
 *                  payment method (customer taps/inserts card) -> confirm it.
 *   4. CLEAN UP    Remove listeners; disconnect the reader.
 *
 * Each phase is a clearly marked section below.
 */
import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { Device } from '@capacitor/device'
import {
  StripeTerminalError,
  StripeTerminalPlugin,
  type BatteryLevel,
  type ConnectionStatus,
  type Location,
  type OfflineStatus,
  type PaymentIntent,
  type PaymentOption,
  type QrCodeDisplayData,
  type Reader,
  type ReaderDisplayMessage,
  type ReaderInputOptions,
  type ReaderSoftwareUpdate,
} from 'capacitor-stripe-terminal'
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { getCapabilities, type Capabilities } from './capabilities'
import { errorMessage } from '../lib/errors'
import { getSettings, updateSettings, useSettings } from '../lib/settings'
import {
  capturePaymentIntent,
  createPaymentIntent,
  fetchConnectionToken,
  type OrderDetails,
} from './backend'
import { isNativePlatform } from './readers'

/* -------------------------------------------------------------------------- */
/* Types exposed to the rest of the app                                       */
/* -------------------------------------------------------------------------- */

/** Lifecycle of the SDK itself (not of a reader). */
export type SdkState = 'idle' | 'initializing' | 'ready' | 'error'

/** One line in the Activity tab's event log. */
export interface LogEntry {
  id: number
  time: Date
  level: 'info' | 'warn' | 'error'
  /** Which part of the SDK produced this line, e.g. "reader" or "payment". */
  source: string
  message: string
}

/**
 * Where a payment is in its journey. The UI uses this to show progress and to
 * decide which buttons are enabled.
 *
 *   creating   -> asking our backend to create the PaymentIntent
 *   collecting -> the reader is waiting for the customer's card
 *   confirming -> the card was read; Stripe is authorizing it
 *   capturing  -> (manual-capture intents only) finalizing the charge
 *   succeeded / failed / canceled -> terminal states
 */
export type PaymentStep =
  | 'idle'
  | 'creating'
  | 'collecting'
  | 'confirming'
  | 'capturing'
  | 'succeeded'
  | 'failed'
  | 'canceled'

export interface PaymentState {
  step: PaymentStep
  amount: number
  currency: string
  /** Set when `step` is 'failed'. */
  error?: string
  /** Issuer decline reason when the card was declined, e.g. "insufficient_funds". */
  declineCode?: string
  /** The PaymentIntent id (pi_...), once known. */
  intentId?: string
}

/** A finished payment attempt, kept in memory for the Activity tab. */
export interface PaymentRecord {
  id: string
  time: Date
  amount: number
  currency: string
  status: 'succeeded' | 'failed' | 'canceled'
  detail?: string
  /** The Charge id (ch_...). Needed to refund; only on successful payments. */
  chargeId?: string
  /** e.g. "visa · credit · contactless" (from the charge's card details). */
  cardSummary?: string
  /** Set once the payment was (partly) refunded from this app. */
  refunded?: boolean
  /** True when stored on the device because the network was down. */
  offline?: boolean
}

/**
 * Some readers can accept more than a card (QR wallets, etc). When the SDK
 * asks the app to pick, this describes the question. See `onPaymentMethodSelectionRequired`.
 */
/** Optional per-charge settings (the POS tab uses these). */
export interface ChargeExtras extends OrderDetails {
  /** Override the on-reader tipping setting for this charge. */
  tipping?: boolean
  /** The part of the amount tips are calculated on (default: all of it). */
  tipEligibleAmount?: number
}

/** What `charge()` resolves to when the payment succeeded. */
export interface ChargeResult {
  intentId: string
  chargeId?: string
  /** Final amount charged, INCLUDING any tip added on the reader. */
  total: number
  /** Tip added on the reader, in minor units (0 if none). */
  tip: number
  cardSummary?: string
  offline: boolean
}

export interface PaymentChoice {
  options: PaymentOption[]
  select: (paymentOptionType: string) => Promise<void>
  fail: (message?: string) => Promise<void>
}

/** The SDK wants the app to show a QR code for the customer to scan. */
export interface QrChoice {
  qr: QrCodeDisplayData
  confirmDisplayed: () => Promise<void>
  fail: (message?: string) => Promise<void>
}

export interface RefundState {
  step: 'idle' | 'collecting' | 'succeeded' | 'failed'
  /** The PaymentRecord being refunded. */
  paymentId?: string
  message?: string
}

export interface UpdateState {
  /** An update the reader says is available, or null. */
  available: ReaderSoftwareUpdate | null
  installing: boolean
  /** 0..1 */
  progress: number
  /** Why the last install failed, if it did. Cleared on the next attempt. */
  error?: string
  /** True after an install finished successfully. Cleared on the next one. */
  done?: boolean
}

export interface TerminalContextValue {
  /* ---- SDK ---- */
  sdkState: SdkState
  sdkError?: string
  /** (Re)initialize the SDK. Called automatically on startup. */
  initialize: () => Promise<void>

  /* ---- Reader / connection ---- */
  connectionStatus: ConnectionStatus
  reader: Reader | null
  discoveredReaders: Reader[]
  isDiscovering: boolean
  discoveryError?: string
  /** True once a search has been started (so the UI can say "none found"). */
  discoverySearched: boolean
  /** Serial number of the reader we are connecting to, or null. */
  connectingTo: string | null
  /** Why the last connect attempt failed. Cleared on the next attempt. */
  connectError?: string
  /**
   * Set when a connected reader was lost without us asking (walked out of
   * range, battery died) or auto-reconnect gave up. Cleared on connect.
   */
  connectionLost?: string
  /** The reader reported a low battery. Cleared when it is charged/reconnected. */
  lowBattery: boolean
  /** Dismiss the connect / lost-connection / update error messages. */
  clearReaderAlerts: () => void
  battery: BatteryLevel | null
  /** Terminal Locations available to this Stripe account. */
  locations: Location[]
  loadLocations: () => Promise<void>
  discover: () => Promise<void>
  stopDiscovery: () => Promise<void>
  connect: (reader: Reader) => Promise<void>
  disconnect: () => Promise<void>

  /* ---- What the reader is asking the customer to do ---- */
  /** e.g. 'retryCard' - the text the reader would show on its screen. */
  readerMessage: ReaderDisplayMessage | null
  /** e.g. ['insertCard', 'tapCard'] */
  readerInput: ReaderInputOptions[]

  /**
   * True when the connected reader is driven by the NATIVE iOS/Android SDK
   * (Bluetooth, USB, Tap to Pay, Apps on Devices). Internet readers are driven
   * by the JS SDK instead, which lacks several native-only features (on-device
   * intents, offline payments, reboot, collectData...). The plugin picks the
   * SDK automatically based on which connect method you used.
   */
  nativeReader: boolean

  /**
   * What the connected reader can do (cart display, inputs, tipping, print...).
   * Check these BEFORE calling the matching SDK method: a reader without a
   * screen (Stripe M2, Tap to Pay) rejects display and input calls. See
   * capabilities.ts.
   */
  capabilities: Capabilities

  /** Cancel Bluetooth auto-reconnect (while status is 'reconnecting'). */
  cancelReconnect: () => Promise<void>

  /* ---- Software updates ---- */
  update: UpdateState
  installUpdate: () => Promise<void>
  cancelUpdate: () => Promise<void>

  /* ---- Payments ---- */
  payment: PaymentState
  payments: PaymentRecord[]
  charge: (
    amount: number,
    currency: string,
    extras?: ChargeExtras,
  ) => Promise<ChargeResult | null>
  cancelCharge: () => Promise<void>
  resetPayment: () => void
  /** Non-card payment options / QR codes the SDK is waiting on us for. */
  paymentChoice: PaymentChoice | null
  qrChoice: QrChoice | null
  /** Refund a successful payment (the reader asks for the card again). */
  refund: (record: PaymentRecord, amount?: number) => Promise<void>
  cancelRefund: () => Promise<void>
  refundState: RefundState
  /** Offline payments status (iOS/Android), updated by SDK events. */
  offlineStatus: OfflineStatus | null

  /**
   * Escape hatch for the Tools tab: the raw plugin instance, or null before
   * initialization. Feature demos call SDK methods directly through this.
   */
  sdk: () => StripeTerminalPlugin | null

  /* ---- Diagnostics ---- */
  log: LogEntry[]
  clearLog: () => void
}

export const TerminalContext = createContext<TerminalContextValue | null>(null)

const IDLE_PAYMENT: PaymentState = { step: 'idle', amount: 0, currency: 'usd' }
const MAX_LOG_ENTRIES = 200

/* -------------------------------------------------------------------------- */
/* Provider                                                                   */
/* -------------------------------------------------------------------------- */

export function TerminalProvider({ children }: { children: ReactNode }) {
  const settings = useSettings()

  /* ---- React state ---- */
  const [sdkState, setSdkState] = useState<SdkState>('idle')
  const [sdkError, setSdkError] = useState<string>()
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('notConnected')
  const [reader, setReader] = useState<Reader | null>(null)
  const [discoveredReaders, setDiscoveredReaders] = useState<Reader[]>([])
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [discoveryError, setDiscoveryError] = useState<string>()
  const [discoverySearched, setDiscoverySearched] = useState(false)
  const [connectingTo, setConnectingTo] = useState<string | null>(null)
  const [connectError, setConnectError] = useState<string>()
  const [connectionLost, setConnectionLost] = useState<string>()
  const [lowBattery, setLowBattery] = useState(false)
  const [battery, setBattery] = useState<BatteryLevel | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [readerMessage, setReaderMessage] =
    useState<ReaderDisplayMessage | null>(null)
  const [readerInput, setReaderInput] = useState<ReaderInputOptions[]>([])
  const [update, setUpdate] = useState<UpdateState>({
    available: null,
    installing: false,
    progress: 0,
  })
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice | null>(null)
  const [qrChoice, setQrChoice] = useState<QrChoice | null>(null)
  const [refundState, setRefundState] = useState<RefundState>({ step: 'idle' })
  const [offlineStatus, setOfflineStatus] = useState<OfflineStatus | null>(null)
  const [payment, setPayment] = useState<PaymentState>(IDLE_PAYMENT)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [log, setLog] = useState<LogEntry[]>([])

  /* ---- Refs: values that must survive re-renders but never cause one ----
   *
   * `terminal`: the plugin instance. Created once; it is NOT React state
   *   because nothing should re-render when it is assigned.
   * `handles`: every listener subscription we created, so we can remove them.
   * `discoveryHandle`: the active discovery subscription (see discover()).
   * `lastDiscoveryMethod`: remembered so connect() knows which connect call
   *   to use (USB readers need `connectUsbReader`, for example).
   * `cancelRequested`: set by cancelCharge() so the charge flow can tell a
   *   deliberate cancel apart from a real failure.
   */
  const terminal = useRef<StripeTerminalPlugin | null>(null)
  const handles = useRef<PluginListenerHandle[]>([])
  const discoveryHandle = useRef<PluginListenerHandle | null>(null)
  const capabilitiesRef = useRef<Capabilities>(getCapabilities(null, false))
  const lastDiscoveryMethod = useRef(settings.discoveryMethod)
  const cancelRequested = useRef(false)
  const initStarted = useRef(false)
  const logId = useRef(0)

  /** Append a line to the Activity log (newest first, capped in length). */
  const addLog = useCallback(
    (source: string, message: string, level: LogEntry['level'] = 'info') => {
      const entry: LogEntry = {
        id: ++logId.current,
        time: new Date(),
        level,
        source,
        message,
      }
      setLog((prev) => [entry, ...prev].slice(0, MAX_LOG_ENTRIES))
    },
    [],
  )

  /* ======================================================================== */
  /* PHASE 1: INITIALIZE                                                      */
  /* ======================================================================== */

  /**
   * Register one SDK event listener, remembering the handle for cleanup.
   *
   * Every `terminal.didXxx(callback)` method resolves to a
   * `PluginListenerHandle`; calling `handle.remove()` stops the callbacks.
   * Some events don't exist on every platform/reader, so a failed registration
   * is logged rather than treated as fatal.
   */
  const listen = useCallback(
    async (name: string, register: Promise<PluginListenerHandle>) => {
      try {
        handles.current.push(await register)
      } catch (err) {
        addLog(
          'sdk',
          `Could not listen for ${name}: ${errorMessage(err)}`,
          'warn',
        )
      }
    },
    [addLog],
  )

  /**
   * Subscribe to the SDK events this app cares about. Each one updates React
   * state (or the log), which makes the UI react automatically.
   */
  const registerListeners = useCallback(
    async (t: StripeTerminalPlugin) => {
      // Fires immediately with the current status, then on every change.
      await listen(
        'connectionStatus',
        t.connectionStatus((status) => {
          setConnectionStatus(status)
          setIsDiscovering(status === 'discovering')
          addLog('connection', `Status: ${status}`)
        }),
      )

      // The reader wants the customer to do something (retry the card, remove
      // it, ...). Show this text prominently on the Charge tab.
      await listen(
        'readerDisplayMessage',
        t.didRequestReaderDisplayMessage((message) => {
          setReaderMessage(message)
          addLog('reader', `Display message: ${message}`)
        }),
      )

      // The reader is listening for these input methods (tap, insert, swipe).
      await listen(
        'readerInput',
        t.didRequestReaderInput((options) => {
          setReaderInput(options)
          addLog('reader', `Waiting for: ${options.join(', ')}`)
        }),
      )

      // Fires for EVERY disconnect, including ones we asked for. (Unexpected
      // drops are also reported via `onUnexpectedReaderDisconnect` below.)
      await listen(
        'disconnect',
        t.didDisconnect((reason) => {
          setReader(null)
          setBattery(null)
          setUpdate({ available: null, installing: false, progress: 0 })
          setLowBattery(false)
          addLog('reader', `Disconnected (${reason})`)
        }),
      )

      await listen(
        'battery',
        t.didUpdateBatteryLevel((level) => {
          setBattery(level)
          // A charged reader clears a stale warning.
          if (level.batteryLevel > 0.2) setLowBattery(false)
        }),
      )
      await listen(
        'lowBattery',
        t.didReportLowBatteryWarning(() => {
          setLowBattery(true)
          addLog('reader', 'Low battery warning', 'warn')
        }),
      )
      await listen(
        'readerEvent',
        t.didReportReaderEvent((event) => addLog('reader', `Card ${event}`)),
      )

      // Bluetooth auto-reconnect progress (enabled in connect()).
      await listen(
        'reconnectStart',
        t.didStartReaderReconnect(() =>
          addLog('reader', 'Connection lost. Reconnecting...', 'warn'),
        ),
      )
      await listen(
        'reconnectSuccess',
        t.didSucceedReaderReconnect(() => {
          setConnectionLost(undefined)
          addLog('reader', 'Reconnected')
        }),
      )
      await listen(
        'reconnectFail',
        t.didFailReaderReconnect(() => {
          setReader(null)
          setConnectionLost(
            'Lost the connection to the reader and could not get it back. Search for readers to connect again.',
          )
          addLog('reader', 'Reconnect failed', 'error')
        }),
      )

      // Apple Tap to Pay: the merchant accepted Apple's Terms of Service.
      await listen(
        'termsOfService',
        t.didAcceptTermsOfService(() =>
          addLog('reader', 'Tap to Pay terms of service accepted'),
        ),
      )

      // OFFLINE PAYMENTS (iOS/Android). The SDK stores payments while the
      // network is down, then forwards them when it returns.
      await listen(
        'offlineStatus',
        t.didChangeOfflineStatus((status) => {
          setOfflineStatus(status)
          addLog('offline', `Network: ${status.sdk.networkStatus}`)
        }),
      )
      await listen(
        'forwarded',
        t.didForwardPaymentIntent((intent, error) =>
          addLog(
            'offline',
            error
              ? `Forwarding ${intent.id} failed: ${error}`
              : `Forwarded ${intent.id}`,
            error ? 'error' : 'info',
          ),
        ),
      )
      await listen(
        'forwardError',
        t.didReportForwardingError((error) =>
          addLog('offline', `Forwarding error: ${error}`, 'error'),
        ),
      )

      // Readers that accept more than a card ask the app which option to use.
      // If we did NOT register this, card would be chosen automatically.
      await listen(
        'paymentMethodSelection',
        t.onPaymentMethodSelectionRequired((_intent, options, callbacks) => {
          addLog(
            'payment',
            `Payment options: ${options
              .map((o) => o.paymentMethodType ?? o.type)
              .join(', ')}`,
          )
          const card = options.find((o) => o.type === 'card')
          if (options.length === 1 && card) {
            void callbacks.selectPaymentOption('card')
            return
          }
          setPaymentChoice({
            options,
            select: async (type) => {
              setPaymentChoice(null)
              await callbacks.selectPaymentOption(type)
            },
            fail: async (message) => {
              setPaymentChoice(null)
              await callbacks.failPaymentMethodSelection(message)
            },
          })
        }),
      )

      // QR-code payments: the app renders the code. If we did not register
      // this, QR payments would fail.
      await listen(
        'qrCode',
        t.onQrCodeDisplayRequired((_intent, qr, callbacks) => {
          addLog('payment', 'QR code requested')
          setQrChoice({
            qr,
            confirmDisplayed: async () => {
              await callbacks.confirmQrCodeDisplayed()
            },
            fail: async (message) => {
              setQrChoice(null)
              await callbacks.failQrCodeDisplay(message)
            },
          })
        }),
      )

      // Reader software updates: discovered -> installing -> progress -> done.
      await listen(
        'updateAvailable',
        t.didReportAvailableUpdate((available) => {
          setUpdate((u) => ({ ...u, available }))
          if (available) {
            addLog(
              'update',
              `Update available: ${available.deviceSoftwareVersion} (~${available.estimatedUpdateTimeString})`,
            )
          }
        }),
      )
      await listen(
        'updateStart',
        t.didStartInstallingUpdate(() => {
          setUpdate((u) => ({
            ...u,
            installing: true,
            progress: 0,
            error: undefined,
            done: false,
          }))
          addLog('update', 'Installing update...')
        }),
      )
      await listen(
        'updateProgress',
        t.didReportReaderSoftwareUpdateProgress((progress) =>
          setUpdate((u) => ({ ...u, progress })),
        ),
      )
      await listen(
        'updateFinish',
        t.didFinishInstallingUpdate((result) => {
          if (result?.error) {
            // Keep the update on offer so the user can try again.
            setUpdate((u) => ({
              ...u,
              installing: false,
              progress: 0,
              error: String(result.error),
            }))
            addLog('update', `Update failed: ${result.error}`, 'error')
          } else {
            setUpdate({
              available: null,
              installing: false,
              progress: 1,
              done: true,
            })
            addLog('update', 'Update installed')
          }
        }),
      )
    },
    [addLog, listen],
  )

  /**
   * Create the plugin instance. Call this ONCE per app launch.
   *
   * `StripeTerminalPlugin.create` configures the native SDK (and, on native
   * platforms, the JS SDK too, which is used for internet readers).
   */
  const initialize = useCallback(async () => {
    setSdkState('initializing')
    setSdkError(undefined)
    try {
      // If this is a retry, tear down the previous instance first.
      await terminal.current?.destroy()

      // ANDROID ONLY: the Terminal SDK requires the location permission to
      // already be granted when it initializes (see docs/getting-started/
      // installation.md). iOS asks lazily, at discovery time (see discover()).
      if (Capacitor.getPlatform() === 'android') {
        let status = await StripeTerminalPlugin.checkPermissions()
        if (status.location !== 'granted') {
          status = await StripeTerminalPlugin.requestPermissions()
        }
        if (status.location !== 'granted') {
          throw new Error('Location permission is required on Android.')
        }
      }

      const t = await StripeTerminalPlugin.create({
        /**
         * REQUIRED. The SDK calls this whenever it needs a connection token
         * (at startup, and again when one expires). It must hit your backend,
         * which calls Stripe with your secret key. Return the `secret` string.
         */
        fetchConnectionToken,

        /**
         * REQUIRED. Called when a reader drops WITHOUT us asking (walked out of
         * Bluetooth range, battery died, cable pulled). Not called for
         * `disconnectReader()`. A real app would show a "reader lost" banner
         * and offer to reconnect.
         */
        onUnexpectedReaderDisconnect: (reason) => {
          setReader(null)
          setConnectionLost(
            `The reader disconnected unexpectedly${
              reason ? ` (${reason})` : ''
            }. Check that it is on, charged and in range, then search again.`,
          )
          addLog('reader', `Reader lost unexpectedly (${reason})`, 'error')
        },

        /** Native log verbosity; logs show up in Xcode / Logcat. */
        logLevel: getSettings().logLevel,

        /** Fixes the language of SDK error messages (iOS/Android). */
        locale: getSettings().locale || undefined,
      })

      terminal.current = t
      await registerListeners(t)

      // Apply the simulator preferences chosen on the Settings tab.
      await t.setSimulatorConfiguration({
        simulatedCard: getSettings().simulatedCard,
        availableReaderUpdate: getSettings().simulatedUpdate,
        // Offline simulation is only implemented by the native SDKs.
        ...(isNativePlatform()
          ? { offlineEnabled: getSettings().simulatedOffline }
          : {}),
      })

      setSdkState('ready')
      addLog('sdk', 'Terminal SDK initialized')
    } catch (err) {
      setSdkState('error')
      setSdkError(errorMessage(err))
      addLog('sdk', `Initialization failed: ${errorMessage(err)}`, 'error')
    }
  }, [addLog, registerListeners])

  // Initialize once, on first mount.
  //
  // `initStarted` guards against double-invocation. (We also deliberately do
  // not render <React.StrictMode>, which runs effects twice in development and
  // would create two SDK instances. See main.tsx.)
  useEffect(() => {
    if (initStarted.current) return
    initStarted.current = true
    void initialize()
  }, [initialize])

  // Keep the simulator in sync when the user changes it on the Settings tab.
  // Note: per the plugin docs, `availableReaderUpdate` only takes effect the
  // NEXT time a reader connects.
  useEffect(() => {
    if (sdkState !== 'ready') return
    terminal.current
      ?.setSimulatorConfiguration({
        simulatedCard: settings.simulatedCard,
        availableReaderUpdate: settings.simulatedUpdate,
        // Offline simulation is only implemented by the native SDKs.
        ...(isNativePlatform()
          ? { offlineEnabled: settings.simulatedOffline }
          : {}),
      })
      .catch((err) =>
        addLog('sdk', `Simulator config failed: ${errorMessage(err)}`, 'warn'),
      )
  }, [
    sdkState,
    settings.simulatedCard,
    settings.simulatedUpdate,
    settings.simulatedOffline,
    addLog,
  ])

  /* ======================================================================== */
  /* PHASE 2: DISCOVER + CONNECT                                              */
  /* ======================================================================== */

  /** Fetch the Terminal Locations on the Stripe account (for the picker). */
  const loadLocations = useCallback(async () => {
    if (!terminal.current) return
    try {
      const result = await terminal.current.listLocations({ limit: 100 })
      setLocations(result.locations ?? [])
    } catch (err) {
      addLog('sdk', `Could not load locations: ${errorMessage(err)}`, 'warn')
    }
  }, [addLog])

  const stopDiscovery = useCallback(async () => {
    // Removing the handle cancels discovery.
    await discoveryHandle.current?.remove()
    discoveryHandle.current = null
    setIsDiscovering(false)
  }, [])

  /**
   * Start searching for readers.
   *
   * `discoverReaders` is event-style: the SDK calls your callback with the
   * COMPLETE current list each time it changes (not just new readers). It
   * resolves to a handle; keep it so you can stop discovery later.
   */
  const discover = useCallback(async () => {
    const t = terminal.current
    if (!t) return

    const { simulated, discoveryMethod, locationId } = getSettings()
    setDiscoveryError(undefined)
    setConnectError(undefined)
    setDiscoveredReaders([])
    setDiscoverySearched(true)
    lastDiscoveryMethod.current = discoveryMethod

    try {
      // Bluetooth and Tap to Pay need runtime permissions (location,
      // Bluetooth). Ask up front so the OS prompt appears at a sensible time.
      // ANDROID ONLY: on iOS the plugin rejects these calls ("Permissions are
      // handled automatically on iOS") because the Terminal SDK triggers the
      // system prompts itself during discovery/connect. Also skipped for
      // internet readers and in the browser, which need none.
      if (
        Capacitor.getPlatform() === 'android' &&
        !simulated &&
        discoveryMethod !== 'internet' &&
        discoveryMethod !== 'appsOnDevices'
      ) {
        const permissions = await StripeTerminalPlugin.requestPermissions()
        addLog('sdk', `Permissions: ${JSON.stringify(permissions)}`)
      }

      // Starting a new discovery replaces any previous one.
      await discoveryHandle.current?.remove()

      discoveryHandle.current = await t.discoverReaders(
        {
          simulated,
          discoveryMethod,
          // `locationId` only filters INTERNET readers. Omit when empty.
          locationId: locationId || undefined,
        },
        (readers) => {
          setDiscoveredReaders(readers)
          addLog('discovery', `Found ${readers.length} reader(s)`)
        },
        // The ONLY place discovery failures are reported, so always pass it.
        (error) => {
          setDiscoveryError(errorMessage(error))
          setIsDiscovering(false)
          addLog(
            'discovery',
            `Discovery failed: ${errorMessage(error)}`,
            'error',
          )
        },
      )
      setIsDiscovering(true)
    } catch (err) {
      setDiscoveryError(errorMessage(err))
      setIsDiscovering(false)
      addLog(
        'discovery',
        `Could not start discovery: ${errorMessage(err)}`,
        'error',
      )
    }
  }, [addLog])

  /**
   * Connect to a discovered reader.
   *
   * Each family of reader has its own connect method because they take
   * different options. We pick one based on the discovery method and the
   * reader's device type.
   *
   * Connect WHILE DISCOVERY IS STILL RUNNING; stopping discovery first makes
   * the discovered Reader object stale. We stop it only after connecting.
   */
  const connect = useCallback(
    async (target: Reader) => {
      const t = terminal.current
      if (!t) return

      // Prefer the location chosen in Settings; otherwise use the one the
      // reader already belongs to. Simulated readers come with a mock location
      // (which is why leaving Settings blank works for the simulator).
      const locationId = getSettings().locationId || target.locationId || ''
      if (!locationId && lastDiscoveryMethod.current !== 'appsOnDevices') {
        const message =
          'No location selected. Pick one in the Location menu (Bluetooth readers must be registered to a Stripe location).'
        setConnectError(message)
        addLog('reader', message, 'error')
        return
      }

      addLog(
        'reader',
        `Connecting to ${target.label ?? target.serialNumber}...`,
      )
      setConnectError(undefined)
      setConnectionLost(undefined)
      setConnectingTo(target.serialNumber)
      try {
        let connected: Reader | null
        const style = t.getDeviceStyleFromDeviceType(target.deviceType)

        if (lastDiscoveryMethod.current === 'appsOnDevices') {
          // Android only: the app runs ON a Stripe smart reader (S700 etc.)
          // and talks to its own payment hardware. No location needed.
          connected = await t.connectAppsOnDevicesReader(target, {
            appTransitionAnimation: { type: 'systemDefault' },
          })
        } else if (lastDiscoveryMethod.current === 'usb') {
          connected = await t.connectUsbReader(target, {
            locationId,
            autoReconnectOnUnexpectedDisconnect: true,
          })
        } else if (style === 'local') {
          // Tap to Pay: this phone IS the reader.
          connected = await t.connectTapToPayReader(target, {
            locationId,
            // iOS: allow Apple's Terms of Service screen if not yet accepted.
            tosAcceptancePermitted: true,
          })
        } else if (style === 'bluetooth') {
          connected = await t.connectBluetoothReader(target, {
            locationId,
            // Let the SDK try to reconnect if Bluetooth drops mid-session.
            autoReconnectOnUnexpectedDisconnect: true,
          })
        } else {
          connected = await t.connectInternetReader(target, {
            locationId,
            // Refuse to steal a reader that another device is actively using.
            failIfInUse: true,
          })
        }

        setReader(connected)
        setLowBattery(false)
        addLog(
          'reader',
          `Connected: ${connected?.label ?? connected?.serialNumber}`,
        )
        await stopDiscovery()
      } catch (err) {
        // Shown next to the reader list; the reader stays in the list so the
        // user can simply tap Connect again.
        setConnectError(errorMessage(err))
        addLog('reader', `Connect failed: ${errorMessage(err)}`, 'error')
      } finally {
        setConnectingTo(null)
      }
    },
    [addLog, stopDiscovery],
  )

  const clearReaderAlerts = useCallback(() => {
    setConnectError(undefined)
    setConnectionLost(undefined)
    setDiscoveryError(undefined)
    setUpdate((u) => ({ ...u, error: undefined }))
  }, [])

  const disconnect = useCallback(async () => {
    try {
      await terminal.current?.disconnectReader()
      // The `didDisconnect` listener resets reader state for us.
    } catch (err) {
      addLog('reader', `Disconnect failed: ${errorMessage(err)}`, 'error')
    }
  }, [addLog])

  const installUpdate = useCallback(async () => {
    try {
      setUpdate((u) => ({ ...u, error: undefined }))
      await terminal.current?.installAvailableUpdate()
    } catch (err) {
      setUpdate((u) => ({
        ...u,
        installing: false,
        error: errorMessage(err),
      }))
      addLog('update', `Install failed: ${errorMessage(err)}`, 'error')
    }
  }, [addLog])

  const cancelUpdate = useCallback(async () => {
    try {
      await terminal.current?.cancelInstallUpdate()
    } catch (err) {
      addLog('update', `Cancel failed: ${errorMessage(err)}`, 'error')
    }
  }, [addLog])

  /** Stop an in-progress Bluetooth auto-reconnect. */
  const cancelReconnect = useCallback(async () => {
    try {
      await terminal.current?.cancelAutoReconnect()
    } catch (err) {
      addLog('reader', `Cancel reconnect failed: ${errorMessage(err)}`, 'error')
    }
  }, [addLog])

  /* ---- Auto-connect on Apps on Devices hardware ---- */

  // Some Stripe readers (S700, T600...) are Android computers that RUN this app
  // ("Apps on Devices"). On those, nobody should have to search and tap
  // Connect: the reader is the device itself. We detect it by manufacturer
  // (they report "BBPOS") and discover + connect to the on-device reader as
  // soon as the SDK is ready.
  //   'idle'      -> not checked yet
  //   'searching' -> detected; waiting for discovery to report the reader
  //   'done'      -> finished (connected, failed, or not an on-device reader)
  const autoConnect = useRef<'idle' | 'searching' | 'done'>('idle')

  useEffect(() => {
    if (sdkState !== 'ready' || autoConnect.current !== 'idle') return
    if (Capacitor.getPlatform() !== 'android') {
      autoConnect.current = 'done'
      return
    }
    autoConnect.current = 'searching'
    void (async () => {
      try {
        const info = await Device.getInfo()
        if (info.manufacturer?.toLowerCase() !== 'bbpos') {
          autoConnect.current = 'done'
          return
        }
        addLog('reader', 'Apps on Devices hardware found. Connecting...')
        // Persist the choice so the Reader tab reflects what we're doing.
        updateSettings({ discoveryMethod: 'appsOnDevices', simulated: false })
        await discover()
      } catch (err) {
        autoConnect.current = 'done'
        addLog('reader', `Auto-connect failed: ${errorMessage(err)}`, 'error')
      }
    })()
  }, [sdkState, discover, addLog])

  // When discovery reports the on-device reader, connect to it (once).
  useEffect(() => {
    if (autoConnect.current !== 'searching') return
    if (discoveryError) {
      autoConnect.current = 'done' // shown on the Reader tab; user can retry
      return
    }
    if (discoveredReaders.length === 0) return
    if (connectionStatus === 'connecting' || connectionStatus === 'connected') {
      return
    }
    autoConnect.current = 'done'
    void connect(discoveredReaders[0])
  }, [discoveredReaders, discoveryError, connectionStatus, connect])

  /* ======================================================================== */
  /* PHASE 3: TAKE A PAYMENT                                                  */
  /* ======================================================================== */

  /** Add a finished attempt to the history shown on the Activity tab. */
  const record = useCallback(
    (
      id: string,
      amount: number,
      currency: string,
      status: PaymentRecord['status'],
      extra: Partial<PaymentRecord> = {},
    ) => {
      setPayments((prev) => [
        { id, time: new Date(), amount, currency, status, ...extra },
        ...prev,
      ])
    },
    [],
  )

  /**
   * Charge `amount` (minor units) on the connected reader.
   *
   *   create the intent -> EITHER on our backend (default; returns a client
   *                        secret) OR on the device via the SDK
   *                        (`createPaymentIntent`, iOS/Android, needed for
   *                        offline payments)
   *   SDK:    retrievePaymentIntent -> (backend intents only) loads it
   *   SDK:    collectPaymentMethod  -> customer taps/inserts/swipes (waits
   *                                    until they do, or it's canceled)
   *   SDK:    confirmPaymentIntent  -> authorizes with the card network. THIS
   *                                    is where declines are thrown.
   *   server: capture               -> only for manual-capture intents
   *
   * Behavior is tuned by the "Payment options" on the Charge tab (settings).
   */
  const charge = useCallback(
    async (
      amount: number,
      currency: string,
      extras: ChargeExtras = {},
    ): Promise<ChargeResult | null> => {
      const t = terminal.current
      if (!t) return null
      const { tipping, tipEligibleAmount, ...order } = extras

      const opts = getSettings()
      cancelRequested.current = false
      setReaderMessage(null)
      setReaderInput([])
      let intentId: string | undefined

      try {
        // 1. Create the PaymentIntent.
        setPayment({ step: 'creating', amount, currency })
        if (opts.createOnDevice) {
          // On-device creation: no backend round trip, so it also works
          // offline. The SDK keeps this intent as the "active" one.
          const created = await t.createPaymentIntent({
            amount,
            currency,
            captureMethod: opts.captureMethod,
            offlineBehavior: opts.offlineBehavior,
            ...order,
          })
          intentId = created?.id
          addLog('payment', `Created on device ${intentId}`)
        } else {
          // Backend creation (recommended): the amount is trusted. Then hand
          // the intent to the SDK; this must happen before collecting.
          const created = await createPaymentIntent(
            amount,
            currency,
            opts.captureMethod,
            order,
          )
          intentId = created.id
          addLog('payment', `Created ${created.id}`)
          await t.retrievePaymentIntent(created.clientSecret)
        }

        // 2. Wait for the customer to present a card. On a simulated reader
        //    this resolves almost immediately using the configured test card.
        setPayment({ step: 'collecting', amount, currency, intentId })
        // Tipping screens only exist on readers with a screen. Other readers
        // (Stripe M2, Tap to Pay) are not asked about tipping at all.
        const canTip = capabilitiesRef.current.onReaderTipping
        const wantsTip = tipping ?? opts.onReaderTipping
        await t.collectPaymentMethod({
          // Hide the tipping screen unless on-reader tipping was requested.
          skipTipping: canTip
            ? tipping === undefined
              ? opts.skipTipping && !opts.onReaderTipping
              : !tipping
            : undefined,
          // Tip choices are calculated as a percentage of `eligibleAmount`.
          tipping:
            canTip && wantsTip
              ? { eligibleAmount: tipEligibleAmount ?? amount }
              : undefined,
          // Consent to show this card to the customer again later.
          allowRedisplay: opts.allowRedisplay,
          // Whether the customer can cancel on the reader. NOTE: the JS SDK
          // (internet readers) does not support 'disableIfAvailable'.
          customerCancellation: opts.customerCancellation,
        })

        // 3. Authorize. Declines throw a StripeTerminalError here.
        setPayment({ step: 'confirming', amount, currency, intentId })
        const confirmed: PaymentIntent | null = await t.confirmPaymentIntent()

        // 4. Auto-capture intents are already 'succeeded'. Manual-capture
        //    intents are only authorized: capture now via the backend.
        if (confirmed?.status === 'requiresCapture') {
          setPayment({ step: 'capturing', amount, currency, intentId })
          await capturePaymentIntent(confirmed.id)
        }

        // Pull display details from the charge the SDK reports back.
        const charge = confirmed?.charges?.[0]
        const card =
          charge?.paymentMethodDetails?.cardPresentDetails ??
          charge?.paymentMethodDetails?.interacPresentDetails
        const cardSummary = card
          ? [card.brand, card.funding, card.readMethod]
              .filter(Boolean)
              .join(' · ')
          : undefined
        // `offlineDetails.requiresUpload` means it was stored on the device
        // and will be forwarded to Stripe once the network returns.
        const offline = !!confirmed?.offlineDetails?.requiresUpload

        // A tip added on the reader is included in the confirmed amount.
        const total = confirmed?.amount ?? amount
        const tip = confirmed?.amountTip ?? 0

        setPayment({ step: 'succeeded', amount: total, currency, intentId })
        record(confirmed?.id ?? intentId ?? '-', total, currency, 'succeeded', {
          chargeId: charge?.id,
          cardSummary,
          offline,
        })
        addLog(
          'payment',
          offline
            ? `Payment ${intentId} stored offline`
            : `Payment ${intentId} succeeded`,
        )
        return {
          intentId: confirmed?.id ?? intentId ?? '-',
          chargeId: charge?.id,
          total,
          tip,
          cardSummary,
          offline,
        }
      } catch (err) {
        if (cancelRequested.current) {
          // The user pressed Cancel; not an error.
          setPayment({ step: 'canceled', amount, currency, intentId })
          record(intentId ?? '-', amount, currency, 'canceled')
          addLog('payment', 'Payment canceled', 'warn')
        } else {
          // `StripeTerminalError` adds `decline_code` for card declines.
          const declineCode =
            err instanceof StripeTerminalError ? err.decline_code : undefined
          const message = errorMessage(err)
          setPayment({
            step: 'failed',
            amount,
            currency,
            intentId,
            error: message,
            declineCode,
          })
          record(intentId ?? '-', amount, currency, 'failed', {
            detail: declineCode ?? message,
          })
          addLog(
            'payment',
            `Payment failed: ${message}${
              declineCode ? ` (${declineCode})` : ''
            }`,
            'error',
          )
        }

        // Release the SDK's active intent so the next attempt starts clean.
        // (Ignore errors: there may be nothing to cancel.)
        await t.cancelPaymentIntent().catch(() => undefined)
        return null
      } finally {
        setReaderMessage(null)
        setReaderInput([])
        setPaymentChoice(null)
        setQrChoice(null)
      }
    },
    [addLog, record],
  )

  /**
   * Cancel an in-progress charge. Only possible while collecting; once the
   * card is read and confirmation begins, it can't be stopped.
   */
  const cancelCharge = useCallback(async () => {
    cancelRequested.current = true
    try {
      // This makes the pending `collectPaymentMethod()` call reject, which the
      // `charge()` catch block above treats as a cancel (not a failure).
      await terminal.current?.cancelCollectPaymentMethod()
    } catch (err) {
      addLog('payment', `Cancel failed: ${errorMessage(err)}`, 'warn')
    }
  }, [addLog])

  /**
   * REFUND a successful payment. Since Terminal SDK 6.0 this is ONE call:
   * `processRefund` makes the reader ask for the original card again (the
   * refund is returned to that card), then submits it.
   * Refunding by `chargeId` works on every platform; by `paymentIntentId`
   * (iOS/Android only) needs the intent's client secret too.
   */
  const refund = useCallback(
    async (target: PaymentRecord, amount?: number) => {
      const t = terminal.current
      if (!t || !target.chargeId) return
      setRefundState({ step: 'collecting', paymentId: target.id })
      addLog('refund', `Refunding ${target.chargeId}...`)
      try {
        const result = await t.processRefund({
          chargeId: target.chargeId,
          // GOTCHA: the SIMULATED reader only accepts refunds of exactly 100
          // minor units (e.g. $1.00). Real readers refund any amount up to
          // what was charged.
          amount: amount ?? (reader?.simulated ? 100 : target.amount),
          currency: target.currency,
        })
        // The refund object's status can be 'succeeded', 'pending', 'failed'.
        const status = result?.status ?? 'unknown'
        if (status === 'failed') {
          throw new Error(result?.failureReason ?? 'Refund failed')
        }
        setPayments((prev) =>
          prev.map((p) => (p.id === target.id ? { ...p, refunded: true } : p)),
        )
        setRefundState({
          step: 'succeeded',
          paymentId: target.id,
          message: `Refund ${result?.id ?? ''} ${status}`,
        })
        addLog('refund', `Refund ${result?.id} ${status}`)
      } catch (err) {
        setRefundState({
          step: 'failed',
          paymentId: target.id,
          message: errorMessage(err),
        })
        addLog('refund', `Refund failed: ${errorMessage(err)}`, 'error')
      } finally {
        setReaderMessage(null)
        setReaderInput([])
      }
    },
    [addLog, reader],
  )

  const cancelRefund = useCallback(async () => {
    try {
      await terminal.current?.cancelProcessRefund()
    } catch (err) {
      addLog('refund', `Cancel failed: ${errorMessage(err)}`, 'warn')
    }
  }, [addLog])

  const resetPayment = useCallback(() => {
    setPayment(IDLE_PAYMENT)
    setRefundState({ step: 'idle' })
  }, [])

  /* ======================================================================== */
  /* PHASE 4: CLEAN UP                                                        */
  /* ======================================================================== */

  // The provider lives as long as the app, but if it ever unmounts (hot reload,
  // tests) remove our listeners and free the SDK.
  useEffect(() => {
    const listenerHandles = handles
    const discovery = discoveryHandle
    const sdk = terminal
    const started = initStarted
    return () => {
      listenerHandles.current.forEach((h) => void h.remove())
      listenerHandles.current = []
      void discovery.current?.remove()
      void sdk.current?.destroy()
      // Reset so a remount (e.g. Vite hot reload) initializes a fresh SDK
      // instead of reusing the destroyed one.
      sdk.current = null
      started.current = false
    }
  }, [])

  /* ---- Assemble the context value ---- */

  // `getDeviceStyleFromDeviceType` classifies a model as 'internet' (JS SDK),
  // 'bluetooth' or 'local' (both native SDK).
  const nativeReader =
    isNativePlatform() &&
    !!reader &&
    (StripeTerminalPlugin.getDeviceStyleFromDeviceType(reader.deviceType) !==
      'internet' ||
      // An Apps on Devices reader is an 'internet' MODEL but is driven by the
      // native SDK because the app runs on it.
      lastDiscoveryMethod.current === 'appsOnDevices')

  const capabilities = useMemo(
    () =>
      getCapabilities(
        reader,
        nativeReader,
        lastDiscoveryMethod.current === 'appsOnDevices',
      ),
    [reader, nativeReader],
  )
  // charge() is created once; the ref lets it see the current reader's abilities.
  capabilitiesRef.current = capabilities

  const value = useMemo<TerminalContextValue>(
    () => ({
      sdkState,
      sdkError,
      initialize,
      connectionStatus,
      reader,
      discoveredReaders,
      isDiscovering,
      discoveryError,
      discoverySearched,
      connectingTo,
      connectError,
      connectionLost,
      lowBattery,
      clearReaderAlerts,
      battery,
      locations,
      loadLocations,
      discover,
      stopDiscovery,
      connect,
      disconnect,
      readerMessage,
      readerInput,
      nativeReader,
      capabilities,
      cancelReconnect,
      update,
      installUpdate,
      cancelUpdate,
      paymentChoice,
      qrChoice,
      refund,
      cancelRefund,
      refundState,
      offlineStatus,
      sdk: () => terminal.current,
      payment,
      payments,
      charge,
      cancelCharge,
      resetPayment,
      log,
      clearLog: () => setLog([]),
    }),
    [
      sdkState,
      sdkError,
      initialize,
      connectionStatus,
      reader,
      discoveredReaders,
      isDiscovering,
      discoveryError,
      discoverySearched,
      connectingTo,
      connectError,
      connectionLost,
      lowBattery,
      clearReaderAlerts,
      battery,
      locations,
      loadLocations,
      discover,
      stopDiscovery,
      connect,
      disconnect,
      readerMessage,
      readerInput,
      nativeReader,
      capabilities,
      cancelReconnect,
      update,
      installUpdate,
      cancelUpdate,
      paymentChoice,
      qrChoice,
      refund,
      cancelRefund,
      refundState,
      offlineStatus,
      payment,
      payments,
      charge,
      cancelCharge,
      resetPayment,
      log,
    ],
  )

  return (
    <TerminalContext.Provider value={value}>
      {children}
    </TerminalContext.Provider>
  )
}
