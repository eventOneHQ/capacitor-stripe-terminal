import { WebPlugin } from '@capacitor/core'
import {
  DiscoveryConfiguration,
  Reader,
  ConnectionStatus,
  PaymentIntent,
  PaymentIntentStatus,
  PaymentStatus,
  DeviceType,
  ReaderNetworkStatus,
  BatteryStatus,
  LocationStatus,
  ListLocationsParameters,
  Location,
  SimulatedCardType,
  SimulatorConfiguration,
  PermissionStatus,
  Cart,
  CollectConfig,
  ChargeStatus,
  Charge,
} from './definitions'
import {
  loadStripeTerminal,
  Terminal,
  DiscoverResult,
  Reader as DiscoverReader,
  ErrorResponse,
  InternetMethodConfiguration,
  Location as StripeLocation,
  ISdkManagedPaymentIntent,
  IPaymentIntent,
  ISetReaderDisplayRequest,
} from '@stripe/terminal-js'
import { Stripe } from 'stripe'

/**
 * @ignore
 */
interface TokenResponse {
  token?: string
  errorMessage?: string
}

/**
 * @ignore
 */
interface ConnectResult {
  reader: DiscoverReader
}

/**
 * @ignore
 */
interface CollectPaymentMethodResult {
  paymentIntent: ISdkManagedPaymentIntent
}

/**
 * @ignore
 */
interface ConfirmPaymentIntentResult {
  paymentIntent: IPaymentIntent
}

/**
 * @ignore
 */
const deviceTypes: { [type: string]: DeviceType } = {
  ['chipper_2X']: DeviceType.Chipper2X,
  ['bbpos_wisepos_e']: DeviceType.WisePosE,
  ['stripe_s700']: DeviceType.StripeS700,
  ['stripe_s700_devkit']: DeviceType.StripeS700DevKit,
  ['stripe_s710']: DeviceType.StripeS710,
  ['stripe_s710_devkit']: DeviceType.StripeS710DevKit,
}

/**
 * @ignore
 */
const readerStatuses: { [status: string]: ReaderNetworkStatus } = {
  online: ReaderNetworkStatus.Online,
  offline: ReaderNetworkStatus.Offline,
}

/**
 * @ignore
 */
const connectionStatus: { [status: string]: ConnectionStatus } = {
  connecting: ConnectionStatus.Connecting,
  connected: ConnectionStatus.Connected,
  not_connected: ConnectionStatus.NotConnected,
  reconnecting: ConnectionStatus.Reconnecting,
}

/**
 * @ignore
 */
const testPaymentMethodMap: { [method: string]: SimulatedCardType } = {
  visa: SimulatedCardType.Visa,
  visa_debit: SimulatedCardType.VisaDebit,
  mastercard: SimulatedCardType.Mastercard,
  mastercard_debit: SimulatedCardType.MasterDebit,
  mastercard_prepaid: SimulatedCardType.MastercardPrepaid,
  amex: SimulatedCardType.Amex,
  amex2: SimulatedCardType.Amex2,
  discover: SimulatedCardType.Discover,
  discover2: SimulatedCardType.Discover2,
  diners: SimulatedCardType.Diners,
  diners_14digits: SimulatedCardType.Diners14Digit,
  jcb: SimulatedCardType.Jcb,
  unionpay: SimulatedCardType.UnionPay,
  interac: SimulatedCardType.Interac,
  charge_declined: SimulatedCardType.ChargeDeclined,
  charge_declined_insufficient_funds:
    SimulatedCardType.ChargeDeclinedInsufficientFunds,
  charge_declined_lost_card: SimulatedCardType.ChargeDeclinedLostCard,
  charge_declined_stolen_card: SimulatedCardType.ChargeDeclinedStolenCard,
  charge_declined_expired_card: SimulatedCardType.ChargeDeclinedExpiredCard,
  charge_declined_processing_error:
    SimulatedCardType.ChargeDeclinedProcessingError,
  refund_fail: SimulatedCardType.RefundFailed,
}

/**
 * @ignore
 */
const chargeStatus: { [status: string]: ChargeStatus } = {
  succeeded: ChargeStatus.Succeeded,
  pending: ChargeStatus.Pending,
  failed: ChargeStatus.Failed,
}

/**
 * @ignore
 */
function serializeCharge(c: Stripe.Charge): Charge {
  return {
    stripeId: c.id,
    amount: c.amount,
    currency: c.currency,
    status: chargeStatus[c.status] ?? ChargeStatus.Failed,
    metadata: c.metadata ?? {},
    stripeDescription: c.description ?? null,
    statementDescriptorSuffix: c.statement_descriptor_suffix ?? null,
    calculatedStatementDescriptor: c.calculated_statement_descriptor ?? null,
    authorizationCode: (c as any).authorization_code ?? null,
    amountRefunded: c.amount_refunded,
    created: c.created,
    captured: c.captured,
    paid: c.paid,
    refunded: c.refunded,
    customer:
      typeof c.customer === 'string' ? c.customer : (c.customer?.id ?? null),
    paymentIntentId:
      typeof c.payment_intent === 'string'
        ? c.payment_intent
        : (c.payment_intent?.id ?? null),
    receiptEmail: c.receipt_email ?? null,
    receiptNumber: c.receipt_number ?? null,
    receiptUrl: c.receipt_url ?? null,
    livemode: c.livemode,
  }
}

/**
 * @ignore
 */
const paymentIntentStatus: { [status: string]: PaymentIntentStatus } = {
  requires_payment_method: PaymentIntentStatus.RequiresPaymentMethod,
  requires_confirmation: PaymentIntentStatus.RequiresConfirmation,
  requires_capture: PaymentIntentStatus.RequiresCapture,
  processing: PaymentIntentStatus.Processing,
  canceled: PaymentIntentStatus.Canceled,
  succeeded: PaymentIntentStatus.Succeeded,
}

/**
 * @ignore
 */
const paymentStatus: { [status: string]: PaymentStatus } = {
  not_ready: PaymentStatus.NotReady,
  ready: PaymentStatus.Ready,
  waiting_for_input: PaymentStatus.WaitingForInput,
  processing: PaymentStatus.Processing,
}

/**
 * @ignore
 */
export class StripeTerminalWeb extends WebPlugin {
  private STRIPE_API_BASE = 'https://api.stripe.com'
  private instance: Terminal | null = null

  private simulated: boolean = false
  private currentClientSecret: string | null = null
  private currentPaymentIntent: ISdkManagedPaymentIntent | null = null
  private currentConnectionToken: string | null = null

  private connectionTokenCallbacks: Array<(response: TokenResponse) => void> =
    []

  constructor() {
    super()
  }

  private ensureInitialized(): Terminal {
    if (!this.instance) {
      throw new Error(
        'StripeTerminalPlugin must be initialized before you can use any methods.',
      )
    }

    return this.instance
  }

  async getPermissions(): Promise<PermissionStatus> {
    return this.requestPermissions()
  }

  async checkPermissions(): Promise<PermissionStatus> {
    // location permission isn't actually needed for the web version
    throw this.unimplemented('Permissions are not required on web.')
  }

  async requestPermissions(): Promise<PermissionStatus> {
    // location permission isn't actually needed for the web version
    throw this.unimplemented('Permissions are not required on web.')
  }

  async setConnectionToken(
    options: {
      token?: string
    } | null,
    errorMessage?: string,
  ): Promise<void> {
    if (!options?.token) {
      return
    }

    this.currentConnectionToken = options.token
    const callbacks = this.connectionTokenCallbacks.splice(0)
    for (const cb of callbacks) {
      cb({ token: options.token, errorMessage })
    }
  }

  async initialize(): Promise<void> {
    const ST = await loadStripeTerminal()

    if (!ST) {
      throw new Error('Terminal failed to load')
    }

    this.instance = ST.create({
      onFetchConnectionToken: async () => {
        return new Promise((resolve, reject) => {
          this.notifyListeners('requestConnectionToken', null)

          this.connectionTokenCallbacks.push(({ token, errorMessage }) => {
            if (errorMessage || !token) {
              return reject(new Error(errorMessage ?? 'No token found'))
            }

            return resolve(token)
          })
        })
      },
      onUnexpectedReaderDisconnect: async () => {
        this.notifyListeners('didReportUnexpectedReaderDisconnect', {
          reader: null,
        })
      },
      onConnectionStatusChange: async (event) => {
        this.notifyListeners('didChangeConnectionStatus', {
          status: connectionStatus[event.status],
        })
      },
      onPaymentStatusChange: async (event) => {
        this.notifyListeners('didChangePaymentStatus', {
          status: event.status,
        })
      },
    })
  }

  private isInstanceOfLocation(object: any): object is StripeLocation {
    return typeof object === 'object' && 'id' in object
  }

  private translateReader(sdkReader: DiscoverReader): Reader {
    return {
      stripeId: sdkReader.id,
      deviceType: deviceTypes[sdkReader.device_type],
      status: sdkReader.status
        ? readerStatuses[sdkReader.status]
        : ReaderNetworkStatus.Offline,
      serialNumber: sdkReader.serial_number,
      ipAddress: sdkReader.ip_address,
      locationId: this.isInstanceOfLocation(sdkReader.location)
        ? sdkReader.location.id
        : (sdkReader.location ?? null),
      label: sdkReader.label,
      deviceSoftwareVersion: sdkReader.device_sw_version,
      batteryStatus: BatteryStatus.Unknown,
      batteryLevel: null,
      isCharging: null,
      locationStatus: LocationStatus.Unknown,
      livemode: sdkReader.livemode,
      simulated: this.simulated,
    }
  }

  async discoverReaders(options: DiscoveryConfiguration): Promise<void> {
    const sdk = this.ensureInitialized()

    this.simulated = !!options.simulated
    const discoveryConfig: InternetMethodConfiguration = {
      simulated: options.simulated,
      location: options.locationId,
    }

    const discoverResult = await sdk.discoverReaders(discoveryConfig)

    if ((discoverResult as DiscoverResult).discoveredReaders) {
      const discover: DiscoverResult = discoverResult as DiscoverResult

      const readers: Reader[] = discover?.discoveredReaders?.map(
        this.translateReader.bind(this),
      )

      this.notifyListeners('readersDiscovered', {
        readers,
      })
    } else {
      const error: ErrorResponse = discoverResult as ErrorResponse
      throw error.error
    }
  }

  async cancelDiscoverReaders(): Promise<void> {}

  async connectInternetReader(options: {
    serialNumber: string
    ipAddress?: string
    stripeId?: string
    failIfInUse?: boolean
    allowCustomerCancel?: boolean
  }): Promise<{ reader: Reader }> {
    const sdk = this.ensureInitialized()

    if (!options.stripeId) {
      throw new Error('Reader ID missing')
    }

    // use any here since we don't have all the reader details and don't actually need them all
    const readerOpts: any = {
      id: options.stripeId,
      object: 'terminal.reader',
      ip_address: options.ipAddress ?? null,
      serial_number: options.serialNumber,
    }

    const connectResult = await sdk.connectReader(readerOpts, {
      fail_if_in_use: options.failIfInUse,
    })

    if ((connectResult as ConnectResult).reader) {
      const result: ConnectResult = connectResult as ConnectResult

      const translatedReader = this.translateReader(result.reader)

      return { reader: translatedReader }
    } else {
      const error: ErrorResponse = connectResult as ErrorResponse
      throw error.error
    }
  }

  async connectBluetoothReader(_config: {
    serialNumber: string
    locationId: string
  }): Promise<{ reader: Reader | null }> {
    // no equivalent
    console.warn('connectBluetoothReader is only available on iOS and Android.')
    return { reader: null }
  }
  async connectUsbReader(_config: {
    serialNumber: string
    locationId: string
  }): Promise<{ reader: Reader | null }> {
    // no equivalent
    console.warn('connectUsbReader is only available on Android.')
    return { reader: null }
  }
  async connectAppsOnDevicesReader(_config: {
    serialNumber: string
  }): Promise<{ reader: Reader | null }> {
    // no equivalent
    console.warn('connectAppsOnDevicesReader is only available on Android.')
    return { reader: null }
  }
  async connectTapToPayReader(_config: {
    serialNumber: string
    locationId: string
  }): Promise<{ reader: Reader | null }> {
    // no equivalent
    console.warn('connectTapToPayReader is only available on iOS and Android.')
    return { reader: null }
  }
  async getConnectedReader(): Promise<{ reader: Reader | null }> {
    const sdk = this.ensureInitialized()

    const reader = sdk.getConnectedReader()

    if (!reader) {
      return { reader: null }
    }

    const translatedReader = this.translateReader(reader)

    return { reader: translatedReader }
  }

  async getConnectionStatus(): Promise<{ status: ConnectionStatus }> {
    const sdk = this.ensureInitialized()

    const status = sdk.getConnectionStatus()
    return {
      status: connectionStatus[status],
    }
  }

  async getPaymentStatus(): Promise<{ status: PaymentStatus }> {
    const sdk = this.ensureInitialized()

    const status = sdk.getPaymentStatus()

    return {
      status: paymentStatus[status],
    }
  }

  async disconnectReader(): Promise<void> {
    const sdk = this.ensureInitialized()

    await sdk.disconnectReader()
  }

  async installAvailableUpdate(): Promise<void> {
    // no equivalent
    console.warn('installUpdate is only available for Bluetooth readers.')
  }

  async cancelInstallUpdate(): Promise<void> {
    // no equivalent
    console.warn('cancelInstallUpdate is only available for Bluetooth readers.')
  }

  async retrievePaymentIntent(options: {
    clientSecret: string
  }): Promise<{ intent: PaymentIntent | null }> {
    this.currentClientSecret = options.clientSecret

    // make sure fetch is supported
    const isFetchSupported = 'fetch' in window
    if (!isFetchSupported) {
      return {
        intent: null,
      }
    }

    // parse the paymentIntentId out of the clientSecret
    const paymentIntentId = options.clientSecret
      ? options.clientSecret.split('_secret')[0]
      : null

    const stripeUrl = new URL(
      `/v1/payment_intents/${paymentIntentId}`,
      this.STRIPE_API_BASE,
    )
    stripeUrl.searchParams.append('client_secret', options.clientSecret)

    const response = await fetch(stripeUrl.href, {
      headers: {
        Authorization: `Bearer ${this.currentConnectionToken}`,
      },
    })

    const json = await response.json()

    if (!response.ok) {
      throw new Error(json?.error?.message ?? json)
    }

    const paymentIntent = json as Stripe.PaymentIntent

    return {
      intent: {
        stripeId: paymentIntent.id,
        created: paymentIntent.created,
        status: paymentIntentStatus[paymentIntent.status],
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        paymentMethod:
          typeof paymentIntent.payment_method === 'string'
            ? null
            : paymentIntent.payment_method,
        amountDetails: paymentIntent.amount_details,
        charges: (paymentIntent.charges?.data ?? []).map(serializeCharge),
        metadata: paymentIntent.metadata,
      },
    }
  }

  async collectPaymentMethod(
    collectConfig?: CollectConfig,
  ): Promise<{ intent: PaymentIntent }> {
    const sdk = this.ensureInitialized()

    if (!this.currentClientSecret) {
      throw new Error(
        'No `clientSecret` was found. Make sure to run `retrievePaymentIntent` before running this method.',
      )
    }
    const result = await sdk.collectPaymentMethod(this.currentClientSecret, {
      config_override: {
        update_payment_intent: collectConfig?.updatePaymentIntent,
        skip_tipping: collectConfig?.skipTipping,
        tipping: {
          eligible_amount: collectConfig?.tipping?.eligibleAmount,
        },
      },
    })

    if ((result as CollectPaymentMethodResult).paymentIntent) {
      const res: CollectPaymentMethodResult =
        result as CollectPaymentMethodResult

      this.currentPaymentIntent = res.paymentIntent

      return {
        intent: {
          stripeId: this.currentPaymentIntent.id,
          created: this.currentPaymentIntent.created,
          status: paymentIntentStatus[this.currentPaymentIntent.status],
          amount: this.currentPaymentIntent.amount,
          currency: this.currentPaymentIntent.currency,
          paymentMethod: this.currentPaymentIntent
            .payment_method as Stripe.PaymentMethod,
          amountDetails: this.currentPaymentIntent.amount_details,
          charges: (this.currentPaymentIntent.charges?.data ?? []).map(
            serializeCharge,
          ),
          metadata: this.currentPaymentIntent.metadata,
        },
      }
    } else {
      const error: ErrorResponse = result as ErrorResponse
      throw error.error
    }
  }

  async cancelCollectPaymentMethod(): Promise<void> {
    const sdk = this.ensureInitialized()

    await sdk.cancelCollectPaymentMethod()
  }

  async confirmPaymentIntent(): Promise<{ intent: PaymentIntent }> {
    const sdk = this.ensureInitialized()

    if (!this.currentPaymentIntent) {
      throw new Error(
        'No `paymentIntent` was found. Make sure to run `collectPaymentMethod` before running this method.',
      )
    }
    const result = await sdk.processPayment(this.currentPaymentIntent)

    if ((result as ConfirmPaymentIntentResult).paymentIntent) {
      const res: ConfirmPaymentIntentResult =
        result as ConfirmPaymentIntentResult

      return {
        intent: {
          stripeId: res.paymentIntent.id,
          created: res.paymentIntent.created,
          status: paymentIntentStatus[res.paymentIntent.status],
          amount: res.paymentIntent.amount,
          currency: res.paymentIntent.currency,
          paymentMethod: res.paymentIntent
            .payment_method as Stripe.PaymentMethod,
          amountDetails: res.paymentIntent.amount_details,
          charges: (res.paymentIntent.charges?.data ?? []).map(serializeCharge),
          metadata: res.paymentIntent.metadata,
        },
      }
    } else {
      const error: ErrorResponse = result as ErrorResponse
      throw error?.error
    }
  }

  async clearCachedCredentials(): Promise<void> {
    const sdk = this.ensureInitialized()

    await sdk.clearCachedCredentials()
  }

  async setReaderDisplay(cart: Cart): Promise<void> {
    const sdk = this.ensureInitialized()

    const readerDisplay: ISetReaderDisplayRequest = {
      cart: {
        line_items: cart.lineItems.map((li) => ({
          amount: li.amount,
          description: li.displayName,
          quantity: li.quantity,
        })),
        currency: cart.currency,
        tax: cart.tax,
        total: cart.total,
      },
      type: 'cart',
    }

    await sdk.setReaderDisplay(readerDisplay)
  }

  async clearReaderDisplay(): Promise<void> {
    const sdk = this.ensureInitialized()

    await sdk.clearReaderDisplay()
  }

  async listLocations(
    options?: ListLocationsParameters,
  ): Promise<{ locations?: Location[]; hasMore?: boolean }> {
    // make sure fetch is supported
    const isFetchSupported = 'fetch' in window
    if (!isFetchSupported) {
      throw new Error('fetch is not supported by this browser.')
    }

    const stripeUrl = new URL(`/v1/terminal/locations`, this.STRIPE_API_BASE)

    if (options?.limit) {
      stripeUrl.searchParams.append('limit', options.limit.toString())
    }
    if (options?.endingBefore) {
      stripeUrl.searchParams.append('ending_before', options.endingBefore)
    }
    if (options?.startingAfter) {
      stripeUrl.searchParams.append('starting_after', options.startingAfter)
    }

    const response = await fetch(stripeUrl.href, {
      headers: {
        Authorization: `Bearer ${this.currentConnectionToken}`,
      },
    })

    const json = await response.json()

    if (!response.ok) {
      throw new Error(json)
    }

    const locations: Location[] = json.data.map(
      (l: any): Location => ({
        stripeId: l.id,
        displayName: l.display_name,
        livemode: l.livemode,
        address: {
          city: l.address?.city,
          country: l.address?.country,
          line1: l.address?.line1,
          line2: l.address?.line2,
          postalCode: l.address?.postal_code,
          state: l.address?.state,
        },
      }),
    )

    return {
      locations,
      hasMore: json.has_more,
    }
  }

  async getSimulatorConfiguration(): Promise<SimulatorConfiguration> {
    const sdk = this.ensureInitialized()

    const config = sdk.getSimulatorConfiguration()

    return {
      simulatedCard: config.testPaymentMethod
        ? testPaymentMethodMap[config.testPaymentMethod]
        : undefined,
    }
  }

  async setSimulatorConfiguration(
    config: SimulatorConfiguration,
  ): Promise<SimulatorConfiguration> {
    const sdk = this.ensureInitialized()

    let testPaymentMethod: string | null = null

    for (const key in testPaymentMethodMap) {
      if (Object.prototype.hasOwnProperty.call(testPaymentMethodMap, key)) {
        const method = testPaymentMethodMap[key]

        if (method === config.simulatedCard) {
          testPaymentMethod = key
        }
      }
    }

    sdk.setSimulatorConfiguration({
      testPaymentMethod,
    })

    return {
      simulatedCard: config.simulatedCard,
    }
  }

  async cancelAutoReconnect(): Promise<void> {
    // no equivalent
    console.warn('cancelAutoReconnect is only available for Bluetooth readers.')
  }
}
