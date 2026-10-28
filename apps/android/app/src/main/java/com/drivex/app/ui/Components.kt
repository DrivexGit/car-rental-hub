package com.drivex.app.ui

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.InlineTextContent
import androidx.compose.foundation.text.appendInlineContent
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.toRect
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.Placeholder
import androidx.compose.ui.text.PlaceholderVerticalAlign
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.drivex.app.core.AppConfig
import com.drivex.app.core.DX
import com.drivex.app.core.Fmt
import com.drivex.app.core.display
import com.drivex.app.core.dx
import com.drivex.app.core.t
import com.drivex.app.data.AppStore
import com.drivex.app.data.BookingStatus
import kotlinx.coroutines.delay

// The site's building blocks (apps/customer/src/components/ui.tsx), drawn natively.

/** Light haptic tick, like the site's tap(). */
@Composable
fun rememberTap(): () -> Unit {
    val h = LocalHapticFeedback.current
    return { h.performHapticFeedback(HapticFeedbackType.TextHandleMove) }
}

// ---- Dirham sign and prices

/** The UAE dirham sign (2025 symbol): a D crossed by two bars, drawn on the site's 24-unit grid. */
val DirhamIcon: ImageVector = ImageVector.Builder("Dirham", 24.dp, 24.dp, 24f, 24f).apply {
    path(stroke = SolidColor(Color.Black), strokeLineWidth = 2.6f, strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round) {
        moveTo(6f, 4f); verticalLineTo(20f); horizontalLineTo(10.5f)
        arcTo(8f, 8f, 0f, isMoreThanHalf = false, isPositiveArc = false, x1 = 10.5f, y1 = 4f)
        close()
    }
    path(stroke = SolidColor(Color.Black), strokeLineWidth = 1.9f, strokeLineCap = StrokeCap.Round) {
        moveTo(2f, 10f); horizontalLineTo(20f); moveTo(2f, 14f); horizontalLineTo(20f)
    }
}.build()

private const val DIRHAM = "dirham"

/** Text with the dirham sign where "{aed}" appears: aedText("Pay {aed} 1,250"). */
@Composable
fun AedText(text: String, style: TextStyle, color: Color = DX.ink, modifier: Modifier = Modifier, strike: Boolean = false, maxLines: Int = Int.MAX_VALUE) {
    val parts = text.split("{aed}")
    val annotated = buildAnnotatedString {
        parts.forEachIndexed { i, p ->
            append(p)
            if (i < parts.size - 1) appendInlineContent(DIRHAM, "AED")
        }
    }
    val inline = mapOf(DIRHAM to InlineTextContent(Placeholder(0.8.em, 0.8.em, PlaceholderVerticalAlign.TextCenter)) {
        Icon(DirhamIcon, null, tint = color)
    })
    Text(annotated, style = style, color = color, inlineContent = inline, modifier = modifier, maxLines = maxLines, overflow = TextOverflow.Ellipsis,
        textDecoration = if (strike) TextDecoration.LineThrough else null)
}

/** "<sign> 1,250" */
@Composable
fun Aed(amount: Double, size: TextUnit, weight: FontWeight = FontWeight.Bold, color: Color = DX.ink, modifier: Modifier = Modifier) =
    AedText("{aed} ${Fmt.money(amount)}", dx(size, weight), color, modifier, maxLines = 1)

/** Price with an optional unit ("/ day") and an old price struck through. */
@Composable
fun PriceView(value: Double, unit: String? = null, old: Double? = null, size: TextUnit = 20.sp) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Bottom) {
        Aed(value, size)
        if (unit != null) Text("/ $unit", style = dx(14.sp), color = DX.inkFaint, maxLines = 1)
        if (old != null) AedText("{aed} ${Fmt.money(old)}", dx(14.sp), DX.inkFaint, strike = true, maxLines = 1)
    }
}

// ---- Brand

/** The brand name as plain text (no logo mark), in the same weight as the splash screen. */
@Composable
fun Logo(size: TextUnit = 22.sp, color: Color = DX.brand) =
    Text("Drivex", style = TextStyle(fontSize = size, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.5).sp), color = color)

/** The customer's photo, or their initials when they have not uploaded one. */
@Composable
fun Face(size: Dp = 40.dp, modifier: Modifier = Modifier) {
    val user = AppStore.user
    Box(modifier.size(size).clip(CircleShape).background(DX.brand), contentAlignment = Alignment.Center) {
        Text(user?.initials ?: "?", style = dx((size.value * 0.4f).sp, FontWeight.SemiBold), color = Color.White)
        if (user?.avatarUrl != null) AsyncImage(user.avatarUrl, null, Modifier.matchParentSize(), contentScale = ContentScale.Crop)
    }
}

// ---- Bars and titles

/** Top bar of every tab: logo at the start, the bell and the photo at the end. */
@Composable
fun TopBar(trailing: @Composable RowScope.() -> Unit = { BellButton(); AvatarButton() }) {
    Row(Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 16.dp), verticalAlignment = Alignment.CenterVertically) {
        Logo()
        Spacer(Modifier.weight(1f))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically, content = trailing)
    }
}

@Composable
fun AvatarButton() {
    val tap = rememberTap()
    Face(40.dp, Modifier.border(2.dp, Color.White, CircleShape).clickable(role = Role.Button, onClickLabel = t("Profile")) { tap(); Router.select(Tab.profile) })
}

/** The bell with the number of unread notifications; it rings now and then while there are any. */
@Composable
fun BellButton() {
    val tap = rememberTap()
    val unread = AppStore.unreadCount
    var ring by remember { mutableStateOf(false) }
    val angle by animateFloatAsState(if (ring) -14f else 0f, spring(dampingRatio = 0.2f, stiffness = Spring.StiffnessMedium), label = "bell")
    LaunchedEffect(unread) {
        while (unread > 0) { ring = true; delay(250); ring = false; delay(4000) }
    }
    Box(Modifier.size(40.dp).clip(CircleShape).background(Color.White).border(1.dp, DX.line, CircleShape)
        .clickable(role = Role.Button) { tap(); Router.push(Route.Inbox) }.semantics { contentDescription = t("Notifications") },
        contentAlignment = Alignment.Center) {
        Icon(Icons.Outlined.Notifications, null, Modifier.size(20.dp).rotate(angle), tint = DX.ink)
    }
    if (unread > 0) Box(Modifier.offset(x = (-18).dp, y = (-14).dp).heightIn(min = 20.dp).widthIn(min = 20.dp).clip(CircleShape).background(DX.danger).padding(horizontal = 4.dp), contentAlignment = Alignment.Center) {
        Text("$unread", style = dx(11.sp, FontWeight.Bold), color = Color.White)
    }
}

@Composable
fun PageTitle(title: AnnotatedString, sub: String? = null) {
    Column(Modifier.fillMaxWidth().padding(bottom = 20.dp)) {
        Text(title, style = display(32.sp), color = DX.ink)
        if (sub != null) Text(sub, style = dx(15.sp), color = DX.inkMuted, modifier = Modifier.padding(top = 4.dp))
    }
}

@Composable
fun PageTitle(title: String, sub: String? = null) = PageTitle(AnnotatedString(title), sub)

/** Header of an inner page: back arrow, title, and something at the end. */
@Composable
fun BackBar(title: String, onBack: () -> Unit = { Router.back() }, trailing: @Composable RowScope.() -> Unit = {}) {
    val tap = rememberTap()
    Row(Modifier.fillMaxWidth().background(DX.bg).padding(horizontal = 20.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(Modifier.size(40.dp).shadow(1.dp, CircleShape).clip(CircleShape).background(Color.White).border(1.dp, DX.line, CircleShape)
            .clickable(role = Role.Button) { tap(); onBack() }.semantics { contentDescription = t("Back") }, contentAlignment = Alignment.Center) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, null, Modifier.size(20.dp), tint = DX.ink)
        }
        Text(title, style = dx(18.sp, FontWeight.SemiBold), color = DX.ink, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
        trailing()
    }
}

@Composable
fun SectionHead(title: String, onViewAll: (() -> Unit)? = null) {
    val tap = rememberTap()
    Row(Modifier.fillMaxWidth().padding(top = 28.dp, bottom = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(title, style = dx(20.sp, FontWeight.Bold), color = DX.ink, modifier = Modifier.weight(1f))
        if (onViewAll != null) Row(Modifier.clickable { tap(); onViewAll() }, verticalAlignment = Alignment.CenterVertically) {
            Text(t("View all"), style = dx(14.sp), color = DX.inkMuted)
            Icon(Icons.AutoMirrored.Filled.ArrowForward, null, Modifier.padding(start = 4.dp).size(16.dp), tint = DX.inkMuted)
        }
    }
}

// ---- Cards

private val CardShape = RoundedCornerShape(14.dp)

/** White rounded card with a hairline border, as on the site. */
fun Modifier.card(radius: Dp = 14.dp): Modifier = this
    .shadow(1.dp, RoundedCornerShape(radius), ambientColor = Color(0x0A141414), spotColor = Color(0x0A141414))
    .clip(RoundedCornerShape(radius))
    .background(Color.White)
    .border(1.dp, DX.line, RoundedCornerShape(radius))

/** Shrinks a little while pressed (the site's whileTap). */
@Composable
fun Modifier.pressable(scale: Float = 0.975f, enabled: Boolean = true, role: Role = Role.Button, onClick: () -> Unit): Modifier {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val s by animateFloatAsState(if (pressed && enabled) scale else 1f, spring(dampingRatio = 0.7f, stiffness = 800f), label = "press")
    val tap = rememberTap()
    return this.scale(s).clickable(source, indication = null, enabled = enabled, role = role) { tap(); onClick() }
}

/** A card that opens something: the whole card is the button. */
@Composable
fun CardButton(onClick: () -> Unit, modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(modifier.pressable(onClick = onClick).card(), content = content)
}

/** Fades and lifts in when it first appears (the site's card entrance). */
@Composable
fun Modifier.appear(delayMs: Int = 0): Modifier {
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { shown = true }
    val a by animateFloatAsState(if (shown) 1f else 0f, tween(400, delayMs), label = "appear")
    return this.alpha(a).offset { IntOffset(0, (14 * (1 - a)).dp.roundToPx()) }
}

// ---- Buttons

enum class Variant { Primary, Soft, Ghost, Danger }
enum class Size { Sm, Md, Lg }

// text first, as on the site's <Button>: modifier after the action reads better at the call sites
@Suppress("ModifierParameter")
@Composable
fun DXButton(
    text: String? = null, onClick: () -> Unit, modifier: Modifier = Modifier, variant: Variant = Variant.Primary, size: Size = Size.Md,
    arrow: Boolean = false, busy: Boolean = false, enabled: Boolean = true, content: (@Composable RowScope.() -> Unit)? = null,
) {
    val fg = when (variant) { Variant.Primary -> Color.White; Variant.Soft -> DX.brand; Variant.Ghost -> DX.ink; Variant.Danger -> DX.danger }
    val bg = when (variant) { Variant.Primary -> DX.brand; Variant.Soft -> DX.brandSoft; else -> Color.White }
    val border = when (variant) { Variant.Ghost -> DX.line; Variant.Danger -> DX.danger.copy(alpha = 0.3f); else -> Color.Transparent }
    val shape = RoundedCornerShape(12.dp)
    val height = when (size) { Size.Sm -> 36.dp; Size.Md -> 44.dp; Size.Lg -> 56.dp }
    val font = when (size) { Size.Sm -> 14.sp; Size.Md -> 15.sp; Size.Lg -> 16.sp }
    Row(
        modifier.then(if (size == Size.Lg) Modifier.fillMaxWidth() else Modifier)
            .height(height).alpha(if (enabled) 1f else 0.4f)
            .pressable(0.95f, enabled && !busy, onClick = onClick)
            .clip(shape).background(bg).border(1.dp, border, shape)
            .padding(horizontal = when (size) { Size.Sm -> 14.dp; Size.Md -> 20.dp; Size.Lg -> 24.dp }),
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
    ) {
        if (busy) CircularProgressIndicator(Modifier.size(20.dp), color = fg, strokeWidth = 2.dp)
        else {
            androidx.compose.runtime.CompositionLocalProvider(androidx.compose.material3.LocalContentColor provides fg) {
                if (text != null) Text(text, style = dx(font, FontWeight.SemiBold), color = fg, maxLines = 1)
                content?.invoke(this)
                if (arrow) Icon(Icons.AutoMirrored.Filled.ArrowForward, null, Modifier.size(16.dp), tint = fg)
            }
        }
    }
}

@Composable
fun Chip(text: String, onClick: () -> Unit, active: Boolean = false, danger: Boolean = false, icon: ImageVector? = null) {
    val shape = RoundedCornerShape(12.dp)
    val fg = if (danger) DX.danger else if (active) Color.White else DX.ink
    Row(
        Modifier.height(40.dp).pressable(0.92f, onClick = onClick).clip(shape).background(if (active && !danger) DX.brand else Color.White)
            .border(1.dp, if (danger) DX.danger.copy(alpha = 0.3f) else if (active) DX.brand else DX.line, shape).padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (icon != null) Icon(icon, null, Modifier.size(16.dp), tint = fg)
        Text(text, style = dx(14.sp, FontWeight.Medium), color = fg, maxLines = 1)
    }
}

// ---- Status, badges, lists

@Composable
fun StatusDot(status: BookingStatus) {
    val (dot, color, label) = when (status) {
        BookingStatus.overdue -> Triple(DX.danger, DX.danger, "Overdue")
        BookingStatus.ongoing -> Triple(DX.brand, DX.brand, "Ongoing")
        BookingStatus.upcoming -> Triple(DX.warn, DX.warnText, "Upcoming")
        BookingStatus.pending -> Triple(DX.warn, DX.warnText, "Awaiting payment")
        BookingStatus.completed -> Triple(DX.inkFaint, DX.inkFaint, "Completed")
        BookingStatus.cancelled -> Triple(DX.inkFaint, DX.inkFaint, "Cancelled")
    }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(Modifier.size(8.dp).clip(CircleShape).background(dot))
        Text(t(label), style = dx(13.sp, FontWeight.Medium), color = color, maxLines = 1)
    }
}

@Composable
fun Badge(text: String, fg: Color = DX.brand, bg: Color = DX.brandSoft, modifier: Modifier = Modifier) {
    Text(text, style = dx(12.sp, FontWeight.SemiBold), color = fg, maxLines = 1,
        modifier = modifier.clip(RoundedCornerShape(6.dp)).background(bg).padding(horizontal = 8.dp, vertical = 2.dp))
}

/** A row of a settings-style list: icon, label, value, chevron when it opens something. */
@Composable
fun ListRow(label: String, icon: ImageVector? = null, value: String? = null, danger: Boolean = false, onClick: (() -> Unit)? = null) {
    val tap = rememberTap()
    val color = if (danger) DX.danger else DX.ink
    Row(
        Modifier.fillMaxWidth().heightIn(min = 56.dp)
            .then(if (onClick != null) Modifier.clickable(role = Role.Button) { tap(); onClick() } else Modifier)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        if (icon != null) Icon(icon, null, Modifier.size(20.dp), tint = color)
        Text(label, style = dx(15.sp, FontWeight.Medium), color = color, modifier = Modifier.weight(1f))
        if (value != null) Text(value, style = dx(14.sp), color = DX.inkMuted, maxLines = 1)
        if (onClick != null) Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, Modifier.size(20.dp), tint = DX.inkFaint)
    }
}

/** A hairline between rows (the site's divide-y). */
@Composable
fun Hairline(color: Color = DX.line) = Box(Modifier.fillMaxWidth().height(1.dp).background(color))

/** A card of rows with hairlines between them. Rows are separated by calling [Hairline] or by [rows]. */
@Composable
fun ListGroup(title: String? = null, rows: List<@Composable () -> Unit>) {
    Column(Modifier.fillMaxWidth().padding(bottom = 20.dp)) {
        if (title != null) Text(title, style = dx(13.sp), color = DX.inkMuted, modifier = Modifier.padding(start = 4.dp, bottom = 8.dp))
        Divided(rows)
    }
}

/** One row per item, for [Divided] and [ListGroup]. */
fun <T> List<T>.rows(row: @Composable (T) -> Unit): List<@Composable () -> Unit> = map { x -> @Composable { row(x) } }

/** Rows in a card with a hairline between each. */
@Composable
fun Divided(rows: List<@Composable () -> Unit>, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth().card()) {
        rows.forEachIndexed { i, row -> row(); if (i < rows.size - 1) Hairline() }
    }
}

@Composable
fun <T> Segmented(value: T, options: List<Pair<T, String>>, onChange: (T) -> Unit) {
    val tap = rememberTap()
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(DX.muted).padding(4.dp)) {
        options.forEach { (v, label) ->
            val on = v == value
            Box(
                Modifier.weight(1f).height(40.dp).then(if (on) Modifier.shadow(1.dp, RoundedCornerShape(9.dp)).clip(RoundedCornerShape(9.dp)).background(Color.White) else Modifier)
                    .clickable(role = Role.Tab) { tap(); onChange(v) },
                contentAlignment = Alignment.Center,
            ) { Text(label, style = dx(14.sp, if (on) FontWeight.SemiBold else FontWeight.Medium), color = if (on) DX.ink else DX.inkMuted) }
        }
    }
}

@Composable
fun EmptyState(icon: ImageVector, title: String, text: String? = null, action: (@Composable () -> Unit)? = null) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 64.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(64.dp).clip(CircleShape).background(DX.brandSoft), contentAlignment = Alignment.Center) {
            Icon(icon, null, Modifier.size(28.dp), tint = DX.brand)
        }
        Text(title, style = dx(18.sp, FontWeight.SemiBold), color = DX.ink, modifier = Modifier.padding(top = 16.dp),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        if (text != null) Text(text, style = dx(15.sp), color = DX.inkMuted, modifier = Modifier.padding(top = 4.dp),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        if (action != null) Box(Modifier.padding(top = 20.dp)) { action() }
    }
}

@Composable
fun ErrorText(message: String, modifier: Modifier = Modifier) {
    if (message.isNotEmpty()) Text(message, style = dx(14.sp, FontWeight.Medium), color = DX.danger, modifier = modifier.fillMaxWidth())
}

/** An alert box in a soft colour (danger, warning or brand). */
@Composable
fun NoticeBox(text: String, fg: Color = DX.danger, bg: Color = DX.dangerSoft, icon: ImageVector? = null, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth().clip(CardShape).background(bg).padding(14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        if (icon != null) Icon(icon, null, Modifier.size(18.dp).padding(top = 1.dp), tint = fg)
        AedText(text, dx(14.sp), fg)
    }
}

// ---- Images

/** A picture from the site or from storage. Car renders sit on white; multiply blends them into tinted cards, as on the site. */
@Composable
fun RemoteImage(path: String?, modifier: Modifier = Modifier, fill: Boolean = false, multiply: Boolean = false) {
    AsyncImage(
        model = path?.let { AppConfig.url(it) }, contentDescription = null,
        modifier = if (multiply) modifier.multiply() else modifier,
        contentScale = if (fill) ContentScale.Crop else ContentScale.Fit,
    )
}

/** Lets a row reach the screen edges through the page's side margin (the site's -mx-5). */
fun Modifier.bleed(x: Dp): Modifier = layout { m, c ->
    val extra = x.roundToPx() * 2
    val wide = if (c.hasBoundedWidth) c.copy(minWidth = c.maxWidth + extra, maxWidth = c.maxWidth + extra) else c
    val p = m.measure(wide)
    val w = if (c.hasBoundedWidth) c.maxWidth else p.width
    layout(w, p.height) { p.placeRelative(-extra / 2, 0) }
}

/** Draws the content with the multiply blend, so a white photo background takes the colour under it. */
fun Modifier.multiply(): Modifier = drawWithCache {
    val paint = Paint().apply { blendMode = BlendMode.Multiply }
    onDrawWithContent { drawIntoCanvas { c -> c.saveLayer(size.toRect(), paint); drawContent(); c.restore() } }
}

@Composable
fun AssetImage(res: Int, modifier: Modifier = Modifier, fill: Boolean = true) =
    Image(androidx.compose.ui.res.painterResource(res), null, modifier, contentScale = if (fill) ContentScale.Crop else ContentScale.Fit)

