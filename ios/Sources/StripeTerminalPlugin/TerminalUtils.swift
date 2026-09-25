//
//  TerminalUtils.swift
//  Plugin
//
//  Created by Noah Prail on 6/28/20.
//  Copyright © 2020 eventOne, Inc. All rights reserved.
//

import Foundation
import StripeTerminal

public class StripeTerminalUtils {
    static func translateJSLogLevel(_ level: Int) -> LogLevel {
        // The iOS SDK only exposes none/verbose, so any enabled level maps to verbose.
        return level == 0 ? .none : .verbose
    }

    static func serializeReaderSettings(settings: ReaderSettings) -> [String: Any] {
        var accessibility: [String: Any] = [:]

        if let error = settings.accessibility.error {
            accessibility["error"] = error.localizedDescription
        } else {
            switch settings.accessibility.textToSpeechStatus {
            case .off: accessibility["textToSpeechStatus"] = "off"
            case .headphones: accessibility["textToSpeechStatus"] = "headphones"
            case .speakers: accessibility["textToSpeechStatus"] = "speakers"
            default: accessibility["error"] = "Unknown text-to-speech status"
            }
        }

        return ["accessibility": accessibility]
    }

    static func translateJSDeviceType(_ type: Int) -> DeviceType? {
        switch type {
        case 0: return .chipper2X
        case 2: return .wisePad3
        case 3: return .stripeM2
        case 4: return .wisePosE
        case 5: return .wisePosEDevKit
        case 9: return .stripeS700
        case 10: return .stripeS700DevKit
        case 11: return .tapToPay
        case 12: return .stripeS710
        case 13: return .stripeS710DevKit
        default: return nil
        }
    }

    static func translateJSDiscoveryMethod(_ method: Int) -> DiscoveryMethod? {
        switch method {
        case 0: return .bluetoothScan
        case 1: return .bluetoothProximity
        case 2: return .internet
        case 6: return .tapToPay
        default: return nil
        }
    }

    static func translateDeviceTypeToJS(_ deviceType: DeviceType) -> Int {
        switch deviceType {
        case .chipper2X: return 0
        case .wisePad3: return 2
        case .stripeM2: return 3
        case .wisePosE: return 4
        case .wisePosEDevKit: return 5
        case .stripeS700: return 9
        case .stripeS700DevKit: return 10
        case .tapToPay: return 11
        case .stripeS710: return 12
        case .stripeS710DevKit: return 13
        default: return 6
        }
    }

    static func serializeReader(reader: Reader) -> [String: Any] {
        var jsonObject: [String: Any] = [
            "deviceType": translateDeviceTypeToJS(reader.deviceType),
            "simulated": reader.simulated,
            "id": reader.stripeId as Any,
            "stripeId": reader.stripeId as Any,
            "locationId": reader.locationId as Any,
            "locationStatus": reader.locationStatus.rawValue,
            "serialNumber": reader.serialNumber,
            // Bluetooth reader props
            "deviceSoftwareVersion": reader.deviceSoftwareVersion as Any,
            "isAvailableUpdate": reader.availableUpdate != nil,
            "batteryLevel": reader.batteryLevel?.decimalValue as Any,
            "batteryStatus": reader.batteryStatus.rawValue,
            "isCharging": reader.isCharging as Any,
            // Internet reader props
            "ipAddress": reader.ipAddress as Any,
            "status": reader.status.rawValue,
            "label": reader.label as Any,
        ]

        return jsonObject
    }

    static func serializeUpdate(update: ReaderSoftwareUpdate) -> [String: Any] {
        let estimatedUpdateTime: String
        switch update.durationEstimate {
        case .estimate1To2Minutes: estimatedUpdateTime = "estimate1To2Minutes"
        case .estimate2To5Minutes: estimatedUpdateTime = "estimate2To5Minutes"
        case .estimate5To15Minutes: estimatedUpdateTime = "estimate5To15Minutes"
        default: estimatedUpdateTime = "estimateLessThan1Minute"
        }

        var components: [String] = []
        if update.components.contains(.firmware) { components.append("firmware") }
        if update.components.contains(.config) { components.append("config") }
        if update.components.contains(.keys) { components.append("keys") }
        if update.components.contains(.incremental) { components.append("incremental") }

        let jsonObject: [String: Any] = [
            "estimatedUpdateTime": estimatedUpdateTime,
            "estimatedUpdateTimeString": ReaderSoftwareUpdate.string(from: update.durationEstimate),
            "deviceSoftwareVersion": update.deviceSoftwareVersion,
            "components": components,
            "requiredAt": update.requiredAt.timeIntervalSince1970,
        ]

        return jsonObject
    }

    static func serializePaymentIntent(intent: PaymentIntent) -> [String: Any] {
        let chargesJson = intent.charges.map {
            (charge: Charge) -> [String: Any] in
            var chargeJson: [String: Any] = [
                "id": charge.stripeId,
                "stripeId": charge.stripeId,
                "amount": charge.amount,
                "currency": charge.currency,
                "status": charge.status.rawValue,
                "metadata": charge.metadata,
                "stripeDescription": charge.stripeDescription as Any,
                "statementDescriptorSuffix": charge.statementDescriptorSuffix as Any,
                "calculatedStatementDescriptor": charge.calculatedStatementDescriptor as Any,
                "authorizationCode": charge.authorizationCode as Any,
                "amountRefunded": charge.amountRefunded,
                "created": charge.created?.timeIntervalSince1970 as Any,
                "captured": charge.captured,
                "paid": charge.paid,
                "refunded": charge.refunded,
                "customer": charge.customer as Any,
                "paymentIntentId": charge.paymentIntentId as Any,
                "receiptEmail": charge.receiptEmail as Any,
                "receiptNumber": charge.receiptNumber as Any,
                "receiptUrl": charge.receiptUrl as Any,
                "livemode": charge.livemode,
            ]
            return chargeJson
        }

        var jsonObject: [String: Any] = [
            "id": intent.stripeId,
            "stripeId": intent.stripeId,
            "created": intent.created.timeIntervalSince1970,
            "status": intent.status.rawValue,
            "amount": intent.amount,
            "currency": intent.currency,
            "amountTip": intent.amountTip as Any,
            "statementDescriptor": intent.statementDescriptor as Any,
            "statementDescriptorSuffix": intent.statementDescriptorSuffix as Any,
            "charges": chargesJson,
            "metadata": intent.metadata as Any,
        ]
        
        if let amountDetails = intent.amountDetails {
            var amountDetailsJson: [String: Any] = [:]
            if let tip = amountDetails.tip {
                amountDetailsJson["tip"] = ["amount": tip.amount as Any]
            }
            jsonObject["amountDetails"] = amountDetailsJson
        }

        if let paymentMethod = intent.paymentMethod {
            jsonObject["paymentMethod"] = [
                "id": paymentMethod.stripeId,
                "stripeId": paymentMethod.stripeId,
                "type": paymentMethod.type.rawValue,
                "customer": paymentMethod.customer as Any,
                "metadata": paymentMethod.metadata,
                "livemode": paymentMethod.livemode,
                "created": paymentMethod.created?.timeIntervalSince1970 as Any,
            ]
        }

        return jsonObject
    }

    static func serializeLocation(location: Location) -> [String: Any] {
        var jsonObject: [String: Any] = [
            "id": location.stripeId,
            "stripeId": location.stripeId,
            "displayName": location.displayName as Any,
            "livemode": location.livemode,
            "metadata": location.metadata as Any,
        ]

        if let address = location.address {
            jsonObject["address"] = serializeAddress(address: address)
        }

        return jsonObject
    }

    static func serializeAddress(address: Address) -> [String: Any] {
        let jsonObject: [String: Any] = [
            "city": address.city as Any,
            "country": address.country as Any,
            "line1": address.line1 as Any,
            "line2": address.line2 as Any,
            "postalCode": address.postalCode as Any,
            "state": address.state as Any,
        ]

        return jsonObject
    }
    
    static func serializeSimulatorConfiguration(simulatorConfig: SimulatorConfiguration) -> [String: Any] {
        let jsonObject: [String: Any] = [
            "availableReaderUpdate": simulatorConfig.availableReaderUpdate.rawValue,
            "simulatedCard": "\(simulatorConfig.simulatedCard)" as Any,
        ]
                
        return jsonObject
    }
}
