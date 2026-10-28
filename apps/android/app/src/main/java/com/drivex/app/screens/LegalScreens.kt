package com.drivex.app.screens

import android.content.Context
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckBox
import androidx.compose.material.icons.filled.CheckBoxOutlineBlank
import androidx.compose.material.icons.outlined.Chat
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.CompositionLocalProvider
import com.drivex.app.core.AppConfig
import com.drivex.app.core.DX
import com.drivex.app.core.Files
import com.drivex.app.core.I18n
import com.drivex.app.core.J
import com.drivex.app.core.dx
import com.drivex.app.core.t
import com.drivex.app.data.AppStore
import com.drivex.app.ui.BackBar
import com.drivex.app.ui.DXButton
import com.drivex.app.ui.ErrorText
import com.drivex.app.ui.PageScroll
import com.drivex.app.ui.Size
import com.drivex.app.ui.Variant
import com.drivex.app.ui.appear
import com.drivex.app.ui.card

/** Terms, privacy policy and account deletion: the site's texts (assets/content/legal.json, from src/content/legal.ts). */
private object Legal {
    private var all: J? = null
    fun doc(context: Context, id: String): J {
        val docs = all ?: J.parse(context.assets.open("content/legal.json").bufferedReader().use { it.readText() }).also { all = it }
        val d = docs[id][I18n.lang.name]
        return if (d.isNull) docs[id]["en"] else d
    }
}

@Composable
private fun LegalBody(doc: J) {
    SelectionContainer {
        Column(Modifier.fillMaxWidth().appear(), verticalArrangement = Arrangement.spacedBy(24.dp)) {
            Text(doc["updated"].string ?: "", style = dx(14.sp), color = DX.inkFaint)
            Text(doc["intro"].string ?: "", style = dx(15.sp).copy(lineHeight = 23.sp), color = DX.ink)
            doc["sections"].array.forEach { s ->
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(s["h"].string ?: "", style = dx(18.sp, FontWeight.SemiBold), color = DX.ink)
                    s["p"].array.mapNotNull { it.string }.forEach { line ->
                        if (line.startsWith("• ")) Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Box(Modifier.padding(top = 9.dp).size(6.dp).clip(CircleShape).background(DX.brand))
                            Text(line.drop(2), style = dx(15.sp).copy(lineHeight = 23.sp), color = DX.inkMuted)
                        } else Text(line, style = dx(15.sp).copy(lineHeight = 23.sp), color = DX.inkMuted)
                    }
                }
            }
        }
    }
}

/** Terms or privacy policy. They open without signing in too, from the sign-in page. */
@Composable
fun LegalScreen(id: String, onBack: () -> Unit) {
    val doc = Legal.doc(LocalContext.current, id)
    Column(Modifier.fillMaxSize().background(DX.bg)) {
        BackBar(doc["title"].string ?: "", onBack)
        PageScroll(Modifier.weight(1f), bottom = 40) { LegalBody(doc) }
    }
}

/** The account deletion page, with a request form sent by email or WhatsApp (nothing is deleted from the app itself). */
@Composable
fun DeleteAccountScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val doc = Legal.doc(context, "delete")
    val user = AppStore.user
    var name by remember { mutableStateOf(user?.name ?: "") }
    var phone by remember { mutableStateOf(user?.phone ?: "") }
    var email by remember { mutableStateOf(user?.email ?: "") }
    var reason by remember { mutableStateOf("") }
    var sure by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }

    val text = listOfNotNull(
        "Account deletion request", "Name: ${name.trim()}", "Mobile: ${phone.trim()}",
        email.trim().takeIf { it.isNotEmpty() }?.let { "Email: $it" }, reason.trim().takeIf { it.isNotEmpty() }?.let { "Reason: $it" },
        "I understand that deleting my account is permanent.",
    ).joinToString("\n")
    fun check(): Boolean {
        error = when {
            name.trim().length < 2 || phone.count { it.isDigit() } < 9 -> t("Please enter your name and mobile number.")
            !sure -> t("Please confirm that you understand.")
            else -> ""
        }
        return error.isEmpty()
    }

    Column(Modifier.fillMaxSize().background(DX.bg)) {
        BackBar(doc["title"].string ?: t("Delete my account"), onBack)
        PageScroll(Modifier.weight(1f), bottom = 40) {
            LegalBody(doc)
            Column(Modifier.padding(top = 32.dp).fillMaxWidth().card().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(t("Your request"), style = dx(18.sp, FontWeight.SemiBold), color = DX.ink)
                FormField(t("Full name"), name, { name = it })
                FormField(t("Mobile number"), phone, { phone = it }, ltr = true, type = KeyboardType.Phone)
                FormField(t("Email (optional)"), email, { email = it }, ltr = true, type = KeyboardType.Email)
                FormField(t("Reason (optional)"), reason, { if (it.length <= 500) reason = it }, lines = 4)
                Row(Modifier.clickable(role = Role.Checkbox) { sure = !sure }, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Icon(if (sure) Icons.Filled.CheckBox else Icons.Filled.CheckBoxOutlineBlank, null, tint = if (sure) DX.brand else DX.inkFaint)
                    Text(t("I understand that deleting my account is permanent."), style = dx(14.sp), color = DX.ink)
                }
                ErrorText(error)
                DXButton(t("Send by email"), {
                    if (check()) Files.openLink(context, "mailto:${AppConfig.Company.EMAIL}?subject=${Uri.encode("Account deletion request")}&body=${Uri.encode(text)}")
                }, size = Size.Lg) { Icon(Icons.Outlined.Email, null, Modifier.size(20.dp)) }
                DXButton(t("Send by WhatsApp"), { if (check()) Files.openLink(context, AppConfig.whatsappLink(text)) }, variant = Variant.Soft, size = Size.Lg) {
                    Icon(Icons.Outlined.Chat, null, Modifier.size(20.dp))
                }
                Text(t("This opens your email app or WhatsApp with the request ready to send. We reply from the same channel."), style = dx(12.sp), color = DX.inkMuted)
            }
        }
    }
}

@Composable
private fun FormField(label: String, value: String, onChange: (String) -> Unit, ltr: Boolean = false, type: KeyboardType = KeyboardType.Text, lines: Int = 1) {
    Column {
        Text(label, style = dx(14.sp, FontWeight.Medium), color = DX.ink, modifier = Modifier.padding(bottom = 4.dp))
        Box(Modifier.fillMaxWidth().heightIn(min = 48.dp).clip(RoundedCornerShape(12.dp)).background(Color.White).border(1.dp, DX.line, RoundedCornerShape(12.dp))
            .padding(horizontal = 16.dp, vertical = 12.dp)) {
            val field = @Composable {
                BasicTextField(value, onChange, Modifier.fillMaxWidth(), singleLine = lines == 1, minLines = lines, textStyle = dx(15.sp, color = DX.ink),
                    cursorBrush = SolidColor(DX.brand), keyboardOptions = KeyboardOptions(keyboardType = type))
            }
            if (ltr) CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) { field() } else field()
        }
    }
}
