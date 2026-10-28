package com.drivex.app

import com.drivex.app.core.Fmt
import com.drivex.app.core.J
import com.drivex.app.data.Car
import com.drivex.app.data.Catalog
import com.drivex.app.data.Doc
import com.drivex.app.data.Invoice
import com.drivex.app.data.InvoiceDocument
import com.drivex.app.data.InvoiceLine
import com.drivex.app.data.InvoicePayment
import com.drivex.app.data.Period
import com.drivex.app.data.Pricing
import com.drivex.app.data.Quote
import com.drivex.app.data.RequiredDocuments
import com.drivex.app.data.noteLink
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** The rules the app shares with the site and the server: prices, dates, links, the invoice maths.
 *  The expected values are the ones the site's code gives for the same input. */
class RulesTest {
    private val car = Car("toyota-yaris", "Toyota", "Yaris", 2024, "Economy", 120.0, 700.0, 2400.0, "/cars/toyota-yaris.webp", 5, listOf("v1"))

    @Test fun extras() {
        assertEquals(54.0, Pricing.extraCost("full_cover", 360.0, Period.daily, 3), 0.0)
        assertEquals(75.0, Pricing.extraCost("extra_driver", 360.0, Period.daily, 3), 0.0)
        assertEquals(600.0, Pricing.extraCost("extra_driver", 2400.0, Period.monthly, 2), 0.0)
        assertEquals(105.0, Pricing.extraCost("child_seat", 700.0, Period.weekly, 1), 0.0)
        assertEquals(200.0, Pricing.extraCost("no_deposit", 700.0, Period.weekly, 1), 0.0)
        assertEquals(0.0, Pricing.extraCost("unknown", 700.0, Period.weekly, 1), 0.0)
    }

    @Test fun quoteWithOfferAndVat() {
        val q = Quote.of(car, Period.daily, 3, "2026-11-01", listOf("full_cover", "no_deposit"), off = 10)
        assertEquals(324.0, q.base, 0.0)              // 120 x 3 less 10%
        assertEquals(573.0, q.total, 0.0)             // + insurance 15% of 324 = 48.6 -> 49, + 200 no-deposit fee
        assertEquals(15.43 + 9.52, q.vat, 0.001)      // 5% inside the rental and the fee; none on insurance
        assertEquals("2026-11-04", q.dropoff)
    }

    @Test fun missingDocuments() {
        fun doc(type: String, status: String) = Doc(type, type, "", status, "")
        assertEquals(listOf("id_card", "driving_license"), RequiredDocuments.missing(emptyList()).map { it.id })
        assertEquals(listOf("driving_license"), RequiredDocuments.missing(listOf(doc("passport", "pending"))).map { it.id })
        assertEquals(listOf("id_card"), RequiredDocuments.missing(listOf(doc("id_card", "rejected"), doc("driving_license", "approved"))).map { it.id })
    }

    @Test fun uaeDays() {
        assertEquals("2027-01-02", Fmt.addDays("2026-12-30", 3))
        assertEquals(7, Fmt.daysBetween("2026-11-01", "2026-11-08"))
        assertEquals(1, Fmt.daysBetween("2026-11-01", "2026-11-01"))
        assertEquals(0, Fmt.daysUntil(Fmt.todayInUAE()))
        assertEquals(1, Fmt.daysUntil(Fmt.addDays(Fmt.todayInUAE(), 1)))
        // Postgres sends microseconds; a plain date is noon in Dubai
        assertEquals(1_793_096_493L, Fmt.instant("2026-10-27T10:21:33.123456+00:00").epochSecond)
        assertEquals(Fmt.instant("2026-10-16T08:00:00+00:00"), Fmt.instant("2026-10-16"))
    }

    @Test fun phone() {
        assertEquals("(+971) 50 123 4567", Fmt.phone("+971501234567"))
        assertEquals("+44 20 7946", Fmt.phone("+44 20 7946"))
        assertEquals("050123", Fmt.asciiDigits("۰۵۰١٢٣"))
    }

    @Test fun fleetGroupsPlatesIntoModels() {
        val rows = J.parse("""
            [{"id":"a","make":"Nissan","model":"Patrol","year":2024,"categories":["SUV"],"daily_price":"450","weekly_price":null,"monthly_price":9000},
             {"id":"b","make":"Nissan","model":"Patrol","year":2024,"categories":["SUV"],"daily_price":450,"weekly_price":null,"monthly_price":9000},
             {"id":"c","make":"Kia","model":"Picanto","year":2023,"categories":null,"daily_price":null}]
        """).array
        val fleet = Catalog.fleet(rows)
        assertEquals(1, fleet.size)
        assertEquals(listOf("a", "b"), fleet[0].vehicleIds)
        assertEquals(3150.0, fleet[0].weekly, 0.0)
        assertEquals(7, fleet[0].seats)
        assertEquals("mercedes-benz-gle-53", Catalog.slug("Mercedes-Benz", "GLE 53"))
        assertEquals("Mercedes GLE 53", car.copy(make = "Mercedes-Benz", model = "GLE 53").name)
    }

    @Test fun notificationLinks() {
        assertEquals("/bookings/r1#fines", noteLink("fine", "/bookings/r1"))
        assertEquals("/bookings/r1#invoice", noteLink("invoice", "/bookings/r1"))
        assertEquals("/profile/payments", noteLink("invoice", "/profile/payments"))
        assertEquals("/", noteLink("x", null))
    }

    @Test fun invoiceSplitsVatPerRate() {
        val inv = Invoice("i", "INV-1", null, 1150.0, "2026-10-01", "pending", null, null, null,
            listOf(InvoiceLine("Rental", 1050.0, 50.0, 0.05), InvoiceLine("Insurance", 100.0, 0.0, 0.0)),
            listOf(InvoicePayment("2026-10-02", "Card (Stripe)", "rental", 500.0)), null)
        val rows = InvoiceDocument.rows(inv, null)
        assertEquals(1000.0, rows[0].net, 0.0)
        assertEquals(50.0, rows[0].vat, 0.0)
        assertEquals(1100.0, rows[0].before, 0.0)
        assertEquals(0.0, rows[1].vat, 0.0)
        val html = InvoiceDocument.html(inv, null, InvoiceDocument.BillTo("سارا <b>", "+971501234567", null, 7, null),
            InvoiceDocument.Company("Drivex Car Rental LLC", "Dubai", null, null, null, null, null, null, null), null)
        assertTrue(html.contains("PART PAID"))
        assertTrue(html.contains("AED 650.00"))        // remaining
        assertTrue(html.contains("سارا &lt;b&gt;"))   // escaped
        assertTrue(html.contains("+971 50 123 4567"))
    }
}
