import Capacitor
import Foundation
import StripeTerminal

/**
 * Please read the Capacitor iOS Plugin Development Guide
 * here: https://capacitor.ionicframework.com/docs/plugins/ios
 */
@objc(StripeTerminal)
public class StripeTerminal: CAPPlugin, ConnectionTokenProvider, DiscoveryDelegate, TerminalDelegate, MobileReaderDelegate, TapToPayReaderDelegate, InternetReaderDelegate {
    private var pendingConnectionTokenCompletionBlock: ConnectionTokenCompletionBlock?
    private var pendingDiscoverReaders: Cancelable?
    private var pendingInstallUpdate: Cancelable?
    private var pendingCollectPaymentMethod: Cancelable?
    private var pendingReaderAutoReconnect: Cancelable?
    private var currentUpdate: ReaderSoftwareUpdate?
    private var currentPaymentIntent: PaymentIntent?
    private var cancelDiscoverReadersCall: CAPPluginCall?
    private var isInitialized: Bool = false
    private var thread = DispatchQueue.init(label: "CapacitorStripeTerminal")

    private var readers: [Reader]?

    func logMsg(items: Any...) {
        print("SWIFT \(items)")
    }

    func onLogEntry(logline _: String) {
        // self.notifyListeners("log", data: ["logline": logline])
    }

    @objc func getPermissions(_ call: CAPPluginCall) {
        requestPermissions(call)
    }

    @objc override public func checkPermissions(_ call: CAPPluginCall) {
        call.unimplemented("Permissions are handled automatically on iOS.")
    }

    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        call.unimplemented("Permissions are handled automatically on iOS.")
    }

    @objc func initialize(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if !self.isInitialized {
                // In Stripe Terminal SDK v5, Terminal.setTokenProvider is replaced with Terminal.initWithTokenProvider
                // This must be called before accessing Terminal.shared
                Terminal.initWithTokenProvider(self)
                Terminal.shared.delegate = self

                Terminal.setLogListener { logline in
                    self.onLogEntry(logline: logline)
                }
                // Terminal.shared.logLevel = LogLevel.verbose;

                self.cancelDiscoverReaders()
                self.cancelInstallUpdate()
                self.isInitialized = true
            }
            call.resolve()
        }
    }

    @objc func setConnectionToken(_ call: CAPPluginCall) {
        let token = call.getString("token") ?? ""
        let errorMessage = call.getString("errorMessage") ?? ""

        if let completion = pendingConnectionTokenCompletionBlock {
            if !errorMessage.isEmpty {
                let error = NSError(domain: "io.event1.capacitor-stripe-terminal",
                                    code: 1,
                                    userInfo: [NSLocalizedDescriptionKey: errorMessage])
                completion(nil, error)
            } else {
                completion(token, nil)
            }

            pendingConnectionTokenCompletionBlock = nil
            call.resolve()
        }
    }

    public func fetchConnectionToken(_ completion: @escaping ConnectionTokenCompletionBlock) {
        pendingConnectionTokenCompletionBlock = completion
        notifyListeners("requestConnectionToken", data: [:])
    }

    @objc func discoverReaders(_ call: CAPPluginCall) {
        // Attempt to cancel any pending discoverReader calls first.
        cancelDiscoverReaders()

        let simulated = call.getBool("simulated") ?? true
        let method = UInt(call.getInt("discoveryMethod") ?? 0)
        let locationId = call.getString("locationId") ?? nil

        let config: DiscoveryConfiguration
        do {
            switch method {
            case 0: // BluetoothScan
                config = try BluetoothScanDiscoveryConfigurationBuilder().setSimulated(simulated).build()
            case 1: // BluetoothProximity
                config = try BluetoothProximityDiscoveryConfigurationBuilder().setSimulated(simulated).build()
            case 2: // Internet
                let builder = InternetDiscoveryConfigurationBuilder().setSimulated(simulated)
                if let locationId = locationId { _ = builder.setLocationId(locationId) }
                config = try builder.build()
            case 6: // TapToPay
                config = try TapToPayDiscoveryConfigurationBuilder().setSimulated(simulated).build()
            default:
                config = try BluetoothScanDiscoveryConfigurationBuilder().setSimulated(simulated).build()
            }
        } catch {
            call.reject("Failed to build discovery configuration: \(error.localizedDescription)", nil, error)
            return
        }
        
        guard pendingDiscoverReaders == nil else {
            call.reject("discoverReaders is busy")
            return
        }
                
        self.pendingDiscoverReaders = Terminal.shared.discoverReaders(config, delegate: self) { error in
            if let error = error {
                call.reject(error.localizedDescription, nil, error)
                self.pendingDiscoverReaders = nil
            } else {
                call.resolve()
                self.pendingDiscoverReaders = nil

                // if cancelDiscoverReadersCall exists, resolve it since the discovery is complete now
                self.cancelDiscoverReadersCall?.resolve()
                self.cancelDiscoverReadersCall = nil
            }
        }
    }

    @objc func cancelDiscoverReaders(_ call: CAPPluginCall? = nil) {
        guard let cancelable = pendingDiscoverReaders else {
            call?.resolve()
            return
        }
        
        cancelable.cancel() { error in
            if let error = error as NSError? {
                call?.reject(error.localizedDescription, nil, error)
                self.pendingDiscoverReaders = nil
            } else {
                // do not call resolve, let discoverReaders call it when it is actually complete
                self.cancelDiscoverReadersCall = call
            }
        }
        
    }

    @objc func connectBluetoothReader(_ call: CAPPluginCall) {
        guard let serialNumber = call.getString("serialNumber") else {
            call.reject("Must provide a serial number")
            return
        }

        guard let locationId = call.getString("locationId") else {
            call.reject("Must provide a location ID")
            return
        }

        guard let reader = readers?.first(where: { $0.serialNumber == serialNumber }) else {
            call.reject("No reader found")
            return
        }

        let autoReconnectOnUnexpectedDisconnect = call.getBool("autoReconnectOnUnexpectedDisconnect", false)

        let connectionConfig: BluetoothConnectionConfiguration
        do {
            connectionConfig = try BluetoothConnectionConfigurationBuilder(delegate: self, locationId: locationId)
                .setAutoReconnectOnUnexpectedDisconnect(autoReconnectOnUnexpectedDisconnect)
                .build()
        } catch {
            call.reject("Failed to build connection configuration: \(error.localizedDescription)", nil, error)
            return
        }

        // this must be run on the main thread
        // https://stackoverflow.com/questions/44767778/main-thread-checker-ui-api-called-on-a-background-thread-uiapplication-appli
        DispatchQueue.main.async {
            Terminal.shared.connectReader(reader, connectionConfig: connectionConfig, completion: { reader, error in
                if let reader = reader {
                    call.resolve([
                        "reader": StripeTerminalUtils.serializeReader(reader: reader),
                    ])
                } else if let error = error {
                    call.reject(error.localizedDescription, nil, error)
                }
            })
        }
    }

    @objc func connectInternetReader(_ call: CAPPluginCall) {
        guard let serialNumber = call.getString("serialNumber") else {
            call.reject("Must provide a serial number")
            return
        }

        guard let reader = readers?.first(where: { $0.serialNumber == serialNumber }) else {
            call.reject("No reader found")
            return
        }

        let failIfInUse = call.getBool("failIfInUse") ?? false
        let allowCustomerCancel = call.getBool("allowCustomerCancel") ?? false

        let connectionConfig: InternetConnectionConfiguration
        do {
            connectionConfig = try InternetConnectionConfigurationBuilder(delegate: self)
                .setFailIfInUse(failIfInUse)
                .setAllowCustomerCancel(allowCustomerCancel)
                .build()
        } catch {
            call.reject("Failed to build connection configuration: \(error.localizedDescription)", nil, error)
            return
        }

        // this must be run on the main thread
        // https://stackoverflow.com/questions/44767778/main-thread-checker-ui-api-called-on-a-background-thread-uiapplication-appli
        DispatchQueue.main.async {
            Terminal.shared.connectReader(reader, connectionConfig: connectionConfig, completion: { reader, error in
                if let reader = reader {
                    call.resolve([
                        "reader": StripeTerminalUtils.serializeReader(reader: reader),
                    ])
                } else if let error = error {
                    call.reject(error.localizedDescription, nil, error)
                }
            })
        }
    }

    @objc func connectTapToPayReader(_ call: CAPPluginCall) {
        guard let serialNumber = call.getString("serialNumber") else {
            call.reject("Must provide a serial number")
            return
        }

        guard let locationId = call.getString("locationId") else {
            call.reject("Must provide a location ID")
            return
        }

        guard let reader = readers?.first(where: { $0.serialNumber == serialNumber }) else {
            call.reject("No reader found")
            return
        }
        
        let onBehalfOf = call.getString("onBehalfOf")
        let merchantDisplayName = call.getString("merchantDisplayName")
        let tosAcceptancePermitted = call.getBool("tosAcceptancePermitted", false)

        let connectionConfig: TapToPayConnectionConfiguration
        do {
            let builder = TapToPayConnectionConfigurationBuilder(delegate: self, locationId: locationId)
            if let onBehalfOf = onBehalfOf { _ = builder.setOnBehalfOf(onBehalfOf) }
            if let merchantDisplayName = merchantDisplayName { _ = builder.setMerchantDisplayName(merchantDisplayName) }
            _ = builder.setTosAcceptancePermitted(tosAcceptancePermitted)
            connectionConfig = try builder.build()
        } catch {
            call.reject("Failed to build connection configuration: \(error.localizedDescription)", nil, error)
            return
        }

        // this must be run on the main thread
        // https://stackoverflow.com/questions/44767778/main-thread-checker-ui-api-called-on-a-background-thread-uiapplication-appli
        DispatchQueue.main.async {
            Terminal.shared.connectReader(reader, connectionConfig: connectionConfig, completion: { reader, error in
                if let reader = reader {
                    call.resolve([
                        "reader": StripeTerminalUtils.serializeReader(reader: reader),
                    ])
                } else if let error = error {
                    call.reject(error.localizedDescription, nil, error)
                }
            })
        }
    }

    @objc func disconnectReader(_ call: CAPPluginCall) {
        if Terminal.shared.connectedReader == nil {
            call.resolve()
            return
        }

        let semaphore = DispatchSemaphore(value: 0)
        DispatchQueue.main.async {
            Terminal.shared.disconnectReader { error in
                if let error = error {
                    call.reject(error.localizedDescription, nil, error)
                } else {
                    call.resolve()
                }
                semaphore.signal()
            }
        }
        _ = semaphore.wait(timeout: .now() + 10)
    }

    @objc func installAvailableUpdate(_ call: CAPPluginCall) {
        if currentUpdate != nil {
            Terminal.shared.installAvailableUpdate()
            call.resolve()
        }
    }

    @objc func cancelInstallUpdate(_ call: CAPPluginCall? = nil) {
        if let cancelable = pendingInstallUpdate {
            cancelable.cancel { error in
                if let error = error {
                    call?.reject(error.localizedDescription, nil, error)
                } else {
                    self.pendingInstallUpdate = nil
                    call?.resolve()
                }
            }

            return
        }

        call?.resolve()
    }

    @objc func getConnectionStatus(_ call: CAPPluginCall) {
        call.resolve(["status": Terminal.shared.connectionStatus.rawValue])
    }

    @objc func getPaymentStatus(_ call: CAPPluginCall) {
        call.resolve(["status": Terminal.shared.paymentStatus.rawValue])
    }

    @objc func getConnectedReader(_ call: CAPPluginCall) {
        if let reader = Terminal.shared.connectedReader {
            let reader = StripeTerminalUtils.serializeReader(reader: reader)
            call.resolve(["reader": reader])
        } else {
            call.resolve(["reader": nil])
        }
    }

    @objc func retrievePaymentIntent(_ call: CAPPluginCall) {
        guard let clientSecret = call.getString("clientSecret") else {
            call.reject("Must provide a clientSecret")
            return
        }

        let semaphore = DispatchSemaphore(value: 0)
        thread.async {
            Terminal.shared.retrievePaymentIntent(clientSecret: clientSecret) { retrieveResult, retrieveError in
                self.currentPaymentIntent = retrieveResult

                if let error = retrieveError {
                    call.reject(error.localizedDescription, nil, error)
                } else if let paymentIntent = retrieveResult {
                    call.resolve(["intent": StripeTerminalUtils.serializePaymentIntent(intent: paymentIntent)])
                }
                semaphore.signal()
            }
        }
        _ = semaphore.wait(timeout: .now() + 10)
    }

    @objc func cancelCollectPaymentMethod(_ call: CAPPluginCall? = nil) {
        if let cancelable = pendingCollectPaymentMethod {
            cancelable.cancel { error in
                if let error = error {
                    call?.reject(error.localizedDescription, nil, error)
                } else {
                    self.pendingCollectPaymentMethod = nil
                    call?.resolve()
                }
            }

            return
        }

        call?.resolve()
    }

    @objc func collectPaymentMethod(_ call: CAPPluginCall) {
        let updatePaymentIntent = call.getBool("updatePaymentIntent", false)

        let collectConfig: CollectPaymentIntentConfiguration
        do {
            collectConfig = try CollectPaymentIntentConfigurationBuilder()
                .setUpdatePaymentIntent(updatePaymentIntent)
                .build()
        } catch {
            call.reject("Failed to build collect configuration: \(error.localizedDescription)", nil, error)
            return
        }

        if let intent = currentPaymentIntent {
            pendingCollectPaymentMethod = Terminal.shared.collectPaymentMethod(intent, collectConfig: collectConfig) { collectResult, collectError in
                self.pendingCollectPaymentMethod = nil

                if let error = collectError {
                    call.reject(error.localizedDescription, nil, error)
                } else if let paymentIntent = collectResult {
                    self.currentPaymentIntent = collectResult
                    call.resolve(["intent": StripeTerminalUtils.serializePaymentIntent(intent: paymentIntent)])
                }
            }
        } else {
            call.reject("There is no active payment intent. Make sure you called retrievePaymentIntent first")
        }
    }

    @objc func confirmPaymentIntent(_ call: CAPPluginCall) {
        thread.async {
            if let intent = self.currentPaymentIntent {
                Terminal.shared.confirmPaymentIntent(intent) { paymentIntent, error in
                    if let error = error {
                        var data: PluginCallResultData = [:]
                        if let confirmError = error as? ConfirmPaymentIntentError {
                            if let failedIntent = confirmError.paymentIntent {
                                data["payment_intent"] = StripeTerminalUtils.serializePaymentIntent(intent: failedIntent)
                            }
                            if let declineCode = confirmError.declineCode {
                                data["decline_code"] = declineCode
                            }
                        }
                        call.reject(error.localizedDescription, nil, error, data.isEmpty ? nil : data)
                    } else if let paymentIntent = paymentIntent {
                        self.currentPaymentIntent = paymentIntent
                        call.resolve(["intent": StripeTerminalUtils.serializePaymentIntent(intent: paymentIntent)])
                    }
                }
            } else {
                call.reject("There is no active payment intent. Make sure you called retrievePaymentIntent first")
            }
        }
    }

    @objc func clearCachedCredentials(_ call: CAPPluginCall) {
        let result = Terminal.shared.clearCachedCredentials()
        switch result {
        case .success:
            call.resolve()
        case .failure(let error):
            call.reject("Failed to clear cached credentials", nil, error)
        }
    }

    @objc func setReaderDisplay(_ call: CAPPluginCall) {
        let lineItems = call.getArray("lineItems", [String: Any].self) ?? [[String: Any]]()
        let currency = call.getString("currency") ?? "usd"
        let tax = call.getInt("tax") ?? 0
        let total = call.getInt("total") ?? 0

        var lineItemObjects: [CartLineItem] = []
        for item in lineItems {
            if let displayName = item["displayName"] as? String,
               let quantity = item["quantity"] as? Int,
               let amount = item["amount"] as? Int,
               let lineItem = try? CartLineItemBuilder(displayName: displayName).setQuantity(quantity).setAmount(amount).build() {
                lineItemObjects.append(lineItem)
            }
        }

        let cart: Cart
        do {
            cart = try CartBuilder(currency: currency)
                .setTax(tax)
                .setTotal(total)
                .setLineItems(lineItemObjects)
                .build()
        } catch {
            call.reject("Failed to build cart: \(error.localizedDescription)", nil, error)
            return
        }

        let semaphore = DispatchSemaphore(value: 0)
        thread.async {
            Terminal.shared.setReaderDisplay(cart) { error in
                if let error = error {
                    call.reject(error.localizedDescription, nil, error)
                } else {
                    call.resolve()
                }
                semaphore.signal()
            }
        }
        _ = semaphore.wait(timeout: .now() + 10)
    }

    @objc func clearReaderDisplay(_ call: CAPPluginCall) {
        let semaphore = DispatchSemaphore(value: 0)
        thread.async {
            Terminal.shared.clearReaderDisplay { error in
                if let error = error {
                    call.reject(error.localizedDescription, nil, error)
                } else {
                    call.resolve()
                }
                semaphore.signal()
            }
        }
        _ = semaphore.wait(timeout: .now() + 10)
    }

    @objc func listLocations(_ call: CAPPluginCall) {
        let limit = call.getInt("limit")
        let endingBefore = call.getString("endingBefore")
        let startingAfter = call.getString("startingAfter")

        var params: ListLocationsParameters?

        if limit != nil || endingBefore != nil || startingAfter != nil {
            let builder = ListLocationsParametersBuilder()
            if let limit = limit { _ = builder.setLimit(UInt(limit)) }
            if let endingBefore = endingBefore { _ = builder.setEndingBefore(endingBefore) }
            if let startingAfter = startingAfter { _ = builder.setStartingAfter(startingAfter) }
            params = try? builder.build()
        }
        
        let semaphore = DispatchSemaphore(value: 0)
        thread.async {
            Terminal.shared.listLocations(parameters: params) { locations, hasMore, error in
                if let error = error {
                    call.reject(error.localizedDescription, nil, error)
                } else {
                    let locationsJSON = locations?.map {
                        (location: Location) -> [String: Any] in
                        StripeTerminalUtils.serializeLocation(location: location)
                    }

                    call.resolve([
                        "hasMore": hasMore,
                        "locations": locationsJSON as Any,
                    ])
                }
                semaphore.signal()
            }
        }
        _ = semaphore.wait(timeout: .now() + 10)
    }

    @objc func getSimulatorConfiguration(_ call: CAPPluginCall) {
        let config = Terminal.shared.simulatorConfiguration
        let serialized = StripeTerminalUtils.serializeSimulatorConfiguration(simulatorConfig: config)

        call.resolve(serialized)
    }

    @objc func setSimulatorConfiguration(_ call: CAPPluginCall) {
        let availableReaderUpdateInt = call.getInt("availableReaderUpdate")
        let simulatedCardInt = call.getInt("simulatedCard")

        if availableReaderUpdateInt != nil {
            let availableReaderUpdate = SimulateReaderUpdate(rawValue: UInt(availableReaderUpdateInt ?? 0)) ?? Terminal.shared.simulatorConfiguration.availableReaderUpdate

            Terminal.shared.simulatorConfiguration.availableReaderUpdate = availableReaderUpdate
        }

        if simulatedCardInt != nil {
            let simulatedCardType = SimulatedCardType(rawValue: UInt(simulatedCardInt ?? 0)) ?? SimulatedCardType.visa
            let simulatedCard = SimulatedCard(type: simulatedCardType)

            Terminal.shared.simulatorConfiguration.simulatedCard = simulatedCard
        }

        return getSimulatorConfiguration(call)
    }
    
    @objc func cancelAutoReconnect(_ call: CAPPluginCall) {
        if let cancelable = pendingReaderAutoReconnect {
            cancelable.cancel { error in
                if let error = error {
                    call.reject(error.localizedDescription, nil, error)
                } else {
                    self.pendingReaderAutoReconnect = nil
                    call.resolve()
                }
            }

            return
        }

        call.resolve()
    }

    // MARK: DiscoveryDelegate

    public func terminal(_: Terminal, didUpdateDiscoveredReaders readers: [Reader]) {
        self.readers = readers

        let readersJSON = readers.map {
            (reader: Reader) -> [String: Any] in
            StripeTerminalUtils.serializeReader(reader: reader)
        }

        notifyListeners("readersDiscovered", data: ["readers": readersJSON])
    }

    // MARK: TerminalDelegate

    public func terminal(_: Terminal, didReportUnexpectedReaderDisconnect reader: Reader) {
        logMsg(items: "didReportUnexpectedReaderDisconnect \(reader)")
        notifyListeners("didReportUnexpectedReaderDisconnect", data: ["reader": StripeTerminalUtils.serializeReader(reader: reader)])
    }

    public func terminal(_: Terminal, didChangeConnectionStatus status: ConnectionStatus) {
        notifyListeners("didChangeConnectionStatus", data: ["status": status.rawValue])
    }

    public func terminal(_: Terminal, didChangePaymentStatus status: PaymentStatus) {
        notifyListeners("didChangePaymentStatus", data: ["status": status.rawValue])
    }

    // MARK: MobileReaderDelegate

    public func reader(_: Reader, didReportAvailableUpdate update: ReaderSoftwareUpdate) {
        currentUpdate = update
        notifyListeners("didReportAvailableUpdate", data: ["update": StripeTerminalUtils.serializeUpdate(update: update)])
    }

    public func reader(_: Reader, didStartInstallingUpdate update: ReaderSoftwareUpdate, cancelable: Cancelable?) {
        pendingInstallUpdate = cancelable
        currentUpdate = update
        notifyListeners("didStartInstallingUpdate", data: ["update": StripeTerminalUtils.serializeUpdate(update: update)])
    }

    public func reader(_: Reader, didReportReaderSoftwareUpdateProgress progress: Float) {
        notifyListeners("didReportReaderSoftwareUpdateProgress", data: ["progress": progress])
    }

    public func reader(_: Reader, didFinishInstallingUpdate update: ReaderSoftwareUpdate?, error: Error?) {
        if let error = error {
            notifyListeners("didFinishInstallingUpdate", data: ["error": error.localizedDescription as Any])
        } else if let update = update {
            notifyListeners("didFinishInstallingUpdate", data: ["update": StripeTerminalUtils.serializeUpdate(update: update)])
            currentUpdate = nil
        }
    }

    public func reader(_: Reader, didRequestReaderInput inputOptions: ReaderInputOptions = []) {
        notifyListeners("didRequestReaderInput", data: ["value": inputOptions.rawValue])
    }

    public func reader(_: Reader, didRequestReaderDisplayMessage displayMessage: ReaderDisplayMessage) {
        notifyListeners("didRequestReaderDisplayMessage", data: ["value": displayMessage.rawValue])
    }
        
    // MARK: TapToPayReaderDelegate

    public func tapToPayReader(_ reader: Reader, didStartInstallingUpdate update: ReaderSoftwareUpdate, cancelable: Cancelable?) {
        pendingInstallUpdate = cancelable
        currentUpdate = update
        notifyListeners("didStartInstallingUpdate", data: ["update": StripeTerminalUtils.serializeUpdate(update: update)])
    }

    public func tapToPayReader(_ reader: Reader, didReportReaderSoftwareUpdateProgress progress: Float) {
        notifyListeners("didReportReaderSoftwareUpdateProgress", data: ["progress": progress])
    }

    public func tapToPayReader(_ reader: Reader, didFinishInstallingUpdate update: ReaderSoftwareUpdate?, error: Error?) {
        if let error = error {
            notifyListeners("didFinishInstallingUpdate", data: ["error": error.localizedDescription as Any])
        } else if let update = update {
            notifyListeners("didFinishInstallingUpdate", data: ["update": StripeTerminalUtils.serializeUpdate(update: update)])
            currentUpdate = nil
        }
    }

    public func tapToPayReader(_: Reader, didRequestReaderInput inputOptions: ReaderInputOptions = []) {
        notifyListeners("didRequestReaderInput", data: ["value": inputOptions.rawValue])
    }

    public func tapToPayReader(_: Reader, didRequestReaderDisplayMessage displayMessage: ReaderDisplayMessage) {
        notifyListeners("didRequestReaderDisplayMessage", data: ["value": displayMessage.rawValue])
    }

    public func tapToPayReaderDidAcceptTermsOfService(_: Reader) {
        notifyListeners("tapToPayReaderDidAcceptTermsOfService", data: nil)
    }

    // MARK: ReaderDelegate

    public func reader(_: Reader, didDisconnect reason: DisconnectReason) {
        // Handled by terminal(_:didReportUnexpectedReaderDisconnect:) for unexpected disconnects
    }

    public func reader(_ reader: Reader, didStartReconnect cancelable: Cancelable, disconnectReason reason: DisconnectReason) {
        pendingReaderAutoReconnect = cancelable
        notifyListeners("didStartReaderReconnect", data: nil)
    }

    public func readerDidSucceedReconnect(_ reader: Reader) {
        pendingReaderAutoReconnect = nil
        notifyListeners("didSucceedReaderReconnect", data: nil)
    }

    public func readerDidFailReconnect(_ reader: Reader) {
        pendingReaderAutoReconnect = nil
        notifyListeners("didFailReaderReconnect", data: nil)
    }
}
