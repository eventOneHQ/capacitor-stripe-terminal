import Foundation
import Capacitor
import StripeTerminal
import SwiftyJSON

/**
 * Please read the Capacitor iOS Plugin Development Guide
 * here: https://capacitor.ionicframework.com/docs/plugins/ios
 */
@objc(StripeTerminal)
public class StripeTerminal: CAPPlugin, ConnectionTokenProvider, DiscoveryDelegate, TerminalDelegate {
    
    private var pendingConnectionTokenCompletionBlock: ConnectionTokenCompletionBlock?
    private var pendingDiscoverReaders: Cancelable?
    
    private var readers: [Reader]?
    
    func logMsg (items: Any...) {
        print("SWIFT \(items)")
    }
    
    @objc func initialize(_ call: CAPPluginCall) {
        self.logMsg(items: "init StripeTerminal")
        
        Terminal.setTokenProvider(self)
        Terminal.shared.delegate = self
        
        self.abortDiscoverReaders()
        
        call.resolve()
    }
    
    @objc func setConnectionToken(_ call: CAPPluginCall){
        
        let token = call.getString("token") ?? ""
        let errorMessage = call.getString("errorMessage") ?? ""
        
        self.logMsg(items: "setConnectionToken \(token)")
        
        if let completion = pendingConnectionTokenCompletionBlock {
            if !errorMessage.isEmpty {
                let error = NSError(domain: "io.event1.capacitor-stripe-terminal",
                                    code: 1,
                                    userInfo: [NSLocalizedDescriptionKey: errorMessage])
                completion(nil, error);
            } else {
                completion(token, nil);
            }
            
            pendingConnectionTokenCompletionBlock = nil;
            call.resolve()
        }
    }
    
    public func fetchConnectionToken(_ completion: @escaping ConnectionTokenCompletionBlock) {
        self.logMsg(items: "fetchConnectionToken")
        pendingConnectionTokenCompletionBlock = completion
        self.notifyListeners("requestConnectionToken", data: [:])
    }
    
    @objc func discoverReaders(_ call: CAPPluginCall) {
        self.logMsg(items: "discoverReaders")
        // Attempt to abort any pending discoverReader calls first.
        self.abortDiscoverReaders()
        
        let simulated = call.getBool("simulated") ?? true
        
        pendingDiscoverReaders = nil
        
        let config = DiscoveryConfiguration(deviceType: .chipper2X,
                                            discoveryMethod: .bluetoothProximity,
                                            simulated: simulated)
        self.pendingDiscoverReaders = Terminal.shared.discoverReaders(config, delegate: self, completion: { error in
            if let error = error {
                self.logMsg(items: "discoverReaders failed: \(error)")
                call.reject(error.localizedDescription, error)
            }
            else {
                self.logMsg(items: "discoverReaders succeeded")
                call.resolve()
            }
        })
    }
    
    @objc func abortDiscoverReaders(_ call: CAPPluginCall? = nil) {
        self.logMsg(items: "abortDiscoverReaders")
        if let pendingDiscoverReaders = pendingDiscoverReaders {
            pendingDiscoverReaders.cancel({ error in
                if let error = error {
                    call?.reject(error.localizedDescription, error)
                } else {
                    call?.resolve()
                }
            })
        }
        
        call?.resolve()
    }
    
    @objc func connectReader(_ call: CAPPluginCall) {
        guard let serialNumber = call.getString("serialNumber") as? String else {
            call.reject("Must provide a serial number")
            return
        }
        self.logMsg(items: "connectReader \(serialNumber)")
        
        guard let selectedReader = self.readers?.first(where: { $0.serialNumber == serialNumber }) as? Reader else {
            call.reject("No reader found")
            return
        }
        
        Terminal.shared.connectReader(selectedReader, completion: { reader, error in
            if let reader = reader {
                self.logMsg(items: "Successfully connected to reader: \(reader.serialNumber)")
                call.resolve([
                    "reader": self.serializeReader(reader: reader)
                ])
            }
            else if let error = error {
                self.logMsg(items: "connectReader failed: \(error)")
                call.reject(error.localizedDescription, error)
            }
        })
        
    }
    
    @objc func getConnectionStatus(_ call: CAPPluginCall){
        self.logMsg(items: "getConnectionStatus \(Terminal.shared.connectionStatus.rawValue)")
        call.resolve(["status": Terminal.shared.connectionStatus.rawValue])
    }
    
    @objc func getConnectedReader(_ call: CAPPluginCall){

        var reader: Any = [:]
        if Terminal.shared.connectedReader != nil {
            reader = self.serializeReader(reader: Terminal.shared.connectedReader!)
        }
        
        call.resolve(["reader": reader])
    }
    
    // MARK: DiscoveryDelegate
    
    public func terminal(_ terminal: Terminal, didUpdateDiscoveredReaders readers: [Reader]) {
        self.logMsg(items: "didUpdateDiscoveredReaders")
        self.readers = readers
        
        let readersJSON = readers.map({
            (reader: Reader) -> [String: Any] in
            return serializeReader(reader: reader)
        })
        
        self.notifyListeners("readersDiscovered", data: ["readers": readersJSON])
    }
    
    // MARK: TerminalDelegate
    
    public func terminal(_ terminal: Terminal, didReportUnexpectedReaderDisconnect reader: Reader) {
        self.logMsg(items: "didReportUnexpectedReaderDisconnect \(reader)")
        self.notifyListeners("didReportUnexpectedReaderDisconnect", data: ["reader": serializeReader(reader: reader)])
    }
    
    public func terminal(_ terminal: Terminal, didChangeConnectionStatus status: ConnectionStatus) {
        self.logMsg(items: "didChangeConnectionStatus \(status) \(status.rawValue)")
        self.notifyListeners("didChangeConnectionStatus", data: ["status": status.rawValue])
    }
    
    
    // MARK: Serializers
    
    func serializeReader(reader: Reader) ->  [String: Any]  {
        let jsonObject: [String: Any]  =   [
            "batteryLevel": reader.batteryLevel?.decimalValue ?? 0,
            "deviceSoftwareVersion": reader.deviceSoftwareVersion ?? "",
            "deviceType": reader.deviceType.rawValue,
            "serialNumber": reader.serialNumber,
            "simulated": reader.simulated
        ]
        
        return jsonObject;
    }
    
}
