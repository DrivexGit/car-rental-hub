package com.drivex.app.screens

import android.annotation.SuppressLint
import android.graphics.BitmapFactory
import android.util.Base64
import android.webkit.WebView
import android.widget.Toast
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.Visibility
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.drivex.app.R
import com.drivex.app.core.AppConfig
import com.drivex.app.core.DX
import com.drivex.app.core.Files
import com.drivex.app.core.Fmt
import com.drivex.app.core.Storage
import com.drivex.app.core.dx
import com.drivex.app.core.t
import com.drivex.app.data.AppStore
import com.drivex.app.data.Invoice
import com.drivex.app.data.InvoiceDocument
import com.drivex.app.ui.Aed
import com.drivex.app.ui.DXButton
import com.drivex.app.ui.ErrorText
import com.drivex.app.ui.Sheet
import com.drivex.app.ui.Size
import kotlinx.coroutines.launch

/** The tax invoice document, filled with the customer's and the seller's details (tenant settings win over the defaults). */
private fun invoiceHtml(context: android.content.Context, invoice: Invoice, detail: String?): String? {
    val user = AppStore.user ?: return null
    val s = AppStore.seller
    val logo = runCatching {
        val bytes = context.resources.openRawResource(R.raw.invoice_logo).use { it.readBytes() }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size) // a check that it is an image
        "data:image/png;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP)
    }.getOrNull()
    return InvoiceDocument.html(
        invoice, detail,
        InvoiceDocument.BillTo(user.name, user.phone, user.email, user.customerNo, user.nationality),
        InvoiceDocument.Company(
            AppConfig.Company.NAME, s?.legalAddress ?: AppConfig.Company.ADDRESS, s?.trn, AppConfig.SUPPORT_PHONE, AppConfig.Company.EMAIL,
            s?.bankAccountName, s?.bankName, s?.iban, s?.bic,
        ),
        logo,
    )
}

/**
 * Two small buttons on an invoice row: View (the tax invoice on screen) and Download (a PDF saved to Downloads, then opened).
 * An invoice the staff uploaded as a PDF is shown and saved as that same file, never rebuilt (as on the site).
 */
@Composable
fun InvoiceButtons(invoice: Invoice, detail: String? = null) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var viewing by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }

    fun uploaded(save: Boolean) = scope.launch {
        busy = true; error = ""
        try {
            val bytes = Storage.download(Storage.signedUrl("invoices", invoice.filePath!!))
            val uri = if (save) Files.saveToDownloads(context, "${invoice.number}.pdf", bytes) else Files.cache(context, "${invoice.number}.pdf", bytes)
            if (save) Toast.makeText(context, t("Saved to Downloads"), Toast.LENGTH_SHORT).show()
            Files.open(context, uri)
        } catch (e: Exception) { error = t("Could not open the invoice. Please try again."); viewing = true }
        busy = false
    }

    fun download() {
        if (invoice.filePath != null) { uploaded(save = true); return }
        scope.launch {
            busy = true; error = ""
            try {
                val html = invoiceHtml(context, invoice, detail) ?: return@launch
                val uri = Files.saveToDownloads(context, "${invoice.number}.pdf", Files.pdfFromHtml(context, html))
                Toast.makeText(context, t("Saved to Downloads"), Toast.LENGTH_SHORT).show()
                viewing = false
                Files.open(context, uri)
            } catch (e: Exception) { error = t("Could not create the PDF. Please try again."); viewing = true }
            busy = false
        }
    }

    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        SmallRound(Icons.Outlined.Visibility, t("View invoice")) { if (invoice.filePath != null) uploaded(save = false) else viewing = true }
        SmallRound(Icons.Outlined.Download, t("Download invoice"), busy) { download() }
    }
    if (viewing) Sheet(invoice.number, { viewing = false; error = "" }, full = true) {
        if (invoice.filePath == null) {
            val html = remember(invoice) { invoiceHtml(context, invoice, detail) ?: "" }
            InvoiceWeb(html, Modifier.weight(1f).fillMaxWidth().clip(RoundedCornerShape(12.dp)).border(1.dp, DX.line, RoundedCornerShape(12.dp)))
        }
        ErrorText(error, Modifier.padding(top = 12.dp))
        DXButton(t("Download PDF"), { download() }, Modifier.padding(top = 16.dp), size = Size.Lg, busy = busy) {
            Icon(Icons.Outlined.Download, null, Modifier.size(20.dp))
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun InvoiceWeb(html: String, modifier: Modifier) {
    AndroidView({ ctx -> WebView(ctx).apply { settings.loadWithOverviewMode = true; settings.useWideViewPort = true; loadDataWithBaseURL("https://drivex.invoice/", html, "text/html", "utf-8", null) } },
        modifier.heightIn(min = 300.dp), onRelease = { it.destroy() })
}

@Composable
private fun SmallRound(icon: ImageVector, label: String, busy: Boolean = false, onClick: () -> Unit) {
    Box(Modifier.size(36.dp).clip(CircleShape).border(1.dp, DX.line, CircleShape).clickable(enabled = !busy, role = Role.Button) { onClick() }.semantics { contentDescription = label },
        contentAlignment = Alignment.Center) {
        if (busy) CircularProgressIndicator(Modifier.size(16.dp), color = DX.inkMuted, strokeWidth = 2.dp)
        else Icon(icon, null, Modifier.size(16.dp), tint = DX.inkMuted)
    }
}

/** An invoice in a list: number, date, view/download, amount and "Paid" or "Pay now". */
@Composable
fun InvoiceRow(invoice: Invoice, date: String, detail: String? = null, onPay: () -> Unit) {
    Row(Modifier.fillMaxWidth().heightIn(min = 64.dp).padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Icon(Icons.Outlined.Description, null, Modifier.size(20.dp), tint = DX.inkMuted)
        Column(Modifier.weight(1f)) {
            Text(invoice.number, style = dx(15.sp, FontWeight.Medium), color = DX.ink)
            Text(Fmt.day(date), style = dx(12.sp), color = DX.inkMuted)
        }
        InvoiceButtons(invoice, detail)
        Column(horizontalAlignment = Alignment.End) {
            Aed(invoice.amount, 15.sp)
            if (invoice.paid) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Icon(Icons.Outlined.CheckCircle, null, Modifier.size(14.dp), tint = DX.brand)
                Text(t("Paid"), style = dx(12.sp), color = DX.brand)
            } else Text(t("Pay now"), style = dx(12.sp, FontWeight.SemiBold).copy(textDecoration = TextDecoration.Underline), color = DX.danger,
                modifier = Modifier.clickable(role = Role.Button) { onPay() })
        }
    }
}

