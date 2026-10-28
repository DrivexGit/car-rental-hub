package com.drivex.app.data

import com.drivex.app.core.Fmt
import com.drivex.app.core.roundHalfUp

// The customer's data, shaped as on the site (apps/customer/src/lib/store.tsx).

enum class Period(val days: Int, val unit: String, val label: String) {
    daily(1, "day", "Daily"), weekly(7, "week", "Weekly"), monthly(30, "month", "Monthly");
}

/** A bookable model: the vehicles table has one row per plate; rows of the same make and model are grouped. */
data class Car(
    val id: String, val make: String, val model: String, val year: Int, val category: String,
    val daily: Double, val weekly: Double, val monthly: Double, val image: String, val seats: Int, val vehicleIds: List<String>,
) {
    val name get() = "${make.replace("Mercedes-Benz", "Mercedes")} $model"
    fun price(p: Period) = when (p) { Period.daily -> daily; Period.weekly -> weekly; Period.monthly -> monthly }
}

data class Notify(val bookings: Boolean, val invoices: Boolean, val offers: Boolean)

data class User(
    val id: String, val phone: String, val name: String, val email: String?, val customerNo: Int?, val nationality: String?,
    val avatarUrl: String?, val notify: Notify,
) {
    val firstName get() = name.split(" ").firstOrNull()?.takeIf { it.isNotEmpty() } ?: name
    val initials get() = name.split(" ").filter { it.isNotEmpty() }.take(2).joinToString("") { it.take(1) }.uppercase().ifEmpty { "?" }
}

enum class BookingStatus { pending, upcoming, ongoing, overdue, completed, cancelled }

data class Booking(
    val id: String, val car: Car, val plate: String, val period: Period, val pickup: String, val dropoff: String,
    val total: Double, val extras: List<String>, val status: BookingStatus, val rawStatus: String,
)

data class InvoiceLine(val description: String, val amount: Double, val discount: Double, val vatRate: Double)
data class InvoicePayment(val date: String, val method: String, val category: String?, val amount: Double)

data class Invoice(
    val id: String, val number: String, val bookingId: String?, val amount: Double, val issued: String, val status: String,
    val paidAt: String?, val description: String?, val dueDate: String?, val lines: List<InvoiceLine>, val payments: List<InvoicePayment>,
    /** Set when staff uploaded the invoice as a PDF: that file is shown, not a rebuilt one. */
    val filePath: String?,
) {
    val paid get() = status == "paid"
}

/** Seller details printed on invoices (TRN, legal address, bank). Set in the panel's tenant settings. */
data class Seller(val trn: String?, val legalAddress: String?, val bankAccountName: String?, val bankName: String?, val iban: String?, val bic: String?)

data class Fine(val id: String, val bookingId: String?, val type: String, val title: String?, val amount: Double, val date: String, val place: String)

data class Offer(
    val id: String, val kind: String, val title: String, val subtitle: String?, val off: Int, val image: String?, val car: Car?,
    val description: String?, val terms: String?, val location: String?,
)

data class Specs(
    val engine: String?, val transmission: String, val fuel: String, val seats: Int, val doors: Int, val bags: Int,
    val features: List<String>, val image: String?, val gallery: List<String>,
)

data class Note(val id: String, val type: String, val title: String, val body: String?, val link: String?, val read: Boolean, val created: String)

data class Doc(val id: String, val type: String, val fileName: String, val status: String, val created: String)

/**
 * What the customer picked on the car page; Checkout shows it and the server re-prices it.
 * [base] is the rental price after any offer; [total] is what the customer pays (VAT included), [vat] the VAT inside it.
 */
data class Quote(
    val carId: String, val period: Period, val qty: Int, val pickup: String, val dropoff: String, val extras: List<String>,
    val discount: Int, val base: Double, val vat: Double, val total: Double,
) {
    fun cost(extra: String) = Pricing.extraCost(extra, base, period, qty)

    companion object {
        fun of(car: Car, period: Period, qty: Int, pickup: String, extras: List<String>, off: Int = 0): Quote {
            val base = (car.price(period) * qty * (1 - off / 100.0)).roundHalfUp()
            val price = Pricing.priceWithVat(base, extras, period, qty)
            return Quote(car.id, period, qty, pickup, Fmt.addDays(pickup, period.days * qty), extras, off, base, price.vat, price.total)
        }
    }
}
