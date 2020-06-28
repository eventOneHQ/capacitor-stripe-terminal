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
    static func serializeReader(reader: Reader) -> [String: Any] {
        let jsonObject: [String: Any] = [
            "batteryLevel": reader.batteryLevel?.decimalValue,
            "deviceSoftwareVersion": reader.deviceSoftwareVersion,
            "deviceType": reader.deviceType.rawValue,
            "serialNumber": reader.serialNumber,
            "locationId": reader.locationId,
            "stripeId": reader.stripeId,
            "ipAddress": reader.ipAddress,
            "status": reader.status.rawValue,
            "label": reader.label,
            "simulated": reader.simulated,
        ]
        
        return jsonObject
    }
    
    static func serializeUpdate(update: ReaderSoftwareUpdate) -> [String: Any] {
        let jsonObject: [String: Any] = [
            "estimatedUpdateTime": ReaderSoftwareUpdate.string(from: update.estimatedUpdateTime),
            "deviceSoftwareVersion": update.deviceSoftwareVersion,
        ]
        
        return jsonObject
    }
    
    static func serializePaymentIntent(intent: PaymentIntent) -> [String: Any] {
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
