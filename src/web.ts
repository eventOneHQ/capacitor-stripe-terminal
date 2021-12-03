import { Subject } from 'rxjs'
import { WebPlugin } from '@capacitor/core'
import {
  StripeTerminalInterface,
  DiscoveryConfiguration,
  Reader,
  ConnectionStatus,
  PaymentIntent,
  PaymentIntentStatus,
  DeviceType,
  ReaderNetworkStatus,
  BatteryStatus,
  LocationStatus,
  ListLocationsParameters,
  Location,
  SimulatedCardType,
  SimulatorConfiguration,
  PermissionStatus,
  Cart
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
  ISetReaderDisplayRequest
} from '@stripe/terminal-js'

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
interface ProcessPaymentResult {
  paymentIntent: IPaymentIntent
}

/**
 * @ignore
 */
const deviceTypes: { [type: string]: DeviceType } = {
  ['chipper_2X']: DeviceType.Chipper2X,
  ['verifone_P400']: DeviceType.VerifoneP400,
  ['bbpos_wisepos_e']: DeviceType.WisePosE
}

/**
 * @ignore
 */
const readerStatuses: { [status: string]: ReaderNetworkStatus } = {
  online: ReaderNetworkStatus.Online,
  offline: ReaderNetworkStatus.Offline
}

/**
 * @ignore
 */
const connectionStatus: { [status: string]: ConnectionStatus } = {
  connecting: ConnectionStatus.Connecting,
  connected: ConnectionStatus.Connected,
  not_connected: ConnectionStatus.NotConnected
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
  refund_fail: SimulatedCardType.RefundFailed
}

/**
 * @ignore
 */
const paymentStatus: { [status: string]: PaymentIntentStatus } = {
  requires_payment_method: PaymentIntentStatus.RequiresPaymentMethod,
  requires_confirmation: PaymentIntentStatus.RequiresConfirmation,
  requires_capture: PaymentIntentStatus.RequiresCapture,
  processing: PaymentIntentStatus.Processing,
  canceled: PaymentIntentStatus.Canceled,
  succeeded: PaymentIntentStatus.Succeeded
}

/**
 * @ignore
 */
export class StripeTerminalWeb
  extends WebPlugin
  implements StripeTerminalInterface
{
  private STRIPE_API_BASE = 'https://api.stripe.com'
  private instance: Terminal

  private connectedReader: Reader = null
  private simulated: boolean
  private currentClientSecret: string = null
  private currentPaymentIntent: ISdkManagedPaymentIntent = null
  private currentConnectionToken: string = null

  private connectionTokenCompletionSubject = new Subject<TokenResponse>()

  constructor() {
    super()
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
    },
    errorMessage?: string
  ): Promise<void> {
    this.currentConnectionToken = options.token
    this.connectionTokenCompletionSubject.next({
      token: options.token,
      errorMessage
    })
  }

  async initialize(): Promise<void> {
    const ST = await loadStripeTerminal()

    this.instance = ST.create({
      onFetchConnectionToken: async () => {
        return new Promise((resolve, reject) => {
          this.notifyListeners('requestConnectionToken', null)

          const sub = this.connectionTokenCompletionSubject.subscribe(
            ({ token, errorMessage }) => {
              if (errorMessage) {
                sub.unsubscribe()
                return reject(new Error(errorMessage))
              }

              sub.unsubscribe()
              return resolve(token)
            }
          )
        })
      },
      onUnexpectedReaderDisconnect: async () => {
        this.notifyListeners('didReportUnexpectedReaderDisconnect', {
          reader: null
        })
        this.connectedReader = null
      },
      onConnectionStatusChange: async event => {
        this.notifyListeners('didChangeConnectionStatus', {
          status: connectionStatus[event.status]
        })
        if (connectionStatus[event.status] === ConnectionStatus.NotConnected) {
          this.connectedReader = null
        }
      },
      onPaymentStatusChange: async event => {
        this.notifyListeners('didChangePaymentStatus', {
          status: event.status
        })
      }
    })
  }

  private isInstanceOfLocation(object: any): object is StripeLocation {
    return typeof object === 'object' && 'id' in object
  }

  private translateReader(sdkReader: DiscoverReader): Reader {
    return {
      stripeId: sdkReader.id,
      deviceType: deviceTypes[sdkReader.device_type],
      status: readerStatuses[sdkReader.status],
      serialNumber: sdkReader.serial_number,
      ipAddress: sdkReader.ip_address,
      locationId: this.isInstanceOfLocation(sdkReader.location)
        ? sdkReader.location.id
        : sdkReader.location,
      label: sdkReader.label,
      deviceSoftwareVersion: sdkReader.device_sw_version,
      batteryStatus: BatteryStatus.Unknown,
      locationStatus: LocationStatus.Unknown,
      livemode: sdkReader.livemode,
      simulated: this.simulated
    }
  }

  async discoverReaders(options: DiscoveryConfiguration): Promise<void> {
    this.simulated = !!options.simulated
    const discoveryConfig: InternetMethodConfiguration = {
      simulated: options.simulated,
      location: options.locationId
    }

    const discoverResult = await this.instance.discoverReaders(discoveryConfig)

    if ((discoverResult as DiscoverResult).discoveredReaders) {
      const discover: DiscoverResult = discoverResult as DiscoverResult

      const readers: Reader[] = discover?.discoveredReaders?.map(
        this.translateReader.bind(this)
      )

      this.notifyListeners('readersDiscovered', {
        readers
      })
    } else {
      const error: ErrorResponse = discoverResult as ErrorResponse
      throw error.error
    }
  }

  async cancelDiscoverReaders(): Promise<void> {}

  async connectInternetReader(reader: Reader): Promise<{ reader: Reader }> {
    const readerOpts: DiscoverReader = {
      id: reader.stripeId,
      object: 'terminal.reader',
      device_type:
        reader.deviceType === DeviceType.WisePosE
          ? 'bbpos_wisepos_e'
          : 'verifone_P400', // device type will always be one of these two and never the chipper2x
      ip_address: reader.ipAddress,
      serial_number: reader.serialNumber,
      device_sw_version: reader.deviceSoftwareVersion,
      label: reader.label,
      livemode: reader.livemode,
      location: reader.locationId,
      metadata: {},
      status:
        reader.status === ReaderNetworkStatus.Offline ? 'offline' : 'online'
    }

    const connectResult = await this.instance.connectReader(readerOpts)

    if ((connectResult as ConnectResult).reader) {
      const result: ConnectResult = connectResult as ConnectResult

      const translatedReader = this.translateReader(result.reader)
      this.connectedReader = translatedReader

      return { reader: translatedReader }
    } else {
      this.connectedReader = null
      const error: ErrorResponse = connectResult as ErrorResponse
      throw error.error
    }
  }

  async connectBluetoothReader(_config: {
    serialNumber: string
    locationId: string
  }): Promise<{ reader: Reader }> {
    // no equivalent
    console.warn(
      'connectBluetoothReader is only available for on iOS and Android.'
    )
    return { reader: null }
  }

  async getConnectedReader(): Promise<{ reader: Reader }> {
    const reader = this.instance.getConnectedReader()

    this.connectedReader = this.translateReader(reader)

    return { reader: this.connectedReader }
  }

  async getConnectionStatus(): Promise<{ status: ConnectionStatus }> {
    const status = this.instance.getConnectionStatus()
    return {
      status: connectionStatus[status]
    }
  }

  async disconnectReader(): Promise<void> {
    await this.instance.disconnectReader()
    this.connectedReader = null
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
  }): Promise<{ intent: PaymentIntent }> {
    this.currentClientSecret = options.clientSecret

    // make sure fetch is supported
    const isFetchSupported = 'fetch' in window
    if (!isFetchSupported) {
      return {
        intent: null
      }
    }

    // parse the paymentIntentId out of the clientSecret
    const paymentIntentId = options.clientSecret
      ? options.clientSecret.split('_secret')[0]
      : null

    const stripeUrl = new URL(
      `/v1/payment_intents/${paymentIntentId}`,
      this.STRIPE_API_BASE
    )
    stripeUrl.searchParams.append('client_secret', options.clientSecret)

    const response = await fetch(stripeUrl.href, {
      headers: {
        Authorization: `Bearer ${this.currentConnectionToken}`
      }
    })

    const json = await response.json()

    if (!response.ok) {
      throw new Error(json)
    }

    return {
      intent: {
        stripeId: json.id,
        created: json.created,
        status: paymentStatus[json.status],
        amount: json.amount,
        currency: json.currency
      }
    }
  }

  async collectPaymentMethod(): Promise<{ intent: PaymentIntent }> {
    const result = await this.instance.collectPaymentMethod(
      this.currentClientSecret
    )

    if ((result as CollectPaymentMethodResult).paymentIntent) {
      const res: CollectPaymentMethodResult =
        result as CollectPaymentMethodResult

      this.currentPaymentIntent = res.paymentIntent

      return {
        intent: {
          stripeId: this.currentPaymentIntent.id,
          created: this.currentPaymentIntent.created,
          status: paymentStatus[this.currentPaymentIntent.status],
          amount: this.currentPaymentIntent.amount,
          currency: this.currentPaymentIntent.currency
        }
      }
    } else {
      const error: ErrorResponse = result as ErrorResponse
      throw error.error
    }
  }

  async cancelCollectPaymentMethod(): Promise<void> {
    await this.instance.cancelCollectPaymentMethod()
  }

  async processPayment(): Promise<{ intent: PaymentIntent }> {
    const result = await this.instance.processPayment(this.currentPaymentIntent)

    if ((result as ProcessPaymentResult).paymentIntent) {
      const res: ProcessPaymentResult = result as ProcessPaymentResult

      return {
        intent: {
          stripeId: res.paymentIntent.id,
          created: res.paymentIntent.created,
          status: paymentStatus[res.paymentIntent.status],
          amount: res.paymentIntent.amount,
          currency: res.paymentIntent.currency
        }
      }
    } else {
      const error: ErrorResponse = result as ErrorResponse
      throw error?.error
    }
  }

  async clearCachedCredentials(): Promise<void> {
    await this.instance.clearCachedCredentials()
  }

  async setReaderDisplay(cart: Cart): Promise<void> {
    const readerDisplay: ISetReaderDisplayRequest = {
      cart: {
        line_items: cart.lineItems.map(li => ({
          amount: li.amount,
          description: li.displayName,
          quantity: li.quantity
        })),
        currency: cart.currency,
        tax: cart.tax,
        total: cart.total
      },
      type: 'cart'
    }

    await this.instance.setReaderDisplay(readerDisplay)
  }

  async clearReaderDisplay(): Promise<void> {
    await this.instance.clearReaderDisplay()
  }

  async listLocations(
    options?: ListLocationsParameters
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
        Authorization: `Bearer ${this.currentConnectionToken}`
      }
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
          state: l.address?.state
        }
      })
    )

    return {
      locations,
      hasMore: json.has_more
    }
  }

  async getSimulatorConfiguration(): Promise<SimulatorConfiguration> {
    const config = this.instance.getSimulatorConfiguration()

    return {
      simulatedCard: testPaymentMethodMap[config.testPaymentMethod]
    }
  }

  async setSimulatorConfiguration(
    config: SimulatorConfiguration
  ): Promise<SimulatorConfiguration> {
    let testPaymentMethod: string

    for (const key in testPaymentMethodMap) {
      if (Object.prototype.hasOwnProperty.call(testPaymentMethodMap, key)) {
        const method = testPaymentMethodMap[key]

        if (method === config.simulatedCard) {
          testPaymentMethod = key
        }
      }
    }

    this.instance.setSimulatorConfiguration({
      testPaymentMethod
    })

    return {
      simulatedCard: config.simulatedCard
    }
  }
}
