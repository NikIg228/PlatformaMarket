package kz.platforma.market.read

import org.json.JSONArray
import org.json.JSONObject
import java.math.BigDecimal

/** Native projection storage, not a replacement for the authoritative server schemas. */
sealed interface WireValue {
    data object Null : WireValue
    data class Text(val value: String) : WireValue
    data class Numeric(val value: BigDecimal) : WireValue
    data class Flag(val value: Boolean) : WireValue
    data class Items(val value: List<WireValue>) : WireValue
    data class Fields(val value: Map<String, WireValue>) : WireValue

    operator fun get(key: String): WireValue? = (this as? Fields)?.value?.get(key)
    fun text(): String? = (this as? Text)?.value
    fun items(): List<WireValue>? = (this as? Items)?.value
    fun integer(): Int? = try { (this as? Numeric)?.value?.intValueExact() } catch (_: ArithmeticException) { null }

    companion object {
        fun parse(json: String): WireValue = from(JSONObject(json))
        private fun from(value: Any?): WireValue = when (value) {
            null, JSONObject.NULL -> Null
            is String -> Text(value)
            is Boolean -> Flag(value)
            is Number -> Numeric(BigDecimal(value.toString())) // metadata only; money/quantity must be Text
            is JSONArray -> Items(List(value.length()) { from(value.get(it)) })
            is JSONObject -> {
                val fields = linkedMapOf<String, WireValue>()
                val keys = value.keys()
                while (keys.hasNext()) { val key = keys.next(); fields[key] = from(value.get(key)) }
                Fields(fields.toMap())
            }
            else -> throw ReadContractException()
        }
    }
}

class ReadContractException : Exception("Incompatible read projection")
internal fun WireValue.required(key: String): WireValue = this[key] ?: throw ReadContractException()
internal fun WireValue.string(key: String): String = required(key).text() ?: throw ReadContractException()
internal fun WireValue.array(key: String): List<WireValue> = required(key).items() ?: throw ReadContractException()
internal fun WireValue.uuid(key: String): String = string(key).also {
    if (!it.matches(Regex("[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}"))) throw ReadContractException()
}
internal fun WireValue.int(key: String, minimum: Int = 0): Int =
    (required(key).integer() ?: throw ReadContractException()).also { if (it < minimum) throw ReadContractException() }
internal fun WireValue.nullableString(key: String) {
    val value = required(key)
    if (value != WireValue.Null && value.text() == null) throw ReadContractException()
}
internal fun WireValue.decimal(key: String, nullable: Boolean = false) {
    val value = required(key)
    if (nullable && value == WireValue.Null) return
    if (value.text()?.matches(Regex("-?[0-9]+(?:\\.[0-9]+)?")) != true) throw ReadContractException()
}
internal fun WireValue.currency(key: String) {
    if (!string(key).matches(Regex("[A-Z]{3}"))) throw ReadContractException()
}
