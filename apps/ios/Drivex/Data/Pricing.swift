import Foundation

// Extras and their prices: a copy of apps/customer/src/data/pricing.ts, the file the server (api/book.ts) uses to price
// the booking. The server decides the real price; this is the quote the app shows before paying. Keep them identical
// (DrivexTests/PricingTests checks the same cases as the site).

enum Period: String, CaseIterable, Identifiable, Codable, Hashable {
    case daily, weekly, monthly
    var id: String { rawValue }
    var days: Int {
        switch self {
        case .daily: 1
        case .weekly: 7
        case .monthly: 30
        }
    }
    /// "day" / "week" / "month" (English key, translate where shown).
    var unit: String {
        switch self {
        case .daily: "day"
        case .weekly: "week"
        case .monthly: "month"
        }
    }
    var label: String {
        switch self {
        case .daily: "Daily"
        case .weekly: "Weekly"
        case .monthly: "Monthly"
        }
    }
}

enum Pricing {
    /// Full coverage insurance costs this percentage of the rental price (after any offer).
    static let fullCoverPct = 15.0
    /// Additional driver: per day, but a flat fee per month on a monthly rental.
    static let driverDaily = 25.0
    static let driverMonthly = 300.0
    static let childSeatDaily = 15.0
    /// Security deposit: 1,000 is blocked on the card at pickup, or the customer pays this fee once and nothing is blocked.
    static let depositAmount = 1000.0
    static let noDepositFee = 200.0

    static let extraLabels: [String: String] = [
        "full_cover": "Full coverage insurance",
        "extra_driver": "Additional driver",
        "child_seat": "Child seat",
        "no_deposit": "No deposit",
    ]
    /// Ids a customer can pick as ordinary extras (no_deposit is chosen separately, as the deposit option).
    static let pickableExtras = ["full_cover", "extra_driver", "child_seat"]

    /// What one extra costs for this rental. `base` is the rental price after any offer. Unknown ids cost nothing.
    static func extraCost(_ id: String, base: Double, period: Period, qty: Int) -> Double {
        let days = Double(period.days * qty)
        switch id {
        case "full_cover": return (base * fullCoverPct / 100).rounded()
        case "extra_driver": return period == .monthly ? driverMonthly * Double(qty) : driverDaily * days
        case "child_seat": return childSeatDaily * days
        case "no_deposit": return noDepositFee
        default: return 0
        }
    }

    /// VAT rate of each extra on the invoice: insurance carries no VAT; the rest carry 5%.
    static let extraVat: [String: Double] = ["full_cover": 0, "extra_driver": 0.05, "child_seat": 0.05, "no_deposit": 0.05]
    /// The standard VAT rate. Prices already include it: the VAT is worked out from the total.
    static let rentalVat = 0.05

    private static func round2(_ n: Double) -> Double { (n * 100).rounded() / 100 }
    /// VAT inside a VAT-inclusive amount, rounded to the fil.
    static func vatIn(_ gross: Double, _ rate: Double) -> Double {
        rate > 0 ? round2(gross - round2(gross / (1 + rate))) : 0
    }

    /// The charge for a rental: the rental and its extras, each at its own VAT rate.
    static func priceWithVat(base: Double, extras: [String], period: Period, qty: Int) -> (net: Double, vat: Double, total: Double) {
        var rows: [(gross: Double, rate: Double)] = [(base, rentalVat)]
        for id in extras {
            if let rate = extraVat[id] { rows.append((extraCost(id, base: base, period: period, qty: qty), rate)) }
        }
        let total = round2(rows.reduce(0) { $0 + $1.gross })
        let vat = round2(rows.reduce(0) { $0 + vatIn($1.gross, $1.rate) })
        return (round2(total - vat), vat, total)
    }
}

/// Documents a customer must have before booking (apps/customer/src/data/documents.ts; api/book.ts enforces it).
/// `id` is what the app uploads; `accept` lists every type that counts (staff can upload a passport in the panel).
enum RequiredDocuments {
    struct Item: Identifiable { let id: String; let label: String; let accept: [String] }
    static let all = [
        Item(id: "id_card", label: "Emirates ID or passport", accept: ["id_card", "passport"]),
        Item(id: "driving_license", label: "Driving licence", accept: ["driving_license"]),
    ]
    /// Required documents that are missing, or were rejected and need uploading again. Waiting for review is fine.
    static func missing(_ docs: [Doc]) -> [Item] {
        all.filter { r in !docs.contains { r.accept.contains($0.type) && $0.status != "rejected" } }
    }
}
