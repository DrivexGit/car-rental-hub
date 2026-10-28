package com.drivex.app.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.CompositionLocalProvider
import com.drivex.app.R
import com.drivex.app.core.Api
import com.drivex.app.core.Auth
import com.drivex.app.core.DX
import com.drivex.app.core.Fmt
import com.drivex.app.core.display
import com.drivex.app.core.dx
import com.drivex.app.core.t
import com.drivex.app.data.AppStore
import com.drivex.app.ui.DXButton
import com.drivex.app.ui.Route
import com.drivex.app.ui.Router
import com.drivex.app.ui.Size
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private enum class Step { Phone, Code, Name }

/** Sign in with a UAE mobile number and a one-time code; new customers add their name once (api/auth.ts). */
@Composable
fun LoginScreen() {
    var step by rememberSaveable { mutableStateOf(Step.Phone) }
    var phone by rememberSaveable { mutableStateOf("") }
    var code by rememberSaveable { mutableStateOf("") }
    var name by rememberSaveable { mutableStateOf("") }
    var timer by remember { mutableIntStateOf(0) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var testMode by rememberSaveable { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    val national = Fmt.asciiDigits(phone).filter { it.isDigit() }.let { d -> listOf("00971", "971", "0").firstOrNull { d.startsWith(it) }?.let { d.removePrefix(it) } ?: d }
    val full = "+971$national"
    val phoneOk = national.length == 9 && national.startsWith("5")
    // only warn once the number is clearly not a UAE mobile, not while the customer is still typing
    val phoneHint = if (national.isNotEmpty() && (!national.startsWith("5") || national.length > 9)) t("Enter a UAE mobile number, e.g. 50 123 4567.") else ""

    LaunchedEffect(timer) { if (timer > 0) { delay(1000); timer -= 1 } }

    fun run(block: suspend () -> Unit) {
        busy = true; error = ""
        scope.launch {
            try { block() } catch (e: Exception) { error = e.message ?: t("Something went wrong. Please try again.") }
            busy = false
        }
    }
    fun sendCode() = run {
        val r = Api.post("auth", mapOf("action" to "send", "phone" to full))
        testMode = r["testMode"].bool ?: false
        code = ""; step = Step.Code; timer = 45
    }
    fun verify(c: String, fullName: String? = null) = run {
        val r = Api.post("auth", mapOf("action" to "verify", "phone" to full, "code" to c, "name" to fullName))
        if (r["needName"].bool == true) { step = Step.Name; return@run }
        Auth.setSession(r["access_token"].text ?: error("no token"), r["refresh_token"].text ?: error("no token"))
        AppStore.refresh()
    }

    Box(Modifier.fillMaxSize().background(DX.night)) {
        Box(Modifier.fillMaxWidth().height(560.dp)) {
            Image(painterResource(R.drawable.login_background), null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop, alignment = Alignment.TopCenter)
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color.Black.copy(alpha = 0.3f), 0.5f to Color.Transparent, 1f to DX.night)))
        }
        Column(
            Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().imePadding().verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp).widthIn(max = 480.dp),
        ) {
            Box(Modifier.height(64.dp), contentAlignment = Alignment.CenterStart) {
                if (step == Step.Phone) Image(painterResource(R.drawable.logo_white), "Drivex", Modifier.height(32.dp))
                else Box(Modifier.size(40.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.1f)).border(1.dp, Color.White.copy(alpha = 0.2f), CircleShape)
                    .clickable { error = ""; step = if (step == Step.Name) Step.Code else Step.Phone }.semantics { contentDescription = t("Back") },
                    contentAlignment = Alignment.Center) { Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = Color.White) }
            }
            Spacer(Modifier.height(220.dp))
            AnimatedContent(step, transitionSpec = { (slideInHorizontally { it / 3 } + fadeIn()) togetherWith fadeOut() }, label = "step") { s ->
                Column(Modifier.padding(bottom = 40.dp)) {
                    when (s) {
                        Step.Phone -> Panel(t("Welcome to Drivex"), t("Enter your mobile number to sign in or create your account.")) {
                            Text(t("Mobile number"), style = dx(14.sp, FontWeight.Medium), color = Color.White.copy(alpha = 0.7f), modifier = Modifier.padding(bottom = 8.dp))
                            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                                Row(Modifier.fillMaxWidth().height(56.dp).clip(RoundedCornerShape(12.dp)).background(Color.White).padding(horizontal = 16.dp),
                                    verticalAlignment = Alignment.CenterVertically) {
                                    Text("🇦🇪 +971", style = dx(17.sp, FontWeight.SemiBold), color = DX.ink)
                                    Box(Modifier.padding(horizontal = 12.dp).width(1.dp).height(28.dp).background(DX.line))
                                    Field(phone, { phone = it }, "50 123 4567", KeyboardType.Phone, ImeAction.Go, { if (phoneOk) sendCode() }, autofocus = true)
                                }
                            }
                            LoginError(error.ifEmpty { phoneHint })
                            DXButton(t("Send code"), { sendCode() }, Modifier.padding(top = 24.dp), size = Size.Lg, busy = busy, enabled = phoneOk)
                            Text(t("By continuing you agree to our Terms and Privacy Policy."), style = dx(12.sp), color = Color.White.copy(alpha = 0.5f),
                                textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 16.dp))
                            Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterHorizontally)) {
                                Text(t("Terms & conditions"), style = dx(12.sp), color = Color.White.copy(alpha = 0.6f), modifier = Modifier.clickable { Router.signedOut.add(Route.LegalPage("terms")) })
                                Text(t("Privacy policy"), style = dx(12.sp), color = Color.White.copy(alpha = 0.6f), modifier = Modifier.clickable { Router.signedOut.add(Route.LegalPage("privacy")) })
                            }
                        }
                        Step.Code -> Panel(t("Enter the code"), null, sub = buildAnnotatedString {
                            append(t("We sent a 6-digit code by SMS to") + " ")
                            withStyle(SpanStyle(color = Color.White, fontWeight = FontWeight.Bold)) { append(Char(0x2066) + Fmt.phone(full) + Char(0x2069)) /* isolated left-to-right: the number keeps its order in Arabic and Persian */ }
                        }) {
                            CodeField(code, { code = it; if (it.length == 6) verify(it) })
                            if (testMode) Text(t("Test mode: SMS is not connected yet.") + " " + t("Use code {code}", "code" to "123456"), style = dx(14.sp), color = DX.warnText,
                                modifier = Modifier.padding(top = 12.dp).clip(RoundedCornerShape(8.dp)).background(DX.warnSoft).padding(horizontal = 12.dp, vertical = 8.dp))
                            LoginError(error)
                            DXButton(t("Continue"), { verify(code) }, Modifier.padding(top = 24.dp), size = Size.Lg, busy = busy, enabled = code.length == 6)
                            Text(if (timer > 0) t("Resend code in {n}s", "n" to timer) else t("Resend code"), style = dx(14.sp, FontWeight.Medium),
                                color = Color.White.copy(alpha = if (timer > 0 || busy) 0.4f else 1f), textAlign = TextAlign.Center,
                                modifier = Modifier.fillMaxWidth().padding(top = 16.dp).clickable(enabled = timer == 0 && !busy) { sendCode() }.padding(8.dp))
                        }
                        Step.Name -> Panel(t("What's your name?"), t("So we know how to greet you. You only do this once.")) {
                            Box(Modifier.fillMaxWidth().height(56.dp).clip(RoundedCornerShape(12.dp)).background(Color.White).padding(horizontal = 16.dp), contentAlignment = Alignment.CenterStart) {
                                Field(name, { name = it }, t("Full name"), KeyboardType.Text, ImeAction.Done, { if (name.trim().length >= 2) verify(code, name.trim()) }, autofocus = true)
                            }
                            LoginError(error)
                            DXButton(t("Get started"), { verify(code, name.trim()) }, Modifier.padding(top = 24.dp), size = Size.Lg, busy = busy, enabled = name.trim().length >= 2)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Panel(title: String, subText: String?, sub: androidx.compose.ui.text.AnnotatedString? = null, content: @Composable () -> Unit) {
    Text(title, style = display(34.sp), color = Color.White)
    Text(sub ?: buildAnnotatedString { append(subText ?: "") }, style = dx(15.sp), color = Color.White.copy(alpha = 0.75f), modifier = Modifier.padding(top = 8.dp, bottom = 28.dp))
    content()
}

@Composable
private fun LoginError(msg: String) {
    if (msg.isNotEmpty()) Text(msg, style = dx(14.sp, FontWeight.Medium), color = Color(0xFFFCA5A5), modifier = Modifier.padding(top = 12.dp))
}

@Composable
private fun androidx.compose.foundation.layout.RowScope.Field(value: String, onChange: (String) -> Unit, placeholder: String, type: KeyboardType, ime: ImeAction, onDone: () -> Unit, autofocus: Boolean = false) =
    Box(Modifier.weight(1f)) { FieldBox(value, onChange, placeholder, type, ime, onDone, autofocus) }

@Composable
private fun Field(value: String, onChange: (String) -> Unit, placeholder: String, type: KeyboardType, ime: ImeAction, onDone: () -> Unit, autofocus: Boolean = false) =
    FieldBox(value, onChange, placeholder, type, ime, onDone, autofocus)

@Composable
private fun FieldBox(value: String, onChange: (String) -> Unit, placeholder: String, type: KeyboardType, ime: ImeAction, onDone: () -> Unit, autofocus: Boolean) {
    val focus = remember { FocusRequester() }
    if (autofocus) LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
    BasicTextField(
        value, onChange, Modifier.fillMaxWidth().focusRequester(focus), singleLine = true,
        textStyle = dx(18.sp, color = DX.ink), cursorBrush = SolidColor(DX.brand),
        keyboardOptions = KeyboardOptions(keyboardType = type, imeAction = ime), keyboardActions = KeyboardActions { onDone() },
        decorationBox = { inner -> Box { if (value.isEmpty()) Text(placeholder, style = dx(18.sp), color = DX.inkFaint); inner() } },
    )
}

/** Six boxes over one hidden field; the keyboard's code suggestion (SMS / WhatsApp) fills it in one tap. */
@Composable
private fun CodeField(code: String, onChange: (String) -> Unit) {
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        Box {
            BasicTextField(
                code, { v -> onChange(Fmt.asciiDigits(v).filter { it.isDigit() }.take(6)) },
                Modifier.matchParentSize().focusRequester(focus).semantics { contentDescription = t("Verification code") },
                textStyle = dx(1.sp, color = Color.Transparent), cursorBrush = SolidColor(Color.Transparent),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            )
            Row(Modifier.fillMaxWidth().clickable { runCatching { focus.requestFocus() } }, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                repeat(6) { i ->
                    Box(Modifier.weight(1f).height(56.dp).clip(RoundedCornerShape(12.dp)).background(Color.White)
                        .border(1.dp, if (i == code.length) DX.brand else DX.line, RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
                        Text(code.getOrNull(i)?.toString() ?: "", style = dx(24.sp, FontWeight.Bold), color = DX.ink)
                    }
                }
            }
        }
    }
}
