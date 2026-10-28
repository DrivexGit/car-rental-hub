package com.drivex.app.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull

/**
 * Any JSON value. Rows from Supabase and replies from the site's /api are read through it, field by field,
 * the same way the site maps them (numeric columns can arrive as numbers or strings; a missing field is null).
 */
class J(val e: JsonElement?) {
    operator fun get(key: String) = J((e as? JsonObject)?.get(key))

    private val prim get() = (e as? JsonPrimitive)?.takeIf { e !is JsonNull }
    val string: String? get() = prim?.content
    /** A non-empty string, or null (empty text in the database counts as missing, like `x || undefined` on the site). */
    val text: String? get() = string?.takeIf { it.isNotEmpty() }
    val double: Double? get() = prim?.let { it.doubleOrNull ?: it.content.toDoubleOrNull() }
    val int: Int? get() = double?.toInt()
    val bool: Boolean? get() = prim?.booleanOrNull
    val array: List<J> get() = (e as? JsonArray)?.map { J(it) } ?: emptyList()
    val isNull get() = e == null || e is JsonNull

    companion object {
        fun parse(text: String) = J(runCatching { Json.parseToJsonElement(text) }.getOrNull())
    }
}

/** Kotlin values (maps, lists, strings, numbers, booleans, null) as JSON, for request bodies. */
fun toJson(v: Any?): JsonElement = when (v) {
    null -> JsonNull
    is JsonElement -> v
    is String -> JsonPrimitive(v)
    is Number -> JsonPrimitive(v)
    is Boolean -> JsonPrimitive(v)
    is Map<*, *> -> JsonObject(v.entries.associate { (k, x) -> k.toString() to toJson(x) })
    is Iterable<*> -> JsonArray(v.map { toJson(it) })
    is Array<*> -> JsonArray(v.map { toJson(it) })
    else -> JsonPrimitive(v.toString())
}
