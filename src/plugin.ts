import { PluginListenerHandle } from '@capacitor/core'
import { Observable } from 'rxjs'

import {
  StripeTerminalConfig,
  DiscoveryConfiguration,
  InternetConnectionConfiguration,
  BluetoothConnectionConfiguration,
  Reader,
  ConnectionStatus,
  ReaderDisplayMessage,
  ReaderInputOptions,
  PaymentIntent,
  Cart,
  ListLocationsParameters,
  SimulatedCardType,
  SimulatorConfiguration,
  DeviceType,
  DeviceStyle,
  PermissionStatus,
  ReaderSoftwareUpdate
} from './definitions'

import { StripeTerminal } from './plugin-registration'

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
  private listeners: { [key: string]: PluginListenerHandle } = {}

  private simulatedCardType: SimulatedCardType

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
    this.listeners['connectionTokenListener'] =
      await StripeTerminal.addListener('requestConnectionToken', () => {
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
      })

    this.listeners['unexpectedReaderDisconnectListener'] =
      await StripeTerminal.addListener(
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
    name:
      | 'didRequestReaderDisplayMessage'
      | 'didRequestReaderInput'
      | 'didReportAvailableUpdate'
      | 'didStartInstallingUpdate'
      | 'didReportReaderSoftwareUpdateProgress'
      | 'didFinishInstallingUpdate',
    transformFunc?: (data: any) => any
  ): Observable<any> {
    return new Observable(subscriber => {
      let listener: PluginListenerHandle

      StripeTerminal.addListener(name, (data: any) => {
        if (transformFunc) {
          return subscriber.next(transformFunc(data))
        }

        return subscriber.next(data)
      }).then(l => {
        listener = l
      })

      return {
        unsubscribe: () => {
          listener?.remove()
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
   * Ensure that an object exists and is not empty
   * @param object Object to check
   * @returns
   */
  private objectExists<T>(object: T): T {
    if (Object.keys(object ?? {}).length) {
      return object
    }

    return null
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

  public async cancelDiscoverReaders(): Promise<void> {
    try {
      this.listeners['readersDiscovered']?.remove()

      if (!this.isDiscovering) {
        return
      }
      await StripeTerminal.cancelDiscoverReaders()
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
      StripeTerminal.addListener(
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
      ).then(l => {
        this.listeners['readersDiscovered'] = l
      })

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
          this.cancelDiscoverReaders()
        }
      }
    })
  }

  public async connectBluetoothReader(
    reader: Reader,
    config: BluetoothConnectionConfiguration
  ): Promise<Reader> {
    this.ensureInitialized()

    const data = await StripeTerminal.connectBluetoothReader({
      serialNumber: reader.serialNumber,
      locationId: config.locationId
    })

    return this.objectExists(data?.reader)
  }

  public async connectInternetReader(
    reader: Reader,
    config?: InternetConnectionConfiguration
  ): Promise<Reader> {
    this.ensureInitialized()

    const data = await StripeTerminal.connectInternetReader({
      serialNumber: reader.serialNumber,
      ipAddress: reader.ipAddress,
      stripeId: reader.stripeId,
      ...config
    })

    return this.objectExists(data?.reader)
  }

  /**
   * This is only here for backwards compatibility
   * @param reader
   * @returns Reader
   *
   * @deprecated
   */
  public async connectReader(reader: Reader) {
    return await this.connectInternetReader(reader)
  }

  public async getConnectedReader(): Promise<Reader> {
    this.ensureInitialized()

    const data = await StripeTerminal.getConnectedReader()

    return this.objectExists(data?.reader)
  }

  public async getConnectionStatus(): Promise<ConnectionStatus> {
    this.ensureInitialized()

    const data = await StripeTerminal.getConnectionStatus()

    return this.translateConnectionStatus(data)
  }

  public async disconnectReader(): Promise<void> {
    this.ensureInitialized()

    return await StripeTerminal.disconnectReader()
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

      let listener: PluginListenerHandle

      // then listen for changes
      StripeTerminal.addListener('didChangeConnectionStatus', (status: any) => {
        hasSentEvent = true
        subscriber.next(this.translateConnectionStatus(status))
      }).then(l => {
        listener = l
      })

      return {
        unsubscribe: () => {
          listener?.remove()
        }
      }
    })
  }

  public async installAvailableUpdate(): Promise<void> {
    this.ensureInitialized()

    return await StripeTerminal.installAvailableUpdate()
  }

  public async cancelInstallUpdate(): Promise<void> {
    this.ensureInitialized()

    return await StripeTerminal.cancelInstallUpdate()
  }

  public didRequestReaderInput(): Observable<ReaderInputOptions> {
    return this._listenerToObservable('didRequestReaderInput', (data: any) => {
      if (data.isAndroid) {
        return data.value
      }

      return parseFloat(data.value)
    })
  }

  public didRequestReaderDisplayMessage(): Observable<ReaderDisplayMessage> {
    return this._listenerToObservable(
      'didRequestReaderDisplayMessage',
      (data: any) => {
        return parseFloat(data.value)
      }
    )
  }

  public didReportAvailableUpdate(): Observable<ReaderSoftwareUpdate> {
    return this._listenerToObservable(
      'didReportAvailableUpdate',
      (data: { update: ReaderSoftwareUpdate }) => {
        return this.objectExists(data?.update)
      }
    )
  }

  public didStartInstallingUpdate(): Observable<ReaderSoftwareUpdate> {
    return this._listenerToObservable(
      'didStartInstallingUpdate',
      (data: { update: ReaderSoftwareUpdate }) => {
        return this.objectExists(data?.update)
      }
    )
  }

  public didReportReaderSoftwareUpdateProgress(): Observable<number> {
    return this._listenerToObservable(
      'didReportReaderSoftwareUpdateProgress',
      (data: any) => {
        return parseFloat(data.progress)
      }
    )
  }

  public didFinishInstallingUpdate(): Observable<{
    update?: ReaderSoftwareUpdate
    error?: string
  }> {
    return this._listenerToObservable(
      'didFinishInstallingUpdate',
      (data: { update?: ReaderSoftwareUpdate; error?: string }) => {
        return this.objectExists(data)
      }
    )
  }

  public async retrievePaymentIntent(
    clientSecret: string
  ): Promise<PaymentIntent> {
    this.ensureInitialized()

    const data = await StripeTerminal.retrievePaymentIntent({ clientSecret })

    return this.objectExists(data?.intent)
  }

  public async collectPaymentMethod(): Promise<PaymentIntent> {
    this.ensureInitialized()

    const data = await StripeTerminal.collectPaymentMethod()

    return this.objectExists(data?.intent)
  }

  public async cancelCollectPaymentMethod(): Promise<void> {
    this.ensureInitialized()

    return await StripeTerminal.cancelCollectPaymentMethod()
  }

  public async processPayment(): Promise<PaymentIntent> {
    this.ensureInitialized()

    const data = await StripeTerminal.processPayment()

    return this.objectExists(data?.intent)
  }

  public async clearCachedCredentials(): Promise<void> {
    this.ensureInitialized()

    return await StripeTerminal.clearCachedCredentials()
  }

  public async setReaderDisplay(cart: Cart): Promise<void> {
    this.ensureInitialized()

    return await StripeTerminal.setReaderDisplay(cart)
  }

  public async clearReaderDisplay(): Promise<void> {
    this.ensureInitialized()

    return await StripeTerminal.clearReaderDisplay()
  }

  public async listLocations(options?: ListLocationsParameters) {
    this.ensureInitialized()

    return await StripeTerminal.listLocations(options)
  }

  private simulatedCardTypeStringToEnum(cardType: any): SimulatedCardType {
    // the simulated card type comes back as a string of the enum name so that needs to be converted back to an enum
    const enumSimulatedCard: any = SimulatedCardType[cardType]

    return enumSimulatedCard as SimulatedCardType
  }

  public async getSimulatorConfiguration() {
    this.ensureInitialized()
    const config = await StripeTerminal.getSimulatorConfiguration()

    if (config?.simulatedCard !== null && config?.simulatedCard !== undefined) {
      // the simulated card type comes back as a string of the enum name so that needs to be converted back to an enum
      config.simulatedCard = this.simulatedCardTypeStringToEnum(
        config.simulatedCard
      )

      this.simulatedCardType = config.simulatedCard
    } else {
      // use the stored simulated card type if it doesn't exist, probably because we are on android where you can't get it
      config.simulatedCard = this.simulatedCardType
    }

    return this.objectExists(config)
  }

  public async setSimulatorConfiguration(config: SimulatorConfiguration) {
    this.ensureInitialized()

    const newConfig = await StripeTerminal.setSimulatorConfiguration(config)

    if (config?.simulatedCard) {
      // store the simulated card type because we can't get it from android
      this.simulatedCardType = config.simulatedCard
    }

    if (
      newConfig?.simulatedCard !== null &&
      newConfig?.simulatedCard !== undefined
    ) {
      // the simulated card type comes back as a string of the enum name so that needs to be converted back to an enum
      newConfig.simulatedCard = this.simulatedCardTypeStringToEnum(
        newConfig.simulatedCard
      )
    } else if (this.objectExists(newConfig)) {
      newConfig.simulatedCard = config.simulatedCard
    }

    return this.objectExists(newConfig)
  }

  public getDeviceStyleFromDeviceType(type: DeviceType): DeviceStyle {
    if (
      type === DeviceType.Chipper2X ||
      type === DeviceType.StripeM2 ||
      type === DeviceType.WisePad3
    ) {
      return DeviceStyle.Bluetooth
    } else if (
      type === DeviceType.WisePosE ||
      type === DeviceType.VerifoneP400
    ) {
      return DeviceStyle.Internet
    }

    return DeviceStyle.Internet
  }

  /**
   * @deprecated use requestPermissions and checkPermissions instead
   */
  public static async getPermissions(): Promise<PermissionStatus> {
    return await this.requestPermissions()
  }

  public static async checkPermissions(): Promise<PermissionStatus> {
    return await StripeTerminal.checkPermissions()
  }

  public static async requestPermissions(): Promise<PermissionStatus> {
    return await StripeTerminal.requestPermissions()
  }

  public async addListener(eventName: string, listenerFunc: Function) {
    return await StripeTerminal.addListener(eventName, listenerFunc)
  }
}
