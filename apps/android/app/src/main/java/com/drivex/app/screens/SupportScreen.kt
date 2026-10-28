package com.drivex.app.screens

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.StartOffset
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Call
import androidx.compose.material.icons.outlined.Chat
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.drivex.app.core.Api
import com.drivex.app.core.AppConfig
import com.drivex.app.core.DX
import com.drivex.app.core.Files
import com.drivex.app.core.display
import com.drivex.app.core.dx
import com.drivex.app.core.t
import com.drivex.app.data.AppStore
import com.drivex.app.ui.AvatarButton
import com.drivex.app.ui.Chip
import com.drivex.app.ui.Router
import com.drivex.app.ui.TopBar
import com.drivex.app.ui.appear
import com.drivex.app.ui.pressable
import kotlinx.coroutines.launch

/** The conversation, kept for as long as the app runs (the site keeps it for the browser tab). */
object SupportChat {
    data class Message(val role: String, val content: String, val urgent: Boolean = false)
    val messages = mutableStateListOf<Message>()
    var busy by mutableStateOf(false)

    suspend fun send(content: String, urgent: Boolean) {
        messages.add(Message("user", content))
        busy = true
        try {
            val out = Api.post("chat", mapOf("messages" to messages.takeLast(12).map { mapOf("role" to it.role, "content" to it.content) }, "urgentCall" to urgent))
            messages.add(Message("assistant", out["reply"].text ?: t("Sorry, something went wrong."), out["urgent"].bool ?: false))
        } catch (e: Exception) {
            messages.add(Message("assistant", t("I can't connect right now. Please message us on WhatsApp or call us.")))
        }
        busy = false
    }
}

private val CHIPS = listOf("Extend my rental", "Payment help")

/** Support tab: chat with Drivex AI (api/chat.ts), quick questions, an urgent call that alerts the team, WhatsApp. */
@Composable
fun SupportScreen() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var text by remember { mutableStateOf("") }
    val focus = remember { FocusRequester() }
    val list = rememberLazyListState()
    val msgs = SupportChat.messages
    LaunchedEffect(Router.supportDraft) { Router.supportDraft?.let { text = it; Router.supportDraft = null; runCatching { focus.requestFocus() } } }
    LaunchedEffect(msgs.size, SupportChat.busy) { if (msgs.isNotEmpty()) list.animateScrollToItem(list.layoutInfo.totalItemsCount.coerceAtLeast(1) - 1) }

    fun send(content: String, urgent: Boolean = false) {
        val c = content.trim()
        if (c.isEmpty() || SupportChat.busy) return
        text = ""
        scope.launch { SupportChat.send(c, urgent) }
    }

    Column(Modifier.fillMaxSize().background(DX.bg)) {
        LazyColumn(Modifier.weight(1f).fillMaxWidth(), list, contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item { TopBar { AvatarButton() } }
            item {
                Row(Modifier.fillMaxWidth().padding(bottom = 8.dp), verticalAlignment = Alignment.Top) {
                    Column(Modifier.weight(1f)) {
                        Text(t("How can we help?"), style = display(30.sp), color = DX.ink)
                        Row(Modifier.padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Icon(Icons.Outlined.AutoAwesome, null, Modifier.size(16.dp), tint = DX.brand)
                            Text(buildAnnotatedString { withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = DX.ink)) { append("Drivex AI") }; append(" · " + t("AI assistant")) },
                                style = dx(14.sp), color = DX.inkFaint)
                        }
                    }
                    Box(Modifier.size(48.dp).pressable(0.92f) { Files.openLink(context, AppConfig.whatsappLink("Hi Drivex, this is ${AppStore.user?.name ?: ""}.")) }
                        .clip(CircleShape).background(DX.whatsapp.copy(alpha = 0.1f)).semantics { contentDescription = "WhatsApp" }, contentAlignment = Alignment.Center) {
                        Icon(Icons.Outlined.Chat, null, Modifier.size(24.dp), tint = DX.whatsapp)
                    }
                }
            }
            item { Bubble(SupportChat.Message("assistant", t("Hi {name}. What can I help you with?", "name" to (AppStore.user?.firstName ?: "")))) }
            if (msgs.isEmpty()) item { QuickChips(urgentFirst = false, ::send) }
            items(msgs) { Bubble(it) }
            if (SupportChat.busy) item { TypingDots() }
        }
        Column(Modifier.fillMaxWidth().background(DX.bg).padding(vertical = 10.dp)) {
            if (msgs.isNotEmpty()) Box(Modifier.padding(bottom = 8.dp)) { QuickChips(urgentFirst = true, ::send) }
            Row(Modifier.padding(horizontal = 20.dp).fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color.White).border(1.dp, DX.line, RoundedCornerShape(16.dp)).padding(6.dp),
                verticalAlignment = Alignment.CenterVertically) {
                BasicTextField(text, { if (it.length <= 2000) text = it }, Modifier.weight(1f).padding(start = 10.dp).focusRequester(focus), maxLines = 4,
                    textStyle = dx(15.sp, color = DX.ink), cursorBrush = SolidColor(DX.brand),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send), keyboardActions = KeyboardActions { send(text) },
                    decorationBox = { inner -> Box { if (text.isEmpty()) Text(t("Ask a question…"), style = dx(15.sp), color = DX.inkFaint); inner() } })
                val ok = text.isNotBlank() && !SupportChat.busy
                Box(Modifier.size(44.dp).pressable(0.95f, enabled = ok) { send(text) }.clip(RoundedCornerShape(12.dp)).background(DX.brand.copy(alpha = if (ok) 1f else 0.4f))
                    .semantics { contentDescription = t("Send") }, contentAlignment = Alignment.Center) {
                    Icon(Icons.AutoMirrored.Filled.Send, null, Modifier.size(18.dp), tint = Color.White)
                }
            }
        }
    }
}

@Composable
private fun QuickChips(urgentFirst: Boolean, send: (String, Boolean) -> Unit) {
    val urgent: @Composable () -> Unit = { Chip(t("Urgent call"), { send(t("Urgent call — I need help now."), true) }, danger = true, icon = Icons.Outlined.Call) }
    LazyRow(contentPadding = PaddingValues(horizontal = if (urgentFirst) 20.dp else 0.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        if (urgentFirst) item { urgent() }
        items(CHIPS) { c -> Chip(t(c), { send(t(c), false) }) }
        if (!urgentFirst) item { urgent() }
    }
}

@Composable
private fun Bubble(m: SupportChat.Message) {
    val context = LocalContext.current
    val mine = m.role == "user"
    Column(Modifier.fillMaxWidth().appear(), horizontalAlignment = if (mine) Alignment.End else Alignment.Start) {
        SelectionContainer {
            Text(m.content, style = dx(15.sp).copy(lineHeight = 22.sp), color = if (mine) Color.White else DX.ink,
                modifier = Modifier.widthIn(max = 300.dp)
                    .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomStart = if (mine) 16.dp else 6.dp, bottomEnd = if (mine) 6.dp else 16.dp))
                    .background(if (mine) DX.brand else DX.muted).padding(horizontal = 16.dp, vertical = 12.dp))
        }
        if (m.urgent) Column(Modifier.padding(top = 8.dp).widthIn(max = 300.dp).fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(DX.dangerSoft)
            .border(1.dp, DX.danger.copy(alpha = 0.3f), RoundedCornerShape(16.dp)).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(Icons.Outlined.Warning, null, Modifier.size(16.dp), tint = DX.danger)
                Text(t("Our team has been alerted"), style = dx(14.sp, FontWeight.SemiBold), color = DX.danger)
            }
            Row(Modifier.fillMaxWidth().height(44.dp).clip(RoundedCornerShape(12.dp)).background(DX.danger).clickable { Files.openLink(context, "tel:${AppConfig.SUPPORT_PHONE}") },
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)) {
                Icon(Icons.Outlined.Call, null, Modifier.size(16.dp), tint = Color.White)
                Text(t("Call Drivex now"), style = dx(15.sp, FontWeight.SemiBold), color = Color.White)
            }
        }
    }
}

@Composable
private fun TypingDots() {
    val tr = rememberInfiniteTransition(label = "dots")
    Row(Modifier.padding(horizontal = 16.dp, vertical = 12.dp).heightIn(min = 16.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        repeat(3) { d ->
            val y by tr.animateFloat(0f, -4f, infiniteRepeatable(tween(400), RepeatMode.Reverse, StartOffset(d * 120)), label = "dot$d")
            Box(Modifier.offset(y = y.dp).size(8.dp).clip(CircleShape).background(DX.inkFaint))
        }
    }
}
