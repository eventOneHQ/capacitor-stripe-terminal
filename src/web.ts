import { WebPlugin } from '@capacitor/core'
import {
  AppTransitionAnimation,
  DiscoveryConfiguration,
  OpenDeviceSettingsOptions,
  Reader,
  ConnectionStatus,
  PaymentIntent,
  PaymentIntentStatus,
  PaymentStatus,
  DeviceType,
  ReaderNetworkStatus,
  ListLocationsParameters,
  Location,
  SimulatedCardType,
  SimulatorConfiguration,
  PermissionStatus,
  Cart,
  CollectConfig,
  ChargeStatus,
  Charge,
  CardPresentDetails,
  PaymentMethodDetails,
  PaymentMethodType,
  ReaderSettings,
  ReaderSettingsParameters,
  CollectDataConfig,
  CollectedData,
  CreatePaymentIntentParams,
  CreateSetupIntentParams,
  CollectSetupIntentPaymentMethodParams,
  SetupIntent,
  SetupIntentStatus,
  SetupIntentUsage,
  SetupAttempt,
  SetupAttemptCardPresentDetails,
  RefundParams,
  Refund,
  RefundStatus,
  ICollectInputsParameters,
  ICollectInputsResult,
  DiscoveryMethod,
  OfflineStatus,
  PrintContent,
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
  ICollectConfig,
  IReaderSettings,
  ICollectInputsParameters as SdkCollectInputsParameters,
} from '@stripe/terminal-js'
import { Stripe } from 'stripe'

/**
 * @ignore
 */
type SdkSetupIntent = Parameters<Terminal['confirmSetupIntent']>[0]

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
  ['chipper_2X']: 'chipper2X',
  ['bbpos_wisepos_e']: 'wisePosE',
  ['simulated_wisepos_e']: 'wisePosE',
  ['stripe_s700']: 'stripeS700',
  ['stripe_s700_devkit']: 'stripeS700Devkit',
  ['stripe_s710']: 'stripeS710',
  ['stripe_s710_devkit']: 'stripeS710Devkit',
}

/**
 * @ignore
 */
const readerStatuses: { [status: string]: ReaderNetworkStatus } = {
  online: 'online',
  offline: 'offline',
}

/**
 * @ignore
 */
const connectionStatus: { [status: string]: ConnectionStatus } = {
  connecting: 'connecting',
  connected: 'connected',
  not_connected: 'notConnected',
  reconnecting: 'reconnecting',
}

/**
 * @ignore
 */
const testPaymentMethodMap: { [method: string]: SimulatedCardType } = {
  visa: 'visa',
  visa_debit: 'visaDebit',
  mastercard: 'mastercard',
  mastercard_debit: 'masterDebit',
  mastercard_prepaid: 'mastercardPrepaid',
  amex: 'amex',
  amex2: 'amex2',
  discover: 'discover',
  discover2: 'discover2',
  diners: 'diners',
  diners_14digits: 'diners14Digit',
  jcb: 'jcb',
  unionpay: 'unionPay',
  interac: 'interac',
  charge_declined: 'chargeDeclined',
  charge_declined_insufficient_funds: 'chargeDeclinedInsufficientFunds',
  charge_declined_lost_card: 'chargeDeclinedLostCard',
  charge_declined_stolen_card: 'chargeDeclinedStolenCard',
  charge_declined_expired_card: 'chargeDeclinedExpiredCard',
  charge_declined_processing_error: 'chargeDeclinedProcessingError',
  refund_fail: 'refundFailed',
}

/**
 * @ignore
 */
const chargeStatus: { [status: string]: ChargeStatus } = {
  succeeded: 'succeeded',
  pending: 'pending',
  failed: 'failed',
}

/**
 * @ignore
 */
function serializeCharge(c: Stripe.Charge): Charge {
  return {
    id: c.id,
    amount: c.amount,
    currency: c.currency,
    status: chargeStatus[c.status] ?? 'failed',
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
    balanceTransaction:
      typeof c.balance_transaction === 'string'
        ? c.balance_transaction
        : (c.balance_transaction?.id ?? null),
    applicationFee:
      typeof c.application_fee === 'string'
        ? c.application_fee
        : (c.application_fee?.id ?? null),
    applicationFeeAmount: c.application_fee_amount ?? null,
    onBehalfOf:
      typeof c.on_behalf_of === 'string'
        ? c.on_behalf_of
        : (c.on_behalf_of?.id ?? null),
    paymentMethodDetails: serializePaymentMethodDetails(
      c.payment_method_details,
    ),
  }
}

/**
 * @ignore
 */
const paymentMethodType: { [type: string]: PaymentMethodType } = {
  card_present: 'cardPresent',
  interac_present: 'interacPresent',
  card: 'card',
  wechat_pay: 'wechatPay',
  affirm: 'affirm',
  paynow: 'paynow',
  paypay: 'paypay',
  klarna: 'klarna',
}

/**
 * @ignore
 */
function serializePaymentMethodDetails(
  details: Stripe.Charge.PaymentMethodDetails | null | undefined,
): PaymentMethodDetails | null {
  if (!details) return null

  const cardPresent = (details as any).card_present
  const interacPresent = (details as any).interac_present
  const card = (details as any).card

  return {
    type: paymentMethodType[details.type] ?? null,
    cardPresentDetails: serializeCardPresentDetails(cardPresent),
    interacPresentDetails: serializeCardPresentDetails(interacPresent),
    cardDetails: card
      ? {
          brand: card.brand ?? null,
          country: card.country ?? null,
          expMonth: card.exp_month ?? null,
          expYear: card.exp_year ?? null,
          funding: card.funding ?? null,
          last4: card.last4 ?? null,
        }
      : null,
  }
}

/**
 * @ignore
 */
function serializeCardPresentDetails(details: any): CardPresentDetails | null {
  if (!details) return null

  return {
    last4: details.last4 ?? null,
    expMonth: details.exp_month ?? null,
    expYear: details.exp_year ?? null,
    cardholderName: details.cardholder_name ?? null,
    funding: details.funding ?? null,
    brand: details.brand ?? null,
    generatedCard: details.generated_card ?? null,
    emvAuthData: details.emv_auth_data ?? null,
    country: details.country ?? null,
    preferredLocales: details.preferred_locales ?? undefined,
    issuer: details.issuer ?? null,
    iin: details.iin ?? null,
    network: details.network ?? null,
    description: details.description ?? null,
    location: details.location ?? null,
    reader: details.reader ?? null,
    readMethod: details.read_method ?? null,
    wallet: details.wallet ? { type: details.wallet.type ?? null } : null,
    receipt: details.receipt
      ? {
          accountType: details.receipt.account_type ?? null,
          applicationCryptogram: details.receipt.application_cryptogram ?? null,
          applicationPreferredName:
            details.receipt.application_preferred_name ?? null,
          authorizationCode: details.receipt.authorization_code ?? null,
          authorizationResponseCode:
            details.receipt.authorization_response_code ?? null,
          cvm: details.receipt.cardholder_verification_method ?? null,
          dedicatedFileName: details.receipt.dedicated_file_name ?? null,
          terminalVerificationResult:
            details.receipt.terminal_verification_results ?? null,
          transactionStatusInformation:
            details.receipt.transaction_status_information ?? null,
        }
      : null,
  }
}

/**
 * @ignore
 */
const paymentIntentStatus: { [status: string]: PaymentIntentStatus } = {
  requires_payment_method: 'requiresPaymentMethod',
  requires_confirmation: 'requiresConfirmation',
  requires_capture: 'requiresCapture',
  requires_action: 'requiresAction',
  processing: 'processing',
  canceled: 'canceled',
  succeeded: 'succeeded',
}

/**
 * @ignore
 */
const paymentStatus: { [status: string]: PaymentStatus } = {
  not_ready: 'notReady',
  ready: 'ready',
  waiting_for_input: 'waitingForInput',
  processing: 'processing',
}

/**
 * @ignore
 */
const setupIntentStatus: { [status: string]: SetupIntentStatus } = {
  requires_payment_method: 'requiresPaymentMethod',
  requires_confirmation: 'requiresConfirmation',
  requires_action: 'requiresAction',
  processing: 'processing',
  succeeded: 'succeeded',
  canceled: 'canceled',
}

/**
 * @ignore
 */
const setupIntentUsage: { [usage: string]: SetupIntentUsage } = {
  on_session: 'onSession',
  off_session: 'offSession',
}

/**
 * @ignore
 */
const refundStatus: { [status: string]: RefundStatus } = {
  succeeded: 'succeeded',
  failed: 'failed',
  pending: 'pending',
}

/**
 * @ignore
 */
function idOf(value: any): string | null {
  if (!value) return null
  return typeof value === 'string' ? value : (value.id ?? null)
}

/**
 * @ignore
 */
function serializeSetupAttemptCardPresent(
  details: any,
): SetupAttemptCardPresentDetails | null {
  if (!details) return null

  return {
    emvAuthData: details.emv_auth_data ?? null,
    generatedCard: details.generated_card ?? null,
  }
}

/**
 * @ignore
 */
function serializeSetupAttempt(attempt: any): SetupAttempt {
  const details = attempt.payment_method_details

  return {
    id: attempt.id,
    applicationId: idOf(attempt.application),
    created: attempt.created ?? null,
    customer: idOf(attempt.customer),
    livemode: !!attempt.livemode,
    onBehalfOfId: idOf(attempt.on_behalf_of),
    paymentMethodId: idOf(attempt.payment_method),
    setupIntentId: idOf(attempt.setup_intent),
    status: attempt.status ?? null,
    usage: setupIntentUsage[attempt.usage] ?? null,
    paymentMethodDetails: details
      ? {
          type: paymentMethodType[details.type] ?? null,
          cardPresent: serializeSetupAttemptCardPresent(details.card_present),
          interacPresent: serializeSetupAttemptCardPresent(
            details.interac_present,
          ),
        }
      : null,
  }
}

/**
 * @ignore
 */
function serializeSetupIntent(intent: any): SetupIntent {
  const latestAttempt =
    intent.latest_attempt && typeof intent.latest_attempt === 'object'
      ? serializeSetupAttempt(intent.latest_attempt)
      : null

  return {
    id: intent.id,
    created: intent.created ?? null,
    customer: idOf(intent.customer),
    description: intent.description ?? null,
    livemode: !!intent.livemode,
    metadata: intent.metadata ?? null,
    onBehalfOf: idOf(intent.on_behalf_of),
    paymentMethodId: idOf(intent.payment_method),
    paymentMethodTypes: (intent.payment_method_types ?? [])
      .map((type: string) => paymentMethodType[type])
      .filter(Boolean),
    status: setupIntentStatus[intent.status] ?? 'unknown',
    usage: setupIntentUsage[intent.usage] ?? null,
    latestAttempt,
  }
}

/**
 * @ignore
 */
function serializeRefund(refund: any): Refund {
  return {
    id: refund.id,
    amount: refund.amount ?? null,
    chargeId: idOf(refund.charge),
    created: refund.created ?? null,
    currency: refund.currency ?? null,
    metadata: refund.metadata ?? null,
    reason: refund.reason ?? null,
    status: refundStatus[refund.status] ?? 'unknown',
    failureReason: refund.failure_reason ?? null,
  }
}

/**
 * @ignore
 */
function serializeReaderSettings(settings: IReaderSettings): ReaderSettings {
  const accessibility = settings.accessibilitySettings

  if ('textToSpeechStatus' in accessibility) {
    return {
      accessibility: { textToSpeechStatus: accessibility.textToSpeechStatus },
    }
  }

  return {
    accessibility: {
      error: accessibility.message ?? 'Unable to read accessibility settings',
    },
  }
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
  private currentSetupIntentClientSecret: string | null = null
  private currentSetupIntent: SdkSetupIntent | null = null
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

  private unwrap<T>(result: T | ErrorResponse): T {
    const error = (result as ErrorResponse)?.error
    if (error) {
      throw error
    }

    return result as T
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
        // The JS SDK doesn't report a reason.
        const data = { reason: 'unknown' }
        this.notifyListeners('didDisconnect', data)
        this.notifyListeners('didReportUnexpectedReaderDisconnect', data)
      },
      onConnectionStatusChange: async (event) => {
        this.notifyListeners('didChangeConnectionStatus', {
          status: connectionStatus[event.status],
        })
      },
      onPaymentStatusChange: async (event) => {
        this.notifyListeners('didChangePaymentStatus', {
          status: paymentStatus[event.status],
        })
      },
    })
  }

  private isInstanceOfLocation(object: any): object is StripeLocation {
    return typeof object === 'object' && 'id' in object
  }

  private translateReader(sdkReader: DiscoverReader): Reader {
    return {
      id: sdkReader.id,
      deviceType: deviceTypes[sdkReader.device_type] ?? 'unknown',
      status: sdkReader.status ? readerStatuses[sdkReader.status] : 'offline',
      serialNumber: sdkReader.serial_number,
      ipAddress: sdkReader.ip_address,
      locationId: this.isInstanceOfLocation(sdkReader.location)
        ? sdkReader.location.id
        : (sdkReader.location ?? null),
      location: this.isInstanceOfLocation(sdkReader.location)
        ? {
            id: sdkReader.location.id,
            displayName: sdkReader.location.display_name,
            livemode: sdkReader.livemode,
          }
        : null,
      label: sdkReader.label,
      deviceSoftwareVersion: sdkReader.device_sw_version,
      batteryStatus: 'unknown',
      batteryLevel: null,
      isCharging: null,
      locationStatus: 'unknown',
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
    id?: string
    failIfInUse?: boolean
  }): Promise<{ reader: Reader }> {
    const sdk = this.ensureInitialized()

    const readerId = options.id

    if (!readerId) {
      throw new Error('Reader ID missing')
    }

    // use any here since we don't have all the reader details and don't actually need them all
    const readerOpts: any = {
      id: readerId,
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
  async openDeviceSettings(_options: OpenDeviceSettingsOptions): Promise<void> {
    // no equivalent
    console.warn('openDeviceSettings is only available on Android.')
  }
  async connectAppsOnDevicesReader(_config: {
    serialNumber: string
    appTransitionAnimation?: AppTransitionAnimation
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
  async rebootReader(): Promise<void> {
    // no equivalent
    console.warn('rebootReader is only available on iOS and Android.')
  }
  async getReaderSettings(): Promise<ReaderSettings> {
    const sdk = this.ensureInitialized()

    return serializeReaderSettings(this.unwrap(await sdk.getReaderSettings()))
  }
  async setReaderSettings(
    options: ReaderSettingsParameters,
  ): Promise<ReaderSettings> {
    const sdk = this.ensureInitialized()

    const result = await sdk.setReaderSettings({
      accessibility_parameters: {
        enableTextToSpeechSpeakers: options.textToSpeechViaSpeakers,
      },
    })

    return serializeReaderSettings(this.unwrap(result))
  }
  async collectData(
    _options: CollectDataConfig,
  ): Promise<{ data: CollectedData }> {
    throw new Error('collectData is only available on iOS and Android.')
  }
  async createPaymentIntent(
    _params: CreatePaymentIntentParams,
  ): Promise<{ intent: PaymentIntent | null }> {
    throw new Error('createPaymentIntent is only available on iOS and Android.')
  }
  async cancelPaymentIntent(): Promise<{ intent: PaymentIntent | null }> {
    throw new Error('cancelPaymentIntent is only available on iOS and Android.')
  }
  async createSetupIntent(
    _params: CreateSetupIntentParams,
  ): Promise<{ intent: SetupIntent | null }> {
    throw new Error('createSetupIntent is only available on iOS and Android.')
  }
  async retrieveSetupIntent(options: {
    clientSecret: string
  }): Promise<{ intent: SetupIntent | null }> {
    this.currentSetupIntentClientSecret = options.clientSecret
    this.currentSetupIntent = null

    // make sure fetch is supported
    const isFetchSupported = 'fetch' in window
    if (!isFetchSupported) {
      return {
        intent: null,
      }
    }

    const setupIntentId = options.clientSecret.split('_secret')[0]

    const stripeUrl = new URL(
      `/v1/setup_intents/${setupIntentId}`,
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

    return { intent: serializeSetupIntent(json) }
  }
  async collectSetupIntentPaymentMethod(
    params?: CollectSetupIntentPaymentMethodParams,
  ): Promise<{ intent: SetupIntent | null }> {
    const sdk = this.ensureInitialized()

    if (!this.currentSetupIntentClientSecret) {
      throw new Error(
        'No `clientSecret` was found. Make sure to run `retrieveSetupIntent` before running this method.',
      )
    }
    if (params?.collectionReason === 'verify') {
      throw new Error(
        "collectionReason: 'verify' is only supported on iOS and Android.",
      )
    }

    const result = this.unwrap(
      await sdk.collectSetupIntentPaymentMethod(
        this.currentSetupIntentClientSecret,
        (params?.allowRedisplay ?? 'unspecified') as NonNullable<
          ICollectConfig['allow_redisplay']
        >,
        {
          enable_customer_cancellation:
            params?.customerCancellation === 'enableIfAvailable'
              ? true
              : params?.customerCancellation === 'disableIfAvailable'
                ? false
                : undefined,
        },
      ),
    )

    this.currentSetupIntent = result.setupIntent

    return { intent: serializeSetupIntent(result.setupIntent) }
  }
  async cancelCollectSetupIntentPaymentMethod(): Promise<void> {
    const sdk = this.ensureInitialized()

    this.unwrap(await sdk.cancelCollectSetupIntentPaymentMethod())
  }
  async confirmSetupIntent(): Promise<{ intent: SetupIntent | null }> {
    const sdk = this.ensureInitialized()

    if (!this.currentSetupIntent) {
      throw new Error(
        'No `setupIntent` was found. Make sure to run `collectSetupIntentPaymentMethod` before running this method.',
      )
    }

    const result = this.unwrap(
      await sdk.confirmSetupIntent(this.currentSetupIntent),
    )

    this.currentSetupIntent = result.setupIntent

    return { intent: serializeSetupIntent(result.setupIntent) }
  }
  async cancelSetupIntent(): Promise<{ intent: SetupIntent | null }> {
    throw new Error('cancelSetupIntent is only available on iOS and Android.')
  }
  async processRefund(
    params: RefundParams,
  ): Promise<{ refund: Refund | null }> {
    const sdk = this.ensureInitialized()

    if (!('chargeId' in params)) {
      throw new Error(
        'Refunding by paymentIntentId is only supported on iOS and Android. Pass chargeId instead.',
      )
    }
    // The JS SDK has no refund options for customer cancellation or metadata.
    if (params.customerCancellation === 'disableIfAvailable') {
      throw new Error(
        "customerCancellation: 'disableIfAvailable' is only supported on iOS and Android.",
      )
    }
    if (params.metadata) {
      throw new Error('Refund metadata is only supported on iOS and Android.')
    }

    // The JS SDK still exposes the collect + process steps separately.
    this.unwrap(
      await sdk.collectRefundPaymentMethod(
        params.chargeId,
        params.amount,
        params.currency,
        {
          refund_application_fee: params.refundApplicationFee,
          reverse_transfer: params.reverseTransfer,
        },
      ),
    )

    const result = this.unwrap(await sdk.processRefund())

    return { refund: serializeRefund(result.refund) }
  }
  async cancelProcessRefund(): Promise<void> {
    const sdk = this.ensureInitialized()

    this.unwrap(await sdk.cancelCollectRefundPaymentMethod())
  }
  async collectInputs(
    params: ICollectInputsParameters,
  ): Promise<{ collectInputResults: ICollectInputsResult[] }> {
    const sdk = this.ensureInitialized()

    // The plugin's input and result shapes match the JS SDK's field for field.
    const results = this.unwrap(
      await sdk.collectInputs(params as unknown as SdkCollectInputsParameters),
    )

    return {
      collectInputResults: results as unknown as ICollectInputsResult[],
    }
  }
  async cancelCollectInputs(): Promise<void> {
    const sdk = this.ensureInitialized()

    this.unwrap(await sdk.cancelCollectInputs())
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

    this.notifyListeners('didDisconnect', { reason: 'disconnectRequested' })
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
        id: paymentIntent.id,
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
    // The JS SDK has no collect-time option to hide the reader's cancel button.
    if (collectConfig?.customerCancellation === 'disableIfAvailable') {
      throw new Error(
        "customerCancellation: 'disableIfAvailable' is only supported on iOS and Android.",
      )
    }

    const result = await sdk.collectPaymentMethod(this.currentClientSecret, {
      config_override: {
        update_payment_intent: collectConfig?.updatePaymentIntent,
        skip_tipping: collectConfig?.skipTipping,
        tipping: {
          eligible_amount: collectConfig?.tipping?.eligibleAmount,
        },
        request_dynamic_currency_conversion:
          collectConfig?.requestDynamicCurrencyConversion,
        allow_redisplay: collectConfig?.allowRedisplay as
          ICollectConfig['allow_redisplay'] | undefined,
      },
    })

    if ((result as CollectPaymentMethodResult).paymentIntent) {
      const res: CollectPaymentMethodResult =
        result as CollectPaymentMethodResult

      this.currentPaymentIntent = res.paymentIntent

      return {
        intent: {
          id: this.currentPaymentIntent.id,
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
          id: res.paymentIntent.id,
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

  private nativeOnly(method: string): never {
    throw new Error(`${method} is only available on iOS and Android.`)
  }

  async getOfflineStatus(): Promise<OfflineStatus> {
    return this.nativeOnly('getOfflineStatus')
  }

  async print(options: { content: PrintContent }): Promise<void> {
    const sdk = this.ensureInitialized()

    let src = options.content
    if (!src.startsWith('data:')) {
      // Raw base64: detect the format from its magic bytes (PNG vs JPEG).
      const mime = src.startsWith('/9j/') ? 'image/jpeg' : 'image/png'
      src = `data:${mime};base64,${src}`
    }

    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () =>
        reject(new Error('The print content is not a valid image.'))
      image.src = src
    })

    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    canvas.getContext('2d')?.drawImage(image, 0, 0)

    this.unwrap(await sdk.print(canvas))
  }

  async selectPaymentOption(_options: {
    paymentOptionType: string
  }): Promise<void> {
    return this.nativeOnly('selectPaymentOption')
  }

  async failPaymentMethodSelection(_options: {
    errorMessage?: string
  }): Promise<void> {
    return this.nativeOnly('failPaymentMethodSelection')
  }

  async confirmQrCodeDisplayed(): Promise<void> {
    return this.nativeOnly('confirmQrCodeDisplayed')
  }

  async failQrCodeDisplay(_options: { errorMessage?: string }): Promise<void> {
    return this.nativeOnly('failQrCodeDisplay')
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

    const locations: Location[] = json.data.map((l: any): Location => ({
      id: l.id,
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
    }))

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

  async supportsReadersOfType(_options: {
    deviceType: DeviceType
    discoveryMethod: DiscoveryMethod
    simulated?: boolean
  }): Promise<{ isSupported: boolean }> {
    // not supported on web
    return { isSupported: false }
  }
}
