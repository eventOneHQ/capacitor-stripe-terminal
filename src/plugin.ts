import { Capacitor, PluginListenerHandle } from '@capacitor/core'
import { Observable } from 'rxjs'
import { transform, isObject, isArray, snakeCase } from 'lodash'
import { Stripe } from 'stripe'

import {
  StripeTerminalInterface,
  StripeTerminalConfig,
  DiscoveryConfiguration,
  DiscoveryMethod,
  InternetConnectionConfiguration,
  BluetoothConnectionConfiguration,
  UsbConnectionConfiguration,
  HandoffConnectionConfiguration,
  LocalMobileConnectionConfiguration,
  Reader,
  ConnectionStatus,
  PaymentStatus,
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
  ReaderSoftwareUpdate,
  CollectConfig
} from './definitions'

import { StripeTerminal } from './plugin-registration'
import { StripeTerminalWeb } from './web'

export class StripeTerminalError extends Error {
  /**
   * For card errors resulting from a card issuer decline, a short string indicating the [card issuer’s reason for the decline](https://stripe.com/docs/declines#issuer-declines) if they provide one.
   */
  decline_code?: string

  /**
   * The `PaymentIntent` object for errors returned on a request involving a `PaymentIntent`.
   */
  payment_intent?: Stripe.PaymentIntent
}

export class StripeTerminalPlugin {
  public isInitialized = false

  private stripeTerminalWeb?: StripeTerminalWeb

  private _fetchConnectionToken: () => Promise<string> = () =>
    Promise.reject('You must initialize StripeTerminalPlugin first.')
  private _onUnexpectedReaderDisconnect: () => void = () => {
    // reset the sdk type
    this.selectedSdkType = 'native'

    return Promise.reject('You must initialize StripeTerminalPlugin first.')
  }

  private isDiscovering = false
  private isCollectingPaymentMethod = false
  private listeners: { [key: string]: PluginListenerHandle } = {}

  private simulatedCardType: SimulatedCardType | null = null

  private selectedSdkType: 'native' | 'js' = 'native'

  private get activeSdkType(): 'native' | 'js' {
    if (
      this.selectedSdkType === 'js' &&
      this.stripeTerminalWeb !== undefined &&
      this.isNative()
    ) {
      // only actually use the js sdk if its selected, initialized, and the app is running in a native environment
      return 'js'
    } else {
      return 'native'
    }
  }

  private get sdk(): StripeTerminalInterface {
    if (this.activeSdkType === 'js' && this.stripeTerminalWeb !== undefined) {
      return this.stripeTerminalWeb
    } else {
      return StripeTerminal
    }
  }

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

  private isNative(): boolean {
    return (
      Capacitor.getPlatform() === 'ios' || Capacitor.getPlatform() === 'android'
    )
  }

  private requestConnectionToken(sdkType: string) {
    const sdk = sdkType === 'native' ? StripeTerminal : this.stripeTerminalWeb

    if (!sdk) {
      return
    }

    this._fetchConnectionToken()
      .then(token => {
        if (token) {
          sdk.setConnectionToken({ token })
        } else {
          throw new Error(
            'User-supplied `fetchConnectionToken` resolved successfully, but no token was returned.'
          )
        }
      })
      .catch(err => {
        sdk.setConnectionToken(
          null,
          err.message || 'Error in user-supplied `fetchConnectionToken`.'
        )
      })
  }

  private async init() {
    if (this.isNative()) {
      // if on native android or ios, initialize the js sdk as well
      this.stripeTerminalWeb = new StripeTerminalWeb()
    }

    this.listeners['connectionTokenListenerNative'] =
      await StripeTerminal.addListener('requestConnectionToken', () =>
        this.requestConnectionToken('native')
      )

    this.listeners['unexpectedReaderDisconnectListenerNative'] =
      await StripeTerminal.addListener(
        'didReportUnexpectedReaderDisconnect',
        () => {
          this._onUnexpectedReaderDisconnect()
        }
      )

    if (this.stripeTerminalWeb) {
      this.listeners['connectionTokenListenerJs'] =
        await this.stripeTerminalWeb.addListener('requestConnectionToken', () =>
          this.requestConnectionToken('js')
        )

      this.listeners['unexpectedReaderDisconnectListenerJs'] =
        await this.stripeTerminalWeb.addListener(
          'didReportUnexpectedReaderDisconnect',
          () => {
            this._onUnexpectedReaderDisconnect()
          }
        )
    }

    await Promise.all([
      StripeTerminal.initialize(),
      this.stripeTerminalWeb?.initialize()
    ])

    this.isInitialized = true
  }

  private translateAndroidReaderInput(data: {
    value: string
    isAndroid?: boolean
  }): ReaderInputOptions {
    if (data.isAndroid) {
      const options = data.value.split('/').map((o: string) => o.trim())

      if (
        options.includes('Swipe') &&
        options.includes('Tap') &&
        options.includes('Insert')
      ) {
        return 7
      } else if (
        !options.includes('Swipe') &&
        options.includes('Tap') &&
        options.includes('Insert')
      ) {
        return 6
      } else if (
        options.includes('Swipe') &&
        options.includes('Tap') &&
        !options.includes('Insert')
      ) {
        return 5
      } else if (
        !options.includes('Swipe') &&
        options.includes('Tap') &&
        !options.includes('Insert')
      ) {
        return 4
      } else if (
        options.includes('Swipe') &&
        !options.includes('Tap') &&
        options.includes('Insert')
      ) {
        return 3
      } else if (
        !options.includes('Swipe') &&
        !options.includes('Tap') &&
        options.includes('Insert')
      ) {
        return 2
      } else if (
        options.includes('Swipe') &&
        !options.includes('Tap') &&
        !options.includes('Insert')
      ) {
        return 1
      } else {
        return 0
      }
    }

    return parseFloat(data.value)
  }

  private _listenerToObservable(
    name:
      | 'didRequestReaderDisplayMessage'
      | 'didRequestReaderInput'
      | 'didReportAvailableUpdate'
      | 'didStartInstallingUpdate'
      | 'didReportReaderSoftwareUpdateProgress'
      | 'didFinishInstallingUpdate'
      | 'didStartReaderReconnect'
      | 'didSucceedReaderReconnect'
      | 'didFailReaderReconnect',
    transformFunc?: (data: any) => any
  ): Observable<any> {
    return new Observable(subscriber => {
      let listenerNative: PluginListenerHandle
      let listenerJs: PluginListenerHandle

      StripeTerminal.addListener(name, (data: any) => {
        // only send the event if the native sdk is in use
        if (this.activeSdkType === 'native') {
          if (transformFunc) {
            return subscriber.next(transformFunc(data))
          }

          return subscriber.next(data)
        }
      }).then(l => {
        listenerNative = l
      })

      if (this.stripeTerminalWeb) {
        this.stripeTerminalWeb
          .addListener(name, (data: any) => {
            // only send the event if the js sdk is in use
            if (this.activeSdkType === 'js') {
              if (transformFunc) {
                return subscriber.next(transformFunc(data))
              }

              return subscriber.next(data)
            }
          })
          .then(l => {
            listenerJs = l
          })
      }

      return {
        unsubscribe: () => {
          listenerNative?.remove()
          listenerJs?.remove()
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
  private objectExists<T>(object: T): T | null {
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
      this.listeners['readersDiscoveredNative']?.remove()
      this.listeners['readersDiscoveredJs']?.remove()

      if (!this.isDiscovering) {
        return
      }

      await Promise.all([
        StripeTerminal.cancelDiscoverReaders(),
        this.stripeTerminalWeb?.cancelDiscoverReaders()
      ])

      this.isDiscovering = false
    } catch (err) {
      // eat errors
    }
  }

  private normalizeReader(reader: Reader): Reader {
    if (reader.batteryLevel === 0) {
      // the only time that the battery level should be 0 is while scanning on Android and the level is unknown, so change it to null for consistency with iOS
      reader.batteryLevel = null
    }
    if (reader.deviceSoftwareVersion === 'unknown') {
      // replace unknown with null to make Android consistent with iOS
      reader.deviceSoftwareVersion = null
    }

    return reader
  }

  private snakeCaseRecursively(obj: any) {
    return transform(obj, (acc: any, value, key: any, target) => {
      const snakeKey = isArray(target) ? key : snakeCase(key)

      // don't touch metadata objects
      if (key === 'metadata') {
        acc[snakeKey] = value
      } else {
        acc[snakeKey] = isObject(value)
          ? this.snakeCaseRecursively(value)
          : value
      }
    })
  }

  private parseJson(json: string): any {
    const jsonObj = JSON.parse(json)

    return this.snakeCaseRecursively(jsonObj)
  }

  private normalizePaymentIntent(paymentIntent: any): PaymentIntent | null {
    if (!paymentIntent) return null

    if (
      paymentIntent.amountDetails &&
      typeof paymentIntent.amountDetails === 'string'
    ) {
      paymentIntent.amountDetails = this.parseJson(paymentIntent.amountDetails)
    }

    if (
      paymentIntent.paymentMethod &&
      typeof paymentIntent.paymentMethod === 'string' &&
      !paymentIntent.paymentMethod.startsWith('pm_') // if its just the ID, return the ID
    ) {
      paymentIntent.paymentMethod = this.parseJson(paymentIntent.paymentMethod)
    }

    if (paymentIntent.charges) {
      paymentIntent.charges = paymentIntent.charges.map((charge: any) => {
        if (typeof charge === 'string') {
          return this.parseJson(charge)
        }

        return charge
      })
    }

    return paymentIntent
  }

  public discoverReaders(
    options: DiscoveryConfiguration
  ): Observable<Reader[]> {
    this.ensureInitialized()

    return new Observable(subscriber => {
      let nativeReaderList: Reader[] = []
      let jsReaderList: Reader[] = []

      // reset the sdk type
      this.selectedSdkType = 'native'

      if (options.discoveryMethod === DiscoveryMethod.Internet) {
        this.selectedSdkType = 'js'
      }

      this.sdk
        .addListener('readersDiscovered', (event: { readers?: Reader[] }) => {
          const readers = event?.readers?.map(this.normalizeReader) || []
          nativeReaderList = readers

          // combine the reader list with the latest reader list from the js sdk
          subscriber.next([...nativeReaderList, ...jsReaderList])
        })
        .then(l => {
          this.listeners['readersDiscoveredNative'] = l
        })

      const nativeOptions: DiscoveryConfiguration = {
        ...options,
        discoveryMethod:
          options.discoveryMethod === DiscoveryMethod.Both
            ? DiscoveryMethod.BluetoothScan
            : options.discoveryMethod
      }

      if (nativeOptions.discoveryMethod !== DiscoveryMethod.Internet) {
        // remove locationId if the native discovery method is not internet
        nativeOptions.locationId = undefined
      }

      // start discovery
      this.isDiscovering = true
      this.sdk
        .discoverReaders(nativeOptions)
        .then(() => {
          this.isDiscovering = false
          subscriber.complete()
        })
        .catch((err: any) => {
          this.isDiscovering = false
          subscriber.error(err)
        })

      // if using the both method, search with the js sdk as well
      if (
        options.discoveryMethod === DiscoveryMethod.Both &&
        this.stripeTerminalWeb
      ) {
        this.stripeTerminalWeb
          .addListener('readersDiscovered', (event: { readers?: Reader[] }) => {
            const readers = event?.readers?.map(this.normalizeReader) || []
            jsReaderList = readers

            // combine the reader list with the latest reader list from the native sdk
            subscriber.next([...nativeReaderList, ...jsReaderList])
          })
          .then(l => {
            this.listeners['readersDiscoveredJs'] = l
          })

        const jsOptions: DiscoveryConfiguration = {
          ...options,
          discoveryMethod: DiscoveryMethod.Internet // discovery method is always going to be internet for the js sdk, although, it really doesn't matter because it will be ignored anyway
        }

        // TODO: figure out what to do with errors and completion on this method. maybe just ignore them?
        this.stripeTerminalWeb.discoverReaders(jsOptions)
      }

      return {
        unsubscribe: () => {
          this.cancelDiscoverReaders()
        }
      }
    })
  }

  /**
   * Attempts to connect to the given bluetooth reader.
   *
   * @returns Reader
   */
  public async connectBluetoothReader(
    reader: Reader,
    config: BluetoothConnectionConfiguration
  ): Promise<Reader | null> {
    this.ensureInitialized()

    // if connecting to an Bluetooth reader, make sure to switch to the native SDK
    this.selectedSdkType = 'native'

    const data = await this.sdk.connectBluetoothReader({
      serialNumber: reader.serialNumber,
      ...config
    })

    return this.objectExists(data?.reader)
  }

  /**
   * Attempts to connect to the given reader via usb.
   *
   * @returns Reader
   */
  public async connectUsbReader(
    reader: Reader,
    config: UsbConnectionConfiguration
  ): Promise<Reader | null> {
    this.ensureInitialized()

    // if connecting to a USB reader, make sure to switch to the native SDK
    this.selectedSdkType = 'native'

    const data = await this.sdk.connectUsbReader({
      serialNumber: reader.serialNumber,
      locationId: config.locationId
    })

    return this.objectExists(data?.reader)
  }

  /**
   * Attempts to connect to the given reader in handoff mode.
   *
   * @returns Reader
   */
  public async connectHandoffReader(
    reader: Reader,
    config: HandoffConnectionConfiguration
  ): Promise<Reader | null> {
    this.ensureInitialized()

    // if connecting to a handoff reader, make sure to switch to the native SDK
    this.selectedSdkType = 'native'

    const data = await this.sdk.connectHandoffReader({
      serialNumber: reader.serialNumber,
      locationId: config.locationId
    })

    return this.objectExists(data?.reader)
  }

  /**
   * Attempts to connect to the local device's NFC reader.
   *
   * @returns Reader
   */
  public async connectLocalMobileReader(
    reader: Reader,
    config: LocalMobileConnectionConfiguration
  ): Promise<Reader | null> {
    this.ensureInitialized()

    // if connecting to a local reader, make sure to switch to the native SDK
    this.selectedSdkType = 'native'

    const data = await this.sdk.connectLocalMobileReader({
      serialNumber: reader.serialNumber,
      ...config
    })

    return this.objectExists(data?.reader)
  }

  /**
   * Attempts to connect to the given internet reader.
   *
   * @returns Reader
   */
  public async connectInternetReader(
    reader: Reader,
    config?: InternetConnectionConfiguration
  ): Promise<Reader | null> {
    this.ensureInitialized()

    // if connecting to an internet reader, make sure to switch to the JS SDK
    this.selectedSdkType = 'js'

    const data = await this.sdk.connectInternetReader({
      serialNumber: reader.serialNumber,
      ipAddress: reader.ipAddress ?? undefined,
      stripeId: reader.stripeId ?? undefined,
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

  public async getConnectedReader(): Promise<Reader | null> {
    this.ensureInitialized()

    const data = await this.sdk.getConnectedReader()

    return data.reader
  }

  public async getConnectionStatus(): Promise<ConnectionStatus> {
    this.ensureInitialized()

    const data = await this.sdk.getConnectionStatus()

    return data?.status
  }

  public async getPaymentStatus(): Promise<PaymentStatus> {
    this.ensureInitialized()

    const data = await this.sdk.getPaymentStatus()

    return data?.status
  }

  public async disconnectReader(): Promise<void> {
    this.ensureInitialized()

    return await this.sdk.disconnectReader()
  }

  public connectionStatus(): Observable<ConnectionStatus> {
    this.ensureInitialized()

    return new Observable(subscriber => {
      let hasSentEvent = false

      // get current value
      this.getConnectionStatus()
        .then(data => {
          // only send the initial value if the event listener hasn't already
          if (!hasSentEvent) {
            subscriber.next(data)
          }
        })
        .catch((err: any) => {
          subscriber.error(err)
        })

      let listenerNative: PluginListenerHandle
      let listenerJs: PluginListenerHandle

      // then listen for changes
      StripeTerminal.addListener('didChangeConnectionStatus', (data: any) => {
        // only send an event if we are currently on this sdk type
        if (this.activeSdkType === 'native') {
          hasSentEvent = true
          subscriber.next(data?.status)
        }
      }).then(l => {
        listenerNative = l
      })

      // then listen for js changes
      this.stripeTerminalWeb
        ?.addListener('didChangeConnectionStatus', (data: any) => {
          // only send an event if we are currently on this sdk type
          if (this.activeSdkType === 'js') {
            hasSentEvent = true
            subscriber.next(data?.status)
          }
        })
        .then(l => {
          listenerJs = l
        })

      return {
        unsubscribe: () => {
          listenerNative?.remove()
          listenerJs?.remove()
        }
      }
    })
  }

  public async installAvailableUpdate(): Promise<void> {
    this.ensureInitialized()

    return await this.sdk.installAvailableUpdate()
  }

  public async cancelInstallUpdate(): Promise<void> {
    this.ensureInitialized()

    return await this.sdk.cancelInstallUpdate()
  }

  public didRequestReaderInput(): Observable<ReaderInputOptions> {
    return this._listenerToObservable('didRequestReaderInput', (data: any) => {
      return this.translateAndroidReaderInput(data)
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
  ): Promise<PaymentIntent | null> {
    this.ensureInitialized()

    const data = await this.sdk.retrievePaymentIntent({ clientSecret })

    const pi = this.objectExists(data?.intent)

    return this.normalizePaymentIntent(pi)
  }

  public async collectPaymentMethod(
    collectConfig?: CollectConfig
  ): Promise<PaymentIntent | null> {
    if (this.isCollectingPaymentMethod) {
      return null
    }

    this.isCollectingPaymentMethod = true
    try {
      this.ensureInitialized()

      const data = await this.sdk.collectPaymentMethod(collectConfig)

      const pi = this.objectExists(data?.intent)

      return this.normalizePaymentIntent(pi)
    } catch (err) {
      throw err
    } finally {
      this.isCollectingPaymentMethod = false
    }
  }

  public async cancelCollectPaymentMethod(): Promise<void> {
    this.ensureInitialized()

    return await this.sdk.cancelCollectPaymentMethod()
  }

  public async processPayment(): Promise<PaymentIntent | null> {
    try {
      this.ensureInitialized()

      const data = await this.sdk.processPayment()

      const pi = this.objectExists(data?.intent)

      return this.normalizePaymentIntent(pi)
    } catch (err: any) {
      if (!err?.message || !err?.data) {
        throw err
      }

      const stripeError = new StripeTerminalError(err.message)
      stripeError.decline_code = err.data.decline_code
      stripeError.payment_intent = err.data.payment_intent

      throw stripeError
    }
  }

  public async clearCachedCredentials(): Promise<void> {
    this.ensureInitialized()

    return await this.sdk.clearCachedCredentials()
  }

  public async setReaderDisplay(cart: Cart): Promise<void> {
    this.ensureInitialized()

    // ignore if the sdk is currently collecting a payment method
    if (this.isCollectingPaymentMethod) {
      return
    }

    return await this.sdk.setReaderDisplay(cart)
  }

  public async clearReaderDisplay(): Promise<void> {
    this.ensureInitialized()

    // ignore if the sdk is currently collecting a payment method
    if (this.isCollectingPaymentMethod) {
      return
    }

    return await this.sdk.clearReaderDisplay()
  }

  public async listLocations(options?: ListLocationsParameters) {
    this.ensureInitialized()

    const data = await this.sdk.listLocations(options)

    return data
  }

  private simulatedCardTypeStringToEnum(cardType: any): SimulatedCardType {
    // the simulated card type comes back as a string of the enum name so that needs to be converted back to an enum
    const enumSimulatedCard: any = SimulatedCardType[cardType]

    return enumSimulatedCard as SimulatedCardType
  }

  public async getSimulatorConfiguration() {
    this.ensureInitialized()
    const config = await this.sdk.getSimulatorConfiguration()

    if (config?.simulatedCard !== null && config?.simulatedCard !== undefined) {
      // the simulated card type comes back as a string of the enum name so that needs to be converted back to an enum
      config.simulatedCard = this.simulatedCardTypeStringToEnum(
        config.simulatedCard
      )

      this.simulatedCardType = config.simulatedCard
    } else if (this.simulatedCardType) {
      // use the stored simulated card type if it doesn't exist, probably because we are on android where you can't get it
      config.simulatedCard = this.simulatedCardType
    }

    return this.objectExists(config)
  }

  public async setSimulatorConfiguration(config: SimulatorConfiguration) {
    this.ensureInitialized()

    const newConfig = await this.sdk.setSimulatorConfiguration(config)

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

  /**
   * The reader has lost Bluetooth connection to the SDK and reconnection attempts have been started.
   *
   * In your implementation of this method, you should notify your user that the reader disconnected and that reconnection attempts are being made.
   *
   * Requires `autoReconnectOnUnexpectedDisconnect` is set to true in the `BluetoothConnectionConfiguration`
   */
  public didStartReaderReconnect(): Observable<void> {
    return this._listenerToObservable('didStartReaderReconnect')
  }

  /**
   * The SDK was able to reconnect to the previously connected Bluetooth reader.
   *
   * In your implementation of this method, you should notify your user that reader connection has been re-established.
   *
   * Requires `autoReconnectOnUnexpectedDisconnect` is set to true in the `BluetoothConnectionConfiguration`
   */
  public didSucceedReaderReconnect(): Observable<void> {
    return this._listenerToObservable('didSucceedReaderReconnect')
  }

  /**
   * The SDK was not able to reconnect to the previously connected bluetooth reader. The SDK is now disconnected from any readers.
   *
   * In your implementation of this method, you should notify your user that the reader has disconnected.
   *
   * Requires `autoReconnectOnUnexpectedDisconnect` is set to true in the `BluetoothConnectionConfiguration`
   */
  public didFailReaderReconnect(): Observable<void> {
    return this._listenerToObservable('didFailReaderReconnect')
  }

  /**
   * Cancel auto-reconnection
   */
  public async cancelAutoReconnect(): Promise<void> {
    this.ensureInitialized()

    return await this.sdk.cancelAutoReconnect()
  }

  public getDeviceStyleFromDeviceType(type: DeviceType): DeviceStyle {
    return StripeTerminalPlugin.getDeviceStyleFromDeviceType(type)
  }

  public static getDeviceStyleFromDeviceType(type: DeviceType): DeviceStyle {
    if (
      type === DeviceType.Chipper2X ||
      type === DeviceType.StripeM2 ||
      type === DeviceType.WisePad3
    ) {
      return DeviceStyle.Bluetooth
    } else if (type === DeviceType.AppleBuiltIn) {
      return DeviceStyle.Local
    } else if (
      type === DeviceType.WisePosE ||
      type === DeviceType.WisePosEDevKit ||
      type === DeviceType.StripeS700 ||
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

  public static async tapToPaySupported(): Promise<boolean> {
    return await StripeTerminal.tapToPaySupported()
  }

  /**
   * This should not be used directly. It will not behave correctly when using `Internet` and `Both` discovery methods
   *
   * @deprecated This should not be used directly. It will not behave correctly when using `Internet` and `Both` discovery methods
   */
  public async addListener(eventName: string, listenerFunc: Function) {
    return await this.sdk.addListener(eventName, listenerFunc)
  }
}
