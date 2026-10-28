package com.drivex.app.core

import android.icu.text.DateFormat
import android.icu.text.NumberFormat
import android.icu.util.TimeZone
import android.icu.util.ULocale
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.temporal.ChronoUnit
import kotlin.math.max

/**
 * Dates, money and phone numbers, as on the site (src/lib/format.ts). Rental dates are UAE dates:
 * they are shown in Dubai time whatever the phone's time zone is. Days are "yyyy-MM-dd" strings.
 */
object Fmt {
    val dubai: ZoneId = ZoneId.of("Asia/Dubai")

    /** "2026-10-16" (a plain date) means that day in the UAE (noon, so no time zone can shift it); a timestamp stays what it is. */
    fun instant(s: String): Instant = runCatching {
        if (s.length == 10) LocalDate.parse(s).atTime(12, 0).atZone(dubai).toInstant()
        else OffsetDateTime.parse(s.replace(" ", "T")).toInstant()
    }.getOrElse { Instant.now() }

    private fun uaeDate(s: String): LocalDate = instant(s).atZone(dubai).toLocalDate()

    /** The same calendars as the site's Intl formats: Persian dates use the Persian (solar) calendar, like "fa-IR" in a browser. */
    private fun uLocale(gregorian: Boolean = false) = ULocale(
        when (I18n.lang) {
            Lang.en -> "en_GB"
            Lang.ar -> "ar_AE@numbers=latn"
            Lang.fa -> if (gregorian) "fa_IR@calendar=gregorian;numbers=latn" else "fa_IR@calendar=persian;numbers=latn"
        }
    )

    private fun format(skeleton: String, at: Instant, gregorian: Boolean = false): String =
        DateFormat.getInstanceForSkeleton(skeleton, uLocale(gregorian)).apply { timeZone = TimeZone.getTimeZone("Asia/Dubai") }
            .format(java.util.Date.from(at))

    /** "16 Oct 2026" */
    fun day(s: String): String = format("ddMMMyyyy", instant(s))
    /** "16 Oct" */
    fun shortDay(s: String): String = format("dMMM", instant(s))
    /** "November 2026" over a calendar month (the calendar grid is Gregorian, as on the site). */
    fun monthTitle(d: LocalDate): String = format("MMMMyyyy", d.atTime(12, 0).atZone(dubai).toInstant(), gregorian = true)
    /** Monday-first one-letter weekday names. */
    fun weekdayLetters(): List<String> {
        val f = DateFormat.getInstanceForSkeleton("EEEEE", uLocale(true)).apply { timeZone = TimeZone.getTimeZone("Asia/Dubai") }
        val monday = LocalDate.of(2024, 1, 1) // a Monday
        return (0..6).map { f.format(java.util.Date.from(monday.plusDays(it.toLong()).atTime(12, 0).atZone(dubai).toInstant())) }
    }

    /** 1,250 in the app's language, no decimals. */
    fun money(n: Double): String = NumberFormat.getNumberInstance(uLocale()).apply { maximumFractionDigits = 0 }.format(n.roundHalfUp())

    /** Today's date in the UAE as "yyyy-MM-dd". */
    fun todayInUAE(): String = LocalDate.now(dubai).toString()
    fun addDays(day: String, n: Int): String = LocalDate.parse(day.take(10)).plusDays(n.toLong()).toString()
    fun daysBetween(a: String, b: String): Int =
        max(1L, ((instant(b).toEpochMilli() - instant(a).toEpochMilli()) / 86_400_000.0).roundHalfUp().toLong()).toInt()
    /** Whole UAE calendar days from today to that moment: 0 = today, 1 = tomorrow, negative = past. */
    fun daysUntil(s: String): Int = ChronoUnit.DAYS.between(LocalDate.now(dubai), uaeDate(s)).toInt()

    /** An English key: translate it where it is shown. Uses the hour in the UAE. */
    fun greeting(): String {
        val h = ZonedDateTime.now(dubai).hour
        return if (h < 12) "Good morning" else if (h < 18) "Good afternoon" else "Good evening"
    }

    /** "+971501234567" -> "(+971) 50 123 4567" (UAE mobiles). Anything else is returned as it came. */
    fun phone(p: String?): String {
        val s = (p ?: "").replace(" ", "")
        val m = Regex("""^\+971(\d{2})(\d{3})(\d{4})$""").find(s) ?: return p ?: ""
        val (a, b, c) = m.destructured
        return "(+971) $a $b $c"
    }

    /** Persian and Arabic-Indic digits to ASCII, so a Farsi keyboard still works in number fields. */
    fun asciiDigits(s: String): String = buildString {
        for (ch in s) append(
            when (ch) {
                in '۰'..'۹' -> '0' + (ch - '۰')
                in '٠'..'٩' -> '0' + (ch - '٠')
                else -> ch
            }
        )
    }
}

/** JavaScript's Math.round: halves go up (towards +infinity). */
fun Double.roundHalfUp(): Double = kotlin.math.floor(this + 0.5)
/** Math.round(n * 100) / 100, as the site's prices do. */
fun Double.round2(): Double = (this * 100).roundHalfUp() / 100
