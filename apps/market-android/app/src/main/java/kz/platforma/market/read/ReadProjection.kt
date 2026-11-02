package kz.platforma.market.read

data class ReadScope(val environment: String, val userId: String, val organizationId: String, val generation: Long)
sealed interface ReadTarget {
    data class Catalog(val query: String, val offset: Int = 0) : ReadTarget
    data class Comparison(val productId: String, val variantId: String?) : ReadTarget
    data class Workflow(val orderId: String) : ReadTarget
    data class Orders(val cursor: String? = null) : ReadTarget
}

data class ReadProjection(
    val target: ReadTarget, val root: WireValue, val version: Int? = null,
    val isEmpty: Boolean = false, val isUnsupported: Boolean = false,
) {
    fun selectedOffer(variantId: String, offerId: String): WireValue? {
        if (target !is ReadTarget.Comparison || root["selectedVariantId"]?.text() != variantId ||
            root["variants"]?.items()?.any { it["id"]?.text() == variantId } != true) return null
        return root["offers"]?.items()?.firstOrNull { it["offerId"]?.text() == offerId && it["variantId"]?.text() == variantId }
    }

    companion object {
        // Display vocabulary only; no local state machine, mutation or authority grant.
        internal val displayStatuses = setOf(
            "DRAFT", "AWAITING_CONFIRMATION", "CONFIRMED", "PARTIALLY_CONFIRMED", "RESERVED",
            "AWAITING_PAYMENT", "PAID", "ASSEMBLING", "READY_TO_SHIP", "SHIPPED", "IN_TRANSIT",
            "DELIVERED", "PARTIALLY_FULFILLED", "RETURN_DISPUTE", "REJECTED", "CANCELLED",
        )
        fun decode(json: String, target: ReadTarget, scope: ReadScope): ReadProjection {
            val root = try { WireValue.parse(json) } catch (_: org.json.JSONException) { throw ReadContractException() }
            var version: Int? = null
            var empty = false
            var unsupported = false
            when (target) {
                is ReadTarget.Catalog -> {
                    root.string("query"); root.int("total"); root.int("offset"); root.int("limit", 1)
                    val products = root.array("items")
                    empty = products.isEmpty()
                    products.forEach { product ->
                        product.uuid("id"); product.string("name"); variants(product.array("variants"))
                        product.array("offers").forEach { offer ->
                            offer.uuid("id"); offer.uuid("variantId"); offer.required("supplier").uuid("id")
                            offer.decimal("priceMinor", true); offer.decimal("normalizedPriceMinor", true)
                            if (offer.required("currency") != WireValue.Null) offer.currency("currency")
                        }
                    }
                }
                is ReadTarget.Comparison -> {
                    if (root.required("product").uuid("id") != target.productId) throw ReadContractException()
                    variants(root.array("variants")); root.nullableString("selectedVariantId")
                    if (target.variantId != null && root["selectedVariantId"]?.text() != target.variantId) throw ReadContractException()
                    val offers = root.array("offers")
                    empty = offers.isEmpty()
                    offers.forEach { offer ->
                        offer.uuid("offerId"); offer.uuid("variantId")
                        offer.required("price").let { it.decimal("amountMinor"); it.decimal("normalizedPriceMinor"); it.currency("currency") }
                        offer.decimal("minimumOrderQuantity"); offer.decimal("orderIncrement")
                    }
                }
                is ReadTarget.Workflow -> {
                    if (root.uuid("orderId") != target.orderId) throw ReadContractException()
                    val order = root.required("order")
                    if (order.uuid("id") != target.orderId) throw ReadContractException()
                    if (order.uuid("buyerOrganizationId") != scope.organizationId && order.uuid("supplierOrganizationId") != scope.organizationId) throw ReadContractException()
                    order.int("version", 1); order.decimal("subtotalAmountMinor"); order.currency("currency")
                    order.array("items").forEach { item ->
                        item.uuid("offerId"); item.uuid("productVariantId")
                        item.decimal("quantity"); item.decimal("unitPriceMinor"); item.decimal("totalPriceMinor")
                    }
                    version = root.required("version").integer() ?: throw ReadContractException()
                    unsupported = root.string("status") !in displayStatuses
                    root.string("paymentStatus"); root.nullableString("invoiceDocumentId")
                    root.array("claims"); root.array("events")
                    if (root["paymentSummary"] != null && root["paymentSummary"] !is WireValue.Fields) throw ReadContractException()
                }
                is ReadTarget.Orders -> {
                    root.nullableString("nextCursor")
                    val orders = root.array("items")
                    empty = orders.isEmpty()
                    orders.forEach { order ->
                        order.uuid("id")
                        if (order.string("status") !in displayStatuses) throw ReadContractException()
                        val buyer = order.required("buyer").uuid("id")
                        val supplier = order.required("supplier").uuid("id")
                        if (buyer != scope.organizationId && supplier != scope.organizationId) throw ReadContractException()
                        order.decimal("subtotalAmountMinor")
                    }
                }
            }
            return ReadProjection(target, root, version, empty, unsupported)
        }
        private fun variants(values: List<WireValue>) { values.forEach { it.uuid("id"); it.string("label") } }
    }
}
