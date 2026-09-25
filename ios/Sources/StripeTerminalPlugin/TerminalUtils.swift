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

    static func translateJSCollectDataType(_ value: String) -> CollectDataType {
        switch value {
        case "nfcUid": return .nfcUid
        case "magstripe": return .magstripe
        default: return .unknown
        }
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

    static func serializeCollectedData(data: CollectedData) -> [String: Any] {
        var jsonObject: [String: Any] = [
            "created": data.created.timeIntervalSince1970,
            "livemode": data.livemode,
        ]

        if let magstripe = data as? MagstripeCollectedData {
            jsonObject["id"] = magstripe.stripeId as Any
            jsonObject["stripeId"] = magstripe.stripeId as Any
        } else if let nfcUid = data as? NfcUidCollectedData {
            jsonObject["uid"] = nfcUid.uid
        }

        return jsonObject
    }

    static func translateJSCustomerCancellation(_ value: String) -> CustomerCancellation {
        switch value {
        case "disableIfAvailable": return .disableIfAvailable
        default: return .enableIfAvailable
        }
    }

    static func translateJSAllowRedisplay(_ value: String) -> AllowRedisplay {
        switch value {
        case "always": return .always
        case "limited": return .limited
        default: return .unspecified
        }
    }

    static func translateJSPaymentMethodType(_ value: String) -> PaymentMethodType {
        switch value {
        case "interacPresent": return .interacPresent
        case "card": return .card
        case "wechatPay": return .wechatPay
        case "affirm": return .affirm
        default: return .cardPresent
        }
    }

    static func translateJSPaymentMethodTypes(_ values: [String]) -> [NSNumber] {
        return values.map { NSNumber(value: translateJSPaymentMethodType($0).rawValue) }
    }

    static func translateJSSetupIntentUsage(_ value: String) -> SetupIntentUsage {
        return value == "offSession" ? .offSession : .onSession
    }

    static func translateJSCollectionReason(_ value: String) -> SetupIntentCollectionReason? {
        switch value {
        case "saveCard": return .saveCard
        case "verify": return .verify
        default: return nil
        }
    }

    static func serializeSetupIntentStatus(_ status: SetupIntentStatus) -> String {
        switch status {
        case .requiresPaymentMethod: return "requiresPaymentMethod"
        case .requiresConfirmation: return "requiresConfirmation"
        case .requiresAction: return "requiresAction"
        case .processing: return "processing"
        case .succeeded: return "succeeded"
        case .canceled: return "canceled"
        @unknown default: return "unknown"
        }
    }

    static func serializePaymentMethodType(_ type: PaymentMethodType) -> String {
        switch type {
        case .interacPresent: return "interacPresent"
        case .card: return "card"
        case .wechatPay: return "wechatPay"
        case .affirm: return "affirm"
        default: return "cardPresent"
        }
    }

    static func serializeSetupAttempt(attempt: SetupAttempt) -> [String: Any] {
        var jsonObject: [String: Any] = [
            "id": attempt.stripeId,
            "applicationId": attempt.application as Any,
            "created": attempt.created.timeIntervalSince1970,
            "customer": attempt.customer as Any,
            "livemode": attempt.livemode,
            "onBehalfOfId": attempt.onBehalfOf as Any,
            "paymentMethodId": attempt.paymentMethod as Any,
            "setupIntentId": attempt.setupIntent,
            "status": attempt.status,
            "usage": attempt.usage == .offSession ? "offSession" : "onSession",
        ]

        if let paymentMethodDetails = attempt.paymentMethodDetails {
            var details: [String: Any] = [
                "type": serializePaymentMethodType(paymentMethodDetails.type),
            ]
            if let cardPresent = paymentMethodDetails.cardPresent {
                details["cardPresent"] = [
                    "emvAuthData": cardPresent.emvAuthData,
                    "generatedCard": cardPresent.generatedCard,
                ]
            }
            if let interacPresent = paymentMethodDetails.interacPresent {
                details["interacPresent"] = [
                    "emvAuthData": interacPresent.emvAuthData,
                    "generatedCard": interacPresent.generatedCard,
                ]
            }
            jsonObject["paymentMethodDetails"] = details
        }

        return jsonObject
    }

    static func serializeSetupIntent(intent: SetupIntent) -> [String: Any] {
        var jsonObject: [String: Any] = [
            "id": intent.stripeId as Any,
            "created": intent.created.timeIntervalSince1970,
            "customer": intent.customer as Any,
            "description": intent.stripeDescription as Any,
            "livemode": intent.livemode,
            "metadata": intent.metadata as Any,
            "onBehalfOf": intent.onBehalfOf as Any,
            "paymentMethodId": intent.paymentMethod as Any,
            "status": serializeSetupIntentStatus(intent.status),
            "usage": intent.usage == .offSession ? "offSession" : "onSession",
            "paymentMethodTypes": intent.paymentMethodTypes.map {
                serializePaymentMethodType(PaymentMethodType(rawValue: $0.uintValue) ?? .cardPresent)
            },
        ]

        if let latestAttempt = intent.latestAttempt {
            jsonObject["latestAttempt"] = serializeSetupAttempt(attempt: latestAttempt)
        }

        return jsonObject
    }

    static func serializeRefund(refund: Refund) -> [String: Any] {
        let status: String
        switch refund.status {
        case .succeeded: status = "succeeded"
        case .failed: status = "failed"
        case .pending: status = "pending"
        @unknown default: status = "unknown"
        }

        return [
            "id": refund.stripeId,
            "amount": refund.amount,
            "balanceTransaction": refund.balanceTransaction as Any,
            "chargeId": refund.chargeId as Any,
            "created": refund.created.timeIntervalSince1970,
            "currency": refund.currency,
            "description": refund.stripeDescription as Any,
            "failureBalanceTransaction": refund.failureBalanceTransaction as Any,
            "failureReason": refund.failureReason as Any,
            "metadata": refund.metadata,
            "paymentIntentId": refund.paymentIntentId as Any,
            "reason": refund.reason as Any,
            "receiptNumber": refund.receiptNumber as Any,
            "sourceTransferReversal": refund.sourceTransferReversal as Any,
            "status": status,
            "transferReversal": refund.transferReversal as Any,
        ]
    }

    static func buildToggles(_ raw: [[String: Any]]) throws -> [Toggle] {
        return try raw.map { toggle in
            let defaultValue: ToggleValue = (toggle["defaultValue"] as? String) == "disabled" ? .disabled : .enabled
            let builder = ToggleBuilder(defaultValue: defaultValue)
            if let title = toggle["title"] as? String { _ = builder.setTitle(title) }
            if let description = toggle["description"] as? String { _ = builder.setStripeDescription(description) }
            return try builder.build()
        }
    }

    static func buildInput(_ input: [String: Any]) throws -> Input {
        let formType = input["formType"] as? String ?? ""
        let title = input["title"] as? String ?? ""
        let required = input["required"] as? Bool ?? false
        let description = input["description"] as? String
        let skipButtonText = input["skipButtonText"] as? String
        let submitButtonText = input["submitButtonText"] as? String
        let toggles = try buildToggles(input["toggles"] as? [[String: Any]] ?? [])

        switch formType {
        case "selection":
            let builder = SelectionInputBuilder(title: title)
            _ = builder.setRequired(required)
            _ = builder.setToggles(toggles)
            if let description = description { _ = builder.setStripeDescription(description) }
            if let skipButtonText = skipButtonText { _ = builder.setSkipButtonText(skipButtonText) }

            let buttons: [SelectionButton] = try (input["selectionButtons"] as? [[String: Any]] ?? []).map { button in
                let style: SelectionButtonStyle = (button["style"] as? String) == "secondary" ? .secondary : .primary
                return try SelectionButtonBuilder(
                    style: style,
                    text: button["text"] as? String ?? "",
                    id: button["id"] as? String ?? ""
                )
                .build()
            }
            _ = builder.setSelectionButtons(buttons)
            return try builder.build()
        case "signature":
            let builder = SignatureInputBuilder(title: title)
            _ = builder.setRequired(required)
            _ = builder.setToggles(toggles)
            if let description = description { _ = builder.setStripeDescription(description) }
            if let skipButtonText = skipButtonText { _ = builder.setSkipButtonText(skipButtonText) }
            if let submitButtonText = submitButtonText { _ = builder.setSubmitButtonText(submitButtonText) }
            return try builder.build()
        case "phone":
            let builder = PhoneInputBuilder(title: title)
            _ = builder.setRequired(required)
            _ = builder.setToggles(toggles)
            if let description = description { _ = builder.setStripeDescription(description) }
            if let skipButtonText = skipButtonText { _ = builder.setSkipButtonText(skipButtonText) }
            if let submitButtonText = submitButtonText { _ = builder.setSubmitButtonText(submitButtonText) }
            return try builder.build()
        case "email":
            let builder = EmailInputBuilder(title: title)
            _ = builder.setRequired(required)
            _ = builder.setToggles(toggles)
            if let description = description { _ = builder.setStripeDescription(description) }
            if let skipButtonText = skipButtonText { _ = builder.setSkipButtonText(skipButtonText) }
            if let submitButtonText = submitButtonText { _ = builder.setSubmitButtonText(submitButtonText) }
            return try builder.build()
        case "numeric":
            let builder = NumericInputBuilder(title: title)
            _ = builder.setRequired(required)
            _ = builder.setToggles(toggles)
            if let description = description { _ = builder.setStripeDescription(description) }
            if let skipButtonText = skipButtonText { _ = builder.setSkipButtonText(skipButtonText) }
            if let submitButtonText = submitButtonText { _ = builder.setSubmitButtonText(submitButtonText) }
            return try builder.build()
        default:
            let builder = TextInputBuilder(title: title)
            _ = builder.setRequired(required)
            _ = builder.setToggles(toggles)
            if let description = description { _ = builder.setStripeDescription(description) }
            if let skipButtonText = skipButtonText { _ = builder.setSkipButtonText(skipButtonText) }
            if let submitButtonText = submitButtonText { _ = builder.setSubmitButtonText(submitButtonText) }
            return try builder.build()
        }
    }

    private static func serializeToggleResults(_ toggles: [NSNumber]) -> [String] {
        return toggles.map { value in
            switch ToggleResult(rawValue: value.uintValue) {
            case .enabled: return "enabled"
            case .disabled: return "disabled"
            default: return "skipped"
            }
        }
    }

    static func serializeCollectInputsResult(result: CollectInputsResult) -> [String: Any] {
        var jsonObject: [String: Any] = ["skipped": result.skipped]

        if let selection = result as? SelectionResult {
            jsonObject["formType"] = "selection"
            jsonObject["toggles"] = serializeToggleResults(selection.toggles)
            jsonObject["selection"] = selection.selection as Any
            jsonObject["selectionId"] = selection.selectionId as Any
        } else if let signature = result as? SignatureResult {
            jsonObject["formType"] = "signature"
            jsonObject["toggles"] = serializeToggleResults(signature.toggles)
            jsonObject["signatureSvg"] = signature.signatureSvg as Any
        } else if let phone = result as? PhoneResult {
            jsonObject["formType"] = "phone"
            jsonObject["toggles"] = serializeToggleResults(phone.toggles)
            jsonObject["phone"] = phone.phone as Any
        } else if let email = result as? EmailResult {
            jsonObject["formType"] = "email"
            jsonObject["toggles"] = serializeToggleResults(email.toggles)
            jsonObject["email"] = email.email as Any
        } else if let numeric = result as? NumericResult {
            jsonObject["formType"] = "numeric"
            jsonObject["toggles"] = serializeToggleResults(numeric.toggles)
            jsonObject["numericString"] = numeric.numericString as Any
        } else if let text = result as? TextResult {
            jsonObject["formType"] = "text"
            jsonObject["toggles"] = serializeToggleResults(text.toggles)
            jsonObject["text"] = text.text as Any
        }

        return jsonObject
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
