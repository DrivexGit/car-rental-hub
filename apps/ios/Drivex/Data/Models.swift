import Foundation

// The customer's data, shaped as on the site (apps/customer/src/lib/store.tsx).

/// A bookable model: the vehicles table has one row per plate; rows of the same make and model are grouped.
struct Car: Identifiable, Hashable {
    let id: String
    let make: String
    let model: String
    let year: Int
    let category: String
    let daily: Double
    let weekly: Double
    let monthly: Double
    var image: String
    var seats: Int
    var vehicleIds: [String]

    var name: String { "\(make.replacingOccurrences(of: "Mercedes-Benz", with: "Mercedes")) \(model)" }
    func price(_ p: Period) -> Double {
        switch p {
        case .daily: daily
        case .weekly: weekly
        case .monthly: monthly
        }
    }
}

struct User: Equatable {
    struct Notify: Equatable { var bookings: Bool; var invoices: Bool; var offers: Bool }
    let id: String
    let phone: String
    let name: String
    let email: String?
    let customerNo: Int?
    let nationality: String?
    let avatarURL: String?
    let notify: Notify

    var firstName: String { name.split(separator: " ").first.map(String.init) ?? name }
    var initials: String {
        let s = name.split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined().uppercased()
        return s.isEmpty ? "?" : s
    }
}

enum BookingStatus: String {
    case pending, upcoming, ongoing, overdue, completed, cancelled
}

struct Booking: Identifiable, Hashable {
    let id: String
    let car: Car
    let plate: String
    let period: Period
    let pickup: String
    let dropoff: String
    let total: Double
    let extras: [String]
    let status: BookingStatus
    let rawStatus: String
}

struct InvoiceLine: Hashable { let description: String; let amount: Double; let discount: Double; let vatRate: Double }
struct InvoicePayment: Hashable { let date: String; let method: String; let category: String?; let amount: Double }

struct Invoice: Identifiable, Hashable {
    enum Status: String { case pending, paid, void }
    let id: String
    let number: String
    let bookingId: String?
    let amount: Double
    let issued: String
    let status: Status
    let paidAt: String?
    let description: String?
    let dueDate: String?
    let lines: [InvoiceLine]
    let payments: [InvoicePayment]
    /// Set when staff uploaded the invoice as a PDF: that file is shown, not a rebuilt one.
    let filePath: String?
}

/// Seller details printed on invoices (TRN, legal address, bank). Set in the panel's tenant settings.
struct Seller: Equatable {
    let trn: String?
    let legalAddress: String?
    let bankAccountName: String?
    let bankName: String?
    let iban: String?
    let bic: String?
}

struct Fine: Identifiable, Hashable {
    let id: String
    let bookingId: String?
    let type: String
    let title: String?
    let amount: Double
    let date: String
    let place: String
}

struct Offer: Identifiable, Hashable {
    enum Kind: String { case car, partner }
    let id: String
    let kind: Kind
    let title: String
    let subtitle: String?
    let off: Int
    let image: String?
    let car: Car?
    let description: String?
    let terms: String?
    let location: String?
}

struct Specs: Hashable {
    let engine: String?
    let transmission: String
    let fuel: String
    let seats: Int
    let doors: Int
    let bags: Int
    let features: [String]
    let image: String?
    let gallery: [String]
}

struct Note: Identifiable, Hashable {
    let id: String
    let type: String
    let title: String
    let body: String?
    let link: String?
    var read: Bool
    let created: String
}

struct Doc: Identifiable, Hashable {
    let id: String
    let type: String
    let fileName: String
    let status: String
    let created: String
}

/// What the customer picked on the car page; Checkout shows it and the server re-prices it.
/// `base` is the rental price after any offer; `total` is what the customer pays (VAT included), `vat` the VAT inside it.
struct Quote: Hashable {
    let carId: String
    let period: Period
    let qty: Int
    let pickup: String
    let dropoff: String
    let extras: [String]
    let discount: Int
    let base: Double
    let vat: Double
    let total: Double

    init(car: Car, period: Period, qty: Int, pickup: String, extras: [String], off: Int = 0) {
        carId = car.id
        self.period = period
        self.qty = qty
        self.pickup = pickup
        self.extras = extras
        discount = off
        base = (car.price(period) * Double(qty) * (1 - Double(off) / 100)).rounded()
        let p = Pricing.priceWithVat(base: base, extras: extras, period: period, qty: qty)
        vat = p.vat
        total = p.total
        dropoff = Fmt.addDays(pickup, period.days * qty)
    }

    func cost(of extra: String) -> Double { Pricing.extraCost(extra, base: base, period: period, qty: qty) }
}
