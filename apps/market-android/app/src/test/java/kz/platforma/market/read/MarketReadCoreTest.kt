package kz.platforma.market.read

import java.io.File
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

/** Host JVM regression tests using the same synthetic corpus; not APK/device acceptance. */
class MarketReadCoreTest {
    private val scope = ReadScope("synthetic-offline", "00000000-0000-4000-8000-000000000020", "00000000-0000-4000-8000-000000000004", 1)
    private val product = "00000000-0000-4000-8000-000000000001"
    private val variant = "00000000-0000-4000-8000-000000000002"
    private val offer = "00000000-0000-4000-8000-000000000003"
    private val order = "00000000-0000-4000-8000-000000000006"
    private val cases by lazy { JSONObject(File(requireNotNull(System.getProperty("market.fixture.path"))).readText()).getJSONArray("cases") }
    private fun fixture(id: String): JSONObject {
        for (index in 0 until cases.length()) {
            val item = cases.getJSONObject(index)
            if (item.getString("id") == id) return JSONObject(item.getJSONObject("payload").toString())
        }
        error("Missing synthetic fixture $id")
    }
    private fun response(id: String, status: Int = 200) = ReadResponse(status, fixture(id).toString())

    @Test fun catalogComparisonWorkflowKeepsExactWireStrings() = runBlocking {
        val reads = MarketReadStore(scope) { request ->
            when (request.path) {
                "/marketplace/search" -> {
                    assertEquals(scope.organizationId, request.query["buyerOrganizationId"])
                    response("catalog-null-price")
                }
                "/marketplace/products/$product/compare" -> response("comparison-exact-offer")
                "/supplier-orders/$order/workflow" -> response("order-workflow-minimal")
                else -> error("Invented endpoint")
            }
        }
        reads.load(ReadTarget.Catalog("synthetic"))
        assertEquals(ReadPhase.READY, reads.state.value.phase)
        assertEquals(WireValue.Null, reads.state.value.projection?.root?.get("items")?.items()?.first()?.get("offers")?.items()?.first()?.get("priceMinor"))
        reads.load(ReadTarget.Comparison(product, variant))
        val exact = reads.state.value.projection?.selectedOffer(variant, offer)
        assertEquals("9007199254740993", exact?.get("price")?.get("amountMinor")?.text())
        assertNull(reads.state.value.projection?.selectedOffer(order, offer))
        reads.load(ReadTarget.Workflow(order))
        val root = reads.state.value.projection?.root
        assertEquals("9007199254740993", root?.get("order")?.get("subtotalAmountMinor")?.text())
        assertEquals("1.000001", root?.get("order")?.get("items")?.items()?.first()?.get("quantity")?.text())
        assertEquals(WireValue.Null, root?.get("invoiceDocumentId"))
        assertNull(root?.get("paymentSummary")); assertNull(root?.get("order")?.get("documents"))
    }

    @Test fun exactZeroIsNotMissingOrNull() = runBlocking {
        val wire = fixture("catalog-null-price")
        wire.getJSONArray("items").getJSONObject(0).getJSONArray("offers").getJSONObject(0).put("priceMinor", "0")
        val reads = MarketReadStore(scope) { ReadResponse(200, wire.toString()) }
        reads.load(ReadTarget.Catalog(""))
        val result = reads.state.value.projection?.root?.get("items")?.items()?.first()?.get("offers")?.items()?.first()
        assertEquals("0", result?.get("priceMinor")?.text())
        assertEquals(WireValue.Null, result?.get("normalizedPriceMinor"))
    }

    @Test fun emptyCatalogAndNoSelectedVariantAreEmpty() = runBlocking {
        val reads = MarketReadStore(scope) { request -> if (request.path == "/marketplace/search") response("catalog-empty") else response("comparison-no-offer") }
        reads.load(ReadTarget.Catalog("")); assertEquals(ReadPhase.EMPTY, reads.state.value.phase)
        reads.load(ReadTarget.Comparison(product, null)); assertEquals(ReadPhase.EMPTY, reads.state.value.phase)
    }

    @Test fun consumedContractMismatchesDoNotBecomeSuccessfulData() = runBlocking {
        val examples = listOf(
            "comparison-invalid-currency" to ReadTarget.Comparison(product, variant),
            "workflow-null-summary" to ReadTarget.Workflow(order),
            "workflow-missing-invoice" to ReadTarget.Workflow(order),
            "workspace-unknown-enum" to ReadTarget.Orders(),
        )
        for ((id, target) in examples) {
            val reads = MarketReadStore(scope) { response(id) }
            reads.load(target)
            assertEquals(id, ReadPhase.CONTRACT_ERROR, reads.state.value.phase)
            assertNull(reads.state.value.projection)
        }
    }

    @Test fun unsupportedDetailStatusIsPreservedWithoutActions() = runBlocking {
        val data = fixture("order-workflow-minimal").put("status", "FUTURE_SYNTHETIC_STATE")
        val reads = MarketReadStore(scope) { ReadResponse(200, data.toString()) }
        reads.load(ReadTarget.Workflow(order))
        assertEquals(ReadPhase.UNSUPPORTED, reads.state.value.phase)
        assertEquals("FUTURE_SYNTHETIC_STATE", reads.state.value.projection?.root?.get("status")?.text())
    }

    @Test fun lowerSameOrderVersionDoesNotReplaceAcceptedRead() = runBlocking {
        var calls = 0
        val reads = MarketReadStore(scope) { calls++; ReadResponse(200, fixture("order-workflow-minimal").put("version", if (calls == 1) 8 else 7).toString()) }
        reads.load(ReadTarget.Workflow(order)); reads.refresh()
        assertEquals(8, reads.state.value.projection?.version)
        reads.reset(scope) { response("order-workflow-minimal") }
        reads.load(ReadTarget.Workflow(order))
        assertEquals(7, reads.state.value.projection?.version)
    }

    @Test fun opaqueCursorHasNoCallerSelectedTenant() = runBlocking {
        val reads = MarketReadStore(scope) { request ->
            assertEquals("/workspaces/buyer/orders", request.path)
            assertEquals(mapOf("cursor" to "opaque+/="), request.query)
            response("workspace-orders-page")
        }
        reads.load(ReadTarget.Orders("opaque+/="))
        assertEquals(ReadPhase.READY, reads.state.value.phase)
        assertNull(reads.state.value.projection?.root?.get("items")?.items()?.first()?.get("nextAction"))
    }

    @Test fun httpErrorsRecoverOnlyAfterExplicitRefresh() = runBlocking {
        val examples = listOf(
            Triple("error-denied", 403, ReadPhase.DENIED), Triple("error-not-found", 404, ReadPhase.UNAVAILABLE),
            Triple("error-throttled", 429, ReadPhase.RETRY_LIMITED), Triple("error-opaque-message", 409, ReadPhase.ERROR),
        )
        for ((id, status, expected) in examples) {
            var calls = 0
            val reads = MarketReadStore(scope) { calls++; if (calls == 1) response(id, status) else response("order-workflow-minimal") }
            reads.load(ReadTarget.Workflow(order))
            assertEquals(expected, reads.state.value.phase); assertNull(reads.state.value.projection); assertEquals(1, calls)
            reads.refresh()
            assertEquals(ReadPhase.READY, reads.state.value.phase); assertEquals(2, calls)
        }
    }

    @Test fun malformedEnvelopeAndTransportFailureStaySafe() = runBlocking {
        val bad = MarketReadStore(scope) { response("error-missing-code", 403) }
        bad.load(ReadTarget.Workflow(order)); assertEquals(ReadPhase.CONTRACT_ERROR, bad.state.value.phase)
        var calls = 0
        val offline = MarketReadStore(scope) { calls++; if (calls == 1) error("Untrusted prose FORBIDDEN retry now") else response("order-workflow-minimal") }
        offline.load(ReadTarget.Workflow(order)); assertEquals(ReadPhase.ERROR, offline.state.value.phase)
        offline.refresh(); assertEquals(ReadPhase.READY, offline.state.value.phase)
    }

    @Test fun identicalScopeResetDiscardsLateSuccessAndLateFailure() = runBlocking {
        for (failure in listOf(false, true)) {
            val entered = CompletableDeferred<Unit>()
            val pending = CompletableDeferred<ReadResponse>()
            val reads = MarketReadStore(scope) { entered.complete(Unit); pending.await() }
            val old = async { reads.load(ReadTarget.Workflow(order)) }
            withTimeout(2_000) { entered.await() }
            reads.reset(scope) { response("catalog-empty") }
            assertFalse(reads.refresh()); assertEquals(ReadPhase.IDLE, reads.state.value.phase)
            reads.load(ReadTarget.Catalog("new"))
            if (failure) pending.completeExceptionally(IllegalStateException("synthetic offline")) else pending.complete(response("order-workflow-minimal"))
            assertFalse(old.await()); assertEquals(ReadPhase.EMPTY, reads.state.value.phase)
        }
    }

    @Test fun eachContextComponentResetsAndUsesNewTransport() = runBlocking {
        val scopes = listOf(scope.copy(environment = "other"), scope.copy(userId = product), scope.copy(organizationId = product), scope.copy(generation = 2))
        for (next in scopes) {
            val reads = MarketReadStore(scope) { response("order-workflow-minimal") }
            reads.load(ReadTarget.Workflow(order))
            var newCalls = 0
            reads.reset(next) { newCalls++; response("catalog-empty") }
            assertEquals(ReadPhase.IDLE, reads.state.value.phase); assertNull(reads.state.value.projection)
            assertFalse(reads.refresh()); assertEquals(0, newCalls)
            reads.load(ReadTarget.Catalog("")); assertEquals(1, newCalls)
        }
    }

    @Test fun overlappingQueriesDiscardOlderCompletion() = runBlocking {
        val entered = CompletableDeferred<Unit>()
        val pending = CompletableDeferred<ReadResponse>()
        var calls = 0
        val reads = MarketReadStore(scope) { calls++; if (calls == 1) { entered.complete(Unit); pending.await() } else response("catalog-empty") }
        val old = async { reads.load(ReadTarget.Catalog("first")) }
        withTimeout(2_000) { entered.await() }
        reads.load(ReadTarget.Catalog("latest"))
        pending.complete(response("catalog-null-price"))
        assertFalse(old.await()); assertEquals(ReadPhase.EMPTY, reads.state.value.phase)
    }

    @Test fun unrelatedOrderAndOrganizationAreRejected() = runBlocking {
        val reads = MarketReadStore(scope) { response("order-workflow-minimal") }
        reads.load(ReadTarget.Workflow(product)); assertEquals(ReadPhase.CONTRACT_ERROR, reads.state.value.phase)
        reads.reset(scope.copy(organizationId = product)) { response("order-workflow-minimal") }
        reads.load(ReadTarget.Workflow(order)); assertEquals(ReadPhase.CONTRACT_ERROR, reads.state.value.phase)
    }
}
