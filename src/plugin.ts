import { Capacitor, PluginListenerHandle } from '@capacitor/core'
import { Stripe } from 'stripe'

import {
  StripeTerminalInterface,
  StripeTerminalConfig,
  DiscoveryConfiguration,
  DiscoveryMethod,
  InternetConnectionConfiguration,
  BluetoothConnectionConfiguration,
  UsbConnectionConfiguration,
  AppsOnDevicesConnectionConfiguration,
  TapToPayConnectionConfiguration,
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
  CollectConfig,
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
      // Type assertion is safe here: WebPlugin in Capacitor v8 properly implements the addListener
      // return type (Promise<PluginListenerHandle> & PluginListenerHandle), but TypeScript can't
      // verify this statically. The runtime behavior is correct.
      return this.stripeTerminalWeb as unknown as StripeTerminalInterface
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
      .then((token) => {
        if (token) {
          sdk.setConnectionToken({ token })
        } else {
          throw new Error(
            'User-supplied `fetchConnectionToken` resolved successfully, but no token was returned.',
          )
        }
      })
      .catch((err) => {
        sdk.setConnectionToken(
          null,
          err.message || 'Error in user-supplied `fetchConnectionToken`.',
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
        this.requestConnectionToken('native'),
      )

    this.listeners['unexpectedReaderDisconnectListenerNative'] =
      await StripeTerminal.addListener(
        'didReportUnexpectedReaderDisconnect',
        () => {
          this._onUnexpectedReaderDisconnect()
        },
      )

    if (this.stripeTerminalWeb) {
      this.listeners['connectionTokenListenerJs'] =
        await this.stripeTerminalWeb.addListener('requestConnectionToken', () =>
          this.requestConnectionToken('js'),
        )

      this.listeners['unexpectedReaderDisconnectListenerJs'] =
        await this.stripeTerminalWeb.addListener(
          'didReportUnexpectedReaderDisconnect',
          () => {
            this._onUnexpectedReaderDisconnect()
          },
        )
    }

    await Promise.all([
      StripeTerminal.initialize(),
      this.stripeTerminalWeb?.initialize(),
    ])

    this.isInitialized = true
  }

  private translateAndroidReaderInput(data: {
    value: string
    isAndroid?: boolean
  }): ReaderInputOptions {
    if (data.isAndroid) {
      const map: Record<string, ReaderInputOptions> = {
        Swipe: ReaderInputOptions.SwipeCard,
        Tap: ReaderInputOptions.TapCard,
        Insert: ReaderInputOptions.InsertCard,
      }
      return data.value
        .split('/')
        .reduce(
          (acc, s) => acc | (map[s.trim()] ?? ReaderInputOptions.None),
          ReaderInputOptions.None,
        )
    }

    return parseFloat(data.value) as ReaderInputOptions
  }

  private async _addListener<T>(
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
    callback: (data: T) => void,
    transformFunc?: (data: any) => T,
  ): Promise<PluginListenerHandle> {
    let listenerNative: PluginListenerHandle
    let listenerJs: PluginListenerHandle

    listenerNative = await StripeTerminal.addListener(name, (data: any) => {
      // only send the event if the native sdk is in use
      if (this.activeSdkType === 'native') {
        callback(transformFunc ? transformFunc(data) : data)
      }
    })

    if (this.stripeTerminalWeb) {
      listenerJs = await this.stripeTerminalWeb.addListener(
        name,
        (data: any) => {
          // only send the event if the js sdk is in use
          if (this.activeSdkType === 'js') {
            callback(transformFunc ? transformFunc(data) : data)
          }
        },
      )
    }

    return {
      remove: async () => {
        await listenerNative?.remove()
        await listenerJs?.remove()
      },
    }
  }

  private ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error(
        'StripeTerminalPlugin must be initialized before you can use any methods.',
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
    options: StripeTerminalConfig,
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
        this.stripeTerminalWeb?.cancelDiscoverReaders(),
      ])

      this.isDiscovering = false
    } catch (err) {
      // eat errors
    }
  }

  /**
   * Removes all event listeners and resets the plugin instance to an
   * uninitialized state. Call this when the plugin is no longer needed (e.g.
   * on component unmount) to prevent listener leaks.
   */
  public async destroy(): Promise<void> {
    for (const listener of Object.values(this.listeners)) {
      await listener?.remove()
    }
    this.listeners = {}
    this.isInitialized = false
    this.isDiscovering = false
    this.isCollectingPaymentMethod = false
    this.selectedSdkType = 'native'
    this.simulatedCardType = null
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

  private normalizePaymentIntent(paymentIntent: any): PaymentIntent | null {
    if (!paymentIntent) return null

    return paymentIntent
  }

  public async discoverReaders(
    options: DiscoveryConfiguration,
    callback: (readers: Reader[]) => void,
    errorCallback?: (error: Error) => void,
  ): Promise<PluginListenerHandle> {
    this.ensureInitialized()

    let nativeReaderList: Reader[] = []
    let jsReaderList: Reader[] = []

    // reset the sdk type
    this.selectedSdkType = 'native'

    if (options.discoveryMethod === DiscoveryMethod.Internet) {
      this.selectedSdkType = 'js'
    }

    // Remove any existing listeners before re-subscribing to avoid duplicates
    await this.listeners['readersDiscoveredNative']?.remove()
    await this.listeners['readersDiscoveredJs']?.remove()

    this.listeners['readersDiscoveredNative'] = await this.sdk.addListener(
      'readersDiscovered',
      (event: { readers?: Reader[] }) => {
        const readers = event?.readers?.map(this.normalizeReader) || []
        nativeReaderList = readers

        // combine the reader list with the latest reader list from the js sdk
        callback([...nativeReaderList, ...jsReaderList])
      },
    )

    const nativeOptions: DiscoveryConfiguration = {
      ...options,
      discoveryMethod:
        options.discoveryMethod === DiscoveryMethod.Both
          ? DiscoveryMethod.BluetoothScan
          : options.discoveryMethod,
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
      })
      .catch((err: Error) => {
        this.isDiscovering = false
        errorCallback?.(err)
      })

    // if using the both method, search with the js sdk as well
    if (
      options.discoveryMethod === DiscoveryMethod.Both &&
      this.stripeTerminalWeb
    ) {
      this.listeners['readersDiscoveredJs'] =
        await this.stripeTerminalWeb.addListener(
          'readersDiscovered',
          (event: { readers?: Reader[] }) => {
            const readers = event?.readers?.map(this.normalizeReader) || []
            jsReaderList = readers

            // combine the reader list with the latest reader list from the native sdk
            callback([...nativeReaderList, ...jsReaderList])
          },
        )

      const jsOptions: DiscoveryConfiguration = {
        ...options,
        discoveryMethod: DiscoveryMethod.Internet, // discovery method is always going to be internet for the js sdk, although, it really doesn't matter because it will be ignored anyway
      }

      // TODO: figure out what to do with errors and completion on this method. maybe just ignore them?
      this.stripeTerminalWeb.discoverReaders(jsOptions).catch((err: Error) => {
        errorCallback?.(err)
      })
    }

    return {
      remove: async () => {
        await this.cancelDiscoverReaders()
      },
    }
  }

  /**
   * Attempts to connect to the given bluetooth reader.
   *
   * @returns Reader
   */
  public async connectBluetoothReader(
    reader: Reader,
    config: BluetoothConnectionConfiguration,
  ): Promise<Reader | null> {
    this.ensureInitialized()

    // if connecting to an Bluetooth reader, make sure to switch to the native SDK
    this.selectedSdkType = 'native'

    const data = await this.sdk.connectBluetoothReader({
      serialNumber: reader.serialNumber,
      ...config,
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
    config: UsbConnectionConfiguration,
  ): Promise<Reader | null> {
    this.ensureInitialized()

    // if connecting to a USB reader, make sure to switch to the native SDK
    this.selectedSdkType = 'native'

    const data = await this.sdk.connectUsbReader({
      serialNumber: reader.serialNumber,
      locationId: config.locationId,
    })

    return this.objectExists(data?.reader)
  }

  /**
   * Attempts to connect to an AppsOnDevices reader (Android only).
   *
   * @returns Reader
   */
  public async connectAppsOnDevicesReader(
    reader: Reader,
    _config?: AppsOnDevicesConnectionConfiguration,
  ): Promise<Reader | null> {
    this.ensureInitialized()

    // if connecting to an AppsOnDevices reader, make sure to switch to the native SDK
    this.selectedSdkType = 'native'

    const data = await this.sdk.connectAppsOnDevicesReader({
      serialNumber: reader.serialNumber,
    })

    return this.objectExists(data?.reader)
  }

  /**
   * Attempts to connect to the local device's NFC reader.
   *
   * @returns Reader
   */
  public async connectTapToPayReader(
    reader: Reader,
    config: TapToPayConnectionConfiguration,
  ): Promise<Reader | null> {
    this.ensureInitialized()

    // if connecting to a local reader, make sure to switch to the native SDK
    this.selectedSdkType = 'native'

    const data = await this.sdk.connectTapToPayReader({
      serialNumber: reader.serialNumber,
      ...config,
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
    config?: InternetConnectionConfiguration,
  ): Promise<Reader | null> {
    this.ensureInitialized()

    // if connecting to an internet reader, make sure to switch to the JS SDK
    this.selectedSdkType = 'js'

    const data = await this.sdk.connectInternetReader({
      serialNumber: reader.serialNumber,
      ipAddress: reader.ipAddress ?? undefined,
      stripeId: reader.stripeId ?? undefined,
      ...config,
    })

    return this.objectExists(data?.reader)
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

  public async connectionStatus(
    callback: (status: ConnectionStatus) => void,
  ): Promise<PluginListenerHandle> {
    this.ensureInitialized()

    let hasSentEvent = false

    let listenerNative: PluginListenerHandle
    let listenerJs: PluginListenerHandle

    // Set up listeners before fetching the initial value to avoid missing
    // events that fire between the fetch starting and the listener attaching
    listenerNative = await StripeTerminal.addListener(
      'didChangeConnectionStatus',
      (data: any) => {
        if (this.activeSdkType === 'native') {
          hasSentEvent = true
          callback(data?.status)
        }
      },
    )

    if (this.stripeTerminalWeb) {
      listenerJs = await this.stripeTerminalWeb.addListener(
        'didChangeConnectionStatus',
        (data: any) => {
          if (this.activeSdkType === 'js') {
            hasSentEvent = true
            callback(data?.status)
          }
        },
      )
    }

    // Fetch initial value after listeners are attached
    this.getConnectionStatus()
      .then((data) => {
        if (!hasSentEvent) {
          callback(data)
        }
      })
      .catch(() => {})

    return {
      remove: async () => {
        await listenerNative?.remove()
        await listenerJs?.remove()
      },
    }
  }

  public async installAvailableUpdate(): Promise<void> {
    this.ensureInitialized()

    return await this.sdk.installAvailableUpdate()
  }

  public async cancelInstallUpdate(): Promise<void> {
    this.ensureInitialized()

    return await this.sdk.cancelInstallUpdate()
  }

  public async didRequestReaderInput(
    callback: (options: ReaderInputOptions) => void,
  ): Promise<PluginListenerHandle> {
    return this._addListener('didRequestReaderInput', callback, (data: any) =>
      this.translateAndroidReaderInput(data),
    )
  }

  public async didRequestReaderDisplayMessage(
    callback: (message: ReaderDisplayMessage) => void,
  ): Promise<PluginListenerHandle> {
    return this._addListener(
      'didRequestReaderDisplayMessage',
      callback,
      (data: any) => parseFloat(data.value),
    )
  }

  public async didReportAvailableUpdate(
    callback: (update: ReaderSoftwareUpdate | null) => void,
  ): Promise<PluginListenerHandle> {
    return this._addListener(
      'didReportAvailableUpdate',
      callback,
      (data: { update: ReaderSoftwareUpdate }) =>
        this.objectExists(data?.update),
    )
  }

  public async didStartInstallingUpdate(
    callback: (update: ReaderSoftwareUpdate | null) => void,
  ): Promise<PluginListenerHandle> {
    return this._addListener(
      'didStartInstallingUpdate',
      callback,
      (data: { update: ReaderSoftwareUpdate }) =>
        this.objectExists(data?.update),
    )
  }

  public async didReportReaderSoftwareUpdateProgress(
    callback: (progress: number) => void,
  ): Promise<PluginListenerHandle> {
    return this._addListener(
      'didReportReaderSoftwareUpdateProgress',
      callback,
      (data: any) => parseFloat(data.progress),
    )
  }

  public async didFinishInstallingUpdate(
    callback: (
      result: { update?: ReaderSoftwareUpdate; error?: string } | null,
    ) => void,
  ): Promise<PluginListenerHandle> {
    return this._addListener(
      'didFinishInstallingUpdate',
      callback,
      (data: { update?: ReaderSoftwareUpdate; error?: string }) =>
        this.objectExists(data),
    )
  }

  public async retrievePaymentIntent(
    clientSecret: string,
  ): Promise<PaymentIntent | null> {
    this.ensureInitialized()

    const data = await this.sdk.retrievePaymentIntent({ clientSecret })

    const pi = this.objectExists(data?.intent)

    return this.normalizePaymentIntent(pi)
  }

  public async collectPaymentMethod(
    collectConfig?: CollectConfig,
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

  public async confirmPaymentIntent(): Promise<PaymentIntent | null> {
    try {
      this.ensureInitialized()

      const data = await this.sdk.confirmPaymentIntent()

      const pi = this.objectExists(data?.intent)

      return this.normalizePaymentIntent(pi)
    } catch (err: any) {
      if (!err?.message) {
        throw err
      }

      const stripeError = new StripeTerminalError(err.message)
      if (err.data) {
        stripeError.decline_code = err.data.decline_code
        stripeError.payment_intent = err.data.payment_intent
      }

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
        config.simulatedCard,
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
        newConfig.simulatedCard,
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
  public async didStartReaderReconnect(
    callback: () => void,
  ): Promise<PluginListenerHandle> {
    return this._addListener('didStartReaderReconnect', callback)
  }

  /**
   * The SDK was able to reconnect to the previously connected Bluetooth reader.
   *
   * In your implementation of this method, you should notify your user that reader connection has been re-established.
   *
   * Requires `autoReconnectOnUnexpectedDisconnect` is set to true in the `BluetoothConnectionConfiguration`
   */
  public async didSucceedReaderReconnect(
    callback: () => void,
  ): Promise<PluginListenerHandle> {
    return this._addListener('didSucceedReaderReconnect', callback)
  }

  /**
   * The SDK was not able to reconnect to the previously connected bluetooth reader. The SDK is now disconnected from any readers.
   *
   * In your implementation of this method, you should notify your user that the reader has disconnected.
   *
   * Requires `autoReconnectOnUnexpectedDisconnect` is set to true in the `BluetoothConnectionConfiguration`
   */
  public async didFailReaderReconnect(
    callback: () => void,
  ): Promise<PluginListenerHandle> {
    return this._addListener('didFailReaderReconnect', callback)
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
    } else if (type === DeviceType.TapToPay) {
      return DeviceStyle.Local
    } else if (
      type === DeviceType.WisePosE ||
      type === DeviceType.WisePosEDevKit ||
      type === DeviceType.StripeS700 ||
      type === DeviceType.StripeS700DevKit ||
      type === DeviceType.StripeS710 ||
      type === DeviceType.StripeS710DevKit
    ) {
      return DeviceStyle.Internet
    }

    return DeviceStyle.Internet
  }

  public static async checkPermissions(): Promise<PermissionStatus> {
    return await StripeTerminal.checkPermissions()
  }

  public static async requestPermissions(): Promise<PermissionStatus> {
    return await StripeTerminal.requestPermissions()
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
