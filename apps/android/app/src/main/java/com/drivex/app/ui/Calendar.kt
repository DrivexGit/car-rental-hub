package com.drivex.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.drivex.app.core.DX
import com.drivex.app.core.Fmt
import com.drivex.app.core.dx
import com.drivex.app.core.t
import java.time.LocalDate

/** Month grids from this month for a year, weeks starting on Monday, days before today (UAE date) disabled.
 *  Days are "yyyy-MM-dd" strings, so they compare in order. Same rules as the site's react-day-picker setup. */
@Composable
private fun MonthGrid(month: LocalDate, isSelected: (String) -> Boolean, inRange: (String) -> Boolean, onPick: (String) -> Unit) {
    val today = Fmt.todayInUAE()
    val lead = month.dayOfWeek.value - 1 // Monday = 1
    val cells: List<String?> = List(lead) { null } + (1..month.lengthOfMonth()).map { month.withDayOfMonth(it).toString() }
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(Fmt.monthTitle(month), style = dx(17.sp, FontWeight.Bold), color = DX.ink, modifier = Modifier.padding(start = 4.dp, bottom = 6.dp))
        Row {
            Fmt.weekdayLetters().forEach { Text(it, style = dx(12.sp, FontWeight.Medium), color = DX.inkFaint, modifier = Modifier.weight(1f).padding(vertical = 4.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center) }
        }
        cells.chunked(7).forEach { week ->
            Row {
                for (i in 0 until 7) {
                    val day = week.getOrNull(i)
                    Box(Modifier.weight(1f).height(44.dp).padding(1.dp), contentAlignment = Alignment.Center) {
                        if (day != null) {
                            val disabled = day < today
                            val selected = isSelected(day)
                            val middle = !selected && inRange(day)
                            Box(
                                Modifier.fillMaxWidth().height(42.dp).clip(RoundedCornerShape(12.dp))
                                    .background(if (selected) DX.brand else if (middle) DX.brandSoft else Color.Transparent)
                                    .pressable(0.9f, enabled = !disabled) { onPick(day) },
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(day.takeLast(2).trimStart('0'), style = dx(15.sp, if (selected) FontWeight.Bold else FontWeight.Normal),
                                    color = when { disabled -> DX.inkFaint.copy(alpha = 0.6f); selected -> Color.White; day == today -> DX.brand; else -> DX.ink })
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun months(): List<LocalDate> {
    val start = LocalDate.parse(Fmt.todayInUAE()).withDayOfMonth(1)
    return (0L..12L).map { start.plusMonths(it) }
}

/** Pickup -> return, for the Book filter. */
@Composable
fun DateRangeSheet(from: String, to: String, onApply: (String, String) -> Unit, onClear: () -> Unit, onClose: () -> Unit) {
    var start by remember { mutableStateOf(from.ifEmpty { null }) }
    var end by remember { mutableStateOf(to.ifEmpty { null }) }
    Sheet(t("Rental dates"), onClose, full = true) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(bottom = 12.dp)) {
            Pill(t("Pickup"), start?.let { Fmt.shortDay(it) } ?: t("Select"), start == null, Modifier.weight(1f))
            Pill(t("Return"), end?.let { Fmt.shortDay(it) } ?: t("Select"), start != null && end == null, Modifier.weight(1f))
        }
        LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            items(months()) { m ->
                MonthGrid(m, { it == start || it == end }, { d -> val s = start; val e = end; s != null && e != null && d > s && d < e }) { d ->
                    // like a range calendar: the first tap is the pickup, a later day is the return, an earlier day starts again
                    val s = start
                    if (s != null && end == null && d > s) end = d else { start = d; end = null }
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 16.dp)) {
            DXButton(t("Clear"), { start = null; end = null; onClear(); onClose() }, Modifier.weight(1f), Variant.Ghost)
            val s = start; val e = end
            val n = if (s != null && e != null) Fmt.daysBetween(s, e) else 0
            DXButton(if (n == 0) t("Apply") else if (n > 1) t("Apply · {n} days", "n" to n) else t("Apply · {n} day", "n" to n),
                { if (s != null && e != null) { onApply(s, e); onClose() } }, Modifier.weight(2f), enabled = n > 0)
        }
    }
}

@Composable
private fun Pill(label: String, value: String, active: Boolean, modifier: Modifier) {
    val shape = RoundedCornerShape(12.dp)
    Column(modifier.clip(shape).background(if (active) DX.brandSoft else Color.White).border(1.dp, if (active) DX.brand else DX.line, shape).padding(vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally) {
        Text(label, style = dx(12.sp), color = DX.inkMuted)
        Text(value, style = dx(15.sp, FontWeight.SemiBold), color = DX.ink)
    }
}

/** One day, for the pickup date. */
@Composable
fun DateSheet(value: String, title: String = t("Pickup date"), onPick: (String) -> Unit, onClose: () -> Unit) {
    val list = months()
    val state = rememberLazyListState(list.indexOfFirst { it.toString().take(7) == value.take(7) }.coerceAtLeast(0))
    Sheet(title, onClose, full = true) {
        LazyColumn(Modifier.weight(1f), state, verticalArrangement = Arrangement.spacedBy(20.dp)) {
            items(list) { m -> MonthGrid(m, { it == value }, { false }) { onPick(it); onClose() } }
            item { Spacer(Modifier.height(8.dp)) }
        }
    }
}

