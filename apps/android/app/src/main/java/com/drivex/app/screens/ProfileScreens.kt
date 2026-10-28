package com.drivex.app.screens

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Rect
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.Badge
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material.icons.outlined.HeadsetMic
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Palette
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Smartphone
import androidx.compose.material.icons.outlined.Upload
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.CompositionLocalProvider
import androidx.core.content.FileProvider
import androidx.exifinterface.media.ExifInterface
import com.drivex.app.core.Api
import com.drivex.app.core.AppConfig
import com.drivex.app.core.AppError
import com.drivex.app.core.DX
import com.drivex.app.core.Db
import com.drivex.app.core.Files
import com.drivex.app.core.Fmt
import com.drivex.app.core.I18n
import com.drivex.app.core.Lang
import com.drivex.app.core.Storage
import com.drivex.app.core.ThemeName
import com.drivex.app.core.ThemeStore
import com.drivex.app.core.dx
import com.drivex.app.core.t
import com.drivex.app.data.AppStore
import com.drivex.app.data.Invoice
import com.drivex.app.data.Notify
import com.drivex.app.data.RequiredDocuments
import com.drivex.app.data.noteLink
import com.drivex.app.ui.Aed
import com.drivex.app.ui.CardButton
import com.drivex.app.ui.DXButton
import com.drivex.app.ui.Divided
import com.drivex.app.ui.rows
import com.drivex.app.ui.EmptyState
import com.drivex.app.ui.ErrorText
import com.drivex.app.ui.Face
import com.drivex.app.ui.InnerPage
import com.drivex.app.ui.ListGroup
import com.drivex.app.ui.ListRow
import com.drivex.app.ui.PageScroll
import com.drivex.app.ui.PageTitle
import com.drivex.app.ui.Route
import com.drivex.app.ui.Router
import com.drivex.app.ui.Segmented
import com.drivex.app.ui.Sheet
import com.drivex.app.ui.Size
import com.drivex.app.ui.Tab
import com.drivex.app.ui.TopBar
import com.drivex.app.ui.appear
import com.drivex.app.ui.card
import com.drivex.app.ui.pressable
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File

// ---- Notifications inbox

/** Notifications: invoices, fines and booking updates. Opening the page marks them read; a tap goes where they point. */
@Composable
fun InboxScreen() {
    LaunchedEffect(Unit) { delay(1200); AppStore.markNotesRead() }
    InnerPage(t("Notifications")) {
        if (AppStore.notes.isEmpty()) EmptyState(Icons.Outlined.Notifications, t("You're all caught up"), t("Invoices, Salik and booking updates show up here."))
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            AppStore.notes.forEachIndexed { i, n ->
                val fine = n.type == "fine"
                val body: @Composable () -> Unit = {
                    Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(if (fine) DX.dangerSoft else DX.brandSoft), contentAlignment = Alignment.Center) {
                            Icon(when (n.type) { "invoice" -> Icons.Outlined.Description; "fine" -> Icons.Outlined.ReceiptLong; "booking_confirmed" -> Icons.Outlined.CalendarMonth; else -> Icons.Outlined.Notifications },
                                null, Modifier.size(20.dp), tint = if (fine) DX.danger else DX.brand)
                        }
                        Column(Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(n.title, style = dx(16.sp, FontWeight.SemiBold), color = DX.ink, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                                Text(ago(n.created), style = dx(12.sp), color = DX.inkFaint, modifier = Modifier.padding(start = 8.dp))
                            }
                            n.body?.let { Text(it, style = dx(14.sp), color = DX.inkMuted) }
                        }
                        if (!n.read) Box(Modifier.padding(top = 6.dp).size(10.dp).clip(CircleShape).background(DX.brand))
                    }
                }
                Box(Modifier.appear(i * 40)) {
                    if (n.link != null) CardButton({ Router.open(noteLink(n.type, n.link)) }) { body() } else Box(Modifier.card()) { body() }
                }
            }
        }
    }
}

private fun ago(d: String): String {
    val m = Math.round((System.currentTimeMillis() - Fmt.instant(d).toEpochMilli()) / 60000.0)
    return when {
        m < 1 -> t("now")
        m < 60 -> t("{n}m", "n" to m)
        m < 1440 -> t("{n}h", "n" to Math.round(m / 60.0))
        else -> t("{n}d", "n" to Math.round(m / 1440.0))
    }
}

// ---- Profile tab

/** Profile tab: the customer's card, reminders for missing documents or email, and the settings menu. */
@Composable
fun ProfileScreen() {
    val user = AppStore.user ?: return
    val missing = AppStore.missingDocuments
    var appearance by remember { mutableStateOf(false) }
    var logout by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Refreshable {
        PageScroll {
            TopBar {
                Row(Modifier.clickable { Router.select(Tab.support) }.padding(4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.Outlined.HeadsetMic, null, Modifier.size(20.dp), tint = DX.ink)
                    Text(t("Support"), style = dx(14.sp, FontWeight.Medium), color = DX.ink)
                }
            }
            PageTitle(t("My profile"))
            Row(Modifier.fillMaxWidth().padding(bottom = 24.dp).card().padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Face(64.dp)
                Column(Modifier.weight(1f)) {
                    Text(user.name, style = dx(18.sp, FontWeight.Bold), color = DX.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                        Text(user.email ?: Fmt.phone(user.phone), style = dx(14.sp), color = DX.inkMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
                Box(Modifier.size(44.dp).pressable(0.92f) { Router.push(Route.EditProfile) }.clip(CircleShape).border(1.dp, DX.line, CircleShape)
                    .semantics { contentDescription = t("Edit profile") }, contentAlignment = Alignment.Center) { Icon(Icons.Outlined.Edit, null, tint = DX.ink) }
            }
            if (missing.isNotEmpty()) Reminder(Icons.Outlined.Badge, DX.danger, DX.dangerSoft, DX.danger, t("Upload your documents"),
                t("You need these before you can book: {list}.", "list" to missing.joinToString(", ") { t(it.label) })) { Router.push(Route.Documents) }
            if (user.email == null) Reminder(Icons.Outlined.Email, DX.warnText, DX.warnSoft, DX.warn, t("Add your email"),
                t("Your account has no email yet. Add one so we can reach you.")) { Router.push(Route.EditProfile) }

            ListGroup(t("Account"), listOf(
                { ListRow(t("Payments"), Icons.Outlined.CreditCard) { Router.push(Route.Payments) } },
                { ListRow(t("Security"), Icons.Outlined.VerifiedUser) { Router.push(Route.Security) } },
                { ListRow(t("Documents"), Icons.Outlined.Description) { Router.push(Route.Documents) } },
            ))
            ListGroup(t("Preferences & support"), listOf(
                { ListRow(t("Notifications"), Icons.Outlined.Notifications) { Router.push(Route.Notifications) } },
                { ListRow(t("Change language"), Icons.Outlined.Language, I18n.lang.label) { Router.push(Route.Language) } },
                { ListRow(t("Appearance"), Icons.Outlined.Palette, t(ThemeStore.name.label)) { appearance = true } },
                { ListRow(t("Support & legal"), Icons.Outlined.HeadsetMic) { Router.push(Route.Legal) } },
                { ListRow(t("Other"), Icons.Outlined.Settings) { Router.push(Route.Other) } },
            ))
            ListGroup(null, listOf({ ListRow(t("Log out"), Icons.AutoMirrored.Outlined.Logout, danger = true) { logout = true } }))
        }
    }
    if (appearance) Sheet(t("Appearance"), { appearance = false }) {
        Segmented(ThemeStore.name, ThemeName.entries.map { it to t(it.label) }) { ThemeStore.set(it) }
    }
    if (logout) AlertDialog(
        onDismissRequest = { logout = false },
        confirmButton = { TextButton({ logout = false; SupportChat.messages.clear(); Router.reset(); scope.launch { AppStore.signOut() } }) { Text(t("Log out"), color = DX.danger) } },
        dismissButton = { TextButton({ logout = false }) { Text(t("Cancel"), color = DX.ink) } },
        title = { Text(t("Log out")) }, containerColor = Color.White,
    )
}

@Composable
private fun Reminder(icon: ImageVector, fg: Color, bg: Color, iconBg: Color, title: String, text: String, onClick: () -> Unit) {
    Row(Modifier.padding(top = 0.dp, bottom = 16.dp).fillMaxWidth().pressable(onClick = onClick).clip(RoundedCornerShape(14.dp)).background(bg)
        .border(1.dp, fg.copy(alpha = 0.3f), RoundedCornerShape(14.dp)).padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(iconBg), contentAlignment = Alignment.Center) { Icon(icon, null, Modifier.size(20.dp), tint = Color.White) }
        Column(Modifier.weight(1f)) {
            Text(title, style = dx(16.sp, FontWeight.SemiBold), color = fg)
            Text(text, style = dx(14.sp), color = DX.inkMuted)
        }
    }
}

// ---- Edit profile and photo

/** Centre-crops to a square and shrinks to [size] px, JPEG at 85% (the site's compressSquare). Follows the photo's rotation. */
private suspend fun squareJpeg(context: android.content.Context, uri: Uri, size: Int = 512): ByteArray = withContext(Dispatchers.IO) {
    val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: throw AppError(t("We could not read that image. Try a JPG or PNG."))
    if (bytes.size > 10 * 1024 * 1024) throw AppError(t("That photo is too large. Choose one under 10 MB."))
    val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)
    var sample = 1
    while (minOf(opts.outWidth, opts.outHeight) / (sample * 2) >= size) sample *= 2
    val raw = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })
        ?: throw AppError(t("We could not read that image. Try a JPG or PNG."))
    val rotation = runCatching { ExifInterface(bytes.inputStream()).rotationDegrees }.getOrDefault(0)
    val bmp = if (rotation != 0) Bitmap.createBitmap(raw, 0, 0, raw.width, raw.height, Matrix().apply { postRotate(rotation.toFloat()) }, true) else raw
    val side = minOf(bmp.width, bmp.height)
    val out = minOf(size, side)
    val square = Bitmap.createBitmap(out, out, Bitmap.Config.ARGB_8888)
    Canvas(square).drawBitmap(bmp, Rect((bmp.width - side) / 2, (bmp.height - side) / 2, (bmp.width + side) / 2, (bmp.height + side) / 2), Rect(0, 0, out, out), null)
    ByteArrayOutputStream().also { square.compress(Bitmap.CompressFormat.JPEG, 85, it) }.toByteArray()
}

/** A photo from the camera: written to the app's cache, then read back. */
private fun cameraUri(context: android.content.Context): Uri {
    val dir = File(context.cacheDir, "camera").apply { mkdirs() }
    return FileProvider.getUriForFile(context, "${context.packageName}.files", File(dir, "photo-${System.currentTimeMillis()}.jpg"))
}

@Composable
fun EditProfileScreen() {
    val user = AppStore.user ?: return
    var name by remember { mutableStateOf(user.name) }
    var email by remember { mutableStateOf(user.email ?: "") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    val valid = name.trim().length >= 2 && Regex("""^\S+@\S+\.\S+$""").matches(email.trim())
    InnerPage(t("Edit profile")) {
        PhotoPicker()
        Field(t("Full name"), name, { name = it })
        Field(t("Email"), email, { email = it }, ltr = true, type = KeyboardType.Email)
        Field(t("Mobile number"), Fmt.phone(user.phone), {}, ltr = true, enabled = false)
        ErrorText(error, Modifier.padding(bottom = 8.dp))
        DXButton(t("Save"), {
            busy = true; error = ""
            scope.launch {
                try { AppStore.updateUser(name = name.trim(), email = email.trim()); Router.back() } catch (e: Exception) { error = e.message ?: ""; busy = false }
            }
        }, Modifier.padding(top = 16.dp), size = Size.Lg, busy = busy, enabled = valid)
    }
}

@Composable
private fun Field(label: String, value: String, onChange: (String) -> Unit, ltr: Boolean = false, enabled: Boolean = true, type: KeyboardType = KeyboardType.Text) {
    Column(Modifier.padding(bottom = 16.dp)) {
        Text(label, style = dx(14.sp), color = DX.inkMuted, modifier = Modifier.padding(bottom = 6.dp))
        Box(Modifier.fillMaxWidth().height(56.dp).clip(RoundedCornerShape(12.dp)).background(if (enabled) Color.White else DX.bg).border(1.dp, DX.line, RoundedCornerShape(12.dp))
            .padding(horizontal = 16.dp), contentAlignment = Alignment.CenterStart) {
            val field = @Composable {
                BasicTextField(value, onChange, Modifier.fillMaxWidth(), enabled = enabled, singleLine = true, textStyle = dx(16.sp, color = if (enabled) DX.ink else DX.inkMuted),
                    cursorBrush = SolidColor(DX.brand), keyboardOptions = KeyboardOptions(keyboardType = type))
            }
            if (ltr) CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) { field() } else field()
        }
    }
}

/** Tap the photo to pick one (camera or gallery); it is cropped square and shrunk on the phone before upload. */
@Composable
private fun PhotoPicker() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var choose by remember { mutableStateOf(false) }
    var shot by remember { mutableStateOf<Uri?>(null) }
    fun run(block: suspend () -> Unit) { busy = true; error = ""; scope.launch { try { block() } catch (e: Exception) { error = e.message ?: "" }; busy = false } }
    val gallery = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri -> if (uri != null) run { AppStore.setAvatar(squareJpeg(context, uri)) } }
    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok -> val u = shot; if (ok && u != null) run { AppStore.setAvatar(squareJpeg(context, u)) } }

    Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.clickable(enabled = !busy, role = Role.Button) { choose = true }.semantics { contentDescription = t("Change profile photo") }) {
            Face(96.dp)
            Box(Modifier.align(Alignment.BottomEnd).size(36.dp).clip(CircleShape).background(DX.brand).border(2.dp, Color.White, CircleShape), contentAlignment = Alignment.Center) {
                if (busy) CircularProgressIndicator(Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp) else Icon(Icons.Outlined.CameraAlt, null, Modifier.size(16.dp), tint = Color.White)
            }
        }
        if (AppStore.user?.avatarUrl != null) Text(t("Remove photo"), style = dx(14.sp, FontWeight.Medium).copy(textDecoration = TextDecoration.Underline), color = DX.inkMuted,
            modifier = Modifier.padding(top = 12.dp).clickable(enabled = !busy) { run { AppStore.setAvatar(null) } })
        ErrorText(error, Modifier.padding(top = 8.dp))
    }
    if (choose) SourceSheet(t("Change profile photo"), withFile = false, onClose = { choose = false },
        onCamera = { shot = cameraUri(context); camera.launch(shot!!) },
        onGallery = { gallery.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }, onFile = {})
}

/** Take a photo, pick one, or (documents) choose a file. */
@Composable
private fun SourceSheet(title: String, withFile: Boolean, onClose: () -> Unit, onCamera: () -> Unit, onGallery: () -> Unit, onFile: () -> Unit) {
    Sheet(title, onClose) {
        Divided(buildList<@Composable () -> Unit> {
            add { ListRow(t("Take photo"), Icons.Outlined.CameraAlt) { onClose(); onCamera() } }
            add { ListRow(t("Photo library"), Icons.Outlined.Badge) { onClose(); onGallery() } }
            if (withFile) add { ListRow(t("Choose file"), Icons.Outlined.Description) { onClose(); onFile() } }
        })
    }
}

// ---- Payments

@Composable
fun PaymentsScreen() {
    var paying by remember { mutableStateOf<Invoice?>(null) }
    InnerPage(t("Payments")) {
        if (AppStore.invoices.isEmpty()) EmptyState(Icons.Outlined.Description, t("No payments yet"))
        else Divided(AppStore.invoices.rows { i -> InvoiceRow(i, i.paidAt ?: i.issued) { paying = i } })
        if (AppStore.fines.isNotEmpty()) {
            Heading(t("Salik & fines"))
            Divided(AppStore.fines.rows { f ->
                run {
                    Row(Modifier.fillMaxWidth().heightIn(min = 56.dp).padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(f.title?.let { t(it) } ?: t(if (f.type == "traffic") "Fine" else "Salik"), style = dx(15.sp, FontWeight.Medium), color = DX.ink)
                            Text((if (f.place.isNotEmpty()) "${f.place} · " else "") + Fmt.day(f.date), style = dx(12.sp), color = DX.inkMuted)
                        }
                        Aed(f.amount, 15.sp, FontWeight.SemiBold)
                    }
                }
            })
        }
    }
    paying?.let { PayInvoiceSheet(it) { paying = null } }
}

// ---- Documents

private val DOC_TYPES = RequiredDocuments.all.map { it.id to it.label } + ("visa" to "Visa page (tourists)")

/**
 * Uploads to the private customer-documents bucket ("<uid>/...") and registers the file for staff review; an AI check
 * rejects at once a picture that is unreadable, the wrong document or expired. Viewing an approved document needs a code
 * sent to WhatsApp (api/doc-view.ts); the unlock lasts five minutes and lives in memory only. Uploading is never gated.
 */
@Composable
fun DocumentsScreen() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf("") }
    var choosing by remember { mutableStateOf<String?>(null) }
    var target by remember { mutableStateOf<String?>(null) }
    var shot by remember { mutableStateOf<Uri?>(null) }
    var unlock by remember { mutableStateOf<Pair<String, Long>?>(null) }
    var viewing by remember { mutableStateOf<Pair<String, String>?>(null) }
    var code by remember { mutableStateOf("") }
    var viewBusy by remember { mutableStateOf(false) }
    var viewError by remember { mutableStateOf("") }

    fun upload(type: String, uri: Uri) {
        val uid = AppStore.user?.id ?: return
        busy = type; error = ""
        scope.launch {
            try {
                val cr = context.contentResolver
                val mime = cr.getType(uri) ?: "image/jpeg"
                val name = cr.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c -> if (c.moveToFirst()) c.getString(0) else null } ?: "photo.jpg"
                val bytes = withContext(Dispatchers.IO) { cr.openInputStream(uri)?.use { it.readBytes() } } ?: throw AppError(t("Something went wrong. Please try again."))
                if (bytes.size > 10 * 1024 * 1024) throw AppError(t("File is too large (max 10 MB)."))
                val ext = name.substringAfterLast('.', "").lowercase().ifEmpty { "jpg" }
                val path = "$uid/$type-${System.currentTimeMillis()}.$ext"
                Storage.upload("customer-documents", path, bytes, mime)
                val me = Db.select("customers", "select" to "lead_id,tenant_id", "id" to "eq.$uid", "limit" to "1").firstOrNull()
                val row = Db.insert("customer_documents", mapOf(
                    "lead_id" to me?.get("lead_id")?.string, "tenant_id" to me?.get("tenant_id")?.string, "document_type" to type,
                    "storage_bucket" to "customer-documents", "storage_path" to path, "file_name" to name, "mime_type" to mime, "file_size" to bytes.size,
                    "uploaded_by" to "customer", "verification_status" to "pending",
                )).firstOrNull()
                // the AI check reads the picture and rejects it at once if it is unreadable, the wrong document or expired
                row?.get("id")?.string?.let { id ->
                    val check = runCatching { Api.post("doc-check", mapOf("documentId" to id)) }.getOrNull()
                    if (check?.get("status")?.string == "rejected") check["reason"].text?.let { error = it }
                }
            } catch (e: Exception) { error = e.message ?: "" }
            AppStore.refresh()
            busy = null
        }
    }
    val gallery = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri -> val tp = target; if (uri != null && tp != null) upload(tp, uri) }
    val files = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> val tp = target; if (uri != null && tp != null) upload(tp, uri) }
    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok -> val tp = target; val u = shot; if (ok && tp != null && u != null) upload(tp, u) }

    suspend fun open(id: String, token: String) {
        val out = Api.post("doc-view", mapOf("action" to "view", "documentId" to id, "unlock" to token))
        val url = out["url"].text ?: throw AppError(t("Could not open the document. Please try again."))
        val bytes = Storage.download(url)
        val isPdf = url.substringBefore('?').lowercase().endsWith(".pdf")
        val uri = Files.cache(context, "document-${System.currentTimeMillis()}.${if (isPdf) "pdf" else "jpg"}", bytes)
        viewing = null; code = ""
        Files.open(context, uri, if (isPdf) "application/pdf" else "image/*")
    }
    fun view(id: String, name: String) {
        viewError = ""; code = ""; viewBusy = true
        scope.launch {
            try {
                val u = unlock
                if (u != null && u.second > System.currentTimeMillis()) open(id, u.first)
                else { unlock = null; viewing = id to name; Api.post("doc-view", mapOf("action" to "send")) }
            } catch (e: Exception) { unlock = null; viewError = e.message ?: ""; if (viewing == null) error = viewError }
            viewBusy = false
        }
    }

    InnerPage(t("Documents")) {
        Text(t("Upload once. We need these before your first pickup."), style = dx(15.sp), color = DX.inkMuted, modifier = Modifier.padding(bottom = 16.dp))
        Divided(DOC_TYPES.rows { (id, label) ->
            run {
                val doc = AppStore.documents.firstOrNull { it.type == id }
                Row(Modifier.fillMaxWidth().heightIn(min = 64.dp).padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(Modifier.weight(1f).clickable(enabled = busy == null) { choosing = id }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Icon(Icons.Outlined.Badge, null, Modifier.size(20.dp), tint = DX.ink)
                        Column(Modifier.weight(1f)) {
                            Text(buildAnnotatedString {
                                append(t(label) + "  ")
                                withStyle(SpanStyle(fontSize = 12.sp, fontWeight = FontWeight.Normal, color = if (id == "visa") DX.inkMuted else DX.warnText)) { append(if (id == "visa") t("Optional") else t("Required")) }
                            }, style = dx(15.sp, FontWeight.Medium), color = DX.ink)
                            val status = doc?.let { if (it.status == "approved") t("Approved") else if (it.status == "rejected") t("Rejected — upload again") else t("In review") }
                            Text(doc?.let { "${it.fileName} · $status" } ?: t("Photo or PDF"), style = dx(12.sp), color = DX.inkMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        when {
                            busy == id -> CircularProgressIndicator(Modifier.size(20.dp), color = DX.brand, strokeWidth = 2.dp)
                            doc != null && doc.status != "rejected" -> Icon(Icons.Outlined.CheckCircle, null, Modifier.size(24.dp), tint = DX.brand)
                            else -> Icon(Icons.Outlined.Upload, null, Modifier.size(20.dp), tint = DX.brand)
                        }
                    }
                    if (doc?.status == "approved") Text(t("View"), style = dx(14.sp, FontWeight.Medium), color = DX.brand,
                        modifier = Modifier.clip(CircleShape).border(1.dp, DX.line, CircleShape).clickable(enabled = !viewBusy) { view(doc.id, t(label)) }.padding(horizontal = 12.dp, vertical = 6.dp))
                }
            }
        })
        ErrorText(error, Modifier.padding(top = 12.dp))
    }

    choosing?.let { id ->
        SourceSheet(t("Photo or PDF"), withFile = true, onClose = { choosing = null },
            onCamera = { target = id; shot = cameraUri(context); camera.launch(shot!!) },
            onGallery = { target = id; gallery.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
            onFile = { target = id; files.launch(arrayOf("application/pdf", "image/*")) })
    }
    viewing?.let { (id, name) ->
        Sheet(name, { viewing = null; code = ""; viewError = "" }) {
            Text(t("We sent a code to your WhatsApp. Enter it to open this document."), style = dx(14.sp), color = DX.inkMuted, modifier = Modifier.padding(bottom = 12.dp))
            Box(Modifier.fillMaxWidth().height(48.dp).clip(RoundedCornerShape(12.dp)).background(Color.White).border(1.dp, DX.line, RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
                BasicTextField(code, { code = Fmt.asciiDigits(it).filter { c -> c.isDigit() }.take(6) }, Modifier.fillMaxWidth(), singleLine = true,
                    textStyle = dx(20.sp, FontWeight.SemiBold, DX.ink).copy(textAlign = TextAlign.Center, letterSpacing = 8.sp), cursorBrush = SolidColor(DX.brand),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                    decorationBox = { inner -> Box(contentAlignment = Alignment.Center) { if (code.isEmpty()) Text(t("Enter the code"), style = dx(16.sp), color = DX.inkFaint); inner() } })
            }
            ErrorText(viewError, Modifier.padding(top = 12.dp))
            DXButton(t("Open document"), {
                viewBusy = true; viewError = ""
                scope.launch {
                    try {
                        val u = Api.post("doc-view", mapOf("action" to "unlock", "code" to code))
                        val token = u["token"].string ?: throw AppError(t("Please enter the code again."))
                        unlock = token to (u["expiresAt"].double?.toLong() ?: 0L)
                        open(id, token)
                    } catch (e: Exception) { viewError = e.message ?: "" }
                    viewBusy = false
                }
            }, Modifier.padding(top = 16.dp), size = Size.Lg, busy = viewBusy, enabled = code.length == 6)
        }
    }
}

// ---- Security, notifications, language, legal, other

@Composable
fun SecurityScreen() = InnerPage(t("Security")) {
    ListGroup(null, listOf({ ListRow(t("Sign-in number"), Icons.Outlined.Smartphone, Fmt.phone(AppStore.user?.phone)) }))
    Text(t("You sign in with a one-time code sent to this number. To change it, contact support."), style = dx(14.sp), color = DX.inkMuted, modifier = Modifier.padding(horizontal = 4.dp))
}

@Composable
fun NotificationSettingsScreen() {
    val scope = rememberCoroutineScope()
    var on by remember { mutableStateOf(AppStore.user?.notify ?: Notify(true, true, true)) }
    fun set(next: Notify) {
        val before = on
        on = next
        scope.launch { try { AppStore.updateUser(notify = next) } catch (e: Exception) { on = before } }
    }
    InnerPage(t("Notifications")) {
        Divided(listOf(
            Triple("Booking reminders", on.bookings) { v: Boolean -> set(on.copy(bookings = v)) },
            Triple("Invoices, Salik & fines", on.invoices) { v: Boolean -> set(on.copy(invoices = v)) },
            Triple("Offers & benefits", on.offers) { v: Boolean -> set(on.copy(offers = v)) },
        ).rows { (label, value, change) ->
            run {
                Row(Modifier.fillMaxWidth().height(64.dp).clickable(role = Role.Switch) { change(!value) }.padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(t(label), style = dx(16.sp, FontWeight.Medium), color = DX.ink, modifier = Modifier.weight(1f))
                    Switch(value, change, colors = SwitchDefaults.colors(checkedTrackColor = DX.brand, uncheckedTrackColor = DX.line, uncheckedBorderColor = DX.line, uncheckedThumbColor = Color.White))
                }
            }
        })
    }
}

@Composable
fun LanguageScreen() = InnerPage(t("Language")) {
    Divided(Lang.entries.rows { l ->
        run {
            val on = l == I18n.lang
            Row(Modifier.fillMaxWidth().height(56.dp).background(if (on) DX.brandSoft else Color.Transparent).clickable { I18n.set(l) }.padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Text(l.label, style = dx(16.sp, if (on) FontWeight.SemiBold else FontWeight.Normal), color = if (on) DX.brand else DX.ink, modifier = Modifier.weight(1f))
                if (on) Icon(Icons.Filled.Check, null, Modifier.size(18.dp), tint = DX.brand)
            }
        }
    })
}

@Composable
fun SupportLegalScreen() {
    val context = LocalContext.current
    InnerPage(t("Support & legal")) {
        ListGroup(null, listOf(
            { ListRow(t("Chat with Drivex AI")) { Router.openSupport() } },
            { ListRow(t("WhatsApp us")) { Files.openLink(context, AppConfig.whatsappLink()) } },
            { ListRow(t("Terms & conditions")) { Router.push(Route.LegalPage("terms")) } },
            { ListRow(t("Privacy policy")) { Router.push(Route.LegalPage("privacy")) } },
            { ListRow(t("Delete my account")) { Router.push(Route.DeleteAccount) } },
        ))
    }
}

@Composable
fun OtherScreen() = InnerPage(t("Other")) {
    ListGroup(null, listOf({ ListRow(t("App version"), value = AppConfig.version) }))
}

