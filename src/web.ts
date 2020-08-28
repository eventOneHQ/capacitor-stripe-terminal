import { Subject } from 'rxjs'
import { WebPlugin } from '@capacitor/core'
import {
  StripeTerminalInterface,
  DiscoveryConfiguration,
  Reader,
  ConnectionStatus,
  ReaderSoftwareUpdate,
  PaymentIntent,
  DeviceType,
  ReaderNetworkStatus
} from './definitions'
import {
  loadStripeTerminal,
  StripeTerminal,
  Terminal,
  DiscoverResult,
  ErrorResponse,
  InternetMethodConfiguration
} from '@stripe/terminal-js'

interface TokenResponse {
  token?: string
  errorMessage?: string
}

const deviceTypes: { [type: string]: DeviceType } = {
  chipper_2X: DeviceType.Chipper2X,
  verifone_P400: DeviceType.VerifoneP400
}

const readerStatuses: { [status: string]: ReaderNetworkStatus } = {
  online: ReaderNetworkStatus.Online,
  offline: ReaderNetworkStatus.Offline
}

export class StripeTerminalWeb extends WebPlugin
  implements StripeTerminalInterface {
  private instance: Terminal

  private connectionTokenCompletionSubject = new Subject<TokenResponse>()

  constructor() {
    super({
      name: 'StripeTerminal',
      platforms: ['web']
    })
  }

  async setConnectionToken(
    options: {
      token?: string
    },
    errorMessage?: string
  ): Promise<void> {
    console.log('setConnectionToken', {
      token: options.token,
      errorMessage
    })
    this.connectionTokenCompletionSubject.next({
      token: options.token,
      errorMessage
    })
  }

  async initialize(): Promise<void> {
    console.log('initialize')
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
      }
    })
  }

  async discoverReaders(options: DiscoveryConfiguration): Promise<void> {
    console.log('discoverReaders', options)

    const discoveryConfig: InternetMethodConfiguration = {
      //   method: 'internet',
      //   device_type: deviceTypes[options.deviceType],
      simulated: options.simulated,
      location: options.locationId
    }
    console.log('discoverReaders translated', discoveryConfig)
    const discoverResult = await this.instance.discoverReaders(discoveryConfig)

    console.log('discoverResult', discoverResult)
    if ((discoverResult as DiscoverResult).discoveredReaders) {
      const discover: DiscoverResult = discoverResult as DiscoverResult

      const readers: Reader[] = discover?.discoveredReaders?.map(reader => ({
        stripeId: reader.id,
        deviceType: reader.device_type,
        status: readerStatuses[reader.status],
        serialNumber: reader.serial_number,
        ipAddress: reader.ip_address,
        location: reader.location,
        label: reader.label,
        simulated: true
      }))
      console.log(readers)

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
    console.log('connect', {
      id: reader.stripeId,
      object: 'terminal.reader',
      device_type: reader.deviceType,
      ip_address: reader.ipAddress,
      serial_number: reader.serialNumber
    })
    await this.instance.connectReader({
      id: reader.stripeId,
      object: 'terminal.reader',
      device_type: reader.deviceType,
      ip_address: reader.ipAddress,
      serial_number: reader.serialNumber
    })

    return { reader: reader }
  }

  async getConnectedReader(): Promise<{ reader: Reader }> {
    return { reader: null }
  }

  async getConnectionStatus(): Promise<{ status: ConnectionStatus }> {
    return {
      status: null
    }
  }

  async disconnectReader(): Promise<void> {}

  async checkForUpdate(): Promise<{ update: ReaderSoftwareUpdate }> {
    return { update: null }
  }

  async installUpdate(): Promise<void> {}

  async abortInstallUpdate(): Promise<void> {}

  async retrievePaymentIntent(options: {
    clientSecret: string
  }): Promise<{ intent: PaymentIntent }> {
    return { intent: null }
  }

  async collectPaymentMethod(): Promise<{ intent: PaymentIntent }> {
    return { intent: null }
  }

  async abortCollectPaymentMethod(): Promise<void> {}

  async processPayment(): Promise<{ intent: PaymentIntent }> {
    return { intent: null }
  }

  async clearCachedCredentials(): Promise<void> {}
}

const StripeTerminal = new StripeTerminalWeb()

export { StripeTerminal }

import { registerWebPlugin } from '@capacitor/core'
registerWebPlugin(StripeTerminal)
