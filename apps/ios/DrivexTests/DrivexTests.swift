import XCTest
@testable import Drivex

/// The rules the app shares with the site and the server: prices, dates, links, the invoice maths.
/// The expected values are the ones the site's code gives for the same input.
final class PricingTests: XCTestCase {
    private let car = Car(id: "toyota-yaris", make: "Toyota", model: "Yaris", year: 2024, category: "Economy",
                          daily: 120, weekly: 700, monthly: 2400, image: "/cars/toyota-yaris.webp", seats: 5, vehicleIds: ["v1"])

    func testExtras() {
        XCTAssertEqual(Pricing.extraCost("full_cover", base: 360, period: .daily, qty: 3), 54)
        XCTAssertEqual(Pricing.extraCost("extra_driver", base: 360, period: .daily, qty: 3), 75)
        XCTAssertEqual(Pricing.extraCost("extra_driver", base: 2400, period: .monthly, qty: 2), 600)
        XCTAssertEqual(Pricing.extraCost("child_seat", base: 700, period: .weekly, qty: 1), 105)
        XCTAssertEqual(Pricing.extraCost("no_deposit", base: 700, period: .weekly, qty: 1), 200)
        XCTAssertEqual(Pricing.extraCost("unknown", base: 700, period: .weekly, qty: 1), 0)
    }

    func testQuoteWithOfferAndVat() {
        let q = Quote(car: car, period: .daily, qty: 3, pickup: "2026-11-01", extras: ["full_cover", "no_deposit"], off: 10)
        XCTAssertEqual(q.base, 324)                 // 120 x 3 less 10%
        XCTAssertEqual(q.total, 324 + 49 + 200)     // insurance 15% of 324 = 48.6 -> 49
        XCTAssertEqual(q.vat, 15.43 + 9.52, accuracy: 0.001) // 5% inside the rental and the no-deposit fee; none on insurance
        XCTAssertEqual(q.dropoff, "2026-11-04")
    }

    func testMissingDocuments() {
        let doc = { (type: String, status: String) in Doc(id: type, type: type, fileName: "", status: status, created: "") }
        XCTAssertEqual(RequiredDocuments.missing([]).map(\.id), ["id_card", "driving_license"])
        XCTAssertEqual(RequiredDocuments.missing([doc("passport", "pending")]).map(\.id), ["driving_license"])
        XCTAssertEqual(RequiredDocuments.missing([doc("id_card", "rejected"), doc("driving_license", "approved")]).map(\.id), ["id_card"])
    }
}

final class FormatTests: XCTestCase {
    func testPhone() {
        XCTAssertEqual(Fmt.phone("+971501234567"), "(+971) 50 123 4567")
        XCTAssertEqual(Fmt.phone("+44 20 7946"), "+44 20 7946")
        XCTAssertEqual(Fmt.asciiDigits("۰۵۰١٢٣"), "050123")
    }

    func testUAEDays() {
        XCTAssertEqual(Fmt.addDays("2026-12-30", 3), "2027-01-02")
        XCTAssertEqual(Fmt.daysBetween("2026-11-01", "2026-11-08"), 7)
        XCTAssertEqual(Fmt.daysBetween("2026-11-01", "2026-11-01"), 1)
        XCTAssertEqual(Fmt.daysUntil(Fmt.todayInUAE()), 0)
        XCTAssertEqual(Fmt.daysUntil(Fmt.addDays(Fmt.todayInUAE(), 1)), 1)
    }

    func testTimestamps() {
        // Postgres sends microseconds; a plain date is noon in Dubai
        XCTAssertEqual(Fmt.date("2026-10-27T10:21:33.123456+00:00").timeIntervalSince1970, 1_793_096_493, accuracy: 1)
        XCTAssertEqual(Fmt.date("2026-10-16").timeIntervalSince1970, Fmt.date("2026-10-16T08:00:00+00:00").timeIntervalSince1970)
    }
}

final class CatalogTests: XCTestCase {
    func testSlugAndFleet() throws {
        XCTAssertEqual(Catalog.slug("Mercedes-Benz", "GLE 53"), "mercedes-benz-gle-53")
        let rows = try JSONDecoder().decode([JSON].self, from: Data("""
        [{"id":"a","make":"Nissan","model":"Patrol","year":2024,"categories":["SUV"],"daily_price":"450","weekly_price":null,"monthly_price":9000},
         {"id":"b","make":"Nissan","model":"Patrol","year":2024,"categories":["SUV"],"daily_price":450,"weekly_price":null,"monthly_price":9000},
         {"id":"c","make":"Kia","model":"Picanto","year":2023,"categories":null,"daily_price":null}]
        """.utf8))
        let fleet = Catalog.fleet(rows)
        XCTAssertEqual(fleet.count, 1)
        XCTAssertEqual(fleet[0].vehicleIds, ["a", "b"])
        XCTAssertEqual(fleet[0].weekly, 3150)
        XCTAssertEqual(fleet[0].seats, 7)
        XCTAssertEqual(fleet[0].name, "Nissan Patrol")
    }
}

final class LinkTests: XCTestCase {
    func testNoteLink() {
        XCTAssertEqual(noteLink(type: "fine", link: "/bookings/r1"), "/bookings/r1#fines")
        XCTAssertEqual(noteLink(type: "invoice", link: "/bookings/r1"), "/bookings/r1#invoice")
        XCTAssertEqual(noteLink(type: "invoice", link: "/profile/payments"), "/profile/payments")
        XCTAssertEqual(noteLink(type: "x", link: nil), "/")
    }

    func testRouterOpensLinks() {
        let r = Router()
        r.open(link: "/bookings/r1#invoice")
        XCTAssertEqual(r.tab, .bookings)
        XCTAssertEqual(r.paths[.bookings], [.booking("r1", section: "invoice")])
        r.open(link: "/profile/payments")
        XCTAssertEqual(r.tab, .profile)
        XCTAssertEqual(r.paths[.profile], [.payments])
    }
}

final class InvoiceTests: XCTestCase {
    func testRowsSplitVatPerRate() {
        let inv = Invoice(id: "i", number: "INV-1", bookingId: nil, amount: 1150, issued: "2026-10-01", status: .pending, paidAt: nil,
                          description: nil, dueDate: nil,
                          lines: [InvoiceLine(description: "Rental", amount: 1050, discount: 50, vatRate: 0.05),
                                  InvoiceLine(description: "Insurance", amount: 100, discount: 0, vatRate: 0)],
                          payments: [InvoicePayment(date: "2026-10-02", method: "Card (Stripe)", category: "rental", amount: 500)], filePath: nil)
        let rows = InvoiceDocument.rows(inv, detail: nil)
        XCTAssertEqual(rows[0].net, 1000)
        XCTAssertEqual(rows[0].vat, 50)
        XCTAssertEqual(rows[0].before, 1100)
        XCTAssertEqual(rows[1].vat, 0)
        let html = InvoiceDocument.html(invoice: inv, detail: nil, to: .init(name: "سارا <b>", phone: "+971501234567", email: nil, no: 7, nationality: nil),
                                        company: .init(name: "Drivex Car Rental LLC", address: "Dubai", trn: nil, phone: nil, email: nil, accountName: nil, bankName: nil, iban: nil, bic: nil),
                                        logoDataURL: nil)
        XCTAssertTrue(html.contains("PART PAID"))
        XCTAssertTrue(html.contains("AED 650.00"))           // remaining
        XCTAssertTrue(html.contains("سارا &lt;b&gt;"))      // escaped
        XCTAssertTrue(html.contains("+971 50 123 4567"))
    }
}
