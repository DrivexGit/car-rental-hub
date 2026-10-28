package com.drivex.app.ui

import android.content.Context
import android.provider.Settings
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Assignment
import androidx.compose.material.icons.outlined.DirectionsCar
import androidx.compose.material.icons.outlined.HeadsetMic
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.drivex.app.R
import com.drivex.app.core.DX
import com.drivex.app.core.dx
import com.drivex.app.core.t
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.hypot

private fun reduceMotion(context: Context) =
    Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f

/**
 * Animated launch screen, as on the site: road lines rush past, the D mark sweeps in, the wordmark reveals,
 * then the green closes into a circle. It waits for the data, but never longer than five seconds.
 */
@Composable
fun Splash(ready: Boolean, onDone: () -> Unit) {
    val reduce = reduceMotion(LocalContext.current)
    val mark = remember { Animatable(if (reduce) 1f else 0f) }
    val word = remember { Animatable(if (reduce) 1f else 0f) }
    val tag = remember { Animatable(if (reduce) 1f else 0f) }
    val open = remember { Animatable(1f) }
    var minDone by remember { mutableStateOf(false) }
    var closing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val roads = rememberInfiniteTransition(label = "roads")
    val road by roads.animateFloat(-0.4f, 1.4f, infiniteRepeatable(tween(1100, easing = LinearEasing), RepeatMode.Restart), label = "road")

    fun close() {
        if (closing) return
        closing = true
        scope.launch { open.animateTo(0f, tween(if (reduce) 250 else 600, easing = CubicBezierEasing(0.7f, 0f, 0.3f, 1f))); onDone() }
    }

    LaunchedEffect(Unit) {
        launch { delay(150); mark.animateTo(1f, spring(dampingRatio = 0.55f, stiffness = Spring.StiffnessLow)) }
        launch { delay(550); word.animateTo(1f, tween(700, easing = CubicBezierEasing(0.2f, 0.8f, 0.2f, 1f))) }
        launch { delay(1050); tag.animateTo(1f, tween(400)) }
        delay(if (reduce) 600 else 1900)
        minDone = true
        if (ready) close()
        delay(3100) // gives up after five seconds even if the data is slow
        close()
    }
    LaunchedEffect(ready, minDone) { if (ready && minDone) close() }

    BoxWithConstraints(
        Modifier.fillMaxSize()
            .drawWithContent {
                val r = hypot(size.width, size.height) * open.value
                val circle = Path().apply { addOval(androidx.compose.ui.geometry.Rect(Offset(size.width / 2, size.height * 0.46f), r)) }
                clipPath(circle) { this@drawWithContent.drawContent() }
            }
            .background(DX.brand)
            .clickable(enabled = false) {}
            .semantics { contentDescription = "Drivex" },
    ) {
        val w = maxWidth
        if (!reduce) for (i in 0..2) Box(
            Modifier.offset(x = w * (road - 0.0f) - 80.dp, y = maxHeight * (0.36f + i * 0.14f))
                .size(160.dp, 2.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.15f)),
        )
        Column(Modifier.align(Alignment.Center).offset(y = -(maxHeight * 0.04f)), horizontalAlignment = Alignment.CenterHorizontally) {
            Image(painterResource(R.drawable.app_mark), null,
                Modifier.size(96.dp).graphicsLayer { translationX = (1 - mark.value) * -140.dp.toPx(); alpha = mark.value.coerceIn(0f, 1f) }
                    .shadow(20.dp, RoundedCornerShape(28.dp)).clip(RoundedCornerShape(28.dp)))
            Text("Drivex", style = TextStyle(fontSize = 40.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.5).sp), color = Color.White,
                modifier = Modifier.padding(top = 24.dp).drawWithContent {
                    clipRight(size.width * word.value) { this@drawWithContent.drawContent() }
                })
            Text(t("Drive. Easy.").uppercase(), style = dx(12.sp, FontWeight.Medium).copy(letterSpacing = 4.sp), color = Color.White.copy(alpha = 0.6f),
                modifier = Modifier.padding(top = 12.dp).alpha(tag.value).offset { IntOffset(0, (8 * (1 - tag.value)).dp.roundToPx()) })
        }
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.clipRight(right: Float, block: androidx.compose.ui.graphics.drawscope.DrawScope.() -> Unit) =
    clipRect(0f, 0f, right, size.height, block = block)

/** Three short slides on the first launch after sign-in. Skippable, shown once per device. */
@Composable
fun OnboardingOverlay() {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("drivex", Context.MODE_PRIVATE) }
    var seen by remember { mutableStateOf(prefs.getBoolean("drivex.onboarded", false)) }
    if (seen) return
    val slides = listOf(
        Triple(Icons.Outlined.DirectionsCar, "Book in a minute", "Pick a car, choose your dates and pay. That's it."),
        Triple(Icons.AutoMirrored.Outlined.Assignment, "Everything in one place", "Your bookings, invoices, Salik and fines, always up to date."),
        Triple(Icons.Outlined.HeadsetMic, "Help when you need it", "Chat with Drivex AI any time, or call us if it's urgent."),
    )
    val pager = rememberPagerState { slides.size }
    val scope = rememberCoroutineScope()
    val finish = { prefs.edit().putBoolean("drivex.onboarded", true).apply(); seen = true }
    Column(Modifier.fillMaxSize().background(DX.bg).clickable(enabled = false) {}.statusBarsPadding().navigationBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 8.dp), horizontalArrangement = Arrangement.End) {
            Text(t("Skip"), style = dx(14.sp, FontWeight.Medium), color = DX.inkMuted, modifier = Modifier.clickable { finish() }.padding(8.dp))
        }
        HorizontalPager(pager, Modifier.weight(1f)) { i ->
            val (icon, title, text) = slides[i]
            Column(Modifier.fillMaxSize().padding(horizontal = 32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                Box(Modifier.size(112.dp).clip(RoundedCornerShape(32.dp)).background(DX.brand), contentAlignment = Alignment.Center) {
                    Icon(icon, null, Modifier.size(56.dp), tint = Color.White)
                }
                Text(t(title), style = dx(28.sp, FontWeight.Bold), color = DX.ink, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 32.dp))
                Text(t(text), style = dx(16.sp), color = DX.inkMuted, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 12.dp).width(300.dp))
            }
        }
        Row(Modifier.fillMaxWidth().padding(bottom = 24.dp), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)) {
            repeat(slides.size) { k ->
                Box(Modifier.height(6.dp).width(if (k == pager.currentPage) 24.dp else 6.dp).clip(CircleShape).background(if (k == pager.currentPage) DX.brand else DX.inkFaint.copy(alpha = 0.4f)))
            }
        }
        val last = pager.currentPage == slides.size - 1
        DXButton(if (last) t("Get started") else t("Next"), { if (last) finish() else scope.launch { pager.animateScrollToPage(pager.currentPage + 1) } },
            Modifier.padding(horizontal = 24.dp).padding(bottom = 32.dp), size = Size.Lg, arrow = true)
    }
}
