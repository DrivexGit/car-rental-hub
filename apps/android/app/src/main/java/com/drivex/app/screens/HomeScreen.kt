package com.drivex.app.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.WifiOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import com.drivex.app.core.DX
import com.drivex.app.core.Db
import com.drivex.app.core.Fmt
import com.drivex.app.core.dx
import com.drivex.app.core.roundHalfUp
import com.drivex.app.core.t
import com.drivex.app.data.AppStore
import com.drivex.app.data.Booking
import com.drivex.app.data.BookingStatus
import com.drivex.app.data.Car
import com.drivex.app.data.Catalog
import com.drivex.app.data.Invoice
import com.drivex.app.data.Offer
import com.drivex.app.data.Period
import com.drivex.app.data.timeLabel
import com.drivex.app.ui.Aed
import com.drivex.app.ui.AssetImage
import com.drivex.app.ui.Badge
import com.drivex.app.ui.CardButton
import com.drivex.app.ui.DXButton
import com.drivex.app.ui.NoticeBox
import com.drivex.app.ui.PageScroll
import com.drivex.app.ui.PageTitle
import com.drivex.app.ui.PriceView
import com.drivex.app.ui.RemoteImage
import com.drivex.app.ui.Route
import com.drivex.app.ui.Router
import com.drivex.app.ui.SectionHead
import com.drivex.app.ui.Sheet
import com.drivex.app.ui.Size
import com.drivex.app.ui.StatusDot
import com.drivex.app.ui.Tab
import com.drivex.app.ui.TopBar
import com.drivex.app.ui.Variant
import com.drivex.app.ui.appear
import com.drivex.app.ui.bleed
import com.drivex.app.ui.pressable
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Pull down to reload, on every tab (the site reloads on focus; a phone app pulls). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun Refreshable(content: @Composable () -> Unit) {
    var refreshing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    PullToRefreshBox(refreshing, { scope.launch { refreshing = true; AppStore.refresh(); refreshing = false } }, Modifier.fillMaxSize()) { content() }
}

/** "Pull down to try again" when the last load failed. */
@Composable
fun OfflineNotice() {
    if (AppStore.offline) NoticeBox(t("Could not load your data. Pull down to try again."), DX.warnText, DX.warnSoft, Icons.Outlined.WifiOff, Modifier.padding(bottom = 16.dp))
}

/** A row of cards that scrolls sideways, edge to edge. */
@Composable
fun <T> Rail(items: List<T>, card: @Composable (T) -> Unit) {
    LazyRow(Modifier.bleed(20.dp), contentPadding = PaddingValues(horizontal = 20.dp, vertical = 2.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)) { items(items) { card(it) } }
}

private val order = mapOf(BookingStatus.overdue to 0, BookingStatus.ongoing to 1, BookingStatus.upcoming to 2, BookingStatus.pending to 3)

/** Home tab: greeting, banners, the customer's cars, a pending invoice, car offers and partner benefits. */
@Composable
fun HomeScreen() {
    val booked = AppStore.bookings.filter { it.status in order }.sortedWith(compareBy({ order[it.status] }, { it.pickup }))
    val carOffers = AppStore.offers.filter { it.kind == "car" && it.car != null }
    val partners = AppStore.offers.filter { it.kind == "partner" }
    val pending = AppStore.invoices.firstOrNull { it.status == "pending" }
    var paying by remember { mutableStateOf<Invoice?>(null) }
    var benefit by remember { mutableStateOf<Offer?>(null) }

    Refreshable {
        PageScroll {
            TopBar()
            // "Good evening, Sara" with the name in the brand colour
            val parts = t("{greeting}, {name}", "greeting" to t(Fmt.greeting()), "name" to "@@").split("@@")
            Box(Modifier.appear()) {
                PageTitle(buildAnnotatedString {
                    append(parts[0]); withStyle(SpanStyle(color = DX.brand)) { append(AppStore.user?.firstName ?: "") }; append(parts.getOrElse(1) { "" })
                }, t("Your next journey, beautifully taken care of."))
            }
            OfflineNotice()
            Banners()

            if (booked.isNotEmpty()) {
                SectionHead(t("Your booked cars")) { Router.select(Tab.bookings) }
                Rail(booked) { BookedCarCard(it) }
            }

            if (pending != null) Row(
                Modifier.padding(top = 16.dp).fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(DX.dangerSoft).padding(16.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(DX.danger), contentAlignment = Alignment.Center) {
                    Icon(Icons.Outlined.Description, null, tint = Color.White)
                }
                Column(Modifier.weight(1f)) {
                    Text(t("Pending invoice"), style = dx(13.sp, FontWeight.Medium), color = DX.danger)
                    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Aed(pending.amount, 20.sp)
                        Text(Fmt.day(pending.issued), style = dx(12.sp), color = DX.inkMuted)
                    }
                }
                DXButton(t("Pay now"), { paying = pending }, size = Size.Sm, arrow = true)
            }

            if (carOffers.isNotEmpty()) {
                SectionHead(t("Your Offers")) { Router.openBook(offersOnly = true) }
                Rail(carOffers) { o -> OfferCard(o.car!!, o.off) { Router.push(Route.Reserve(o.car.id, Period.daily, o.off, null, null)) } }
            }
            if (partners.isNotEmpty()) {
                SectionHead(t("DriveX Community"))
                Rail(partners) { o -> PartnerCard(o) { benefit = o } }
            }
        }
    }
    paying?.let { PayInvoiceSheet(it) { paying = null } }
    benefit?.let { BenefitSheet(it) { benefit = null } }
}

/** The marketing banners, sliding by themselves every five seconds unless the customer is touching them. */
@Composable
private fun Banners() {
    val pager = rememberPagerState { Catalog.banners.size }
    LaunchedEffect(pager) {
        while (true) {
            delay(5000)
            if (!pager.isScrollInProgress) pager.animateScrollToPage((pager.currentPage + 1) % Catalog.banners.size)
        }
    }
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        HorizontalPager(pager, Modifier.bleed(20.dp), contentPadding = PaddingValues(start = 20.dp, end = 32.dp), pageSpacing = 12.dp) { i ->
            val b = Catalog.banners[i]
            Box(Modifier.fillMaxWidth().height(190.dp).clip(RoundedCornerShape(14.dp)).background(DX.hero)) {
                AssetImage(b.image, Modifier.fillMaxSize())
                val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
                val dark = listOf(Color.Black.copy(alpha = 0.75f), Color.Black.copy(alpha = 0.35f), Color.Transparent)
                Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(if (rtl) dark.reversed() else dark)))
                Column(Modifier.fillMaxSize().padding(16.dp)) {
                    Text(t(b.kicker).uppercase(), style = dx(10.sp, FontWeight.SemiBold).copy(letterSpacing = 1.5.sp), color = Color.White.copy(alpha = 0.7f))
                    Text(t(b.title), style = dx(26.sp, FontWeight.Bold).copy(lineHeight = 28.sp), color = Color.White, modifier = Modifier.padding(top = 4.dp).fillMaxWidth(0.62f))
                    Text(t(b.text), style = dx(13.sp), color = Color.White.copy(alpha = 0.8f), modifier = Modifier.padding(top = 6.dp).fillMaxWidth(0.56f))
                    Spacer(Modifier.weight(1f))
                    Row(Modifier.height(36.dp).pressable(0.95f) { Router.openBook(b.period) }.clip(RoundedCornerShape(8.dp)).background(Color.White).padding(horizontal = 12.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(t(b.cta), style = dx(14.sp, FontWeight.SemiBold), color = DX.ink)
                        Icon(Icons.AutoMirrored.Filled.ArrowForward, null, Modifier.size(16.dp), tint = DX.ink)
                    }
                }
            }
        }
        Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            val scope = rememberCoroutineScope()
            repeat(Catalog.banners.size) { k ->
                val on = k == pager.currentPage
                Box(Modifier.height(6.dp).width(if (on) 16.dp else 6.dp).clip(CircleShape).background(if (on) DX.ink else DX.inkFaint.copy(alpha = 0.5f))
                    .clickable { scope.launch { pager.animateScrollToPage(k) } })
            }
        }
    }
}

@Composable
private fun CarPicture(path: String, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(100.dp).background(Brush.verticalGradient(listOf(DX.tint, Color.White)))) {
        RemoteImage(path, Modifier.fillMaxSize().padding(8.dp), multiply = true)
    }
}

/** One of the customer's current cars, with its status and the days left. */
@Composable
private fun BookedCarCard(b: Booking) {
    CardButton({ Router.push(Route.BookingDetail(b.id)) }, Modifier.width(190.dp)) {
        Box {
            CarPicture(b.car.image)
            Box(Modifier.padding(8.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.9f)).padding(horizontal = 8.dp, vertical = 2.dp)) { StatusDot(b.status) }
        }
        Column(Modifier.padding(12.dp)) {
            Text(b.car.name, style = dx(14.sp, FontWeight.SemiBold), color = DX.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("${Fmt.day(b.pickup)} – ${Fmt.day(b.dropoff)}", style = dx(12.sp), color = DX.inkMuted, maxLines = 1)
            timeLabel(b)?.let { (text, late) -> Badge(text, if (late) DX.danger else DX.brand, if (late) DX.dangerSoft else DX.brandSoft, Modifier.padding(top = 8.dp)) }
        }
    }
}

@Composable
private fun OfferCard(car: Car, off: Int, onClick: () -> Unit) {
    CardButton(onClick, Modifier.width(170.dp)) {
        Box {
            CarPicture(car.image)
            Badge(t("{n}% off", "n" to off), Color.White, DX.danger, Modifier.padding(8.dp))
        }
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(car.name, style = dx(14.sp, FontWeight.SemiBold), color = DX.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text("${t(car.category)} · ${car.year}", style = dx(12.sp), color = DX.inkMuted, maxLines = 1)
                }
                Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, Modifier.size(16.dp), tint = DX.inkFaint)
            }
            Box(Modifier.padding(top = 8.dp)) { PriceView((car.daily * (1 - off / 100.0)).roundHalfUp(), t("day"), car.daily, 16.sp) }
        }
    }
}

@Composable
private fun PartnerCard(o: Offer, onClick: () -> Unit) {
    CardButton(onClick, Modifier.width(170.dp)) {
        if (o.image != null) RemoteImage(o.image, Modifier.fillMaxWidth().height(100.dp), fill = true)
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(o.title, style = dx(14.sp, FontWeight.SemiBold), color = DX.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                o.subtitle?.let { Text(it, style = dx(12.sp), color = DX.inkMuted, maxLines = 1, overflow = TextOverflow.Ellipsis) }
            }
            Badge(t("{n}% off", "n" to o.off), DX.danger, DX.dangerSoft)
        }
    }
}

/** A partner benefit, with the customer's own code to show at the venue (created on first open). */
@Composable
private fun BenefitSheet(o: Offer, onClose: () -> Unit) {
    val context = LocalContext.current
    var code by remember { mutableStateOf("") }
    var copied by remember { mutableStateOf(false) }
    LaunchedEffect(o.id) { code = runCatching { Db.rpc("my_offer_code", mapOf("p_offer" to o.id)).string }.getOrNull() ?: "" }
    LaunchedEffect(copied) { if (copied) { delay(1800); copied = false } }
    Sheet(o.title, onClose) {
        if (o.image != null) RemoteImage(o.image, Modifier.fillMaxWidth().height(176.dp).clip(RoundedCornerShape(14.dp)), fill = true)
        Row(Modifier.padding(top = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(listOfNotNull(o.subtitle, o.location).joinToString(" · "), style = dx(15.sp), color = DX.inkMuted, modifier = Modifier.weight(1f))
            Badge(t("{n}% off", "n" to o.off), Color.White, DX.danger)
        }
        o.description?.let { Text(it, style = dx(15.sp), color = DX.ink, modifier = Modifier.padding(top = 8.dp)) }
        Column(
            Modifier.padding(top = 20.dp).fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(DX.brandSoft)
                .drawBehind { drawRoundRect(DX.brand, style = Stroke(2.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(18f, 12f))), cornerRadius = CornerRadius(14.dp.toPx())) }
                .padding(16.dp).appear(150),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(t("Your personal code — show it at the venue").uppercase(), style = dx(12.sp).copy(letterSpacing = 1.5.sp), color = DX.brand, textAlign = TextAlign.Center)
            if (code.isEmpty()) CircularProgressIndicator(Modifier.padding(top = 8.dp).size(28.dp), color = DX.brand)
            else {
                Text(code, style = dx(24.sp, FontWeight.Bold).copy(fontFamily = FontFamily.Monospace, letterSpacing = 2.sp), color = DX.brand, modifier = Modifier.padding(top = 4.dp))
                DXButton(if (copied) t("Copied") else t("Copy code"), {
                    (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("code", code))
                    copied = true
                }, Modifier.padding(top = 12.dp), Variant.Ghost, Size.Sm) {
                    Icon(if (copied) Icons.Outlined.Check else Icons.Outlined.ContentCopy, null, Modifier.size(16.dp))
                }
            }
        }
        o.terms?.let { Text(it, style = dx(12.sp), color = DX.inkMuted, modifier = Modifier.padding(top = 16.dp)) }
    }
}

