package com.drivex.app.core

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.util.Locale

/** The app's three languages. Arabic and Persian are written right to left. */
enum class Lang(val label: String) {
    en("English"), ar("العربية"), fa("فارسی");

    val isRtl get() = this != en
    /** Locale for dates and numbers. Arabic and Persian keep Latin digits, which is what UAE apps use (same as the site). */
    val locale: Locale
        get() = when (this) {
            en -> Locale.forLanguageTag("en-GB")
            ar -> Locale.forLanguageTag("ar-AE-u-nu-latn")
            fa -> Locale.forLanguageTag("fa-IR-u-nu-latn")
        }
}

/**
 * Strings are keyed by their English text, exactly like the site: t("Pay now"). A missing translation falls back to the key.
 * The Arabic and Persian dictionaries are the site's own (scripts/sync-content.mjs); app-strings.json adds the few texts
 * only the phone app has. The language is the app's own choice, as on the site. Reading [lang] in a composable makes it
 * follow language changes.
 */
object I18n {
    private const val KEY = "drivex.lang"
    var lang by mutableStateOf(Lang.en)
        private set
    private val dicts = mutableMapOf<Lang, Map<String, String>>()
    private var prefs: android.content.SharedPreferences? = null

    fun init(context: Context) {
        prefs = context.getSharedPreferences("drivex", Context.MODE_PRIVATE)
        lang = runCatching { Lang.valueOf(prefs!!.getString(KEY, "en")!!) }.getOrDefault(Lang.en)
        val extra = read(context, "app-strings")
        for (l in listOf(Lang.ar, Lang.fa)) {
            val site = read(context, "strings-${l.name}").mapValues { it.value.jsonPrimitive.content }
            val app = (extra[l.name] as? JsonObject)?.mapValues { it.value.jsonPrimitive.content } ?: emptyMap()
            dicts[l] = app + site // the site's words win
        }
    }

    private fun read(context: Context, name: String): JsonObject = runCatching {
        Json.parseToJsonElement(context.assets.open("content/$name.json").bufferedReader().use { it.readText() }).jsonObject
    }.getOrDefault(JsonObject(emptyMap()))

    fun set(l: Lang) {
        lang = l
        prefs?.edit()?.putString(KEY, l.name)?.apply()
    }

    fun translate(key: String, vars: Array<out Pair<String, Any>>, lang: Lang = this.lang): String {
        var text = dicts[lang]?.get(key) ?: key
        for ((k, v) in vars) text = text.replace("{$k}", v.toString())
        return text
    }
}

/** Translates an English key: t("Pay now"), t("{n} days left", "n" to 3). */
fun t(key: String, vararg vars: Pair<String, Any>): String = I18n.translate(key, vars)
