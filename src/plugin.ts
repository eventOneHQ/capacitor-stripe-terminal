import { Plugins } from '@capacitor/core'
import { Observable } from 'rxjs'

import {
  StripeTerminalConfig,
  DiscoveryConfiguration,
  Reader,
  ConnectionStatus,
  ReaderSoftwareUpdate,
  ReaderDisplayMessage,
  ReaderInputOptions,
  PaymentIntent
} from './definitions'

import './web'

/**
 * @ignore
 */
const { StripeTerminal } = Plugins

/**
 * The Android connection status enum is different from iOS, this maps Android to iOS
 * @ignore
 */
const AndroidConnectionStatusMap = {
  0: ConnectionStatus.NotConnected,
  1: ConnectionStatus.Connecting,
  2: ConnectionStatus.Connected
}

export class StripeTerminalPlugin {
  public isInitialized = false

  private _fetchConnectionToken: () => Promise<string> = () =>
    Promise.reject('You must initialize StripeTerminalPlugin first.')
  private _onUnexpectedReaderDisconnect: () => void = () =>
    Promise.reject('You must initialize StripeTerminalPlugin first.')

  private isDiscovering = false
  private listeners: any = {}

  /**
   * **_DO NOT USE THIS CONSTRUCTOR DIRECTLY._**
   *
   * Use the [[StripeTerminalPlugin.create]] method instead.
   * @hidden
   * @param options `StripeTerminalPlugin` options.
   */
  constructor(options: StripeTerminalConfig) {
    this._fetchConnectionToken = options.fetchConnectionToken
    this._onUnexpectedReaderDisconnect = options.onUnexpectedReaderDisconnect
  }

  private async init() {
    this.listeners['connectionTokenListener'] = StripeTerminal.addListener(
      'requestConnectionToken',
      () => {
        this._fetchConnectionToken()
          .then(token => {
            if (token) {
              StripeTerminal.setConnectionToken({ token }, null)
            } else {
              throw new Error(
                'User-supplied `fetchConnectionToken` resolved successfully, but no token was returned.'
              )
            }
          })
          .catch(err =>
            StripeTerminal.setConnectionToken(
              null,
              err.message || 'Error in user-supplied `fetchConnectionToken`.'
            )
          )
      }
    )

    this.listeners[
      'unexpectedReaderDisconnectListener'
    ] = StripeTerminal.addListener(
      'didReportUnexpectedReaderDisconnect',
      () => {
        this._onUnexpectedReaderDisconnect()
      }
    )

    await StripeTerminal.initialize()

    this.isInitialized = true
  }

  private translateConnectionStatus(data: {
    status: ConnectionStatus
    isAndroid?: boolean
  }): ConnectionStatus {
    let status: ConnectionStatus = data.status

    if (data.isAndroid) {
      // the connection status on android is different than on iOS so we have to translate it
      status = AndroidConnectionStatusMap[data.status]
    }

    return status
  }

  private _listenerToObservable(
    name: string,
    transformFunc?: (data: any) => any
  ): Observable<any> {
    return new Observable(subscriber => {
      const listener = StripeTerminal.addListener(name, (data: any) => {
        if (transformFunc) {
          return subscriber.next(transformFunc(data))
        }

        return subscriber.next(data)
      })

      return {
        unsubscribe: () => {
          listener.remove()
        }
      }
    })
  }

  private ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error(
        'StripeTerminalPlugin must be initialized before you can use any methods.'
      )
    }
  }

  /**
   * Creates an instance of [[StripeTerminalPlugin]] with the given options.
   *
   * ```typescript
   * const terminal = await StripeTerminalPlugin.create({
   *   fetchConnectionToken: async () => {
   *     const resp = await fetch('https://your-backend.dev/token', {
   *       method: 'POST'
   *     })
   *     const data = await resp.json()
   *
   *     return data.secret
   *   },
   *   onUnexpectedReaderDisconnect: () => {
   *     // handle reader disconnect
   *   }
   * })
   * ```
   *
   * @param options [[StripeTerminalPlugin]] options.
   */
  public static async create(
    options: StripeTerminalConfig
  ): Promise<StripeTerminalPlugin> {
    const terminal = new StripeTerminalPlugin(options)

    await terminal.init()

    return terminal
  }

  public async abortDiscoverReaders(): Promise<void> {
    try {
      this.listeners['readersDiscovered']?.remove()

      if (!this.isDiscovering) {
        return
      }
      await StripeTerminal.abortDiscoverReaders()
      this.isDiscovering = false
    } catch (err) {
      // eat errors
    }
  }

  public discoverReaders(
    options: DiscoveryConfiguration
  ): Observable<Reader[]> {
    this.ensureInitialized()

    return new Observable(subscriber => {
      this.listeners['readersDiscovered'] = StripeTerminal.addListener(
        'readersDiscovered',
        (event: { readers?: Reader[] }) => {
          const readers =
            event?.readers?.map((reader: Reader) => {
              if (reader.batteryLevel === 0) {
                // the only time that the battery level should be 0 is while scanning on Android and the level is unknown, so change it to null for consistency with iOS
                reader.batteryLevel = null
              }
              if (reader.deviceSoftwareVersion === 'unknown') {
                // replace unknown with null to make Android consistent with iOS
                reader.deviceSoftwareVersion = null
              }

              return reader
            }) || []

          subscriber.next(readers)
        }
      )

      // start discovery
      this.isDiscovering = true
      StripeTerminal.discoverReaders(options)
        .then(() => {
          this.isDiscovering = false
          subscriber.complete()
        })
        .catch((err: any) => {
          this.isDiscovering = false
          subscriber.error(err)
        })

      return {
        unsubscribe: () => {
          this.abortDiscoverReaders()
        }
      }
    })
  }

  public async connectReader(reader: Reader): Promise<Reader> {
    this.ensureInitialized()

    const data = await StripeTerminal.connectReader(reader)

    return data.reader
  }

  public async getConnectedReader(): Promise<Reader> {
    this.ensureInitialized()

    const data = await StripeTerminal.getConnectedReader()

    return data.reader
  }

  public async getConnectionStatus(): Promise<ConnectionStatus> {
    this.ensureInitialized()

    const data = await StripeTerminal.getConnectionStatus()

    return this.translateConnectionStatus(data)
  }

  public async disconnectReader(): Promise<void> {
    this.ensureInitialized()

    return StripeTerminal.disconnectReader()
  }

  public async checkForUpdate(): Promise<ReaderSoftwareUpdate> {
    this.ensureInitialized()

    const data = await StripeTerminal.checkForUpdate()

    return data && data.update
  }

  public connectionStatus(): Observable<ConnectionStatus> {
    this.ensureInitialized()

    return new Observable(subscriber => {
      let hasSentEvent = false

      // get current value
      StripeTerminal.getConnectionStatus()
        .then((status: any) => {
          // only send the initial value if the event listener hasn't already
          if (!hasSentEvent) {
            subscriber.next(this.translateConnectionStatus(status))
          }
        })
        .catch((err: any) => {
          subscriber.error(err)
        })

      // then listen for changes
      const listener = StripeTerminal.addListener(
        'didChangeConnectionStatus',
        (status: any) => {
          hasSentEvent = true
          subscriber.next(this.translateConnectionStatus(status))
        }
      )

      return {
        unsubscribe: () => {
          listener.remove()
        }
      }
    })
  }

  public installUpdate(): Observable<number> {
    this.ensureInitialized()

    return new Observable(subscriber => {
      // initiate the installation
      StripeTerminal.installUpdate()
        .then(() => {
          subscriber.complete()
        })
        .catch((err: any) => {
          subscriber.error(err)
        })

      // then listen for progress
      const listener = StripeTerminal.addListener(
        'didReportReaderSoftwareUpdateProgress',
        (data: any) => {
          subscriber.next(data.progress)
        }
      )

      return {
        unsubscribe: () => {
          StripeTerminal.abortInstallUpdate()
          listener.remove()
        }
      }
    })
  }

  public readerInput(): Observable<ReaderInputOptions> {
    return this._listenerToObservable('didRequestReaderInput', (data: any) => {
      if (data.isAndroid) {
        return data.value
      }

      return parseFloat(data.value)
    })
  }

  public readerDisplayMessage(): Observable<ReaderDisplayMessage> {
    return this._listenerToObservable(
      'didRequestReaderDisplayMessage',
      (data: any) => {
        return parseFloat(data.value)
      }
    )
  }

  public async retrievePaymentIntent(
    clientSecret: string
  ): Promise<PaymentIntent> {
    this.ensureInitialized()

    const data = await StripeTerminal.retrievePaymentIntent({ clientSecret })

    return data && data.intent
  }

  public async collectPaymentMethod(): Promise<PaymentIntent> {
    this.ensureInitialized()

    const data = await StripeTerminal.collectPaymentMethod()

    return data && data.intent
  }

  public async abortCollectPaymentMethod(): Promise<void> {
    this.ensureInitialized()

    return StripeTerminal.abortCollectPaymentMethod()
  }

  public async processPayment(): Promise<PaymentIntent> {
    this.ensureInitialized()

    const data = await StripeTerminal.processPayment()

    return data && data.intent
  }

  public async clearCachedCredentials(): Promise<void> {
    this.ensureInitialized()

    return StripeTerminal.clearCachedCredentials()
  }

  public static async getPermissions(): Promise<{ granted: boolean }> {
    return StripeTerminal.getPermissions()
  }

  public addListener(eventName: string, listenerFunc: Function) {
    return StripeTerminal.addListener(eventName, listenerFunc)
  }
}
