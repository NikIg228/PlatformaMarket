import Foundation

public struct ReadScope: Equatable, Sendable {
    public let environment, userID, organizationID: String
    public let generation: UInt64
    public init(environment: String, userID: String, organizationID: String, generation: UInt64) {
        self.environment = environment; self.userID = userID
        self.organizationID = organizationID; self.generation = generation
    }
}

public enum ReadTarget: Equatable, Sendable {
    case catalog(query: String, offset: Int)
    case comparison(productID: String, variantID: String?)
    case workflow(orderID: String)
    case orders(cursor: String?)
}

public struct ReadProjection: Equatable, Sendable {
    public let target: ReadTarget
    public let root: WireValue
    public let version: Int?
    public let isEmpty, isUnsupported: Bool

    // Display vocabulary only, never a state machine or grant of permission.
    static let displayStatuses: Set<String> = [
        "DRAFT", "AWAITING_CONFIRMATION", "CONFIRMED", "PARTIALLY_CONFIRMED", "RESERVED",
        "AWAITING_PAYMENT", "PAID", "ASSEMBLING", "READY_TO_SHIP", "SHIPPED", "IN_TRANSIT",
        "DELIVERED", "PARTIALLY_FULFILLED", "RETURN_DISPUTE", "REJECTED", "CANCELLED"
    ]

    public static func decode(_ data: Data, target: ReadTarget, scope: ReadScope) throws -> Self {
        let root = try JSONDecoder().decode(WireValue.self, from: data)
        var version: Int?
        var empty = false
        var unsupported = false
        switch target {
        case .catalog:
            _ = try root.string("query")
            _ = try root.int("total"); _ = try root.int("offset"); _ = try root.int("limit", minimum: 1)
            let products = try root.array("items")
            empty = products.isEmpty
            for product in products {
                _ = try product.uuid("id"); _ = try product.string("name")
                try variants(product.array("variants"))
                for offer in try product.array("offers") {
                    _ = try offer.uuid("id"); _ = try offer.uuid("variantId")
                    _ = try offer.required("supplier").uuid("id")
                    try offer.decimal("priceMinor", nullable: true)
                    try offer.decimal("normalizedPriceMinor", nullable: true)
                    if try offer.required("currency") != .null { try offer.currency("currency") }
                }
            }
        case let .comparison(productID, variantID):
            guard try root.required("product").uuid("id") == productID else { throw ReadContractError.incompatible }
            try variants(root.array("variants"))
            try root.nullableString("selectedVariantId")
            if let variantID, root["selectedVariantId"]?.text != variantID { throw ReadContractError.incompatible }
            let offers = try root.array("offers")
            empty = offers.isEmpty
            for offer in offers {
                _ = try offer.uuid("offerId"); _ = try offer.uuid("variantId")
                let price = try offer.required("price")
                try price.decimal("amountMinor"); try price.decimal("normalizedPriceMinor"); try price.currency("currency")
                try offer.decimal("minimumOrderQuantity"); try offer.decimal("orderIncrement")
            }
        case let .workflow(orderID):
            guard try root.uuid("orderId") == orderID else { throw ReadContractError.incompatible }
            let order = try root.required("order")
            guard try order.uuid("id") == orderID else { throw ReadContractError.incompatible }
            try party(order, scope: scope)
            _ = try order.int("version", minimum: 1)
            try order.decimal("subtotalAmountMinor"); try order.currency("currency")
            for item in try order.array("items") {
                _ = try item.uuid("offerId"); _ = try item.uuid("productVariantId")
                try item.decimal("quantity"); try item.decimal("unitPriceMinor"); try item.decimal("totalPriceMinor")
            }
            // Existing workflow version is an integer, unlike the positive nested order version.
            guard let n = try root.required("version").integer else { throw ReadContractError.incompatible }
            version = n
            unsupported = !displayStatuses.contains(try root.string("status"))
            _ = try root.string("paymentStatus"); try root.nullableString("invoiceDocumentId")
            _ = try root.array("claims"); _ = try root.array("events")
            if let summary = root["paymentSummary"], case .object = summary {} else if root["paymentSummary"] != nil {
                throw ReadContractError.incompatible
            }
        case .orders:
            try root.nullableString("nextCursor")
            let orders = try root.array("items")
            empty = orders.isEmpty
            for order in orders {
                _ = try order.uuid("id")
                guard displayStatuses.contains(try order.string("status")) else { throw ReadContractError.incompatible }
                let buyer = try order.required("buyer").uuid("id"), supplier = try order.required("supplier").uuid("id")
                guard buyer == scope.organizationID || supplier == scope.organizationID else { throw ReadContractError.incompatible }
                try order.decimal("subtotalAmountMinor")
            }
        }
        return .init(target: target, root: root, version: version, isEmpty: empty, isUnsupported: unsupported)
    }

    public func selectedOffer(variantID: String, offerID: String) -> WireValue? {
        guard case .comparison = target, root["selectedVariantId"]?.text == variantID,
              root["variants"]?.elements?.contains(where: { $0["id"]?.text == variantID }) == true else { return nil }
        return root["offers"]?.elements?.first { $0["offerId"]?.text == offerID && $0["variantId"]?.text == variantID }
    }

    private static func variants(_ values: [WireValue]) throws {
        for value in values { _ = try value.uuid("id"); _ = try value.string("label") }
    }
    private static func party(_ order: WireValue, scope: ReadScope) throws {
        let buyer = try order.uuid("buyerOrganizationId"), supplier = try order.uuid("supplierOrganizationId")
        guard buyer == scope.organizationID || supplier == scope.organizationID else { throw ReadContractError.incompatible }
    }
}
