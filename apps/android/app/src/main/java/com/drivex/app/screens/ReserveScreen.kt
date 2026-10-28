package com.drivex.app.screens

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.LocalGasStation
import androidx.compose.material.icons.outlined.Luggage
import androidx.compose.material.icons.outlined.MeetingRoom
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.Remove
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Speed
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.runtime.CompositionLocalProvider
import com.drivex.app.core.DX
import com.drivex.app.core.Fmt
import com.drivex.app.core.dx
import com.drivex.app.core.roundHalfUp
import com.drivex.app.core.t
import com.drivex.app.data.AppStore
import com.drivex.app.data.Period
import com.drivex.app.data.Pricing
import com.drivex.app.data.Quote
import com.drivex.app.data.Specs
import com.drivex.app.data.periodCount
import com.drivex.app.ui.AedText
import com.drivex.app.ui.BottomBar
import com.drivex.app.ui.DXButton
import com.drivex.app.ui.DateSheet
import com.drivex.app.ui.Divided
import com.drivex.app.ui.rows
import com.drivex.app.ui.InnerPage
import com.drivex.app.ui.PriceView
import com.drivex.app.ui.RemoteImage
import com.drivex.app.ui.Route
import com.drivex.app.ui.Router
import com.drivex.app.ui.Segmented
import com.drivex.app.ui.Size
import com.drivex.app.ui.appear
import com.drivex.app.ui.card
import com.drivex.app.ui.pressable
import kotlinx.coroutines.launch
import kotlin.math.ceil

@Composable
fun Heading(text: String, top: Int = 24) =
    Text(text, style = dx(16.sp, FontWeight.SemiBold), color = DX.ink, modifier = Modifier.padding(top = top.dp, bottom = 8.dp))

/** Booking step 1 of 3: the car, its photos and specs, the rental plan, extras and the deposit option. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ReserveScreen(r: Route.Reserve) {
    val car = AppStore.car(r.carId) ?: return InnerPage(t("Book your car")) {}
    val specs = AppStore.specs[car.id]
    val off = AppStore.offers.firstOrNull { it.kind == "car" && it.car?.id == car.id }?.off ?: 0
    var period by rememberSaveable { mutableStateOf(r.period) }
    var pickup by rememberSaveable { mutableStateOf(r.from ?: Fmt.addDays(Fmt.todayInUAE(), 1)) }
    var qty by rememberSaveable {
        mutableStateOf(if (r.from != null && r.to != null) maxOf(1, ceil(Fmt.daysBetween(r.from, r.to).toDouble() / r.period.days).toInt()) else if (r.period == Period.daily) 3 else 1)
    }
    var extras by rememberSaveable { mutableStateOf(listOf("full_cover")) }
    var noDeposit by rememberSaveable { mutableStateOf(false) }
    var picking by remember { mutableStateOf(false) }
    var photo by remember { mutableStateOf<Int?>(null) }
    var needDocs by remember { mutableStateOf(false) }
    var needEmail by remember { mutableStateOf(false) }
    val missing = AppStore.missingDocuments
    val q = Quote.of(car, period, qty, pickup, if (noDeposit) extras + "no_deposit" else extras, off)
    // the album: the studio photo first, then the gallery
    val album = (listOf(car.image) + (specs?.gallery ?: emptyList())).filter { it.isNotEmpty() }.distinct()

    InnerPage(t("Book your car"), trailing = { Text(t("1 of 3"), style = dx(14.sp), color = DX.inkMuted) }, bottomBar = {
        Row(verticalAlignment = Alignment.Bottom) {
            Text(t("Total · {count}", "count" to periodCount(period, qty)), style = dx(15.sp), color = DX.inkMuted, modifier = Modifier.weight(1f))
            AedText("{aed} ${Fmt.money(q.total)}", dx(24.sp, FontWeight.Bold))
        }
        AnimatedVisibility(needDocs && missing.isNotEmpty()) {
            Notice(t("Please update your documents first: {list}.", "list" to missing.joinToString(", ") { t(it.label) }), t("Update documents")) { Router.push(Route.Documents) }
        }
        AnimatedVisibility(needEmail && AppStore.user?.email == null) {
            Notice(t("Add your email before you book. We send the booking details there."), t("Add your email")) { Router.push(Route.EditProfile) }
        }
        DXButton(t("Continue"), {
            when {
                missing.isNotEmpty() -> needDocs = true
                AppStore.user?.email == null -> needEmail = true
                else -> Router.push(Route.Checkout(q))
            }
        }, size = Size.Lg, arrow = true)
    }) {
        // the car
        Column(Modifier.fillMaxWidth().card()) {
            Box(Modifier.fillMaxWidth().height(186.dp).background(Brush.verticalGradient(listOf(DX.tint, Color.White)))
                .clickable(enabled = album.size > 1) { photo = 0 }) {
                RemoteImage(car.image, Modifier.fillMaxSize().padding(start = 16.dp, end = 16.dp, top = 16.dp), multiply = true)
            }
            if (!specs?.gallery.isNullOrEmpty()) LazyRow(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                itemsIndexed(album) { i, src ->
                    RemoteImage(src, Modifier.size(112.dp, 80.dp).pressable(0.95f) { photo = i }.clip(RoundedCornerShape(12.dp)).background(DX.line)
                        .semantics { contentDescription = t("{name} photo {n}", "name" to car.name, "n" to i + 1) }, fill = true)
                }
            }
            Column(Modifier.padding(16.dp)) {
                Text(car.name, style = dx(24.sp, FontWeight.Bold), color = DX.ink)
                FlowRow(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Meta(null, "${car.year} · ${t(car.category)}")
                    Meta(Icons.Outlined.People, t("{n} seats", "n" to car.seats))
                    Meta(null, t("{n} in fleet", "n" to car.vehicleIds.size))
                    Meta(Icons.Outlined.LocalGasStation, t("Full to full"))
                }
                Box(Modifier.padding(top = 12.dp)) { PriceView((car.price(period) * (1 - off / 100.0)).roundHalfUp(), t(period.unit), if (off > 0) car.price(period) else null) }
            }
        }

        if (specs != null) SpecsGrid(specs)

        Heading(t("Rental plan"))
        Segmented(period, Period.entries.map { it to t(it.label) }) { period = it; qty = if (it == Period.daily) 3 else 1 }
        Divided(listOf(
            {
                Row(Modifier.fillMaxWidth().height(64.dp).clickable { picking = true }.padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(t("Pickup date"), style = dx(16.sp, FontWeight.Medium), color = DX.ink, modifier = Modifier.weight(1f))
                    Icon(Icons.Outlined.CalendarMonth, null, Modifier.size(16.dp), tint = DX.brand)
                    Text(Fmt.day(pickup), style = dx(16.sp, FontWeight.SemiBold), color = DX.brand, modifier = Modifier.padding(start = 8.dp))
                }
            },
            {
                Row(Modifier.fillMaxWidth().height(64.dp).padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(when (period) { Period.daily -> t("Number of days"); Period.weekly -> t("Number of weeks"); Period.monthly -> t("Number of months") },
                        style = dx(16.sp, FontWeight.Medium), color = DX.ink, modifier = Modifier.weight(1f))
                    Round(Icons.Outlined.Remove, t("Less")) { qty = maxOf(1, qty - 1) }
                    Text("$qty", style = dx(18.sp, FontWeight.Bold), color = DX.ink, textAlign = TextAlign.Center, modifier = Modifier.width(44.dp))
                    Round(Icons.Outlined.Add, t("More")) { qty = minOf(if (period == Period.daily) 29 else 12, qty + 1) }
                }
            },
            {
                Row(Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(t("Return"), style = dx(14.sp), color = DX.inkMuted, modifier = Modifier.weight(1f))
                    Text(Fmt.shortDay(q.dropoff), style = dx(14.sp, FontWeight.SemiBold), color = DX.ink)
                }
            },
        ), Modifier.padding(top = 12.dp))

        Heading(t("Extras"))
        Divided(Pricing.pickableExtras.rows { id ->
            run {
                val on = id in extras
                Row(Modifier.fillMaxWidth().heightIn(min = 60.dp).clickable(role = Role.Checkbox) { extras = if (on) extras - id else extras + id }.padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(Modifier.size(24.dp).clip(RoundedCornerShape(6.dp)).background(if (on) DX.brand else Color.White).border(2.dp, if (on) DX.brand else DX.line, RoundedCornerShape(6.dp)),
                        contentAlignment = Alignment.Center) { if (on) Icon(Icons.Filled.Check, null, Modifier.size(16.dp), tint = Color.White) }
                    Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(t(Pricing.extraLabels[id] ?: id), style = dx(16.sp, FontWeight.Medium), color = DX.ink)
                        if (id == "full_cover") Icon(Icons.Outlined.VerifiedUser, null, Modifier.size(16.dp), tint = DX.brand)
                    }
                    AedText(extraHint(id, period), dx(14.sp), DX.inkMuted)
                }
            }
        })

        Heading(t("Security deposit"))
        Divided(listOf(false, true).rows { none ->
            run {
                val on = noDeposit == none
                Row(Modifier.fillMaxWidth().heightIn(min = 64.dp).clickable(role = Role.RadioButton) { noDeposit = none }.padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(Modifier.size(24.dp).clip(CircleShape).border(2.dp, if (on) DX.brand else DX.line, CircleShape), contentAlignment = Alignment.Center) {
                        if (on) Box(Modifier.size(12.dp).clip(CircleShape).background(DX.brand))
                    }
                    Column(Modifier.weight(1f)) {
                        Text(t(if (none) "No deposit" else "Refundable deposit"), style = dx(16.sp, FontWeight.Medium), color = DX.ink)
                        Text(t(if (none) "Pay once. Nothing is blocked on your card." else "Blocked on your card at pickup and released after the return."), style = dx(13.sp), color = DX.inkMuted)
                    }
                    AedText(if (none) "+ {aed} ${Fmt.money(Pricing.NO_DEPOSIT_FEE)}" else "{aed} ${Fmt.money(Pricing.DEPOSIT_AMOUNT)}", dx(14.sp, FontWeight.SemiBold))
                }
            }
        })
    }

    if (picking) DateSheet(pickup, onPick = { pickup = it }) { picking = false }
    photo?.let { PhotoAlbum(album, car.name, it) { photo = null } }
}

/** What each extra costs, in words (the amounts come from Pricing). */
private fun extraHint(id: String, period: Period) = when {
    id == "full_cover" -> t("{n}% of the rental", "n" to Pricing.FULL_COVER_PCT.toInt())
    id == "extra_driver" && period == Period.monthly -> "{aed} " + t("{n} / month", "n" to Pricing.DRIVER_MONTHLY.toInt())
    else -> "{aed} " + t("{n} / day", "n" to (if (id == "extra_driver") Pricing.DRIVER_DAILY else Pricing.CHILD_SEAT_DAILY).toInt())
}

@Composable
private fun Meta(icon: ImageVector?, text: String) = Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
    if (icon != null) Icon(icon, null, Modifier.size(16.dp), tint = DX.inkMuted)
    Text(text, style = dx(14.sp), color = DX.inkMuted)
}

@Composable
private fun Round(icon: ImageVector, label: String, onClick: () -> Unit) =
    Box(Modifier.size(36.dp).pressable(0.9f, onClick = onClick).clip(CircleShape).background(Color.White).border(1.dp, DX.line, CircleShape).semantics { contentDescription = label },
        contentAlignment = Alignment.Center) { Icon(icon, null, Modifier.size(16.dp), tint = DX.ink) }

@Composable
private fun Notice(message: String, button: String, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(DX.dangerSoft).padding(12.dp), verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(message, style = dx(14.sp, FontWeight.Medium), color = DX.danger, modifier = Modifier.weight(1f))
        DXButton(button, onClick, size = Size.Sm)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SpecsGrid(s: Specs) {
    val items = listOf(
        Triple(Icons.Outlined.Speed, s.engine ?: "—", "Engine"), Triple(Icons.Outlined.Settings, s.transmission, "Gearbox"),
        Triple(Icons.Outlined.LocalGasStation, s.fuel, "Fuel"), Triple(Icons.Outlined.People, t("{n} seats", "n" to s.seats), "Seats"),
        Triple(Icons.Outlined.MeetingRoom, t("{n} doors", "n" to s.doors), "Doors"), Triple(Icons.Outlined.Luggage, t("{n} bags", "n" to s.bags), "Luggage"),
    )
    Heading(t("About this car"))
    items.chunked(3).forEachIndexed { row, chunk ->
        Row(Modifier.padding(bottom = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            chunk.forEachIndexed { i, (icon, value, label) ->
                Column(Modifier.weight(1f).appear((row * 3 + i) * 50).card().padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(icon, null, Modifier.size(20.dp), tint = DX.brand)
                    Text(value, style = dx(13.sp, FontWeight.SemiBold), color = DX.ink, textAlign = TextAlign.Center, maxLines = 2)
                    Text(t(label), style = dx(11.sp), color = DX.inkFaint)
                }
            }
        }
    }
    if (s.features.isNotEmpty()) FlowRow(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        s.features.forEach { f ->
            Row(Modifier.clip(CircleShape).background(DX.brandSoft).padding(horizontal = 12.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Icon(Icons.Outlined.AutoAwesome, null, Modifier.size(14.dp), tint = DX.brand)
                Text(f, style = dx(13.sp, FontWeight.Medium), color = DX.brand)
            }
        }
    }
}

/** Full-screen photo viewer: swipe or the arrows for the previous / next photo, the counter, a close button. */
@Composable
fun PhotoAlbum(photos: List<String>, name: String, start: Int, onClose: () -> Unit) {
    val pager = rememberPagerState(start) { photos.size }
    val scope = rememberCoroutineScope()
    Dialog(onClose, DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        BackHandler { onClose() }
        Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.95f)).clickable { onClose() }.statusBarsPadding().navigationBarsPadding()) {
            HorizontalPager(pager, Modifier.fillMaxSize()) { i ->
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    RemoteImage(photos[i], Modifier.fillMaxWidth().fillMaxHeight(0.85f).padding(horizontal = 16.dp).clip(RoundedCornerShape(12.dp))
                        .semantics { contentDescription = t("{name} photo {n}", "name" to name, "n" to i + 1) })
                }
            }
            Box(Modifier.align(Alignment.TopEnd).padding(16.dp).size(44.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.15f)).clickable { onClose() }
                .semantics { contentDescription = t("Close photo") }, contentAlignment = Alignment.Center) { Icon(Icons.Filled.Close, null, tint = Color.White) }
            if (photos.size > 1) {
                val n = photos.size
                AlbumArrow(Icons.AutoMirrored.Filled.KeyboardArrowLeft, t("Previous photo"), Modifier.align(Alignment.CenterStart)) { scope.launch { pager.animateScrollToPage((pager.currentPage - 1 + n) % n) } }
                AlbumArrow(Icons.AutoMirrored.Filled.KeyboardArrowRight, t("Next photo"), Modifier.align(Alignment.CenterEnd)) { scope.launch { pager.animateScrollToPage((pager.currentPage + 1) % n) } }
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                    Text("${pager.currentPage + 1} / $n", style = dx(14.sp, FontWeight.Medium), color = Color.White.copy(alpha = 0.8f),
                        modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 24.dp))
                }
            }
        }
    }
}

@Composable
private fun AlbumArrow(icon: ImageVector, label: String, modifier: Modifier, onClick: () -> Unit) =
    Box(modifier.padding(horizontal = 12.dp).size(44.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.15f)).clickable { onClick() }.semantics { contentDescription = label },
        contentAlignment = Alignment.Center) { Icon(icon, null, Modifier.size(28.dp), tint = Color.White) }

