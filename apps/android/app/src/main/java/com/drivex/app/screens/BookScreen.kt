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
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.LocalOffer
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.SwapVert
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.drivex.app.core.DX
import com.drivex.app.core.Db
import com.drivex.app.core.Fmt
import com.drivex.app.core.dx
import com.drivex.app.core.roundHalfUp
import com.drivex.app.core.t
import com.drivex.app.data.AppStore
import com.drivex.app.data.Car
import com.drivex.app.data.Period
import com.drivex.app.ui.Badge
import com.drivex.app.ui.CardButton
import com.drivex.app.ui.Chip
import com.drivex.app.ui.DXButton
import com.drivex.app.ui.DateRangeSheet
import com.drivex.app.ui.EmptyState
import com.drivex.app.ui.PageTitle
import com.drivex.app.ui.PriceView
import com.drivex.app.ui.RemoteImage
import com.drivex.app.ui.Route
import com.drivex.app.ui.Router
import com.drivex.app.ui.Segmented
import com.drivex.app.ui.Sheet
import com.drivex.app.ui.Size
import com.drivex.app.ui.TopBar
import com.drivex.app.ui.Variant
import com.drivex.app.ui.appear
import com.drivex.app.ui.pressable

private val SORTS = listOf("low" to "Price: low to high", "high" to "Price: high to low", "name" to "Name A–Z")

/** Book tab: every model for the chosen period, with search, sort, filters, optional dates and "offers only". */
@OptIn(ExperimentalLayoutApi::class, androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
fun BookScreen() {
    var query by rememberSaveable { mutableStateOf("") }
    var sort by rememberSaveable { mutableStateOf("high") }
    var category by rememberSaveable { mutableStateOf("All") }
    var brand by rememberSaveable { mutableStateOf("All") }
    var year by rememberSaveable { mutableStateOf("All") }
    var seats by rememberSaveable { mutableStateOf("All") }
    var from by rememberSaveable { mutableStateOf("") }
    var to by rememberSaveable { mutableStateOf("") }
    var sheet by rememberSaveable { mutableStateOf<String?>(null) }
    // with dates: vehicles already booked in that range, so models with no free unit are hidden
    var busy by rememberSaveable { mutableStateOf(listOf<String>()) }
    LaunchedEffect(from, to) {
        busy = if (from.isEmpty() || to.isEmpty()) emptyList()
        else runCatching { Db.rpc("busy_vehicle_ids", mapOf("p_from" to "${from}T00:00:00+04:00", "p_to" to "${to}T23:59:59+04:00")).array.mapNotNull { it.string } }.getOrDefault(emptyList())
    }

    val period = Router.bookPeriod
    val offersOnly = Router.bookOffersOnly
    val offerOff = AppStore.offers.filter { it.kind == "car" && it.car != null }.associate { it.car!!.id to it.off }
    val filtered = category != "All" || brand != "All" || year != "All" || seats != "All"
    val term = query.trim().lowercase()
    val cars = AppStore.fleet.filter { c ->
        c.vehicleIds.any { it !in busy } && (!offersOnly || c.id in offerOff)
            && (category == "All" || c.category == category) && (brand == "All" || c.make == brand)
            && (year == "All" || c.year.toString() == year) && (seats == "All" || c.seats.toString() == seats)
            && "${c.make} ${c.name} ${c.category}".lowercase().contains(term)
    }.let { list ->
        when (sort) {
            "name" -> list.sortedBy { it.name.lowercase() }
            "low" -> list.sortedBy { it.price(period) }
            else -> list.sortedByDescending { it.price(period) }
        }
    }
    fun clearAll() { query = ""; category = "All"; brand = "All"; year = "All"; seats = "All" }
    fun open(c: Car) = Router.push(Route.Reserve(c.id, period, if (offersOnly) offerOff[c.id] ?: 0 else 0, from.ifEmpty { null }, to.ifEmpty { null }))

    Refreshable {
        LazyColumn(Modifier.fillMaxSize().background(DX.bg), horizontalAlignment = Alignment.CenterHorizontally) {
            item { Column(Modifier.widthIn(max = 560.dp).padding(horizontal = 20.dp)) { TopBar(); PageTitle(t("Find your drive")) } }
            // period, search, sort and filter stay pinned at the top while the list scrolls
            stickyHeader {
                Column(Modifier.fillMaxWidth().background(DX.bg).padding(horizontal = 20.dp).padding(top = 8.dp, bottom = 12.dp).widthIn(max = 560.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Segmented(period, Period.entries.map { it to t(it.label) }) { Router.bookPeriod = it }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(Modifier.weight(1f).height(48.dp).clip(RoundedCornerShape(12.dp)).background(Color.White).border(1.dp, DX.line, RoundedCornerShape(12.dp)).padding(horizontal = 14.dp),
                            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Icon(Icons.Outlined.Search, null, tint = DX.inkMuted)
                            BasicTextField(query, { query = it }, Modifier.weight(1f), singleLine = true, textStyle = dx(15.sp, color = DX.ink), cursorBrush = SolidColor(DX.brand),
                                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                                decorationBox = { inner -> Box { if (query.isEmpty()) Text(t("Search cars"), style = dx(15.sp), color = DX.inkFaint); inner() } })
                        }
                        IconBox(Icons.Outlined.SwapVert, t("Sort")) { sheet = "sort" }
                        IconBox(Icons.Outlined.Tune, t("Filter"), dot = filtered) { sheet = "filter" }
                    }
                }
            }
            item {
                Column(Modifier.widthIn(max = 560.dp).padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    CardButton({ sheet = "dates" }) {
                        Row(Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Icon(Icons.Outlined.CalendarMonth, null, tint = DX.ink)
                            Text(
                                if (from.isNotEmpty() && to.isNotEmpty()) buildAnnotatedString { append("${Fmt.shortDay(from)} – ${Fmt.shortDay(to)}") }
                                else buildAnnotatedString { append(t("Add rental dates") + " "); withStyle(SpanStyle(color = DX.inkFaint, fontWeight = FontWeight.Normal)) { append(t("(optional)")) } },
                                style = dx(15.sp, FontWeight.Medium), color = DX.ink, modifier = Modifier.weight(1f),
                            )
                            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = DX.inkFaint)
                        }
                    }
                    if (offerOff.isNotEmpty()) Chip(t("Offers only"), { Router.bookOffersOnly = !offersOnly }, active = offersOnly, icon = Icons.Outlined.LocalOffer)
                }
            }
            itemsIndexed(cars, key = { _, c -> c.id }) { i, c ->
                Box(Modifier.widthIn(max = 560.dp).padding(horizontal = 20.dp).padding(top = 12.dp).appear(minOf(i, 6) * 50)) {
                    CarCard(c, period, if (offersOnly) offerOff[c.id] ?: 0 else 0) { open(c) }
                }
            }
            if (cars.isEmpty()) item {
                EmptyState(Icons.Outlined.Search, if (offersOnly) t("No offers right now") else t("No cars found"),
                    if (offersOnly) t("Turn off Offers only to see every car.") else t("Try another name or clear the filter.")) {
                    DXButton(t("Clear"), { clearAll() }, variant = Variant.Ghost)
                }
            }
            item { Spacer(Modifier.height(24.dp)) }
        }
    }

    when (sheet) {
        "sort" -> Sheet(t("Sort by"), { sheet = null }) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SORTS.forEach { (k, label) ->
                    val on = sort == k
                    Text(t(label), style = dx(15.sp, FontWeight.Medium), color = if (on) DX.brand else DX.ink,
                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(if (on) DX.brandSoft else Color.White)
                            .border(1.dp, if (on) DX.brand else DX.line, RoundedCornerShape(12.dp)).clickable { sort = k; sheet = null }.padding(horizontal = 16.dp, vertical = 17.dp))
                }
            }
        }
        "filter" -> Sheet(t("Filter"), { sheet = null }) {
            val uniq = { xs: List<String> -> xs.distinct().sorted() }
            val groups = listOf(
                Triple("Car type", listOf("All") + uniq(AppStore.fleet.map { it.category }), category),
                Triple("Brand", listOf("All") + uniq(AppStore.fleet.map { it.make }), brand),
                Triple("Year", listOf("All") + uniq(AppStore.fleet.map { it.year.toString() }.filter { it != "0" }).reversed(), year),
                Triple("Seats", listOf("All") + uniq(AppStore.fleet.map { it.seats.toString() }), seats),
            )
            groups.forEach { (label, options, value) ->
                Text(t(label), style = dx(14.sp, FontWeight.SemiBold), color = DX.inkMuted, modifier = Modifier.padding(bottom = 8.dp))
                FlowRow(Modifier.padding(bottom = 20.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    options.forEach { k ->
                        val text = if (label == "Seats" && k != "All") t("{n} seats", "n" to k) else if (k == "All" || label == "Car type") t(k) else k
                        Chip(text, {
                            when (label) { "Car type" -> category = k; "Brand" -> brand = k; "Year" -> year = k; else -> seats = k }
                        }, active = value == k)
                    }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (filtered) DXButton(t("Clear"), { clearAll() }, variant = Variant.Ghost, size = Size.Md, modifier = Modifier.height(56.dp))
                DXButton(if (cars.size == 1) t("Show {n} car", "n" to cars.size) else t("Show {n} cars", "n" to cars.size), { sheet = null }, Modifier.weight(1f), size = Size.Lg)
            }
        }
        "dates" -> DateRangeSheet(from, to, { f, e -> from = f; to = e }, { from = ""; to = "" }) { sheet = null }
    }
}

@Composable
private fun IconBox(icon: ImageVector, label: String, dot: Boolean = false, onClick: () -> Unit) {
    Box(Modifier.size(48.dp).pressable(0.95f, onClick = onClick).clip(RoundedCornerShape(12.dp)).background(Color.White).border(1.dp, DX.line, RoundedCornerShape(12.dp))
        .semantics { contentDescription = label }, contentAlignment = Alignment.Center) {
        Icon(icon, null, tint = DX.ink)
        if (dot) Box(Modifier.align(Alignment.TopEnd).padding(10.dp).size(8.dp).clip(CircleShape).background(DX.brand))
    }
}

/** One model in the list: the whole card opens it, the button too. */
@Composable
private fun CarCard(car: Car, period: Period, off: Int, open: () -> Unit) {
    val base = car.price(period)
    CardButton(open) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Text(car.name, style = dx(18.sp, FontWeight.Bold), color = DX.ink, modifier = Modifier.weight(1f))
                if (off > 0) Badge(t("{n}% off", "n" to off), Color.White, DX.danger)
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("${car.year} · ${t(car.category)} ·", style = dx(14.sp), color = DX.inkMuted)
                Icon(Icons.Outlined.People, null, Modifier.size(14.dp), tint = DX.inkMuted)
                Text(t("{n} seats", "n" to car.seats), style = dx(14.sp), color = DX.inkMuted)
            }
            RemoteImage(car.image, Modifier.fillMaxWidth().height(130.dp).padding(vertical = 8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) { PriceView(if (off > 0) (base * (1 - off / 100.0)).roundHalfUp() else base, t(period.unit), if (off > 0) base else null) }
                DXButton(t("View & book"), open, size = Size.Sm, arrow = true)
            }
        }
    }
}
