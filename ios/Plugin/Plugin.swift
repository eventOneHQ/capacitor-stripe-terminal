import Capacitor
import Foundation
import StripeTerminal

/**
 * Please read the Capacitor iOS Plugin Development Guide
 * here: https://capacitor.ionicframework.com/docs/plugins/ios
 */
@objc(StripeTerminal)
public class StripeTerminal: CAPPlugin, ConnectionTokenProvider, DiscoveryDelegate, TerminalDelegate, BluetoothReaderDelegate, ReconnectionDelegate, LocalMobileReaderDelegate {
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
                Terminal.setTokenProvider(self)
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

        let discoveryMethod = StripeTerminalUtils.translateDiscoveryMethod(method: method)

        let config = DiscoveryConfiguration(
            discoveryMethod: discoveryMethod,
            locationId: locationId,
            simulated: simulated
        )
        
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

        let connectionConfig = BluetoothConnectionConfiguration(
            locationId: locationId,
            autoReconnectOnUnexpectedDisconnect: autoReconnectOnUnexpectedDisconnect,
            autoReconnectionDelegate: self
        )

        // this must be run on the main thread
        // https://stackoverflow.com/questions/44767778/main-thread-checker-ui-api-called-on-a-background-thread-uiapplication-appli
        DispatchQueue.main.async {
            Terminal.shared.connectBluetoothReader(reader, delegate: self, connectionConfig: connectionConfig, completion: { reader, error in
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

        let config = InternetConnectionConfiguration(failIfInUse: failIfInUse,
                                                     allowCustomerCancel: allowCustomerCancel)

        // this must be run on the main thread
        // https://stackoverflow.com/questions/44767778/main-thread-checker-ui-api-called-on-a-background-thread-uiapplication-appli
        DispatchQueue.main.async {
            Terminal.shared.connectInternetReader(reader, connectionConfig: config, completion: { reader, error in
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

    @objc func connectLocalMobileReader(_ call: CAPPluginCall) {
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

        let connectionConfig = LocalMobileConnectionConfiguration(
            locationId: locationId,
            merchantDisplayName: merchantDisplayName,
            onBehalfOf: onBehalfOf,
            tosAcceptancePermitted: tosAcceptancePermitted
        )

        // this must be run on the main thread
        // https://stackoverflow.com/questions/44767778/main-thread-checker-ui-api-called-on-a-background-thread-uiapplication-appli
        DispatchQueue.main.async {
            Terminal.shared.connectLocalMobileReader(reader, delegate: self, connectionConfig: connectionConfig, completion: { reader, error in
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

        let collectConfig = CollectConfiguration(updatePaymentIntent: updatePaymentIntent)

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

    @objc func processPayment(_ call: CAPPluginCall) {
        thread.async {
            if let intent = self.currentPaymentIntent {
                Terminal.shared.processPayment(intent) { paymentIntent, error in
                    if let error = error {
                        call.reject(error.localizedDescription, nil, error, [
                            "decline_code": error.declineCode as Any,
                            "payment_intent": error.paymentIntent?.originalJSON as Any
                        ])
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
        thread.async {
            Terminal.shared.clearCachedCredentials()
            call.resolve()
        }
    }

    @objc func setReaderDisplay(_ call: CAPPluginCall) {
        let lineItems = call.getArray("lineItems", [String: Any].self) ?? [[String: Any]]()
        let currency = call.getString("currency") ?? "usd"
        let tax = call.getInt("tax") ?? 0
        let total = call.getInt("total") ?? 0

        let cart = Cart(currency: currency, tax: tax, total: total)
        let lineItemsArray = NSMutableArray()

        for item in lineItems {
            let lineItem = CartLineItem(displayName: item["displayName"] as! String,
                                        quantity: item["quantity"] as! Int,
                                        amount: item["amount"] as! Int)

            lineItemsArray.add(lineItem)
        }

        cart.lineItems = lineItemsArray

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
        let limit = call.getInt("limit") as NSNumber?
        let endingBefore = call.getString("endingBefore")
        let startingAfter = call.getString("startingAfter")

        var params: ListLocationsParameters?

        if limit != nil || endingBefore != nil || startingAfter != nil {
            params = ListLocationsParameters(limit: limit,
                                             endingBefore: endingBefore,
                                             startingAfter: startingAfter)
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

    // MARK: BluetoothReaderDelegate

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
        
    // MARK: LocalMobileReaderDelegate

    public func localMobileReader(_ reader: Reader, didStartInstallingUpdate update: ReaderSoftwareUpdate, cancelable: Cancelable?) {
        pendingInstallUpdate = cancelable
        currentUpdate = update
        notifyListeners("didStartInstallingUpdate", data: ["update": StripeTerminalUtils.serializeUpdate(update: update)])
    }

    public func localMobileReader(_ reader: Reader, didReportReaderSoftwareUpdateProgress progress: Float) {
        notifyListeners("didReportReaderSoftwareUpdateProgress", data: ["progress": progress])
    }

    public func localMobileReader(_ reader: Reader, didFinishInstallingUpdate update: ReaderSoftwareUpdate?, error: Error?) {
        if let error = error {
            notifyListeners("didFinishInstallingUpdate", data: ["error": error.localizedDescription as Any])
        } else if let update = update {
            notifyListeners("didFinishInstallingUpdate", data: ["update": StripeTerminalUtils.serializeUpdate(update: update)])
            currentUpdate = nil
        }
    }
    
    public func localMobileReader(_: Reader, didRequestReaderInput inputOptions: ReaderInputOptions = []) {
        notifyListeners("didRequestReaderInput", data: ["value": inputOptions.rawValue])
    }

    public func localMobileReader(_: Reader, didRequestReaderDisplayMessage displayMessage: ReaderDisplayMessage) {
        notifyListeners("didRequestReaderDisplayMessage", data: ["value": displayMessage.rawValue])
    }
    
    public func localMobileReaderDidAcceptTermsOfService(_: Reader) {
        notifyListeners("localMobileReaderDidAcceptTermsOfService", data: nil)
    }

    // MARK: ReconnectionDelegate

    public func terminal(_ terminal: Terminal, didStartReaderReconnect cancelable: Cancelable) {
        pendingReaderAutoReconnect = cancelable
        notifyListeners("didStartReaderReconnect", data: nil)
    }

    public func terminalDidSucceedReaderReconnect(_ terminal: Terminal) {
        pendingReaderAutoReconnect = nil
        notifyListeners("didSucceedReaderReconnect", data: nil)
    }
    public func terminalDidFailReaderReconnect(_ terminal: Terminal) {
        pendingReaderAutoReconnect = nil
        notifyListeners("didFailReaderReconnect", data: nil)
    }
}
