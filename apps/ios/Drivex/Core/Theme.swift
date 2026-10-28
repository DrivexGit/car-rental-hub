import SwiftUI
import Observation

/// The two colour themes of the site (src/index.css): green (default) and navy. Chosen in Profile > Appearance.
enum ThemeName: String, CaseIterable, Identifiable {
    case green, navy
    var id: String { rawValue }
    var label: String { self == .green ? "Green" : "Navy" }
}

@Observable
final class ThemeStore {
    static let shared = ThemeStore()
    private static let key = "drivex.theme"
    private(set) var name: ThemeName

    private init() { name = ThemeName(rawValue: UserDefaults.standard.string(forKey: Self.key) ?? "") ?? .green }

    func set(_ n: ThemeName) {
        name = n
        UserDefaults.standard.set(n.rawValue, forKey: Self.key)
    }
}

/// The site's colour tokens. Reading one inside a view's body makes that view follow theme changes.
extension Color {
    private static func rgb(_ r: Double, _ g: Double, _ b: Double) -> Color { Color(red: r / 255, green: g / 255, blue: b / 255) }
    private static var navy: Bool { ThemeStore.shared.name == .navy }

    static var brand: Color { navy ? rgb(18, 42, 84) : rgb(31, 77, 47) }
    static var brandDark: Color { navy ? rgb(11, 29, 61) : rgb(23, 58, 36) }
    static var brandSoft: Color { navy ? rgb(230, 236, 246) : rgb(232, 240, 234) }
    static var bg: Color { navy ? rgb(245, 246, 249) : rgb(246, 245, 242) }
    static var line: Color { navy ? rgb(230, 233, 240) : rgb(236, 235, 231) }
    static var tint: Color { navy ? rgb(236, 240, 246) : rgb(238, 240, 238) }
    static var muted: Color { navy ? rgb(232, 235, 242) : rgb(236, 235, 230) }
    static var hero: Color { navy ? rgb(8, 18, 40) : rgb(11, 26, 17) }
    static var night: Color { navy ? rgb(8, 14, 30) : rgb(11, 15, 20) }

    static let ink = rgb(20, 20, 20)
    static let inkMuted = rgb(107, 107, 107)
    static let inkFaint = rgb(163, 163, 163)
    static let danger = rgb(217, 48, 37)
    static let dangerSoft = rgb(253, 238, 238)
    static let warn = rgb(245, 158, 11)
    static let warnText = rgb(217, 119, 6)
    static let warnSoft = rgb(255, 251, 235)
    static let whatsapp = rgb(26, 158, 75)
    static let online = rgb(34, 197, 94)
}

/// Type scale. The site uses Inter (the system font is its native twin) and a heavy serif for page headings;
/// Arabic and Persian headings keep the plain font, as on the site (the serif has no Arabic letters).
extension Font {
    static func dx(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font { .system(size: size, weight: weight) }
    static func display(_ size: CGFloat) -> Font {
        I18n.shared.lang == .en ? .system(size: size, weight: .heavy, design: .serif) : .system(size: size, weight: .heavy)
    }
}
