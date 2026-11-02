package kz.platforma.market.read

import java.util.UUID
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class ReadPhase { IDLE, LOADING, READY, EMPTY, UNSUPPORTED, CONTRACT_ERROR, AUTHENTICATION_REQUIRED, DENIED, UNAVAILABLE, RETRY_LIMITED, ERROR }
data class ReadState(val phase: ReadPhase, val projection: ReadProjection? = null, val requestId: String? = null)
data class ReadRequest(val path: String, val query: Map<String, String>)
data class ReadResponse(val status: Int, val body: String)
fun interface ReadTransport { suspend fun execute(request: ReadRequest): ReadResponse }

/** Native Android state owner. An accepted authenticated transport is injected separately. */
class MarketReadStore(initialScope: ReadScope, initialTransport: ReadTransport) {
    private val lock = Any()
    private var scope = initialScope
    private var transport = initialTransport
    private var binding = UUID.randomUUID()
    private var active: UUID? = null
    private var lastTarget: ReadTarget? = null
    private var accepted: ReadProjection? = null
    private val mutableState = MutableStateFlow(ReadState(ReadPhase.IDLE))
    val state: StateFlow<ReadState> = mutableState.asStateFlow()

    fun reset(nextScope: ReadScope, nextTransport: ReadTransport) = synchronized(lock) {
        scope = nextScope; transport = nextTransport
        binding = UUID.randomUUID()
        active = null; lastTarget = null; accepted = null
        mutableState.value = ReadState(ReadPhase.IDLE)
    }
    suspend fun refresh(): Boolean {
        val pending = synchronized(lock) { lastTarget?.let { it to binding } } ?: return false
        return loadBound(pending.first, pending.second)
    }
    suspend fun load(target: ReadTarget): Boolean = loadBound(target, null)
    private suspend fun loadBound(target: ReadTarget, expectedBinding: UUID?): Boolean {
        val ticket = UUID.randomUUID()
        val captured = synchronized(lock) {
            if (expectedBinding != null && expectedBinding != binding) return@synchronized null
            active = ticket; lastTarget = target
            if (accepted?.target != target) accepted = null
            mutableState.value = ReadState(ReadPhase.LOADING)
            scope to transport
        } ?: return false
        try {
            val response = captured.second.execute(request(target, captured.first))
            return synchronized(lock) {
                if (active != ticket) return@synchronized false
                val next = if (response.status !in 200..299) {
                    accepted = null
                    failure(response)
                } else {
                    val projection = ReadProjection.decode(response.body, target, captured.first)
                    val current = accepted
                    val chosen = if (current?.version != null && projection.version != null && projection.version < current.version) current else projection
                    accepted = chosen
                    ReadState(when {
                        chosen.isUnsupported -> ReadPhase.UNSUPPORTED
                        chosen.isEmpty -> ReadPhase.EMPTY
                        else -> ReadPhase.READY
                    }, chosen)
                }
                active = null; mutableState.value = next
                true
            }
        } catch (error: Exception) {
            val applied = synchronized(lock) {
                if (active != ticket) return@synchronized false
                active = null; accepted = null
                mutableState.value = ReadState(when (error) {
                    is CancellationException -> ReadPhase.IDLE
                    is ReadContractException, is org.json.JSONException -> ReadPhase.CONTRACT_ERROR
                    else -> ReadPhase.ERROR
                })
                true
            }
            if (error is CancellationException) throw error
            return applied
        }
    }

    private fun request(target: ReadTarget, scope: ReadScope): ReadRequest = when (target) {
        is ReadTarget.Catalog -> {
            if (target.offset !in 0..10_000) throw ReadContractException()
            ReadRequest("/marketplace/search", mapOf("buyerOrganizationId" to scope.organizationId, "q" to target.query, "offset" to target.offset.toString()))
        }
        is ReadTarget.Comparison -> {
            WireValue.Fields(mapOf("id" to WireValue.Text(target.productId))).uuid("id")
            target.variantId?.let { WireValue.Fields(mapOf("id" to WireValue.Text(it))).uuid("id") }
            ReadRequest("/marketplace/products/${target.productId}/compare", buildMap {
                put("buyerOrganizationId", scope.organizationId); target.variantId?.let { put("variantId", it) }
            })
        }
        is ReadTarget.Workflow -> {
            WireValue.Fields(mapOf("id" to WireValue.Text(target.orderId))).uuid("id")
            ReadRequest("/supplier-orders/${target.orderId}/workflow", emptyMap())
        }
        is ReadTarget.Orders -> ReadRequest("/workspaces/buyer/orders", target.cursor?.let { mapOf("cursor" to it) } ?: emptyMap())
    }
    private fun failure(response: ReadResponse): ReadState {
        val root = WireValue.parse(response.body)
        if (response.status !in 100..599 || root.required("statusCode").integer() != response.status) throw ReadContractException()
        root.string("code"); root.required("message"); root.string("path"); root.string("timestamp")
        if (root["requestId"] != null && root["requestId"]?.text() == null) throw ReadContractException()
        val phase = when (response.status) {
            401 -> ReadPhase.AUTHENTICATION_REQUIRED
            403 -> ReadPhase.DENIED
            404 -> ReadPhase.UNAVAILABLE
            429 -> ReadPhase.RETRY_LIMITED
            else -> ReadPhase.ERROR
        }
        return ReadState(phase, requestId = root["requestId"]?.text())
    }
}
