package com.drivex.app.data

import com.drivex.app.core.round2
import com.drivex.app.core.roundHalfUp

// Extras and their prices: a copy of apps/customer/src/data/pricing.ts, the file the server (api/book.ts) uses to price
// the booking. The server decides the real price; this is the quote the app shows before paying. Keep them identical
// (PricingTest checks the same cases).
object Pricing {
    /** Full coverage insurance costs this percentage of the rental price (after any offer). */
    const val FULL_COVER_PCT = 15.0
    /** Additional driver: per day, but a flat fee per month on a monthly rental. */
    const val DRIVER_DAILY = 25.0
    const val DRIVER_MONTHLY = 300.0
    const val CHILD_SEAT_DAILY = 15.0
    /** Security deposit: 1,000 is blocked on the card at pickup, or the customer pays this fee once and nothing is blocked. */
    const val DEPOSIT_AMOUNT = 1000.0
    const val NO_DEPOSIT_FEE = 200.0

    val extraLabels = mapOf(
        "full_cover" to "Full coverage insurance",
        "extra_driver" to "Additional driver",
        "child_seat" to "Child seat",
        "no_deposit" to "No deposit",
    )
    /** Ids a customer can pick as ordinary extras (no_deposit is chosen separately, as the deposit option). */
    val pickableExtras = listOf("full_cover", "extra_driver", "child_seat")

    /** What one extra costs for this rental. [base] is the rental price after any offer. Unknown ids cost nothing. */
    fun extraCost(id: String, base: Double, period: Period, qty: Int): Double {
        val days = (period.days * qty).toDouble()
        return when (id) {
            "full_cover" -> (base * FULL_COVER_PCT / 100).roundHalfUp()
            "extra_driver" -> if (period == Period.monthly) DRIVER_MONTHLY * qty else DRIVER_DAILY * days
            "child_seat" -> CHILD_SEAT_DAILY * days
            "no_deposit" -> NO_DEPOSIT_FEE
            else -> 0.0
        }
    }

    /** VAT rate of each extra on the invoice: insurance carries no VAT; the rest carry 5%. */
    val extraVat = mapOf("full_cover" to 0.0, "extra_driver" to 0.05, "child_seat" to 0.05, "no_deposit" to 0.05)
    /** The standard VAT rate. Prices already include it: the VAT is worked out from the total. */
    const val RENTAL_VAT = 0.05

    /** VAT inside a VAT-inclusive amount, rounded to the fil. */
    fun vatIn(gross: Double, rate: Double) = if (rate > 0) (gross - (gross / (1 + rate)).round2()).round2() else 0.0

    data class Price(val net: Double, val vat: Double, val total: Double)

    /** The charge for a rental: the rental and its extras, each at its own VAT rate. */
    fun priceWithVat(base: Double, extras: List<String>, period: Period, qty: Int): Price {
        val rows = listOf(base to RENTAL_VAT) + extras.mapNotNull { id -> extraVat[id]?.let { extraCost(id, base, period, qty) to it } }
        val total = rows.sumOf { it.first }.round2()
        val vat = rows.sumOf { vatIn(it.first, it.second) }.round2()
        return Price((total - vat).round2(), vat, total)
    }
}

/** Documents a customer must have before booking (apps/customer/src/data/documents.ts; api/book.ts enforces it).
 *  `id` is what the app uploads; `accept` lists every type that counts (staff can upload a passport in the panel). */
object RequiredDocuments {
    data class Item(val id: String, val label: String, val accept: List<String>)
    val all = listOf(
        Item("id_card", "Emirates ID or passport", listOf("id_card", "passport")),
        Item("driving_license", "Driving licence", listOf("driving_license")),
    )
    /** Required documents that are missing, or were rejected and need uploading again. Waiting for review is fine. */
    fun missing(docs: List<Doc>) = all.filter { r -> docs.none { it.type in r.accept && it.status != "rejected" } }
}
