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
        let jsonObject: [String: Any] = [
            "deviceType": translateDeviceTypeToJS(reader.deviceType),
            "simulated": reader.simulated,
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
        let jsonObject: [String: Any] = [
            "estimatedUpdateTimeString": ReaderSoftwareUpdate.string(from: update.durationEstimate),
            "estimatedUpdateTime": update.durationEstimate.rawValue,
            "deviceSoftwareVersion": update.deviceSoftwareVersion,
            "components": update.components.rawValue,
            "requiredAt": update.requiredAt.timeIntervalSince1970,
        ]

        return jsonObject
    }

    static func serializePaymentIntent(intent: PaymentIntent) -> [String: Any] {
        let chargesJson = intent.charges.map {
            (charge: Charge) -> [String: Any] in
            return [
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
        }

        var jsonObject: [String: Any] = [
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
