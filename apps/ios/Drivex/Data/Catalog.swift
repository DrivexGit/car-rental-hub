import Foundation

// Fleet helpers and marketing content, as on the site (apps/customer/src/data/catalog.ts).
enum Catalog {
    static func slug(_ make: String, _ model: String) -> String {
        "\(make)-\(model)".lowercased()
            .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    }
    /// The studio picture the site ships for each model (/cars/<slug>.webp).
    static func carImage(_ make: String, _ model: String) -> String { "/cars/\(slug(make, model)).webp" }

    private static let sevenSeats = try! NSRegularExpression(pattern: "Patrol|Fortuner|Santa|Captiva|M8|Tahoe|Land Cruiser")
    private static func hasSevenSeats(_ model: String) -> Bool {
        sevenSeats.firstMatch(in: model, range: NSRange(model.startIndex..., in: model)) != nil
    }

    /// Groups the vehicles table (one row per plate) into bookable models. Rows without a daily price are not for rent.
    static func fleet(_ rows: [JSON]) -> [Car] {
        var order: [String] = []
        var by: [String: Car] = [:]
        for v in rows {
            guard let daily = v["daily_price"].double, daily > 0, let vid = v["id"].string else { continue }
            let make = v["make"].string ?? "", model = v["model"].string ?? ""
            let id = slug(make, model)
            if by[id] != nil { by[id]!.vehicleIds.append(vid); continue }
            order.append(id)
            by[id] = Car(
                id: id, make: make, model: model, year: v["year"].int ?? 0,
                category: v["categories"].array.first?.string ?? "Car",
                daily: daily, weekly: v["weekly_price"].double ?? daily * 7, monthly: v["monthly_price"].double ?? daily * 30,
                image: carImage(make, model), seats: hasSevenSeats(model) ? 7 : 5, vehicleIds: [vid])
        }
        return order.compactMap { by[$0] }
    }

    /// Home carousel (content, not data). `to` is where the button goes.
    struct Banner: Identifiable {
        enum Target { case book(Period?) }
        let kicker: String, title: String, text: String, cta: String, image: String, to: Target
        var id: String { title }
    }
    static let banners = [
        Banner(kicker: "Exclusive renter benefits", title: "A little more luxury.", text: "Enjoy 30% off at Al Noor Restaurant.", cta: "Explore benefit", image: "BannerLuxury", to: .book(nil)),
        Banner(kicker: "Monthly plans", title: "Drive more, pay less.", text: "Save up to 40% with a monthly rental.", cta: "See monthly cars", image: "BannerMonthly", to: .book(.monthly)),
    ]
}
