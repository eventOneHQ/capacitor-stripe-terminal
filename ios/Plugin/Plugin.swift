import Capacitor
import Foundation
import StripeTerminal

/**
 * Please read the Capacitor iOS Plugin Development Guide
 * here: https://capacitor.ionicframework.com/docs/plugins/ios
 */
@objc(StripeTerminal)
public class StripeTerminal: CAPPlugin, ConnectionTokenProvider, DiscoveryDelegate, TerminalDelegate {
    private var pendingConnectionTokenCompletionBlock: ConnectionTokenCompletionBlock?
    private var pendingDiscoverReaders: Cancelable?
    
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
        
        pendingDiscoverReaders = nil
        
        let config = DiscoveryConfiguration(deviceType: .chipper2X,
                                            discoveryMethod: .bluetoothProximity,
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
            self.pendingDiscoverReaders?.cancel { error in
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
}
