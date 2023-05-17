import type { PluginListenerHandle, PermissionState } from '@capacitor/core'
import { Stripe } from 'stripe'

export interface PermissionStatus {
  location: PermissionState
  bluetooth: PermissionState
}

/**
 * @category Terminal
 */
export enum ConnectionStatus {
  /**
   * The SDK is not connected to a reader.
   */
  NotConnected = 0,
  /**
   * The SDK is connected to a reader.
   */
  Connected = 1,
  /**
   * The SDK is currently connecting to a reader.
   */
  Connecting = 2
}

/**
 * The possible payment statuses for the SDK.
 */
export enum PaymentStatus {
  /**
   * The SDK is not ready to start a payment. It may be busy with another command, or a reader may not be connected.
   */
  NotReady = 0,
  /**
   * The SDK is ready to start a payment.
   */
  Ready = 1,
  /**
   * The SDK is waiting for input from the customer (e.g., for a card to be presented to the reader)
   */
  WaitingForInput = 2,
  /**
   * The SDK is processing a payment.
   */
  Processing = 3
}

/**
 * The possible device types for a reader.
 *
 * @category Reader
 * @see https://stripe.com/docs/terminal/readers
 */
export enum DeviceType {
  /**
   * The BBPOS Chipper 2X BT mobile reader.
   *
   * @see https://stripe.com/docs/terminal/readers/bbpos-chipper2xbt
   */
  Chipper2X,

  /**
   * The Verifone P400 countertop reader.
   *
   * @see https://stripe.com/docs/terminal/readers/verifone-p400
   */
  VerifoneP400,

  /**
   * The BBPOS WisePad 3 mobile reader.
   *
   * @see https://stripe.com/docs/terminal/readers/bbpos-wisepad3
   */
  WisePad3,

  /**
   * The Stripe Reader M2 mobile reader.
   *
   * @see https://stripe.com/docs/terminal/readers/stripe-m2
   */
  StripeM2,

  /**
   * The BBPOS WisePOS E countertop reader.
   *
   * @see https://stripe.com/docs/terminal/readers/bbpos-wisepos-e
   */
  WisePosE,

  /**
   * The BBPOS WisePOS E DevKit countertop reader.
   *
   * @see https://stripe.com/docs/terminal/readers/bbpos-wisepos-e
   */
  WisePosEDevKit,

  Unknown,

  /**
   * The Stripe S7 countertop reader.
   */
  StripeS700 = 9,

  /**
   * Apple Built-In reader.
   */
  AppleBuiltIn = 11
}

/**
 * The possible methods for discovering a reader.
 *
 * @category Reader
 * @see https://stripe.com/docs/terminal/readers/connecting
 */
export enum DiscoveryMethod {
  /**
   * When discovering a reader using this method, the `discoverReaders` Observable will be called multiple times as the Bluetooth scan proceeds.
   */
  BluetoothScan,

  /**
   * If your app will be used in a busy environment with multiple iOS devices pairing to multiple available readers at the same time, we recommend using this discovery method.
   *
   * After a reader has been discovered using this method, the LEDs located above the reader's power button will start flashing multiple colors. After discovering the reader, your app should prompt the user to confirm that the reader is flashing, and require a user action (e.g. tapping a button) to connect to the reader.
   *
   * When discovering a reader using this method, the `discoverReaders` Observable will be called twice. It will be called for the first time when the reader is initially discovered. The reader's LEDs will begin flashing. After a short delay, `discoverReaders` will be called a second time with an updated reader object, populated with additional info about the device, like its battery level.
   *
   * _The Bluetooth Proximity discovery method can only discovery Chipper 2X BT readers._
   */
  BluetoothProximity,

  /**
   * The Internet discovery method searches for internet-connected readers, such as the Verifone P400 or the BBPOS WisePOS E.
   *
   * When discovering a reader with this method, the `discoverReaders` Observable will only be called once with a list of readers from `/v1/terminal/readers`. Note that this will include readers that are both online and offline.
   *
   * Because the discovery process continues if connecting to a discovered reader fails, the SDK will refresh the list of `Readers` and call your subscriber with the results.
   *
   * @see https://stripe.com/docs/api/terminal/readers/list
   */
  Internet,

  /**
   * Use both BluetoothScan and Internet discovery methods
   *
   * This mode is custom to the `capacitor-stripe-terminal` plugin and uses the native SDK for the BluetoothScan method while simultaneously using the JS SDK for the Internet method.
   */
  Both,

  /**
   * The USB discovery method allows the user to use the device's usb input(s) to interact with Stripe Terminal's usb-capable readers.
   */
  USB,

  /**
   * The Embedded discovery method allows the user to collect payments using the reader upon which the Application is currently running.
   */
  Embedded,

  /**
   * The Handoff discovery method is only supported when running directly on a reader. It allows the user to delegate the collecting of payments to a separate application that is responsible for collecting payments.
   */
  Handoff,

  /**
   * The LocalMobile discovery method allows the user to use the phone's or tablet's NFC reader as a payment terminal for NFC (tap) payments only.
   */
  LocalMobile
}

/**
 * The possible networking statuses of a reader.
 *
 * @category Reader
 * @see https://stripe.com/docs/api/terminal/readers/object
 */
export enum ReaderNetworkStatus {
  /**
   * The reader is offline. Note that Chipper 2x and WisePad 3 will always report `offline`.
   */
  Offline,
  /**
   * The reader is online.
   */
  Online
}

/**
 * A categorization of a reader’s battery charge level.
 *
 * @category Reader
 */
export enum BatteryStatus {
  /**
   * Battery state is not yet known or not available for the connected reader.
   */
  Unknown,
  /**
   * The device’s battery is less than or equal to 5%.
   */
  Critical,
  /**
   * The device’s battery is between 5% and 20%.
   */
  Low,
  /**
   * The device’s battery is greater than 20%.
   */
  Nominal
}

/**
 * Represents the possible states of the location object for a discovered reader.
 *
 * @category Reader Discovery & Connection
 * @see https://stripe.com/docs/api/terminal/readers/object
 */
export enum LocationStatus {
  /**
   * The location is not known. `location` will be null.
   *
   * A reader will only have a location status of `unknown` when a Bluetooth reader's full location information failed to fetch properly during discovery.
   */
  Unknown,
  /**
   * The location was successfully set to a known location. `location` is a valid `Location`.
   */
  Set,
  /**
   * This location is known to be not set. `location` will be null.
   */
  NotSet
}

export interface StripeTerminalConfig {
  /**
   * An event handler that [fetches a connection token](https://stripe.com/docs/terminal/sdk/js#connection-token) from your backend.
   */
  fetchConnectionToken: () => Promise<string>

  /**
   * An event handler called [when a reader disconnects](https://stripe.com/docs/terminal/readers/connecting/verifone-p400#handling-disconnects) from your app.
   */
  onUnexpectedReaderDisconnect: () => void
}

/**
 * @category Reader
 */
export interface DiscoveryConfiguration {
  /**
   * Whether to use simulated discovery to discover a device simulator.
   *
   * The Terminal SDK comes with the ability to simulate behavior without using physical hardware. This makes it easy to quickly test your integration end-to-end, from pairing with a reader to taking payments.
   *
   * @default true
   */
  simulated?: boolean

  /**
   * The method by which to discover readers.
   *
   * @default DiscoveryMethod.BluetoothScan
   */
  discoveryMethod?: DiscoveryMethod

  /**
   * A location ID that can be used to filter discovery result so only readers registered to that location are returned. Filtering discovery by a location is only applicable to Internet readers; this parameter must be null when discovering Bluetooth readers.
   */
  locationId?: string
}
/**
 * @category Reader
 */
export interface ConnectionConfiguration {
  /**
   * The ID of the [Location](https://stripe.com/docs/api/terminal/locations) which the reader should be registered to during connection.
   *
   * If the provided ID matches the location the reader is already registered to, the location will not be changed.
   *
   * When connecting to a simulated reader, pass in the reader's pre-existing mock location. You can find the mock location ID on the reader object, on the `locationId` property.
   *
   * @see https://stripe.com/docs/terminal/readers/fleet-management#bbpos-wisepad3-discovery
   */
  locationId: string
}

/**
 * @category Reader
 */
export interface BluetoothConnectionConfiguration
  extends ConnectionConfiguration {
  /**
   * When set to true, the Terminal SDK will attempt a Bluetooth auto-reconnection on any unexpected disconnect.
   *
   * When set to false, we will immediately surface any disconnection through TerminalDelegate.
   *
   * @default false
   */
  autoReconnectOnUnexpectedDisconnect?: boolean
}

/**
 * @category Reader
 */
export interface UsbConnectionConfiguration extends ConnectionConfiguration {}

/**
 * @category Reader
 */
export interface HandoffConnectionConfiguration
  extends ConnectionConfiguration {}

/**
 * @category Reader
 */
export interface LocalMobileConnectionConfiguration
  extends ConnectionConfiguration {
  /**
   * If your integration is creating destination charges and using `on_behalf_of`, you must provide the `connected_account_id` in the `onBehalfOf` parameter as part of the `LocalMobileConnectionConfiguration`. Unlike other reader types which require this information on a per-transaction basis, the Apple Built-In reader requires this on a per-connection basis as well in order to establish a reader connection.
   *
   * @see https://stripe.com/docs/terminal/features/connect#destination-payment-intents
   */
  onBehalfOf?: string

  /**
   * Optional cardholder facing merchant display name that will be used in the prompt for the cardholder to present their card. If this value is not provided, the merchant display name will be taken from the Terminal `Location.display_name` associated with the connection.
   */
  merchantDisplayName?: string

  /**
   * In order to connect to a reader, merchant-specific terms of service may need to be accepted. Presenting the flow requires iCloud sign-in and an authorized individual. This attribute determines how the connection process should proceed if this situation is encountered.
   * - If YES, the terms the terms of service should be presented during connection. If accepted successfully, the connection process will resume. If not accepted successfully, the connection will fail with an error.
   * - If NO, the terms of service will not be presented and the connection will fail with an error.
   *
   * @default false
   */
  tosAcceptancePermitted?: boolean
}

/**
 * @category Reader
 */
export interface InternetConnectionConfiguration
  extends ConnectionConfiguration {
  /**
   * When set to true, the connection will automatically error if the reader is already connected to a device and collecting payment. When set to false, this will allow you to connect to a reader already connected to another device, and will break the existing reader-to-SDK connection on the other device when it attempts to collect payment.
   *
   * @default false
   */
  failIfInUse?: boolean

  /**
   * If set to true, the customer will be able to press the red X button on the Verifone P400 to cancel a `collectPaymentMethod`, `collectReusableCard`, or `collectRefundPaymentMethod` command.
   *
   * @note This behavior is part of a private beta. Setting this property will have no effect if you are not part of the allowCustomerCancel beta program.
   *
   * @default false
   */
  allowCustomerCancel?: boolean
}

/**
 * @category Reader
 */
export interface Reader {
  /**
   * The reader's device type.
   */
  deviceType: DeviceType

  /**
   * True if this is a simulated reader.
   *
   * `DiscoveryConfiguration` objects with `simulated = true` produce simulated Readers.
   */
  simulated: boolean

  /**
   * The Stripe unique identifier for the reader.
   */
  stripeId: string | null

  /**
   * The ID of the reader’s [Location](https://stripe.com/docs/api/terminal/locations/object).
   *
   * Internet readers remain registered to the location specified when registering the reader to your account. For internet readers, this field represents that location. If you need to change your internet reader's location, re-register the reader and specify the new location id in the `location` param. See https://stripe.com/docs/api/terminal/readers/create
   *
   * Bluetooth readers are designed to be more mobile and must be registered to a location upon each connection. For Bluetooth readers, this field represents the last location that the reader was registered to. If the reader has not been used before, this field will be nil. If you associate the reader to a different location while calling `connectBluetoothReader`, this field will update to that new location's ID.
   *
   * @see https://stripe.com/docs/api/terminal/locations
   */
  locationId: string | null

  /**
   * Used to tell whether the `location` field has been set. Note that the Verifone P400 and simulated readers will always have an `unknown` `locationStatus`. (Chipper 2X BT and WisePad 3 only.)
   */
  locationStatus: LocationStatus

  /**
   * The reader's serial number.
   */
  serialNumber: string

  /**
   * The reader's current device software version, or `null` if this information is unavailable.
   */
  deviceSoftwareVersion: string | null

  /**
   * True if there is an available update.
   */
  isAvailableUpdate?: boolean

  /**
   * The reader's battery level, represented as a boxed float in the range `[0, 1]`. If the reader does not have a battery, or the battery level is unknown, this value is `null`. (Bluetooth readers only.)
   */
  batteryLevel: number | null

  /**
   * The reader's battery status. Usable as a general classification for the current battery state.
   */
  batteryStatus: BatteryStatus

  /**
   * The reader's charging state, represented as a `boolean`. If the reader does not have a battery, or the battery level is unknown, this value is `null`. (Bluetooth readers only.)
   */
  isCharging: boolean | null

  /**
   * The IP address of the reader. (Internet reader only.)
   */
  ipAddress: string | null

  /**
   * The networking status of the reader: either `offline` or `online`. Note that the Chipper 2X and the WisePad 3's statuses will always be `offline`. (Verifone P400 only.)
   */
  status: ReaderNetworkStatus

  /**
   * A custom label that may be given to a reader for easier identification. (Verifone P400 only.)
   */
  label: string | null

  /**
   * Has the value true if the object exists in live mode or the value false if the object exists in test mode.
   */
  livemode?: boolean
}

/**
 * @category Reader Updates
 */
export interface ReaderSoftwareUpdate {
  /**
   * The estimated amount of time for the update.
   */
  estimatedUpdateTime: string

  /**
   * The target version for the update.
   */
  deviceSoftwareVersion: string
}

/**
 * The display messages that a reader may request be displayed by your app.
 *
 * @category Reader
 * @see https://stripe.dev/stripe-terminal-ios/docs/Enums/SCPReaderDisplayMessage
 */
export enum ReaderDisplayMessage {
  /**
   * Retry the presented card.
   */
  RetryCard,

  /**
   * Insert the presented card.
   */
  InsertCard,

  /**
   * Insert or swipe the presented card.
   */
  InsertOrSwipeCard,

  /**
   * Swipe the presented card.
   */
  SwipeCard,

  /**
   * Remove the presented card.
   */
  RemoveCard,

  /**
   * The reader detected multiple contactless cards. Make sure only one contactless card or NFC device is near the reader.
   */
  MultipleContactlessCardsDetected,

  /**
   * The card could not be read. Try another read method on the same card, or use a different card.
   */
  TryAnotherReadMethod,

  /**
   * The card is invalid. Try another card.
   */
  TryAnotherCard
}

/**
 * This represents all of the input methods available to your user when the reader begins waiting for input.
 *
 * @category Reader
 * @see https://stripe.dev/stripe-terminal-ios/docs/Enums/SCPReaderInputOptions
 */
export enum ReaderInputOptions {
  /**
   * No input options are available on the reader.
   */
  None = 0,

  /**
   * Swipe a magstripe card.
   */
  SwipeCard = 1 << 0,

  /**
   * Insert a chip card.
   */
  InsertCard = 1 << 1,

  /**
   * Tap a contactless card.
   */
  TapCard = 1 << 2
}

/**
 * The possible statuses for a PaymentIntent.
 *
 * @category Payment
 * @see https://stripe.com/docs/api/payment_intents/object#payment_intent_object-status
 */
export enum PaymentIntentStatus {
  /**
   * Next step: collect a payment method by calling `collectPaymentMethod`.
   */
  RequiresPaymentMethod,

  /**
   * Next step: process the payment by calling `processPayment`.
   */
  RequiresConfirmation,

  /**
   * Next step: capture the PaymentIntent on your backend via the Stripe API.
   */
  RequiresCapture,

  /**
   * The PaymentIntent is in the middle of full EMV processing.
   */
  Processing,

  /**
   * The PaymentIntent was canceled.
   */
  Canceled,

  /**
   * The PaymentIntent succeeded.
   */
  Succeeded
}

/**
 * A PaymentIntent tracks the process of collecting a payment from your customer. We recommend that you create exactly one PaymentIntent for each order or customer session in your system. You can reference the PaymentIntent later to see the history of payment attempts for a particular session.
 *
 * A PaymentIntent transitions through multiple statuses throughout its lifetime and ultimately creates at most one successful charge.
 *
 * @category Payment
 * @see https://stripe.com/docs/api/payment_intents
 */
export interface PaymentIntent {
  /**
   * The unique identifier for the intent.
   */
  stripeId: string
  /**
   * When the intent was created.
   */
  created: number
  /**
   * The status of the PaymentIntent.
   */
  status: PaymentIntentStatus
  /**
   * The amount to be collected by this PaymentIntent, provided in the currency’s smallest unit.
   *
   * @see https://stripe.com/docs/currencies#zero-decimal
   */
  amount: number

  /**
   * The currency of the payment.
   */
  currency: string

  /**
   * Set of key-value pairs attached to the object.
   *
   * @see https://stripe.com/docs/api#metadata
   */
  metadata: { [key: string]: string }

  /**
   * Charges that were created by this `PaymentIntent`, if any.
   */
  charges: Stripe.Charge[]

  /**
   * The payment method to be used in this `PaymentIntent`. Only valid in the intent returned during `collectPaymentMethod` when using the `updatePaymentIntent` option in the `CollectConfig`.
   */
  paymentMethod: Stripe.PaymentMethod | string | null

  /**
   * Details about items included in the amount after confirmation.
   */
  amountDetails?: Stripe.PaymentIntent.AmountDetails

  /**
   * Indicates how much the user intends to tip in addition to the amount by at confirmation time. This is only non-null in the `PaymentIntent` instance returned during collect when using `updatePaymentIntent` set to true in the `CollectConfig`.
   *
   * After `processPaymentIntent` the amount will have this tip `amount` added to it and the `amountDetails` will contain the breakdown of how much of the `amount` was a tip.
   */
  amountTip?: number

  /**
   * Extra information about a PaymentIntent. This will appear on your customer’s statement when this PaymentIntent succeeds in creating a charge.
   */
  statementDescriptor?: string

  /**
   * Extra dynamic information about a PaymentIntent. This will appear concatenated with the statementDescriptor on your customer’s statement when this PaymentIntent succeeds in creating a charge.
   */
  statementDescriptorSuffix?: string
}

/**
 * An `Cart` object contains information about what line items are included in the current transaction. A cart object should be created and then passed into `setReaderDisplay()`, which will display the cart's contents on the reader's screen.
 *
 * The `Cart` only represents exactly what will be shown on the screen, and is not reflective of what the customer is actually charged. You are responsible for making sure that tax and total reflect what is in the cart.
 *
 * _Only Internet readers support `setReaderDisplay` functionality_
 *
 * @see https://stripe.com/docs/terminal/checkout/cart-display
 */

export interface Cart {
  /**
   * You can add or remove line items from this array individually or reassign the array entirely. After making your desired changes, call setReaderDisplay to update the cart on the reader's screen.
   */
  lineItems: CartLineItem[]
  /**
   * The displayed tax amount, provided in the currency’s smallest unit.
   *
   * @see https://stripe.com/docs/currencies#zero-decimal
   */
  tax: number
  /**
   * The cart’s total balance, provided in the currency’s smallest unit.
   *
   * @see https://stripe.com/docs/currencies#zero-decimal
   */
  total: number
  /**
   * The currency of the cart.
   */
  currency: string
}

/**
 * Represents a single line item in an `Cart`, displayed on the reader's screen during checkout.
 */
export interface CartLineItem {
  /**
   * The quantity of the line item being purchased.
   */
  quantity: number
  /**
   * The description or name of the item.
   */
  displayName: string
  /**
   * The price of the item, provided in the cart's currency's smallest unit.
   *
   * @see https://stripe.com/docs/currencies#zero-decimal
   */
  amount: number
}

/**
 * Holds address data associated with a given `Location`.
 *
 * @see https://stripe.com/docs/api/terminal/locations/object#terminal_location_object-address
 */
export interface Address {
  /**
   * The city name
   */
  city?: string
  /**
   * The country code
   */
  country?: string
  /**
   * The first line of the address
   */
  line1?: string
  /**
   * The second line of the address
   */
  line2?: string
  /**
   * The postal code of the address
   */
  postalCode?: string
  /**
   * The state of the address
   */
  state?: string
}

/**
 * A Location is used to group readers in the Stripe Terminal ecosystem. The Location to which a reader is registered can control regional behavior for that particular reader.
 *
 * You cannot create locations through the SDK. Instead, use the Stripe API from your backend to manage your account’s locations.
 *
 * To fetch the Location objects associated with your account, call `listLocations()`.
 *
 * @see https://stripe.com/docs/api/terminal/locations
 */
export interface Location {
  /**
   * The ID of the Location
   */
  stripeId: string
  /**
   * The address of this Location
   */
  address?: Address
  /**
   * The display name of this Location
   */
  displayName?: string
  /**
   * Whether this Location was created in livemode
   */
  livemode: boolean
}

/**
 * Parameters to be used when calling `listLocations()` to list the Location objects associated with an account.
 *
 * @see https://stripe.com/docs/terminal/readers/connecting
 */
export interface ListLocationsParameters {
  /**
   * A limit on the number of objects to be returned. Limit can range between 1 and 100, and the default is 10.
   *
   * @default 10
   * @see https://stripe.com/docs/api/terminal/locations/list#list_terminal_locations-limit
   */
  limit?: number
  /**
   * A cursor for use in pagination. `ending_before` is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, starting with `obj_bar`, your subsequent call can include `ending_before=obj_bar` in order to fetch the previous page of the list.
   *
   * @see https://stripe.com/docs/api/terminal/locations/list#list_terminal_locations-ending_before
   */
  endingBefore?: string
  /**
   * A cursor for use in pagination. `starting_after` is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, ending with `obj_foo`, your subsequent call can include `starting_after=obj_foo` in order to fetch the next page of the list.
   *
   * @see https://stripe.com/docs/api/terminal/locations/list#list_terminal_locations-starting_after
   */
  startingAfter?: string
}

/**
 * Simulator specific configurations you can set to test your integration's behavior in different scenarios. We recommend changing these properties during testing to ensure your app works as expected for different reader updates and for different presented cards.
 */
export interface SimulatorConfiguration {
  availableReaderUpdate?: SimulateReaderUpdate
  simulatedCard?: SimulatedCardType
  simulatedTipAmount?: number
}

/**
 * Enum used to simulate various types of cards and error cases.
 * @see https://stripe.com/docs/terminal/testing#simulated-test-cards
 */
export enum SimulatedCardType {
  Visa,
  VisaDebit,
  Mastercard,
  MasterDebit,
  MastercardPrepaid,
  Amex,
  Amex2,
  Discover,
  Discover2,
  Diners,
  Diners14Digit,
  Jcb,
  UnionPay,
  Interac,
  ChargeDeclined,
  ChargeDeclinedInsufficientFunds,
  ChargeDeclinedLostCard,
  ChargeDeclinedStolenCard,
  ChargeDeclinedExpiredCard,
  ChargeDeclinedProcessingError,
  RefundFailed
}

export enum SimulateReaderUpdate {
  // Default: An update is available that is marked as needing to be installed within 7 days
  Available,
  // No updates are available
  None,
  // A required full reader software update exists. Use this to simulate the auto-install of a required update that will be applied during connect. This simulated update will take 1 minute and progress will be provided.
  Required,
  // A required update exists. When the SDK connects to the reader, the connection will fail because the reader's battery is too low for the update to begin.
  LowBattery,
  // Randomly picks a type of update for the reader to help exercise the various states.
  Random
}

export enum DeviceStyle {
  Internet,
  Bluetooth,
  Local
}

export interface TippingConfig {
  // Calculate percentage-based tips based on this amount.
  // For more information, see the official Stripe docs: [On Reader Tipping](https://stripe.com/docs/terminal/features/collecting-tips/on-reader)
  eligibleAmount?: number | null
}

export interface CollectConfig {
  /**
   * Bypass tipping selection if it would have otherwise been shown.
   *
   * @default false
   */
  skipTipping?: boolean

  /**
   * The tipping configuration for this payment collection.
   *
   * @see https://stripe.com/docs/terminal/features/collecting-tips/on-reader#tip-eligible
   */
  tipping?: TippingConfig | null

  /**
   * Whether or not to update the PaymentIntent server side during collectPaymentMethod.
   *
   * @default false
   */
  updatePaymentIntent?: boolean
}

/**
 * @ignore
 */
export interface StripeTerminalInterface {
  setConnectionToken(
    options: {
      token?: string
    } | null,
    errorMessage?: string
  ): Promise<void>

  initialize(): Promise<void>

  discoverReaders(options: DiscoveryConfiguration): Promise<void>

  cancelDiscoverReaders(): Promise<void>

  connectBluetoothReader(options: {
    serialNumber: string
    locationId: string
    autoReconnectOnUnexpectedDisconnect?: boolean
  }): Promise<{ reader: Reader | null }>

  connectInternetReader(options: {
    serialNumber: string
    ipAddress?: string
    stripeId?: string
    failIfInUse?: boolean
  }): Promise<{ reader: Reader | null }>

  connectUsbReader(options: {
    serialNumber: string
    locationId: string
  }): Promise<{ reader: Reader | null }>

  connectLocalMobileReader(options: {
    serialNumber: string
    locationId: string
    onBehalfOf?: string
    merchantDisplayName?: string
    tosAcceptancePermitted?: boolean
  }): Promise<{ reader: Reader | null }>

  connectHandoffReader(options: {
    serialNumber: string
    locationId: string
  }): Promise<{ reader: Reader | null }>

  getConnectedReader(): Promise<{ reader: Reader | null }>

  getConnectionStatus(): Promise<{
    status: ConnectionStatus
    isAndroid?: boolean
  }>

  getPaymentStatus(): Promise<{ status: PaymentStatus }>

  disconnectReader(): Promise<void>

  installAvailableUpdate(): Promise<void>

  cancelInstallUpdate(): Promise<void>

  retrievePaymentIntent(options: {
    clientSecret: string
  }): Promise<{ intent: PaymentIntent | null }>

  collectPaymentMethod(configOverride?: CollectConfig): Promise<{
    intent: PaymentIntent
  }>

  cancelCollectPaymentMethod(): Promise<void>

  processPayment(): Promise<{ intent: PaymentIntent }>

  clearCachedCredentials(): Promise<void>

  setReaderDisplay(cart: Cart): Promise<void>

  clearReaderDisplay(): Promise<void>

  listLocations(
    parameters?: ListLocationsParameters
  ): Promise<{ locations?: Location[]; hasMore?: boolean }>

  getSimulatorConfiguration(): Promise<SimulatorConfiguration>

  setSimulatorConfiguration(
    config: SimulatorConfiguration
  ): Promise<SimulatorConfiguration>

  cancelAutoReconnect(): Promise<void>

  /**
   * @deprecated use requestPermissions and checkPermissions
   */
  getPermissions(): Promise<PermissionStatus>

  checkPermissions(): Promise<PermissionStatus>
  requestPermissions(): Promise<PermissionStatus>

  tapToPaySupported(): Promise<boolean>

  addListener(
    eventName: 'requestConnectionToken',
    listenerFunc: () => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle

  addListener(
    eventName: 'didReportUnexpectedReaderDisconnect',
    listenerFunc: () => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle

  addListener(
    eventName: 'readersDiscovered',
    listenerFunc: (event: { readers?: Reader[] }) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle

  addListener(
    eventName: 'didChangeConnectionStatus',
    listenerFunc: (status: any) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle

  addListener(
    eventName: 'didReportReaderSoftwareUpdateProgress',
    listenerFunc: (data: any) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle

  addListener(
    eventName: 'didRequestReaderDisplayMessage' | 'didRequestReaderInput',
    listenerFunc: (data: any) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle

  addListener(
    eventName: 'didReportAvailableUpdate' | 'didStartInstallingUpdate',
    listenerFunc: (data: any) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle

  addListener(
    eventName: 'didFinishInstallingUpdate',
    listenerFunc: (data: {
      update?: ReaderSoftwareUpdate
      error?: string
    }) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle

  addListener(
    eventName:
      | 'didStartReaderReconnect'
      | 'didSucceedReaderReconnect'
      | 'didFailReaderReconnect',
    listenerFunc: (data: null) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle

  addListener(
    eventName: string,
    listenerFunc: Function
  ): Promise<PluginListenerHandle> & PluginListenerHandle

  addListener(
    eventName: 'didCancelDiscoverReaders',
    listenerFunc: (data: null) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle
}
