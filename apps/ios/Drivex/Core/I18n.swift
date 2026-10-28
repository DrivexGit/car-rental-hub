import SwiftUI
import Observation

/// The app's three languages. Arabic and Persian are written right to left.
enum Lang: String, CaseIterable, Identifiable {
    case en, ar, fa
    var id: String { rawValue }
    var label: String {
        switch self {
        case .en: "English"
        case .ar: "العربية"
        case .fa: "فارسی"
        }
    }
    var isRTL: Bool { self != .en }
    /// Locale for dates and numbers. Arabic and Persian keep Latin digits, which is what UAE apps use (same as the site).
    var locale: Locale {
        switch self {
        case .en: Locale(identifier: "en_GB")
        case .ar: Locale(identifier: "ar_AE@numbers=latn")
        case .fa: Locale(identifier: "fa_IR@numbers=latn")
        }
    }
}

/// Strings are keyed by their English text, exactly like the site: t("Pay now"). A missing translation falls back to the key.
/// The Arabic and Persian dictionaries are the site's own (scripts/sync-content.mjs); ios-strings.json adds the few
/// texts only the iPhone app has. The language is the app's own choice, not the phone's, as on the site.
@Observable
final class I18n {
    static let shared = I18n()
    private static let key = "drivex.lang"

    private(set) var lang: Lang
    @ObservationIgnored private var dicts: [Lang: [String: String]] = [:]

    private init() {
        lang = Lang(rawValue: UserDefaults.standard.string(forKey: Self.key) ?? "") ?? .en
        let extra = Self.json([String: [String: String]].self, "ios-strings") ?? [:]
        for l in [Lang.ar, .fa] {
            var d = Self.json([String: String].self, "strings-\(l.rawValue)") ?? [:]
            d.merge(extra[l.rawValue] ?? [:]) { site, _ in site }
            dicts[l] = d
        }
    }

    private static func json<T: Decodable>(_ type: T.Type, _ name: String) -> T? {
        guard let url = Bundle.main.url(forResource: name, withExtension: "json"), let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }

    func set(_ l: Lang) {
        lang = l
        UserDefaults.standard.set(l.rawValue, forKey: Self.key)
    }

    func translate(_ key: String, _ vars: [String: Any] = [:], lang: Lang? = nil) -> String {
        var text = dicts[lang ?? self.lang]?[key] ?? key
        for (k, v) in vars { text = text.replacingOccurrences(of: "{\(k)}", with: "\(v)") }
        return text
    }
}

/// Translates an English key: t("Pay now"), t("{n} days left", ["n": 3]). Reading it inside a view's body
/// makes the view follow language changes.
func t(_ key: String, _ vars: [String: Any] = [:]) -> String { I18n.shared.translate(key, vars) }
