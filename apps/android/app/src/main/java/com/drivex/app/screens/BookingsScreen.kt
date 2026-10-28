package com.drivex.app.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Assignment
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.outlined.DirectionsCar
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.HeadsetMic
import androidx.compose.material.icons.outlined.SwapHoriz
import androidx.compose.material.icons.outlined.SwapVert
import androidx.compose.material.icons.outlined.Timer
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.drivex.app.core.AppConfig
import com.drivex.app.core.DX
import com.drivex.app.core.Files
import com.drivex.app.core.Fmt
import com.drivex.app.core.dx
import com.drivex.app.core.t
import com.drivex.app.data.AppStore
import com.drivex.app.data.Booking
import com.drivex.app.data.BookingStatus
import com.drivex.app.data.Invoice
import com.drivex.app.data.Pricing
import com.drivex.app.data.timeLabel
import com.drivex.app.ui.Aed
import com.drivex.app.ui.Badge
import com.drivex.app.ui.CardButton
import com.drivex.app.ui.Chip
import com.drivex.app.ui.DXButton
import com.drivex.app.ui.Divided
import com.drivex.app.ui.rows
import com.drivex.app.ui.EmptyState
import com.drivex.app.ui.ErrorText
import com.drivex.app.ui.InnerPage
import com.drivex.app.ui.ListGroup
import com.drivex.app.ui.ListRow
import com.drivex.app.ui.NoticeBox
import com.drivex.app.ui.PageScroll
import com.drivex.app.ui.PageTitle
import com.drivex.app.ui.PriceView
import com.drivex.app.ui.RemoteImage
import com.drivex.app.ui.Route
import com.drivex.app.ui.Router
import com.drivex.app.ui.Sheet
import com.drivex.app.ui.Size
import com.drivex.app.ui.StatusDot
import com.drivex.app.ui.TopBar
import com.drivex.app.ui.Variant
import com.drivex.app.ui.card
import com.drivex.app.ui.pressable
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val PRIORITY = mapOf(BookingStatus.overdue to 0, BookingStatus.pending to 1, BookingStatus.ongoing to 2, BookingStatus.upcoming to 3, BookingStatus.completed to 4, BookingStatus.cancelled to 5)
private val FILTERS = listOf("all" to "All", "pending" to "Awaiting payment", "overdue" to "Overdue", "ongoing" to "Ongoing", "upcoming" to "Upcoming", "completed" to "Completed", "cancelled" to "Cancelled")

/** Bookings tab: every booking, most urgent first (or most recent), with a status filter. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun BookingsScreen() {
    var byPriority by rememberSaveable { mutableStateOf(true) }
    var filter by rememberSaveable { mutableStateOf("all") }
    var picking by remember { mutableStateOf(false) }
    val list = AppStore.bookings.filter { filter == "all" || it.status.name == filter }
        .sortedWith(compareBy<Booking> { if (byPriority) PRIORITY[it.status] else 0 }.thenByDescending { it.pickup })

    Refreshable {
        PageScroll {
            TopBar()
            PageTitle(t("My bookings"))
            Row(Modifier.fillMaxWidth().padding(bottom = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Row(Modifier.clickable { byPriority = !byPriority }.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.Outlined.SwapVert, null, Modifier.size(16.dp), tint = DX.ink)
                    Text(if (byPriority) t("Priority") else t("Most recent"), style = dx(14.sp, FontWeight.Medium), color = DX.ink)
                    Icon(Icons.Outlined.ExpandMore, null, Modifier.size(16.dp), tint = DX.ink)
                }
                Box(Modifier.weight(1f))
                Row(Modifier.clickable { picking = true }.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.Outlined.Tune, null, Modifier.size(16.dp), tint = DX.ink)
                    Text(t("Filters"), style = dx(14.sp, FontWeight.Medium), color = DX.ink)
                    if (filter != "all") Box(Modifier.size(8.dp).clip(CircleShape).background(DX.brand))
                }
            }
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) { list.forEach { BookingCard(it) } }
            if (list.isEmpty()) {
                if (AppStore.bookings.isEmpty()) EmptyState(Icons.AutoMirrored.Filled.Assignment, t("No bookings yet"), t("Find a car and book in a minute.")) {
                    DXButton(t("Find a car"), { Router.openBook() }, arrow = true)
                } else EmptyState(Icons.AutoMirrored.Filled.Assignment, t("Nothing here"), t("Try another filter.")) {
                    DXButton(t("Show all"), { filter = "all" }, variant = Variant.Ghost)
                }
            }
        }
    }
    if (picking) Sheet(t("Show bookings"), { picking = false }) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            FILTERS.forEach { (k, label) -> Chip(t(label), { filter = k; picking = false }, active = filter == k) }
        }
    }
}

@Composable
private fun BookingCard(b: Booking) {
    val car = b.car
    val perDay = Math.round(car.price(b.period) / b.period.days).toDouble()
    CardButton({ Router.push(Route.BookingDetail(b.id)) }) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text(car.name, style = dx(18.sp, FontWeight.Bold), color = DX.ink)
                    Text("${car.year} · ${t(car.category)}", style = dx(14.sp), color = DX.inkMuted)
                }
                Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    StatusDot(b.status)
                    timeLabel(b)?.let { (text, late) -> Badge(text, if (late) DX.danger else DX.brand, if (late) DX.dangerSoft else DX.brandSoft) }
                }
            }
            Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                RemoteImage(car.image, Modifier.weight(1f).height(96.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    PriceView(if (b.period.days == 1) perDay else car.price(b.period), t(b.period.unit))
                    DateLine(t("Pickup"), Fmt.day(b.pickup))
                    DateLine(t("Return"), Fmt.day(b.dropoff))
                }
            }
            Box(Modifier.padding(top = 12.dp).fillMaxWidth().height(1.dp).background(DX.line))
            Row(Modifier.padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Row(Modifier.clickable { Router.push(Route.BookingDetail(b.id, "invoice")) }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Outlined.Description, null, Modifier.size(16.dp), tint = DX.ink)
                    Text(t("Invoice"), style = dx(14.sp, FontWeight.Medium), color = DX.ink)
                }
                Box(Modifier.weight(1f))
                DXButton(t("View details"), { Router.push(Route.BookingDetail(b.id)) }, variant = Variant.Soft, size = Size.Sm) {
                    Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, Modifier.size(16.dp))
                }
            }
        }
    }
}

@Composable
private fun DateLine(label: String, value: String) = Row(Modifier.fillMaxWidth()) {
    Text(label, style = dx(13.sp), color = DX.inkFaint, modifier = Modifier.weight(1f))
    Text(value, style = dx(13.sp, FontWeight.Medium), color = DX.ink)
}

/** One booking: the car and plate, days left, extend, invoices, Salik and fines, the car papers and help. */
@Composable
fun BookingDetailScreen(id: String, section: String?) {
    val b = AppStore.bookings.firstOrNull { it.id == id } ?: return InnerPage(t("Booking details")) {}
    val context = LocalContext.current
    val car = b.car
    val invoices = AppStore.invoices.filter { it.bookingId == b.id }
    val fines = AppStore.fines.filter { it.bookingId == b.id }
    val totalDays = (Fmt.instant(b.dropoff).toEpochMilli() - Fmt.instant(b.pickup).toEpochMilli()) / 86_400_000.0
    val left = Fmt.daysUntil(b.dropoff) // UAE calendar days, the same count the booking cards show
    val active = b.status == BookingStatus.ongoing || b.status == BookingStatus.overdue
    val insured = "full_cover" in b.extras
    var paying by remember { mutableStateOf<Invoice?>(null) }
    var sheet by remember { mutableStateOf<String?>(null) }
    val scroll = rememberScrollState()
    val anchors = remember { mutableMapOf<String, Int>() }
    LaunchedEffect(section) { if (section != null) { delay(350); anchors[section]?.let { scroll.animateScrollTo(it) } } }

    InnerPage(t("Booking details"), scroll, trailing = { StatusDot(b.status) }) {
        Column(Modifier.fillMaxWidth().card()) {
            Box(Modifier.fillMaxWidth().height(162.dp).background(Brush.verticalGradient(listOf(DX.tint, Color.White)))) {
                RemoteImage(car.image, Modifier.fillMaxWidth().height(150.dp).padding(top = 12.dp).align(Alignment.BottomCenter), multiply = true)
            }
            Column(Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.Top) {
                    Column(Modifier.weight(1f)) {
                        Text(car.name, style = dx(20.sp, FontWeight.Bold), color = DX.ink)
                        Text("${car.year} · ${t(car.category)}", style = dx(14.sp), color = DX.inkMuted)
                    }
                    Text(b.plate, style = dx(14.sp, FontWeight.Bold).copy(fontFamily = FontFamily.Monospace), color = DX.ink,
                        modifier = Modifier.border(2.dp, DX.ink, RoundedCornerShape(8.dp)).padding(horizontal = 8.dp, vertical = 2.dp))
                }
                Row(Modifier.padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    InfoBox(t("Pickup"), Fmt.day(b.pickup), Modifier.weight(1f))
                    InfoBox(t("Return"), Fmt.day(b.dropoff), Modifier.weight(1f))
                }
                if (active) {
                    Row(Modifier.padding(top = 16.dp)) {
                        Text(if (left < 0) (if (left == -1) t("{n} day overdue", "n" to -left) else t("{n} days overdue", "n" to -left))
                             else (if (left == 1) t("{n} day left", "n" to left) else t("{n} days left", "n" to left)),
                            style = dx(14.sp, FontWeight.SemiBold), color = if (left < 0) DX.danger else DX.ink, modifier = Modifier.weight(1f))
                        Text(t("{n} days total", "n" to Math.round(totalDays)), style = dx(14.sp), color = DX.inkMuted)
                    }
                    val progress = if (totalDays > 0) ((totalDays - left) / totalDays).coerceIn(0.04, 1.0) else 1.0
                    Box(Modifier.padding(top = 6.dp).fillMaxWidth().height(8.dp).clip(CircleShape).background(DX.bg)) {
                        Box(Modifier.fillMaxWidth(progress.toFloat()).height(8.dp).clip(CircleShape).background(if (left < 0) DX.danger else DX.brand))
                    }
                    DXButton(t("Extend rental"), { sheet = "extend" }, Modifier.padding(top = 16.dp), size = Size.Lg) {
                        Icon(Icons.Outlined.Timer, null, Modifier.size(20.dp))
                    }
                }
            }
        }
        if (b.status == BookingStatus.overdue) NoticeBox(t("Your return date has passed. Extend the rental or return the car to avoid extra charges."), icon = Icons.Outlined.Warning, modifier = Modifier.padding(top = 12.dp))

        Box(Modifier.onGloballyPositioned { anchors["invoice"] = it.positionInParent().y.toInt() }) { Heading(t("Invoices")) }
        Divided(invoices.rows { i -> InvoiceRow(i, i.issued, "${car.name} · ${b.plate}") { paying = i } }.ifEmpty { listOf<@Composable () -> Unit>({ EmptyLine(t("No invoices yet.")) }) })

        Box(Modifier.onGloballyPositioned { anchors["fines"] = it.positionInParent().y.toInt() }) { Heading(t("Salik & fines")) }
        Divided(fines.rows { f ->
            run {
                Row(Modifier.fillMaxWidth().heightIn(min = 60.dp).padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    val salik = f.type.startsWith("salik")
                    Badge(f.title?.let { t(it) } ?: if (f.type == "salik") t("Salik") else t("Fine"), if (salik) DX.brand else DX.danger, if (salik) DX.brandSoft else DX.dangerSoft)
                    Column(Modifier.weight(1f)) {
                        Text(f.place, style = dx(14.sp, FontWeight.Medium), color = DX.ink)
                        Text(Fmt.shortDay(f.date), style = dx(12.sp), color = DX.inkMuted)
                    }
                    Aed(f.amount, 15.sp, FontWeight.SemiBold)
                }
            }
        }.ifEmpty { listOf<@Composable () -> Unit>({ EmptyLine(t("No Salik or fines. Drive safe!")) }) })
        if (fines.isNotEmpty()) Text(t("Salik and fines are added to your next invoice."), style = dx(12.sp), color = DX.inkMuted, modifier = Modifier.padding(top = 8.dp, start = 4.dp))

        Box(Modifier.padding(top = 24.dp)) {
            ListGroup(t("Car & documents"), buildList<@Composable () -> Unit> {
                add { ListRow(t("Car registration (Mulkiya)"), Icons.Outlined.Description) { sheet = "mulkiya" } }
                add { ListRow(t("Insurance"), Icons.Outlined.VerifiedUser, if (insured) t("Full cover") else t("Basic")) { sheet = "insurance" } }
                if (active) add { ListRow(t("Change car"), Icons.Outlined.SwapHoriz) { Files.openLink(context, AppConfig.whatsappLink("Hi, I'd like to change my car (${car.name}, ${b.plate}).")) } }
                add { ListRow(t("Get help with this booking"), Icons.Outlined.HeadsetMic) { Router.openSupport("I need help with my ${car.name} booking (${b.plate}).") } }
            })
        }
    }

    paying?.let { PayInvoiceSheet(it) { paying = null } }
    when (sheet) {
        "extend" -> ExtendSheet(b) { sheet = null }
        "mulkiya" -> Sheet(t("Car registration"), { sheet = null }) {
            DocCard(Icons.Outlined.DirectionsCar, listOf(t("Vehicle") to car.name, t("Plate") to b.plate, t("Year") to car.year.toString(), t("Owner") to "Drivex Car Rental LLC"))
            Text(t("Show this screen if the police ask for the car papers."), style = dx(12.sp), color = DX.inkMuted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 12.dp))
        }
        "insurance" -> Sheet(t("Insurance"), { sheet = null }) {
            DocCard(Icons.Outlined.VerifiedUser, listOf(
                t("Cover") to if (insured) t("Full cover (zero excess)") else t("Basic (third party + excess)"),
                t("Valid") to "${Fmt.shortDay(b.pickup)} – ${Fmt.shortDay(b.dropoff)}", t("Plate") to b.plate,
            ))
            if (!insured) Text(t("Upgrade to full coverage insurance for {n}% of the rental — ask us in Support.", "n" to Pricing.FULL_COVER_PCT.toInt()),
                style = dx(14.sp), color = DX.inkMuted, modifier = Modifier.padding(top = 12.dp))
        }
    }
}

@Composable
private fun EmptyLine(text: String) = Text(text, style = dx(14.sp), color = DX.inkMuted, modifier = Modifier.fillMaxWidth().padding(16.dp))

@Composable
private fun InfoBox(label: String, value: String, modifier: Modifier) = Column(modifier.clip(RoundedCornerShape(12.dp)).background(DX.bg).padding(12.dp)) {
    Text(label, style = dx(12.sp), color = DX.inkMuted)
    Text(value, style = dx(15.sp, FontWeight.SemiBold), color = DX.ink)
}

// shows booking data; swap for the scanned Mulkiya / insurance PDFs once they are uploaded (as on the site)
@Composable
private fun DocCard(icon: ImageVector, rows: List<Pair<String, String>>) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Brush.linearGradient(listOf(DX.brandSoft, Color.White))).border(1.dp, DX.line, RoundedCornerShape(14.dp)).padding(16.dp)) {
        Box(Modifier.padding(bottom = 12.dp).size(44.dp).clip(RoundedCornerShape(12.dp)).background(DX.brand), contentAlignment = Alignment.Center) { Icon(icon, null, tint = Color.White) }
        rows.forEachIndexed { i, (k, v) ->
            Row(Modifier.padding(vertical = 8.dp)) {
                Text(k, style = dx(14.sp), color = DX.inkMuted, modifier = Modifier.weight(1f))
                Text(v, style = dx(14.sp, FontWeight.SemiBold), color = DX.ink)
            }
            if (i < rows.size - 1) Box(Modifier.fillMaxWidth().height(1.dp).background(DX.line.copy(alpha = 0.7f)))
        }
    }
}

/** Extend a rental by 1, 3, 7 or 30 days: an invoice is added to the booking (api/extend.ts). */
@Composable
private fun ExtendSheet(b: Booking, onClose: () -> Unit) {
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    val perDay = Math.round(b.car.price(b.period) / b.period.days).toDouble()
    Sheet(t("Extend rental"), onClose) {
        Text(t("Current return:") + " " + Fmt.day(b.dropoff), style = dx(14.sp), color = DX.inkMuted, modifier = Modifier.padding(bottom = 16.dp))
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(1, 3, 7, 30).forEach { d ->
                Row(Modifier.fillMaxWidth().height(56.dp).pressable(enabled = !busy) {
                    busy = true; error = ""
                    scope.launch {
                        try { AppStore.extend(b.id, d); onClose() } catch (e: Exception) { error = e.message ?: "" }
                        busy = false
                    }
                }.clip(RoundedCornerShape(12.dp)).background(Color.White).border(1.dp, DX.line, RoundedCornerShape(12.dp)).padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Text(if (d > 1) t("+ {n} days", "n" to d) else t("+ {n} day", "n" to d), style = dx(16.sp, FontWeight.Medium), color = DX.ink, modifier = Modifier.weight(1f))
                    Aed(perDay * d, 16.sp, FontWeight.SemiBold)
                }
            }
        }
        ErrorText(error, Modifier.padding(top = 12.dp))
        Text(t("An invoice is added to this booking. You can pay it right away."), style = dx(12.sp), color = DX.inkMuted, modifier = Modifier.padding(top = 16.dp))
    }
}

