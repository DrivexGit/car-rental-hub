package com.drivex.app.core

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp

/** The two colour themes of the site (src/index.css): green (default) and navy. Chosen in Profile > Appearance. */
enum class ThemeName(val label: String) { green("Green"), navy("Navy") }

object ThemeStore {
    private const val KEY = "drivex.theme"
    var name by mutableStateOf(ThemeName.green)
        private set
    private var prefs: android.content.SharedPreferences? = null

    fun init(context: Context) {
        prefs = context.getSharedPreferences("drivex", Context.MODE_PRIVATE)
        name = runCatching { ThemeName.valueOf(prefs!!.getString(KEY, "green")!!) }.getOrDefault(ThemeName.green)
    }

    fun set(n: ThemeName) {
        name = n
        prefs?.edit()?.putString(KEY, n.name)?.apply()
    }
}

/** The site's colour tokens. Reading one in a composable makes it follow theme changes. */
object DX {
    private val navy get() = ThemeStore.name == ThemeName.navy
    val brand get() = if (navy) Color(18, 42, 84) else Color(31, 77, 47)
    val brandDark get() = if (navy) Color(11, 29, 61) else Color(23, 58, 36)
    val brandSoft get() = if (navy) Color(230, 236, 246) else Color(232, 240, 234)
    val bg get() = if (navy) Color(245, 246, 249) else Color(246, 245, 242)
    val line get() = if (navy) Color(230, 233, 240) else Color(236, 235, 231)
    val tint get() = if (navy) Color(236, 240, 246) else Color(238, 240, 238)
    val muted get() = if (navy) Color(232, 235, 242) else Color(236, 235, 230)
    val hero get() = if (navy) Color(8, 18, 40) else Color(11, 26, 17)
    val night get() = if (navy) Color(8, 14, 30) else Color(11, 15, 20)

    val ink = Color(20, 20, 20)
    val inkMuted = Color(107, 107, 107)
    val inkFaint = Color(163, 163, 163)
    val danger = Color(217, 48, 37)
    val dangerSoft = Color(253, 238, 238)
    val warn = Color(245, 158, 11)
    val warnText = Color(217, 119, 6)
    val warnSoft = Color(255, 251, 235)
    val whatsapp = Color(26, 158, 75)
    val white = Color.White
}

/** Type scale. The site uses Inter (the phone's own sans is its twin here) and a heavy serif for page headings;
 *  Arabic and Persian headings keep the plain font, as on the site (the serif has no Arabic letters). */
fun dx(size: TextUnit, weight: FontWeight = FontWeight.Normal, color: Color = Color.Unspecified) =
    TextStyle(fontSize = size, fontWeight = weight, color = color, lineHeight = size * 1.35)

fun display(size: TextUnit = 32.sp) = TextStyle(
    fontSize = size, fontWeight = FontWeight.ExtraBold, lineHeight = size * 1.15,
    fontFamily = if (I18n.lang == Lang.en) FontFamily.Serif else FontFamily.Default,
)
