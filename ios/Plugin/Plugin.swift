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
    
    @objc func initialize(_ call: CAPPluginCall) {
        print("swift init StripeTerminal")
        
        Terminal.setTokenProvider(self)
        Terminal.shared.delegate = self
        
        call.success()
    }
    
    @objc func setConnectionToken(_ call: CAPPluginCall){
        print("swift setConnectionToken")
        
        let token = call.getString("token") ?? ""
        let errorMessage = call.getString("errorMessage") ?? ""
        
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
            call.success()
        }
    }
    
    public func fetchConnectionToken(_ completion: @escaping ConnectionTokenCompletionBlock) {
        print("swift fetchConnectionToken")
        pendingConnectionTokenCompletionBlock = completion
        self.notifyListeners("requestConnectionToken", data: [:])
    }
    
    @objc func discoverReaders(_ call: CAPPluginCall) {
        // Attempt to abort any pending discoverReader calls first.
        // self.abortDiscoverReaders()
        
        let simulated = call.getBool("simulated") ?? true
        
        pendingDiscoverReaders = nil
        
        let config = DiscoveryConfiguration(deviceType: .chipper2X,
                                            discoveryMethod: .bluetoothProximity,
                                            simulated: simulated)
        self.pendingDiscoverReaders = Terminal.shared.discoverReaders(config, delegate: self, completion: { error in
            if let error = error {
                print("discoverReaders failed: \(error)")
                
                //                self.notifyListeners("readerDiscoveryCompletion", data: ["error": error.localizedDescription])
                call.error(error.localizedDescription)
            }
            else {
                print("discoverReaders succeeded")
                //                self.notifyListeners("readerDiscoveryCompletion", data: [:])
                
                call.success()
            }
        })
    }
    
    @objc func connectReader(_ call: CAPPluginCall) {
        guard let serialNumber = call.getString("serialNumber") as? String else {
            call.reject("Must provide a serial number")
            return
        }
        
        guard let selectedReader = self.readers?.first(where: { $0.serialNumber == serialNumber }) as? Reader else {
            call.reject("No reader found")
            return
        }
        
        Terminal.shared.connectReader(selectedReader, completion: { reader, error in
            if let reader = reader {
                print("Successfully connected to reader: \(reader)")
                call.resolve(["reader":self.serializeReader(reader: reader)])
            }
            else if let error = error {
                print("connectReader failed: \(error)")
                call.reject(error.localizedDescription)
            }
        })
        
    }
    
    // MARK: DiscoveryDelegate
    
    public func terminal(_ terminal: Terminal, didUpdateDiscoveredReaders readers: [Reader]) {
        print("swift didUpdateDiscoveredReaders")
        self.readers = readers
        
        let readersJSON = readers.map({
            (reader: Reader) -> [String: Any] in
            return serializeReader(reader: reader)
        })
        
        self.notifyListeners("readersDiscovered", data: ["readers": readersJSON])
    }
    
    // MARK: TerminalDelegate
    
    public func terminal(_ terminal: Terminal, didReportUnexpectedReaderDisconnect reader: Reader) {
        print("didReportUnexpectedReaderDisconnect \(reader)")
        self.notifyListeners("didReportUnexpectedReaderDisconnect", data: ["reader": serializeReader(reader: reader)])
    }
    
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
