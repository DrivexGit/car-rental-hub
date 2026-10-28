package com.drivex.app.screens

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.drivex.app.core.AppConfig
import com.drivex.app.core.DX
import com.drivex.app.core.Fmt
import com.drivex.app.core.dx
import com.drivex.app.core.t
import com.drivex.app.data.AppStore
import com.drivex.app.data.Invoice
import com.drivex.app.ui.AedText
import com.drivex.app.ui.BackBar
import com.drivex.app.ui.DXButton
import com.drivex.app.ui.ErrorText
import com.drivex.app.ui.Sheet
import com.drivex.app.ui.Size
import kotlinx.coroutines.launch

/**
 * The Stripe Checkout page, inside the app (cards; no script is added to the page). Stripe sends the customer back to a
 * Drivex page with "?payment=<id>"; that page is never loaded here: the app catches the address, closes the page and
 * confirms the payment with the server (api/pay, action "confirm"). [onFinish] gets the payment id, or null when closed.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun PaymentPage(url: String, onFinish: (String?) -> Unit) {
    var loading by remember { mutableStateOf(true) }
    var done by remember { mutableStateOf(false) }
    Dialog({ onFinish(null) }, DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false, dismissOnClickOutside = false)) {
        BackHandler { onFinish(null) }
        Column(Modifier.fillMaxSize().background(Color.White).statusBarsPadding().navigationBarsPadding()) {
            BackBar(t("Payment"), onBack = { onFinish(null) }) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(Icons.Outlined.Lock, null, Modifier.size(14.dp), tint = DX.inkMuted)
                    Text("Stripe", style = dx(13.sp, FontWeight.Medium), color = DX.inkMuted)
                }
            }
            Box(Modifier.weight(1f)) {
                AndroidView(factory = { ctx ->
                    WebView(ctx).apply {
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        webViewClient = object : WebViewClient() {
                            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                                val u = request.url
                                // back on the Drivex site: the payment page is finished
                                if (u.host == AppConfig.siteHost) {
                                    if (!done) { done = true; onFinish(u.getQueryParameter("payment")) }
                                    return true
                                }
                                // bank pages (3-D Secure) and Stripe stay here; links to other apps open outside
                                if (u.scheme != "https" && u.scheme != "http") {
                                    runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
                                    return true
                                }
                                return false
                            }
                            override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) { loading = true }
                            override fun onPageFinished(view: WebView, url: String?) { loading = false }
                        }
                        loadUrl(url)
                    }
                }, modifier = Modifier.fillMaxSize(), onRelease = { it.stopLoading(); it.destroy() })
                if (loading) CircularProgressIndicator(Modifier.align(Alignment.Center), color = DX.brand)
            }
        }
    }
}

/** "Card · Secure payment by Stripe" (Google Pay needs Stripe's own Android SDK, so it is not offered here). */
@Composable
fun CardMethodRow(selected: Boolean = false) {
    val shape = RoundedCornerShape(14.dp)
    Row(Modifier.fillMaxWidth().clip(shape).background(Color.White).border(1.dp, if (selected) DX.brand else DX.line, shape).padding(16.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Icon(Icons.Outlined.CreditCard, null, Modifier.size(24.dp), tint = DX.brand)
        Column(Modifier.weight(1f)) {
            Text(t("Card"), style = dx(16.sp, FontWeight.Medium), color = DX.ink)
            Text(t("Secure payment by Stripe"), style = dx(12.sp), color = DX.inkMuted)
        }
        if (selected) Box(Modifier.size(20.dp).clip(CircleShape).border(6.dp, DX.brand, CircleShape))
    }
}

/** Pay one invoice: the amount, the card row, then Stripe. Shows "Thank you" when the payment went through. */
@Composable
fun PayInvoiceSheet(invoice: Invoice, onClose: () -> Unit) {
    var state by remember { mutableStateOf("idle") } // idle, busy, done
    var error by remember { mutableStateOf("") }
    var page by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Sheet(if (state == "done") t("Payment received") else t("Pay invoice"), onClose) {
        if (state == "done") {
            Column(Modifier.fillMaxWidth().padding(vertical = 16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Outlined.CheckCircle, null, Modifier.size(64.dp), tint = DX.brand)
                Text(t("Thank you!"), style = dx(18.sp, FontWeight.SemiBold), color = DX.ink, modifier = Modifier.padding(top = 12.dp))
                Text(t("Invoice {number} is paid.", "number" to invoice.number), style = dx(15.sp), color = DX.inkMuted, textAlign = TextAlign.Center)
                DXButton(t("Done"), onClose, Modifier.padding(top = 24.dp), size = Size.Lg)
            }
        } else {
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(DX.bg).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row { Text(t("Invoice"), style = dx(14.sp), color = DX.inkMuted, modifier = Modifier.weight(1f)); Text(invoice.number, style = dx(14.sp), color = DX.inkMuted) }
                invoice.description?.let { Text(it, style = dx(14.sp), color = DX.ink) }
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(t("Amount due"), style = dx(16.sp, FontWeight.Medium), color = DX.ink, modifier = Modifier.weight(1f))
                    AedText("{aed} ${Fmt.money(invoice.amount)}", dx(24.sp, FontWeight.Bold))
                }
            }
            Box(Modifier.padding(top = 16.dp)) { CardMethodRow() }
            ErrorText(error, Modifier.padding(top = 12.dp))
            DXButton(null, {
                state = "busy"; error = ""
                scope.launch {
                    try {
                        when (val r = AppStore.payInvoice(invoice.id, invoice.bookingId?.let { "/bookings/$it" } ?: "/profile/payments")) {
                            is AppStore.PayStart.Checkout -> page = r.url
                            AppStore.PayStart.Paid -> state = "done"
                        }
                    } catch (e: Exception) { error = e.message ?: ""; state = "idle" }
                }
            }, Modifier.padding(top = 20.dp), size = Size.Lg, busy = state == "busy") {
                AedText(t("Pay") + " {aed} " + Fmt.money(invoice.amount), dx(16.sp, FontWeight.SemiBold), Color.White)
            }
        }
    }
    page?.let { url ->
        PaymentPage(url) { id ->
            page = null
            scope.launch {
                if (id == null) { state = "idle"; AppStore.refresh() }
                else state = if (AppStore.confirmPayment(id)) "done" else "idle"
            }
        }
    }
}

