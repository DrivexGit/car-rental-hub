package com.drivex.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.HeadsetMic
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.automirrored.filled.Assignment
import androidx.compose.material.icons.outlined.DirectionsCar
import androidx.compose.material.icons.outlined.HeadsetMic
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.automirrored.outlined.Assignment
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.WifiOff
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.drivex.app.core.AppConfig
import com.drivex.app.core.Auth
import com.drivex.app.core.DX
import com.drivex.app.core.I18n
import com.drivex.app.core.dx
import com.drivex.app.core.t
import com.drivex.app.data.AppStore
import com.drivex.app.screens.BookScreen
import com.drivex.app.screens.BookingDetailScreen
import com.drivex.app.screens.BookingsScreen
import com.drivex.app.screens.CheckoutScreen
import com.drivex.app.screens.ConfirmedScreen
import com.drivex.app.screens.DeleteAccountScreen
import com.drivex.app.screens.DocumentsScreen
import com.drivex.app.screens.EditProfileScreen
import com.drivex.app.screens.HomeScreen
import com.drivex.app.screens.InboxScreen
import com.drivex.app.screens.LanguageScreen
import com.drivex.app.screens.LegalScreen
import com.drivex.app.screens.LoginScreen
import com.drivex.app.screens.NotificationSettingsScreen
import com.drivex.app.screens.OtherScreen
import com.drivex.app.screens.PaymentsScreen
import com.drivex.app.screens.ProfileScreen
import com.drivex.app.screens.ReserveScreen
import com.drivex.app.screens.SecurityScreen
import com.drivex.app.screens.SupportLegalScreen
import com.drivex.app.screens.SupportScreen

/** The whole app: language direction, the splash, then sign-in or the tabs. */
@Composable
fun DrivexRoot() {
    val dir = if (I18n.lang.isRtl) LayoutDirection.Rtl else LayoutDirection.Ltr
    var splashDone by remember { mutableStateOf(!AppConfig.isConfigured) }
    CompositionLocalProvider(LocalLayoutDirection provides dir) {
        MaterialTheme(colorScheme = lightColorScheme(primary = DX.brand, onPrimary = Color.White, background = DX.bg, surface = Color.White)) {
            Box(Modifier.fillMaxSize().background(DX.bg)) {
                when {
                    !AppConfig.isConfigured -> EmptyState(Icons.Outlined.Settings, "The app is not set up yet", "Add supabaseUrl and supabaseAnonKey to secrets.properties, then build again.")
                    !AppStore.ready -> {}
                    AppStore.user != null -> { MainTabs(); OnboardingOverlay() }
                    AppStore.offline && Auth.userId != null -> OfflineScreen()
                    else -> SignedOut()
                }
                if (!splashDone) Splash(AppStore.ready) { splashDone = true }
            }
        }
    }
}

@Composable
private fun OfflineScreen() {
    Box(Modifier.fillMaxSize().statusBarsPadding(), contentAlignment = Alignment.Center) {
        EmptyState(Icons.Outlined.WifiOff, t("Could not load your data.")) {
            DXButton(t("Try again"), { AppStore.refreshLater() })
        }
    }
}

/** Signed out: the sign-in page, which also opens the public legal pages. */
@Composable
private fun SignedOut() {
    val top = Router.signedOut.lastOrNull()
    BackHandler(enabled = top != null) { Router.signedOut.removeAt(Router.signedOut.lastIndex) }
    Box(Modifier.fillMaxSize().then(if (top != null) Modifier.statusBarsPadding().navigationBarsPadding() else Modifier)) {
        when (top) {
            null -> LoginScreen()
            Route.DeleteAccount -> DeleteAccountScreen { Router.signedOut.removeAt(Router.signedOut.lastIndex) }
            is Route.LegalPage -> LegalScreen(top.id) { Router.signedOut.removeAt(Router.signedOut.lastIndex) }
            else -> LoginScreen()
        }
    }
}

/** Five tabs, each with its own stack of pages, and the site's bottom bar on the first page of each. */
@Composable
private fun MainTabs() {
    val holder = rememberSaveableStateHolder()
    val stack = Router.stack()
    BackHandler(enabled = stack.isNotEmpty() || Router.tab != Tab.home) {
        if (!Router.back()) Router.select(Tab.home)
    }
    Column(Modifier.fillMaxSize().background(DX.bg)) {
        AnimatedContent(
            targetState = Triple(Router.tab, stack.size, stack.lastOrNull()),
            modifier = Modifier.weight(1f).statusBarsPadding().imePadding(),
            transitionSpec = {
                val sameTab = initialState.first == targetState.first
                when {
                    !sameTab -> (fadeIn(tween(220)) + slideInVertically(tween(320)) { it / 40 }) togetherWith fadeOut(tween(120))
                    targetState.second > initialState.second -> (slideInHorizontally(tween(300)) { it / 4 } + fadeIn(tween(300))) togetherWith fadeOut(tween(150))
                    else -> (slideInHorizontally(tween(300)) { -it / 4 } + fadeIn(tween(300))) togetherWith fadeOut(tween(150))
                }
            },
            label = "page",
        ) { (tab, depth, route) ->
            holder.SaveableStateProvider("${tab.name}/$depth/${route?.toString() ?: ""}") {
                if (route == null) TabRoot(tab) else RouteScreen(route)
            }
        }
        AnimatedVisibility(Router.atRoot, enter = slideInVertically { it }, exit = slideOutVertically { it }) { TabBar() }
        if (!Router.atRoot) Box(Modifier.navigationBarsPadding())
    }
}

@Composable
private fun TabRoot(tab: Tab) = when (tab) {
    Tab.home -> HomeScreen()
    Tab.book -> BookScreen()
    Tab.support -> SupportScreen()
    Tab.bookings -> BookingsScreen()
    Tab.profile -> ProfileScreen()
}

@Composable
private fun RouteScreen(route: Route) = when (route) {
    is Route.Reserve -> ReserveScreen(route)
    is Route.Checkout -> CheckoutScreen(route.quote)
    is Route.Confirmed -> ConfirmedScreen(route.id)
    is Route.BookingDetail -> BookingDetailScreen(route.id, route.section)
    Route.Inbox -> InboxScreen()
    Route.EditProfile -> EditProfileScreen()
    Route.Payments -> PaymentsScreen()
    Route.Security -> SecurityScreen()
    Route.Documents -> DocumentsScreen()
    Route.Notifications -> NotificationSettingsScreen()
    Route.Language -> LanguageScreen()
    Route.Legal -> SupportLegalScreen()
    Route.Other -> OtherScreen()
    is Route.LegalPage -> LegalScreen(route.id) { Router.back() }
    Route.DeleteAccount -> DeleteAccountScreen { Router.back() }
}

/** The site's bottom bar: five tabs, the active one with a pill behind its icon and a line on top. */
@Composable
private fun TabBar() {
    Row(Modifier.fillMaxWidth().shadow(16.dp).background(Color.White).navigationBarsPadding()) {
        Tab.entries.forEach { tab ->
            val on = Router.tab == tab
            val (filled, outlined) = icons(tab)
            Column(
                Modifier.weight(1f).height(64.dp)
                    .pressable(0.95f, role = Role.Tab) { Router.select(tab) }
                    .semantics { contentDescription = t(tab.label); selected = on },
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(Modifier.height(3.dp).width(48.dp).clip(RoundedCornerShape(bottomStart = 3.dp, bottomEnd = 3.dp)).background(if (on) DX.brand else Color.Transparent))
                Box(Modifier.padding(top = 4.dp).size(48.dp, 30.dp).clip(RoundedCornerShape(15.dp)).background(if (on) DX.brandSoft else Color.Transparent), contentAlignment = Alignment.Center) {
                    Icon(if (on) filled else outlined, null, Modifier.size(24.dp), tint = if (on) DX.brand else DX.inkFaint)
                }
                Text(t(tab.label), style = dx(11.sp, FontWeight.Medium), color = if (on) DX.brand else DX.inkFaint, modifier = Modifier.padding(top = 2.dp))
            }
        }
    }
}

private fun icons(tab: Tab): Pair<ImageVector, ImageVector> = when (tab) {
    Tab.home -> Icons.Filled.Home to Icons.Outlined.Home
    Tab.book -> Icons.Filled.DirectionsCar to Icons.Outlined.DirectionsCar
    Tab.support -> Icons.Filled.HeadsetMic to Icons.Outlined.HeadsetMic
    Tab.bookings -> Icons.AutoMirrored.Filled.Assignment to Icons.AutoMirrored.Outlined.Assignment
    Tab.profile -> Icons.Filled.Person to Icons.Outlined.Person
}
