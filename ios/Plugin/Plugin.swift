import Capacitor
import Foundation
import StripeTerminal

/**
 * Please read the Capacitor iOS Plugin Development Guide
 * here: https://capacitor.ionicframework.com/docs/plugins/ios
 */
@objc(StripeTerminal)
public class StripeTerminal: CAPPlugin, ConnectionTokenProvider, DiscoveryDelegate, TerminalDelegate, ReaderSoftwareUpdateDelegate, ReaderDisplayDelegate {
    private var pendingConnectionTokenCompletionBlock: ConnectionTokenCompletionBlock?
    private var pendingDiscoverReaders: Cancelable?
    private var pendingInstallUpdate: Cancelable?
    private var pendingCollectPaymentMethod: Cancelable?
    private var currentUpdate: ReaderSoftwareUpdate?
    private var currentPaymentIntent: PaymentIntent?
    
    private var readers: [Reader]?
    
    func logMsg(items: Any...) {
        print("SWIFT \(items)")
    }
    
    func onLogEntry(logline _: String) {
        // self.notifyListeners("log", data: ["logline": logline])
    }
    
    @objc func initialize(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            Terminal.setTokenProvider(self)
            Terminal.shared.delegate = self
            
            Terminal.setLogListener { logline in
                self.onLogEntry(logline: logline)
            }
            // Terminal.shared.logLevel = LogLevel.verbose;
            
            self.abortDiscoverReaders()
            self.abortInstallUpdate()
            
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
        // Attempt to abort any pending discoverReader calls first.
        abortDiscoverReaders()
        
        let simulated = call.getBool("simulated") ?? true
        let method = UInt(call.getInt("discoveryMethod") ?? 0)
        let device = UInt(call.getInt("deviceType") ?? 0)
        
        let deviceType = DeviceType(rawValue: device) ?? DeviceType.chipper2X
        let discoveryMethod = DiscoveryMethod(rawValue: method) ?? DiscoveryMethod.bluetoothProximity
        
        pendingDiscoverReaders = nil
        
        let config = DiscoveryConfiguration(deviceType: deviceType,
                                            discoveryMethod: discoveryMethod,
                                            simulated: simulated)
        pendingDiscoverReaders = Terminal.shared.discoverReaders(config, delegate: self, completion: { error in
            self.pendingDiscoverReaders = nil
            
            if let error = error {
                call.reject(error.localizedDescription, error)
            } else {
                call.resolve()
            }
        })
    }
    
    @objc func abortDiscoverReaders(_ call: CAPPluginCall? = nil) {
        if pendingDiscoverReaders != nil {
            pendingDiscoverReaders?.cancel { error in
                if let error = error {
                    call?.reject(error.localizedDescription, error)
                } else {
                    call?.resolve()
                }
            }
        }
        
        call?.resolve()
    }
    
    @objc func connectReader(_ call: CAPPluginCall) {
        guard let serialNumber = call.getString("serialNumber") else {
            call.reject("Must provide a serial number")
            return
        }
        
        guard let selectedReader = self.readers?.first(where: { $0.serialNumber == serialNumber }) else {
            call.reject("No reader found")
            return
        }
        
        // this must be run on the main thread
        // https://stackoverflow.com/questions/44767778/main-thread-checker-ui-api-called-on-a-background-thread-uiapplication-appli
        DispatchQueue.main.async {
            Terminal.shared.connectReader(selectedReader, completion: { reader, error in
                if let reader = reader {
                    call.resolve([
                        "reader": self.serializeReader(reader: reader),
                    ])
                } else if let error = error {
                    call.reject(error.localizedDescription, error)
                }
            })
        }
    }
    
    @objc func disconnectReader(_ call: CAPPluginCall) {
        if Terminal.shared.connectedReader == nil {
            call.resolve()
            return
        }
        
        DispatchQueue.main.async {
            Terminal.shared.disconnectReader { error in
                if let error = error {
                    call.reject(error.localizedDescription, error)
                } else {
                    call.resolve()
                }
            }
        }
    }
    
    @objc func checkForUpdate(_ call: CAPPluginCall) {
        Terminal.shared.checkForUpdate { _update, error in
            self.currentUpdate = _update
            if let error = error {
                call.reject(error.localizedDescription, error)
            } else if let update = _update {
                call.resolve(["update": self.serializeUpdate(update: update)])
            } else {
                call.resolve()
            }
        }
    }
    
    @objc func installUpdate(_ call: CAPPluginCall) {
        if let update = currentUpdate {
            pendingInstallUpdate = Terminal.shared.installUpdate(update, delegate: self, completion: { error in
                if let error = error {
                    call.reject(error.localizedDescription, error)
                } else {
                    self.pendingInstallUpdate = nil
                    self.currentUpdate = nil
                    call.resolve()
                }
            })
        }
    }
    
    @objc func abortInstallUpdate(_ call: CAPPluginCall? = nil) {
        if pendingInstallUpdate != nil {
            pendingInstallUpdate?.cancel { error in
                if let error = error {
                    call?.reject(error.localizedDescription, error)
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
    
    @objc func getConnectedReader(_ call: CAPPluginCall) {
        var reader: Any = [:]
        if Terminal.shared.connectedReader != nil {
            reader = serializeReader(reader: Terminal.shared.connectedReader!)
        }
        
        call.resolve(["reader": reader])
    }
    
    @objc func retrievePaymentIntent(_ call: CAPPluginCall) {
        guard let clientSecret = call.getString("clientSecret") else {
            call.reject("Must provide a clientSecret")
            return
        }
        
        Terminal.shared.retrievePaymentIntent(clientSecret: clientSecret) { retrieveResult, retrieveError in
            self.currentPaymentIntent = retrieveResult
            
            if let error = retrieveError {
                call.reject(error.localizedDescription, error)
            } else if let paymentIntent = retrieveResult {
                call.resolve(["intent": self.serializePaymentIntent(intent: paymentIntent)])
            }
        }
    }
    
    @objc func abortCollectPaymentMethod(_ call: CAPPluginCall? = nil) {
        if pendingCollectPaymentMethod != nil {
            pendingCollectPaymentMethod?.cancel { error in
                if let error = error {
                    call?.reject(error.localizedDescription, error)
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
        if let intent = currentPaymentIntent {
            pendingCollectPaymentMethod = Terminal.shared.collectPaymentMethod(intent, delegate: self) { collectResult, collectError in
                self.pendingCollectPaymentMethod = nil
                
                if let error = collectError {
                    call.reject(error.localizedDescription, error)
                } else if let paymentIntent = collectResult {
                    self.currentPaymentIntent = collectResult
                    call.resolve(["intent": self.serializePaymentIntent(intent: paymentIntent)])
                }
            }
        } else {
            call.reject("There is no active payment intent. Make sure you called retrievePaymentIntent first")
        }
    }
    
    @objc func processPayment(_ call: CAPPluginCall) {
        if let intent = currentPaymentIntent {
            Terminal.shared.processPayment(intent) { paymentIntent, error in
                if let error = error {
                    call.reject(error.localizedDescription, error)
                } else if let paymentIntent = paymentIntent {
                    self.currentPaymentIntent = paymentIntent
                    call.resolve(["intent": self.serializePaymentIntent(intent: paymentIntent)])
                }
            }
        } else {
            call.reject("There is no active payment intent. Make sure you called retrievePaymentIntent first")
        }
    }
    
    // helper method to collect a payment intent
    //    @objc func collectPaymentIntent(_ call: CAPPluginCall) {
    //        guard let clientSecret = call.getString("clientSecret") else {
    //            call.reject("Must provide a clientSecret")
    //            return
    //        }
    //
    //        // get the payment intent
    //        Terminal.shared.retrievePaymentIntent(clientSecret: clientSecret, completion: { paymentIntent, error in
    //            if let paymentIntent = paymentIntent {
    //                self.currentPaymentIntent = paymentIntent
    //
    //                // collect a payment method
    //                self.pendingCollectPaymentMethod = Terminal.shared.collectPaymentMethod(paymentIntent, delegate: self, completion: { paymentIntent, error in
    //                    if let paymentIntent = paymentIntent {
    //
    //                        // process the payment
    //                        Terminal.shared.processPayment(paymentIntent) { paymentIntent, error in
    //                            if let paymentIntent = paymentIntent {
    //
    //                                call.resolve(["intent": self.serializePaymentIntent(intent: paymentIntent)])
    //                            } else if let error = error {
    //                                call.reject(error.localizedDescription, error)
    //                            }
    //                        }
    //                    } else if let error = error {
    //                        call.reject(error.localizedDescription, error)
    //                    }
    //                })
    //            } else if let error = error {
    //                call.reject(error.localizedDescription, error)
    //            }
    //        })
    //    }
    
    // MARK: DiscoveryDelegate
    
    public func terminal(_: Terminal, didUpdateDiscoveredReaders readers: [Reader]) {
        self.readers = readers
        
        let readersJSON = readers.map {
            (reader: Reader) -> [String: Any] in
            serializeReader(reader: reader)
        }
        
        notifyListeners("readersDiscovered", data: ["readers": readersJSON])
    }
    
    // MARK: TerminalDelegate
    
    public func terminal(_: Terminal, didReportUnexpectedReaderDisconnect reader: Reader) {
        logMsg(items: "didReportUnexpectedReaderDisconnect \(reader)")
        notifyListeners("didReportUnexpectedReaderDisconnect", data: ["reader": serializeReader(reader: reader)])
    }
    
    public func terminal(_: Terminal, didChangeConnectionStatus status: ConnectionStatus) {
        notifyListeners("didChangeConnectionStatus", data: ["status": status.rawValue])
    }
    
    // MARK: ReaderSoftwareUpdateDelegate
    
    public func terminal(_: Terminal, didReportReaderSoftwareUpdateProgress progress: Float) {
        notifyListeners("didReportReaderSoftwareUpdateProgress", data: ["progress": progress])
    }
    
    // MARK: ReaderDisplayDelegate
    
    public func terminal(_: Terminal, didRequestReaderInput inputOptions: ReaderInputOptions = []) {
        notifyListeners("didRequestReaderInput", data: ["text": Terminal.stringFromReaderInputOptions(inputOptions)])
    }
    
    public func terminal(_: Terminal, didRequestReaderDisplayMessage displayMessage: ReaderDisplayMessage) {
        notifyListeners("didRequestReaderDisplayMessage", data: ["text": Terminal.stringFromReaderDisplayMessage(displayMessage)])
    }
    
    // MARK: Serializers
    
    func serializeReader(reader: Reader) -> [String: Any] {
        let jsonObject: [String: Any] = [
            "batteryLevel": reader.batteryLevel?.decimalValue,
            "deviceSoftwareVersion": reader.deviceSoftwareVersion,
            "deviceType": reader.deviceType.rawValue,
            "serialNumber": reader.serialNumber,
            "simulated": reader.simulated,
        ]
        
        return jsonObject
    }
    
    func serializeUpdate(update: ReaderSoftwareUpdate) -> [String: Any] {
        let jsonObject: [String: Any] = [
            "estimatedUpdateTime": ReaderSoftwareUpdate.string(from: update.estimatedUpdateTime),
            "deviceSoftwareVersion": update.deviceSoftwareVersion,
        ]
        
        return jsonObject
    }
    
    func serializePaymentIntent(intent: PaymentIntent) -> [String: Any] {
        let jsonObject: [String: Any] = [
            "stripeId": intent.stripeId,
            "created": intent.created.timeIntervalSince1970,
            "status": intent.status.rawValue,
            "amount": intent.amount,
            "currency": intent.currency,
            //            "metadata": intent.metadata as [String: Any],
        ]
        
        return jsonObject
    }
}
