package com.drivex.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.ScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.drivex.app.core.DX
import com.drivex.app.core.dx
import com.drivex.app.core.t
import com.drivex.app.data.Period
import com.drivex.app.data.Quote

/** The five tabs of the site's bottom bar. */
enum class Tab(val label: String) { home("Home"), book("Book"), support("Support"), bookings("Bookings"), profile("Profile") }

/** Pages that open on top of a tab (the site's routes). */
sealed interface Route {
    data class Reserve(val carId: String, val period: Period, val off: Int, val from: String?, val to: String?) : Route
    data class Checkout(val quote: Quote) : Route
    data class Confirmed(val id: String) : Route
    data class BookingDetail(val id: String, val section: String? = null) : Route
    data object Inbox : Route
    data object EditProfile : Route
    data object Payments : Route
    data object Security : Route
    data object Documents : Route
    data object Notifications : Route
    data object Language : Route
    data object Legal : Route
    data object Other : Route
    data class LegalPage(val id: String) : Route
    data object DeleteAccount : Route
}

/** Where the customer is: the tab, the pages open on each tab, and the Book tab's filters that other pages set. */
object Router {
    var tab by mutableStateOf(Tab.home)
    val stacks = mutableStateMapOf<Tab, List<Route>>()
    /** The Book tab's period and "offers only", set by the Home banners and "View all". */
    var bookPeriod by mutableStateOf(Period.daily)
    var bookOffersOnly by mutableStateOf(false)
    /** A question to put in the Support composer ("Get help with this booking"). */
    var supportDraft by mutableStateOf<String?>(null)
    /** Pages opened while signed out (the legal pages from the sign-in screen). */
    val signedOut = mutableStateListOf<Route>()

    fun stack(t: Tab = tab) = stacks[t] ?: emptyList()
    val atRoot get() = stack().isEmpty()

    fun push(r: Route) { stacks[tab] = stack() + r }
    /** Back one page; false when already on the first page of the tab. */
    fun back(): Boolean {
        val s = stack()
        if (s.isEmpty()) return false
        stacks[tab] = s.dropLast(1)
        return true
    }
    /** Replaces the pages of the current tab (Checkout -> Confirmed, like `replace: true` on the site). */
    fun replace(r: Route) { stacks[tab] = listOf(r) }

    /** A tap on a tab: back to its first page when it is already open. */
    fun select(t: Tab) { if (tab == t) stacks[t] = emptyList() else tab = t }

    fun openBook(period: Period? = null, offersOnly: Boolean = false) {
        if (period != null) bookPeriod = period
        bookOffersOnly = offersOnly
        stacks[Tab.book] = emptyList()
        tab = Tab.book
    }

    fun openSupport(ask: String? = null) {
        supportDraft = ask
        stacks[Tab.support] = emptyList()
        tab = Tab.support
    }

    /** Opens a site link from a notification ("/bookings/<id>#invoice", "/profile/payments", ...). */
    fun open(link: String) {
        val path = link.substringBefore("#")
        val section = link.substringAfter("#", "").ifEmpty { null }
        val seg = path.split("/").filter { it.isNotEmpty() }
        when (seg.firstOrNull()) {
            "bookings" -> if (seg.size == 2) { tab = Tab.bookings; stacks[Tab.bookings] = listOf(Route.BookingDetail(seg[1], section)) } else select(Tab.bookings)
            "book" -> openBook()
            "support" -> openSupport()
            "profile" -> {
                tab = Tab.profile
                val sub = mapOf("payments" to Route.Payments, "documents" to Route.Documents, "edit" to Route.EditProfile, "notifications" to Route.Notifications)
                stacks[Tab.profile] = listOfNotNull(seg.getOrNull(1)?.let { sub[it] })
            }
            "notifications" -> push(Route.Inbox)
            else -> { tab = Tab.home; stacks[Tab.home] = emptyList() }
        }
    }

    fun reset() { stacks.clear(); tab = Tab.home; signedOut.clear() }
}

// ---- Page layouts

/** A scrolling page in the site's column: 20dp side margins on the page background. */
@Composable
fun PageScroll(modifier: Modifier = Modifier, state: ScrollState = rememberScrollState(), bottom: Int = 32, content: @Composable ColumnScope.() -> Unit) {
    Box(modifier.fillMaxSize().background(DX.bg).verticalScroll(state), contentAlignment = Alignment.TopCenter) {
        Column(Modifier.widthIn(max = 560.dp).fillMaxWidth().padding(start = 20.dp, end = 20.dp, bottom = bottom.dp), content = content)
    }
}

/** An inner page: the back bar stays at the top while the rest scrolls; an optional bar stays at the bottom. */
@Composable
fun InnerPage(
    title: String, state: ScrollState = rememberScrollState(), trailing: @Composable RowScope.() -> Unit = {},
    bottomBar: (@Composable ColumnScope.() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit,
) {
    Column(Modifier.fillMaxSize().background(DX.bg)) {
        BackBar(title, trailing = trailing)
        PageScroll(Modifier.weight(1f), state, bottom = 40, content = content)
        if (bottomBar != null) BottomBar(bottomBar)
    }
}

/** The fixed action bar at the bottom of the booking steps. */
@Composable
fun BottomBar(content: @Composable ColumnScope.() -> Unit) {
    Column(
        Modifier.fillMaxWidth().shadow(12.dp).background(Color.White).navigationBarsPadding().padding(horizontal = 20.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp), content = content,
    )
}

/** The site's bottom sheet: a title, a close button and the content. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun Sheet(title: String, onClose: () -> Unit, full: Boolean = false, content: @Composable ColumnScope.() -> Unit) {
    val state = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = onClose, sheetState = state, containerColor = Color.White, shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)) {
        Column(Modifier.fillMaxWidth().then(if (full) Modifier.fillMaxSize() else Modifier).padding(start = 20.dp, end = 20.dp, bottom = 24.dp)) {
            Row(Modifier.fillMaxWidth().padding(bottom = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(title, style = dx(18.sp, FontWeight.Bold), color = DX.ink, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                Box(Modifier.size(36.dp).clip(CircleShape).background(DX.bg).clickable(role = Role.Button) { onClose() }.semantics { contentDescription = t("Close") },
                    contentAlignment = Alignment.Center) { Icon(Icons.Filled.Close, null, Modifier.size(18.dp), tint = DX.ink) }
            }
            content()
        }
    }
}
