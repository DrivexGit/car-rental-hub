package com.drivex.app.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.CheckBox
import androidx.compose.material.icons.filled.CheckBoxOutlineBlank
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Info
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.drivex.app.core.Api
import com.drivex.app.core.DX
import com.drivex.app.core.Fmt
import com.drivex.app.core.dx
import com.drivex.app.core.display
import com.drivex.app.core.t
import com.drivex.app.data.AppStore
import com.drivex.app.data.Pricing
import com.drivex.app.data.Quote
import com.drivex.app.data.periodCount
import com.drivex.app.ui.AedText
import com.drivex.app.ui.DXButton
import com.drivex.app.ui.Divided
import com.drivex.app.ui.InnerPage
import com.drivex.app.ui.NoticeBox
import com.drivex.app.ui.PageScroll
import com.drivex.app.ui.RemoteImage
import com.drivex.app.ui.Route
import com.drivex.app.ui.Router
import com.drivex.app.ui.Size
import com.drivex.app.ui.Tab
import com.drivex.app.ui.card
import kotlinx.coroutines.launch

/** Booking step 2 of 3: summary and payment. The server re-prices and picks a free car (api/book.ts). */
@Composable
fun CheckoutScreen(q: Quote) {
    val car = AppStore.car(q.carId) ?: return InnerPage(t("Review & pay")) {}
    var agreed by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var page by remember { mutableStateOf<String?>(null) }
    var reservationId by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    // documents were removed or rejected since step 1
    LaunchedEffect(Unit) { if (AppStore.missingDocuments.isNotEmpty()) Router.back() }

    fun finish() { busy = false; reservationId?.let { Router.replace(Route.Confirmed(it)) } }
    fun pay() {
        busy = true; error = ""
        scope.launch {
            try {
                val b = Api.post("book", mapOf("modelId" to q.carId, "period" to q.period.name, "qty" to q.qty, "pickup" to q.pickup, "extras" to q.extras, "terms" to agreed))
                reservationId = b["reservationId"].string
                AppStore.refresh()
                // "Pay at month end" customers: the booking is confirmed now and the invoice is collected later
                if (b["payLater"].bool == true) { finish(); return@launch }
                val invoiceId = b["invoiceId"].string
                // the booking exists; if the payment cannot start, it can be paid later from the booking
                val start = invoiceId?.let { id -> runCatching { AppStore.payInvoice(id, "/confirmed/$reservationId") }.getOrNull() }
                if (start is AppStore.PayStart.Checkout) page = start.url else finish()
            } catch (e: Exception) { error = e.message ?: ""; busy = false }
        }
    }

    InnerPage(t("Review & pay"), trailing = { Text(t("2 of 3"), style = dx(14.sp), color = DX.inkMuted) }, bottomBar = {
        DXButton(null, { pay() }, size = Size.Lg, busy = busy, enabled = agreed) {
            AedText(t("Pay") + " {aed} " + Fmt.money(q.total), dx(16.sp, FontWeight.SemiBold), Color.White)
        }
    }) {
        Row(Modifier.fillMaxWidth().card().padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            RemoteImage(car.image, Modifier.size(96.dp, 64.dp))
            Column {
                Text(car.name, style = dx(16.sp, FontWeight.Bold), color = DX.ink)
                Text("${periodCount(q.period, q.qty)} · ${t(car.category)}", style = dx(14.sp), color = DX.inkMuted)
            }
        }
        Divided(listOf(
            { Line(t("Pickup"), Fmt.day(q.pickup)) },
            { Line(t("Return"), Fmt.day(q.dropoff)) },
            { Line(t("Pickup location"), t("Drivex, Dubai")) },
        ), Modifier.padding(top = 12.dp))

        Heading(t("Price"))
        Divided(buildList<@Composable () -> Unit> {
            add { Line(if (q.discount > 0) t("Rental ({n}% off)", "n" to q.discount) else t("Rental"), "{aed} ${Fmt.money(q.base)}") }
            q.extras.filter { it in Pricing.extraLabels }.forEach { id -> add { Line(t(Pricing.extraLabels[id]!!), "{aed} ${Fmt.money(q.cost(id))}") } }
            add { Line(t("VAT included"), "{aed} ${Fmt.money(q.vat)}") }
            add { Line(t("Total"), "{aed} ${Fmt.money(q.total)}", bold = true) }
        })

        val deposit = if ("no_deposit" in q.extras) t("No deposit is blocked on your card.")
        else t("A refundable security deposit (from {amount}) is blocked on your card at pickup.", "amount" to "{aed} ${Fmt.money(Pricing.DEPOSIT_AMOUNT)}")
        NoticeBox(deposit, DX.brand, DX.brandSoft, Icons.Outlined.Info, Modifier.padding(top = 12.dp))

        Row(Modifier.padding(top = 24.dp).fillMaxWidth().card().clickable(role = Role.Checkbox) { agreed = !agreed }.padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(if (agreed) Icons.Filled.CheckBox else Icons.Filled.CheckBoxOutlineBlank, null, tint = if (agreed) DX.brand else DX.inkFaint)
            Text(t("I agree to the Terms & Rental rules"), style = dx(15.sp), color = DX.ink, modifier = Modifier.weight(1f))
        }
        Row(Modifier.padding(top = 8.dp, start = 4.dp).clickable { Router.push(Route.LegalPage("terms")) }, verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(t("Read the terms"), style = dx(14.sp, FontWeight.SemiBold), color = DX.brand)
            Icon(Icons.AutoMirrored.Filled.ArrowForward, null, Modifier.size(14.dp), tint = DX.brand)
        }

        Heading(t("Payment"))
        CardMethodRow(selected = true)
        if (error.isNotEmpty()) Text(error, style = dx(14.sp, FontWeight.Medium), color = DX.danger,
            modifier = Modifier.padding(top = 16.dp).fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(DX.dangerSoft).padding(12.dp))
    }

    page?.let { url ->
        PaymentPage(url) { id ->
            page = null
            scope.launch { if (id != null) AppStore.confirmPayment(id) else AppStore.refresh(); finish() }
        }
    }
}

@Composable
private fun Line(label: String, value: String, bold: Boolean = false) {
    Row(Modifier.fillMaxWidth().heightIn(min = 52.dp).padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = dx(15.sp, if (bold) FontWeight.Bold else FontWeight.Normal), color = if (bold) DX.ink else DX.inkMuted, modifier = Modifier.weight(1f))
        AedText(value, dx(if (bold) 20.sp else 15.sp, if (bold) FontWeight.Bold else FontWeight.Medium))
    }
}

/** Booking step 3 of 3. */
@Composable
fun ConfirmedScreen(id: String) {
    val b = AppStore.bookings.firstOrNull { it.id == id }
    val unpaid = AppStore.invoices.any { it.bookingId == id && it.status == "pending" }
    androidx.activity.compose.BackHandler { Router.stacks[Router.tab] = emptyList() }
    PageScroll {
        if (b != null) Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(Icons.Outlined.CheckCircle, null, Modifier.padding(top = 64.dp).size(80.dp), tint = DX.brand)
            Text(if (unpaid) t("Booking saved") else t("You're all set!"), style = display(30.sp), color = DX.ink, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 16.dp))
            Text(if (unpaid) t("Your car is held. Pay the invoice to confirm it.") else t("Your booking is confirmed. We'll message you before pickup."),
                style = dx(15.sp), color = DX.inkMuted, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 4.dp))
            Column(Modifier.padding(top = 32.dp).fillMaxWidth().card().padding(16.dp)) {
                RemoteImage(b.car.image, Modifier.fillMaxWidth().height(112.dp))
                Text(b.car.name, style = dx(18.sp, FontWeight.Bold), color = DX.ink, modifier = Modifier.padding(top = 8.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(Fmt.day(b.pickup), style = dx(14.sp), color = DX.inkMuted)
                    Icon(Icons.AutoMirrored.Filled.ArrowForward, null, Modifier.size(14.dp), tint = DX.inkMuted)
                    Text(Fmt.day(b.dropoff), style = dx(14.sp), color = DX.inkMuted)
                }
            }
            DXButton(t("View booking"), {
                Router.stacks[Router.tab] = emptyList()
                Router.tab = Tab.bookings
                Router.stacks[Tab.bookings] = listOf(Route.BookingDetail(id))
            }, Modifier.padding(top = 24.dp), size = Size.Lg)
            Text(t("Back to home"), style = dx(16.sp, FontWeight.Medium), color = DX.brand,
                modifier = Modifier.padding(top = 4.dp).clickable { Router.stacks[Router.tab] = emptyList(); Router.select(Tab.home) }.padding(12.dp))
        }
    }
}
