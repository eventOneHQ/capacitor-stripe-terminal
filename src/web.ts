import { Subject } from 'rxjs'
import { WebPlugin } from '@capacitor/core'
import {
  StripeTerminalInterface,
  DiscoveryConfiguration,
  Reader,
  ConnectionStatus,
  ReaderSoftwareUpdate,
  PaymentIntent,
  // DeviceType,
  ReaderNetworkStatus
} from './definitions'
import {
  loadStripeTerminal,
  StripeTerminal,
  Terminal,
  DiscoverResult,
  Reader as DiscoverReader,
  ErrorResponse,
  InternetMethodConfiguration,
  ISdkManagedPaymentIntent,
  IPaymentIntent
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

// const deviceTypes: { [type: number]: string } = {
//   [DeviceType.Chipper2X]: 'chipper_2X',
//   [DeviceType.VerifoneP400]: 'verifone_P400'
// }

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
export class StripeTerminalWeb extends WebPlugin
  implements StripeTerminalInterface {
  private STRIPE_API_BASE = 'https://api.stripe.com'
  private instance: Terminal

  private connectedReader: Reader = null
  private simulated: boolean
  private currentClientSecret: string = null
  private currentPaymentIntent: ISdkManagedPaymentIntent = null
  private currentConnectionToken: string = null

  private connectionTokenCompletionSubject = new Subject<TokenResponse>()

  constructor() {
    super({
      name: 'StripeTerminal',
      platforms: ['web']
    })
  }

  async getPermissions(): Promise<{ granted: boolean }> {
    return { granted: true }
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

  private translateReader(sdkReader: DiscoverReader): Reader {
    return {
      stripeId: sdkReader.id,
      deviceType: sdkReader.device_type,
      status: readerStatuses[sdkReader.status],
      serialNumber: sdkReader.serial_number,
      ipAddress: sdkReader.ip_address,
      locationId: sdkReader.location,
      label: sdkReader.label,
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

  async abortDiscoverReaders(): Promise<void> {}

  async connectReader(reader: Reader): Promise<{ reader: Reader }> {
    const readerOpts = {
      id: reader.stripeId,
      object: 'terminal.reader',
      device_type: reader.deviceType,
      ip_address: reader.ipAddress,
      serial_number: reader.serialNumber
    }
    this.connectedReader = reader

    const connectResult = await this.instance.connectReader(readerOpts)

    if ((connectResult as ConnectResult).reader) {
      const result: ConnectResult = connectResult as ConnectResult

      const translatedReader = this.translateReader(result.reader)
      this.connectedReader = translatedReader

      return { reader: translatedReader }
    } else {
      this.connectReader = null
      const error: ErrorResponse = connectResult as ErrorResponse
      throw error.error
    }
  }

  async getConnectedReader(): Promise<{ reader: Reader }> {
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

  async checkForUpdate(): Promise<{ update: ReaderSoftwareUpdate }> {
    // no equivalent
    console.warn(
      'checkForUpdate is only available for BBPOS Chipper 2X readers.'
    )
    return { update: null }
  }

  async installUpdate(): Promise<void> {
    // no equivalent
    console.warn(
      'installUpdate is only available for BBPOS Chipper 2X readers.'
    )
  }

  async abortInstallUpdate(): Promise<void> {
    // no equivalent
    console.warn(
      'abortInstallUpdate is only available for BBPOS Chipper 2X readers.'
    )
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
        status: json.status,
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
      const res: CollectPaymentMethodResult = result as CollectPaymentMethodResult

      this.currentPaymentIntent = res.paymentIntent

      return {
        intent: {
          stripeId: this.currentPaymentIntent.id,
          created: this.currentPaymentIntent.created,
          status: this.currentPaymentIntent.status,
          amount: this.currentPaymentIntent.amount,
          currency: this.currentPaymentIntent.currency
        }
      }
    } else {
      const error: ErrorResponse = result as ErrorResponse
      throw error.error
    }
  }

  async abortCollectPaymentMethod(): Promise<void> {
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
          status: res.paymentIntent.status,
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
}

/**
 * @ignore
 */
const StripeTerminal = new StripeTerminalWeb()

export { StripeTerminal }

import { registerWebPlugin } from '@capacitor/core'
registerWebPlugin(StripeTerminal)
