import Foundation

/// Values from Config/App.xcconfig (through Info.plist) and the fixed DriveX contact details (apps/customer/src/config.ts).
enum AppConfig {
    private static func info(_ key: String) -> String {
        ((Bundle.main.object(forInfoDictionaryKey: key) as? String) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// The Drivex site: its /api functions, the bundled car pictures and the page Stripe returns to.
    static let siteURL = URL(string: info("DrivexSiteURL")).flatMap { $0.host == nil ? nil : $0 } ?? URL(string: "https://drivex-customer.vercel.app")!
    static let supabaseURL = URL(string: info("SupabaseURL")).flatMap { $0.host == nil ? nil : $0 }
    static let supabaseKey = info("SupabaseAnonKey")
    /// False when Config/Secrets.xcconfig was not filled in: the app shows how to fix it instead of failing.
    static var isConfigured: Bool { supabaseURL != nil && !supabaseKey.isEmpty }

    static let supportPhone = "+971561215152"
    static let whatsappNumber = "971561215152"
    static func whatsappLink(_ text: String = "") -> URL {
        var c = URLComponents(string: "https://wa.me/\(whatsappNumber)")!
        if !text.isEmpty { c.queryItems = [URLQueryItem(name: "text", value: text)] }
        return c.url!
    }

    /// Seller details printed on invoices; the tenant settings (TRN, address, bank) override them.
    enum Company {
        static let name = "Drivex Car Rental LLC"
        static let address = "Dubai, United Arab Emirates"
        static let email = "info@drivex.ae"
    }

    static var version: String { (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "1.0.0" }

    /// A site path ("/cars/x.webp") as a full URL; full URLs pass through.
    static func url(_ pathOrURL: String) -> URL? {
        if pathOrURL.hasPrefix("http://") || pathOrURL.hasPrefix("https://") { return URL(string: pathOrURL) }
        return URL(string: pathOrURL, relativeTo: siteURL)?.absoluteURL
    }
}
