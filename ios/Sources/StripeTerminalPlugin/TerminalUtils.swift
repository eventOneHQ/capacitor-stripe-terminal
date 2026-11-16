//
//  TerminalUtils.swift
//  Plugin
//
//  Created by Noah Prail on 6/28/20.
//  Copyright © 2020 eventOne, Inc. All rights reserved.
//

import Capacitor
import Foundation
import StripeTerminal

public class StripeTerminalUtils {
    static func translateJSLogLevel(_ level: String?) -> LogLevel {
        switch level {
        case "error": return .error
        case "warning": return .warning
        case "info": return .info
        case "verbose": return .verbose
        default: return .none
        }
    }

    static func buildCollectPaymentIntentConfiguration(_ call: CAPPluginCall) throws -> CollectPaymentIntentConfiguration {
        let builder = CollectPaymentIntentConfigurationBuilder()
            .setUpdatePaymentIntent(call.getBool("updatePaymentIntent", false))
            .setSkipTipping(call.getBool("skipTipping", false))
            .setRequestDynamicCurrencyConversion(call.getBool("requestDynamicCurrencyConversion", false))

        if let tipping = call.getObject("tipping"),
           let eligibleAmount = tipping["eligibleAmount"] as? NSNumber {
            let tippingConfig = try TippingConfigurationBuilder()
                .setEligibleAmount(eligibleAmount.intValue)
                .build()
            _ = builder.setTippingConfiguration(tippingConfig)
        }

        if let customerCancellation = call.getString("customerCancellation") {
            _ = builder.setCustomerCancellation(translateJSCustomerCancellation(customerCancellation))
        }

        if let allowRedisplay = call.getString("allowRedisplay") {
            _ = builder.setAllowRedisplay(translateJSAllowRedisplay(allowRedisplay))
        }

        return try builder.build()
    }

    static func translateJSCollectDataType(_ value: String) -> CollectDataType {
        switch value {
        case "nfcUid": return .nfcUid
        case "magstripe": return .magstripe
        default: return .unknown
        }
    }

    static func serializeDisconnectReason(_ reason: DisconnectReason) -> String {
        switch reason {
        case .disconnectRequested: return "disconnectRequested"
        case .rebootRequested: return "rebootRequested"
        case .securityReboot: return "securityReboot"
        case .criticallyLowBattery: return "criticallyLowBattery"
        case .poweredOff: return "poweredOff"
        case .bluetoothDisabled: return "bluetoothDisabled"
        case .bluetoothSignalLost: return "bluetoothSignalLost"
        case .usbDisconnected: return "usbDisconnected"
        case .idlePowerDown: return "idlePowerDown"
        case .peerRemovedPairingInformation: return "peerRemovedPairingInformation"
        default: return "unknown"
        }
    }

    static func serializeReaderEvent(_ event: ReaderEvent) -> String {
        switch event {
        case .cardInserted: return "cardInserted"
        case .cardRemoved: return "cardRemoved"
        @unknown default: return "unknown"
        }
    }

    static func serializeReaderInputOptions(_ options: ReaderInputOptions) -> [String] {
        var result: [String] = []
        if options.contains(.swipeCard) { result.append("swipeCard") }
        if options.contains(.insertCard) { result.append("insertCard") }
        if options.contains(.tapCard) { result.append("tapCard") }
        return result
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

    static func translateJSOfflineBehavior(_ value: String) -> OfflineBehavior? {
        switch value {
        case "prefer_online": return .preferOnline
        case "require_online": return .requireOnline
        case "force_offline": return .forceOffline
        default: return nil
        }
    }

    static func serializeOfflineNetworkStatus(_ status: NetworkStatus) -> String {
        switch status {
        case .online: return "online"
        case .offline: return "offline"
        case .unknown: return "unknown"
        @unknown default: return "unknown"
        }
    }

    static func serializeOfflineStatusDetails(_ details: OfflineStatusDetails) -> [String: Any] {
        return [
            "networkStatus": serializeOfflineNetworkStatus(details.networkStatus),
            "offlinePaymentsCount": details.paymentsCount?.intValue ?? 0,
            "offlinePaymentAmountsByCurrency": details.paymentAmountsByCurrency.mapValues { $0.intValue },
        ]
    }

    static func serializeOfflineStatus(_ status: OfflineStatus) -> [String: Any] {
        var jsonObject: [String: Any] = ["sdk": serializeOfflineStatusDetails(status.sdk)]
        if let reader = status.reader {
            jsonObject["reader"] = serializeOfflineStatusDetails(reader)
        }
        return jsonObject
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

    static func translateJSDeviceType(_ type: String) -> DeviceType? {
        switch type {
        case "chipper1X": return .chipper1X
        case "chipper2X": return .chipper2X
        case "etna": return .etna
        case "stripeM2": return .stripeM2
        case "stripeS700": return .stripeS700
        case "stripeS700Devkit": return .stripeS700DevKit
        case "stripeS710": return .stripeS710
        case "stripeS710Devkit": return .stripeS710DevKit
        case "stripeT600": return .stripeT600
        case "stripeT600Devkit": return .stripeT600DevKit
        case "stripeT610": return .stripeT610
        case "stripeT610Devkit": return .stripeT610DevKit
        case "stripeU200": return .stripeU200
        case "tapToPay": return .tapToPay
        case "verifoneM425": return .verifoneM425
        case "verifoneM450": return .verifoneM450
        case "verifoneP630": return .verifoneP630
        case "verifoneUX700": return .verifoneUX700
        case "verifoneUX700Devkit": return .verifoneUX700DevKit
        case "verifoneV660p": return .verifoneV660p
        case "verifoneV660pDevkit": return .verifoneV660pDevKit
        case "verifoneVL110": return .verifoneVL110
        case "verifoneVM100": return .verifoneVM100
        case "verifoneVM110": return .verifoneVM110
        case "verifoneVP100": return .verifoneVP100
        case "verifoneVP110": return .verifoneVP110
        case "wiseCube": return .wiseCube
        case "wisePad3": return .wisePad3
        case "wisePosE": return .wisePosE
        case "wisePosEDevkit": return .wisePosEDevKit
        default: return nil
        }
    }

    static func translateJSDiscoveryMethod(_ method: String) -> DiscoveryMethod? {
        switch method {
        case "bluetoothScan": return .bluetoothScan
        case "bluetoothProximity": return .bluetoothProximity
        case "internet": return .internet
        case "tapToPay": return .tapToPay
        default: return nil
        }
    }

    static func serializeDeviceType(_ deviceType: DeviceType) -> String {
        switch deviceType {
        case .chipper1X: return "chipper1X"
        case .chipper2X: return "chipper2X"
        case .etna: return "etna"
        case .stripeM2: return "stripeM2"
        case .stripeS700: return "stripeS700"
        case .stripeS700DevKit: return "stripeS700Devkit"
        case .stripeS710: return "stripeS710"
        case .stripeS710DevKit: return "stripeS710Devkit"
        case .stripeT600: return "stripeT600"
        case .stripeT600DevKit: return "stripeT600Devkit"
        case .stripeT610: return "stripeT610"
        case .stripeT610DevKit: return "stripeT610Devkit"
        case .stripeU200: return "stripeU200"
        case .tapToPay: return "tapToPay"
        case .verifoneM425: return "verifoneM425"
        case .verifoneM450: return "verifoneM450"
        case .verifoneP630: return "verifoneP630"
        case .verifoneUX700: return "verifoneUX700"
        case .verifoneUX700DevKit: return "verifoneUX700Devkit"
        case .verifoneV660p: return "verifoneV660p"
        case .verifoneV660pDevKit: return "verifoneV660pDevkit"
        case .verifoneVL110: return "verifoneVL110"
        case .verifoneVM100: return "verifoneVM100"
        case .verifoneVM110: return "verifoneVM110"
        case .verifoneVP100: return "verifoneVP100"
        case .verifoneVP110: return "verifoneVP110"
        case .wiseCube: return "wiseCube"
        case .wisePad3: return "wisePad3"
        case .wisePosE: return "wisePosE"
        case .wisePosEDevKit: return "wisePosEDevkit"
        case .unknown: return "unknown"
        @unknown default: return "unknown"
        }
    }

    static func serializeConnectionStatus(_ status: ConnectionStatus) -> String {
        switch status {
        case .notConnected: return "notConnected"
        case .discovering: return "discovering"
        case .connecting: return "connecting"
        case .connected: return "connected"
        case .reconnecting: return "reconnecting"
        @unknown default: return "notConnected"
        }
    }

    static func serializePaymentStatus(_ status: PaymentStatus) -> String {
        switch status {
        case .notReady: return "notReady"
        case .ready: return "ready"
        case .waitingForInput: return "waitingForInput"
        case .processing: return "processing"
        @unknown default: return "notReady"
        }
    }

    static func serializeReaderDisplayMessage(_ message: ReaderDisplayMessage) -> String {
        switch message {
        case .retryCard: return "retryCard"
        case .insertCard: return "insertCard"
        case .insertOrSwipeCard: return "insertOrSwipeCard"
        case .swipeCard: return "swipeCard"
        case .removeCard: return "removeCard"
        case .multipleContactlessCardsDetected: return "multipleContactlessCardsDetected"
        case .tryAnotherReadMethod: return "tryAnotherReadMethod"
        case .tryAnotherCard: return "tryAnotherCard"
        case .cardRemovedTooEarly: return "cardRemovedTooEarly"
        @unknown default: return "retryCard"
        }
    }

    static func serializePaymentIntentStatus(_ status: PaymentIntentStatus) -> String {
        switch status {
        case .requiresPaymentMethod: return "requiresPaymentMethod"
        case .requiresConfirmation: return "requiresConfirmation"
        case .requiresCapture: return "requiresCapture"
        case .requiresAction: return "requiresAction"
        case .requiresReauthorization: return "requiresReauthorization"
        case .processing: return "processing"
        case .canceled: return "canceled"
        case .succeeded: return "succeeded"
        @unknown default: return "unknown"
        }
    }

    static func serializeChargeStatus(_ status: ChargeStatus) -> String {
        switch status {
        case .succeeded: return "succeeded"
        case .pending: return "pending"
        case .failed: return "failed"
        @unknown default: return "failed"
        }
    }

    static func serializeLocationStatus(_ status: LocationStatus) -> String {
        switch status {
        case .notSet: return "notSet"
        case .set: return "set"
        case .unknown: return "unknown"
        @unknown default: return "unknown"
        }
    }

    static func serializeNetworkStatus(_ status: ReaderNetworkStatus) -> String {
        switch status {
        case .online: return "online"
        case .offline: return "offline"
        case .unknown: return "unknown"
        @unknown default: return "unknown"
        }
    }

    static func serializeBatteryStatus(_ status: BatteryStatus) -> String {
        switch status {
        case .critical: return "critical"
        case .low: return "low"
        case .nominal: return "nominal"
        case .unknown: return "unknown"
        @unknown default: return "unknown"
        }
    }

    static func serializeSimulateReaderUpdate(_ update: SimulateReaderUpdate) -> String {
        switch update {
        case .available: return "available"
        case .required: return "required"
        case .lowBattery: return "lowBattery"
        case .random: return "random"
        default: return "none"
        }
    }

    static func translateJSSimulateReaderUpdate(_ update: String) -> SimulateReaderUpdate? {
        switch update {
        case "available": return .available
        case "none": return SimulateReaderUpdate.none
        case "required": return .required
        case "lowBattery": return .lowBattery
        case "random": return .random
        default: return nil
        }
    }

    static func translateJSSimulatedCardType(_ type: String) -> SimulatedCardType? {
        switch type {
        case "visa": return .visa
        case "visaDebit": return .visaDebit
        case "mastercard": return .mastercard
        case "masterDebit": return .masterDebit
        case "mastercardPrepaid": return .mastercardPrepaid
        case "amex": return .amex
        case "amex2": return .amex2
        case "discover": return .discover
        case "discover2": return .discover2
        case "diners": return .diners
        case "diners14Digit": return .diners14Digit
        case "jcb": return .jcb
        case "unionPay": return .unionPay
        case "interac": return .interac
        case "chargeDeclined": return .chargeDeclined
        case "chargeDeclinedInsufficientFunds": return .chargeDeclinedInsufficientFunds
        case "chargeDeclinedLostCard": return .chargeDeclinedLostCard
        case "chargeDeclinedStolenCard": return .chargeDeclinedStolenCard
        case "chargeDeclinedExpiredCard": return .chargeDeclinedExpiredCard
        case "chargeDeclinedProcessingError": return .chargeDeclinedProcessingError
        case "refundFailed": return .refundFailed
        default: return nil
        }
    }

    static func serializeReader(reader: Reader) -> [String: Any] {
        var jsonObject: [String: Any] = [
            "deviceType": serializeDeviceType(reader.deviceType),
            "simulated": reader.simulated,
            "id": reader.stripeId as Any,
            "stripeId": reader.stripeId as Any,
            "locationId": reader.locationId as Any,
            "locationStatus": serializeLocationStatus(reader.locationStatus),
            "serialNumber": reader.serialNumber,
            // Bluetooth reader props
            "deviceSoftwareVersion": reader.deviceSoftwareVersion as Any,
            "isAvailableUpdate": reader.availableUpdate != nil,
            "batteryLevel": reader.batteryLevel?.decimalValue as Any,
            "batteryStatus": serializeBatteryStatus(reader.batteryStatus),
            "isCharging": reader.isCharging as Any,
            // Internet reader props
            "ipAddress": reader.ipAddress as Any,
            "status": serializeNetworkStatus(reader.status),
            "label": reader.label as Any,
        ]

        if let availableUpdate = reader.availableUpdate {
            jsonObject["availableUpdate"] = serializeUpdate(update: availableUpdate)
        }

        if let location = reader.location {
            jsonObject["location"] = serializeLocation(location: location)
        }

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

    static func serializeCardFundingType(_ funding: CardFundingType) -> String {
        switch funding {
        case .debit: return "debit"
        case .credit: return "credit"
        case .prepaid: return "prepaid"
        default: return "other"
        }
    }

    static func serializeReceiptDetails(receipt: ReceiptDetails) -> [String: Any] {
        return [
            "accountType": receipt.accountType as Any,
            "applicationCryptogram": receipt.applicationCryptogram,
            "applicationPreferredName": receipt.applicationPreferredName,
            "authorizationCode": receipt.authorizationCode as Any,
            "authorizationResponseCode": receipt.authorizationResponseCode,
            "cvm": receipt.cardholderVerificationMethod,
            "dedicatedFileName": receipt.dedicatedFileName,
            "terminalVerificationResult": receipt.terminalVerificationResults,
            "transactionStatusInformation": receipt.transactionStatusInformation,
        ]
    }

    static func serializeCardPresentDetails(details: CardPresentDetails) -> [String: Any] {
        var jsonObject: [String: Any] = [
            "last4": details.last4,
            "expMonth": details.expMonth,
            "expYear": details.expYear,
            "cardholderName": details.cardholderName as Any,
            "funding": serializeCardFundingType(details.funding),
            "brand": Terminal.stringFromCardBrand(details.brand),
            "generatedCard": details.generatedCard as Any,
            "emvAuthData": details.emvAuthData as Any,
            "country": details.country as Any,
            "preferredLocales": details.preferredLocales as Any,
            "issuer": details.issuer as Any,
            "iin": details.iin as Any,
            "description": details.stripeDescription as Any,
            "location": details.location as Any,
            "reader": details.reader as Any,
            "readMethod": Terminal.stringFromReadMethod(details.readMethod),
        ]

        if let network = details.network {
            jsonObject["network"] = "\(network)"
        }
        if let receipt = details.receipt {
            jsonObject["receipt"] = serializeReceiptDetails(receipt: receipt)
        }
        if let wallet = details.wallet {
            jsonObject["wallet"] = ["type": wallet.type as Any]
        }

        return jsonObject
    }

    static func serializePaymentMethodDetails(details: PaymentMethodDetails) -> [String: Any] {
        var jsonObject: [String: Any] = [
            "type": serializePaymentMethodType(details.type),
        ]

        if let cardPresent = details.cardPresent {
            jsonObject["cardPresentDetails"] = serializeCardPresentDetails(details: cardPresent)
        }
        if let interacPresent = details.interacPresent {
            jsonObject["interacPresentDetails"] = serializeCardPresentDetails(details: interacPresent)
        }
        if let card = details.card {
            jsonObject["cardDetails"] = [
                "brand": Terminal.stringFromCardBrand(card.brand),
                "country": card.country as Any,
                "expMonth": card.expMonth,
                "expYear": card.expYear,
                "funding": serializeCardFundingType(card.funding),
                "last4": card.last4 as Any,
            ]
        }

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
                "status": serializeChargeStatus(charge.status),
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
                "balanceTransaction": charge.balanceTransaction as Any,
                "applicationFee": charge.applicationFee as Any,
                "applicationFeeAmount": charge.applicationFeeAmount as Any,
                "onBehalfOf": charge.onBehalfOf as Any,
            ]

            if let paymentMethodDetails = charge.paymentMethodDetails {
                chargeJson["paymentMethodDetails"] = serializePaymentMethodDetails(details: paymentMethodDetails)
            }

            return chargeJson
        }

        var jsonObject: [String: Any] = [
            "id": intent.stripeId,
            "stripeId": intent.stripeId,
            "created": intent.created.timeIntervalSince1970,
            "status": serializePaymentIntentStatus(intent.status),
            "amount": intent.amount,
            "currency": intent.currency,
            "amountTip": intent.amountTip as Any,
            "statementDescriptor": intent.statementDescriptor as Any,
            "statementDescriptorSuffix": intent.statementDescriptorSuffix as Any,
            "charges": chargesJson,
            "metadata": intent.metadata as Any,
            "amountCapturable": intent.amountCapturable as Any,
            "amountReceived": intent.amountReceived as Any,
            "amountRequested": intent.amountRequested as Any,
            "applicationFeeAmount": intent.applicationFeeAmount as Any,
            "canceledAt": intent.canceledAt?.timeIntervalSince1970 as Any,
            "cancellationReason": intent.cancellationReason as Any,
            "captureMethod": Terminal.stringFromCaptureMethod(intent.captureMethod),
            "clientSecret": intent.clientSecret as Any,
            "confirmationMethod": intent.confirmationMethod as Any,
            "customer": intent.customer as Any,
            "description": intent.stripeDescription as Any,
            "livemode": intent.livemode,
            "onBehalfOf": intent.onBehalfOf as Any,
            "paymentMethodId": intent.paymentMethodId as Any,
            "receiptEmail": intent.receiptEmail as Any,
            "setupFutureUsage": intent.setupFutureUsage as Any,
            "transferGroup": intent.transferGroup as Any,
            "paymentMethodTypes": (intent.paymentMethodTypes ?? []).map {
                serializePaymentMethodType(PaymentMethodType(rawValue: $0.uintValue) ?? .cardPresent)
            },
        ]
        
        if let amountDetails = intent.amountDetails {
            var amountDetailsJson: [String: Any] = [:]
            if let tip = amountDetails.tip {
                amountDetailsJson["tip"] = ["amount": tip.amount as Any]
            }
            jsonObject["amountDetails"] = amountDetailsJson
        }

        if let offlineDetails = intent.offlineDetails {
            var offlineDetailsJson: [String: Any] = ["requiresUpload": offlineDetails.requiresUpload]
            if let storedAt = offlineDetails.storedAt {
                offlineDetailsJson["storedAtMs"] = Int64(storedAt.timeIntervalSince1970 * 1000)
            }
            jsonObject["offlineDetails"] = offlineDetailsJson
        }

        if let paymentMethod = intent.paymentMethod {
            jsonObject["paymentMethod"] = [
                "id": paymentMethod.stripeId,
                "stripeId": paymentMethod.stripeId,
                "type": serializePaymentMethodType(paymentMethod.type),
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
        // The SDK doesn't expose the simulated card's type, so it can't be reported back.
        return [
            "availableReaderUpdate": serializeSimulateReaderUpdate(simulatorConfig.availableReaderUpdate),
            "offlineEnabled": simulatorConfig.offlineEnabled,
        ]
    }
}
