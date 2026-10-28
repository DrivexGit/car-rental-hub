import Foundation

/// Dates, money and phone numbers, as on the site (src/lib/format.ts).
/// Rental dates are UAE dates: they are shown in Dubai time whatever the phone's time zone is.
enum Fmt {
    static let dubai = TimeZone(identifier: "Asia/Dubai")!

    /// Gregorian calendar in Dubai time, for day arithmetic ("yyyy-MM-dd" strings).
    static let uaeCalendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = dubai
        c.locale = Locale(identifier: "en_US_POSIX")
        return c
    }()

    private static let dayKey: DateFormatter = {
        let f = DateFormatter()
        f.calendar = uaeCalendar
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = dubai
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    // MARK: parsing

    /// "2026-10-16" (a plain date) means that day in the UAE (noon, so no time zone can shift it); a timestamp stays what it is.
    static func date(_ s: String) -> Date {
        if s.count == 10, let d = dayKey.date(from: s) { return d.addingTimeInterval(12 * 3600) }
        // Postgres sends microseconds ("…:33.123456+00:00"); drop the fraction, it never matters here.
        let plain = s.replacingOccurrences(of: #"\.\d+"#, with: "", options: .regularExpression)
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]
        if let d = iso.date(from: plain) { return d }
        iso.formatOptions = [.withFullDate, .withTime, .withColonSeparatorInTime, .withDashSeparatorInDate]
        return iso.date(from: plain) ?? Date()
    }

    // MARK: display

    private static func formatter(_ template: String) -> DateFormatter {
        let f = DateFormatter()
        f.locale = I18n.shared.lang.locale
        f.timeZone = dubai
        f.setLocalizedDateFormatFromTemplate(template)
        return f
    }

    /// "16 Oct 2026"
    static func day(_ s: String) -> String { formatter("ddMMMyyyy").string(from: date(s)) }
    static func day(_ d: Date) -> String { formatter("ddMMMyyyy").string(from: d) }
    /// "16 Oct"
    static func shortDay(_ s: String) -> String { formatter("dMMM").string(from: date(s)) }

    /// 1,250 in the app's language, no decimals.
    static func money(_ n: Double) -> String {
        let f = NumberFormatter()
        f.locale = I18n.shared.lang.locale
        f.numberStyle = .decimal
        f.maximumFractionDigits = 0
        return f.string(from: NSNumber(value: n)) ?? String(Int(n.rounded()))
    }

    // MARK: UAE calendar days

    /// Today's date in the UAE as "yyyy-MM-dd".
    static func todayInUAE() -> String { dayKey.string(from: Date()) }
    static func dayString(_ d: Date) -> String { dayKey.string(from: d) }
    static func addDays(_ day: String, _ n: Int) -> String {
        dayKey.string(from: uaeCalendar.date(byAdding: .day, value: n, to: date(day)) ?? date(day))
    }
    static func daysBetween(_ a: String, _ b: String) -> Int {
        max(1, Int((date(b).timeIntervalSince(date(a)) / 86400).rounded()))
    }
    private static func uaeDayNumber(_ d: Date) -> Int {
        let start = uaeCalendar.startOfDay(for: d)
        let c = uaeCalendar.dateComponents([.year, .month, .day], from: start)
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        let midnight = utc.date(from: DateComponents(year: c.year, month: c.month, day: c.day)) ?? start
        return Int((midnight.timeIntervalSince1970 / 86400).rounded())
    }
    /// Whole UAE calendar days from today to that moment: 0 = today, 1 = tomorrow, negative = past.
    static func daysUntil(_ s: String) -> Int { uaeDayNumber(date(s)) - uaeDayNumber(Date()) }

    /// An English key: translate it where it is shown. Uses the hour in the UAE.
    static func greeting() -> String {
        let h = uaeCalendar.component(.hour, from: Date())
        return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"
    }

    /// "+971501234567" -> "(+971) 50 123 4567" (UAE mobiles). Anything else is returned as it came.
    static func phone(_ p: String?) -> String {
        let s = (p ?? "").replacingOccurrences(of: " ", with: "")
        guard s.count == 13, s.hasPrefix("+971"), s.dropFirst(4).allSatisfy(\.isNumber) else { return p ?? "" }
        let d = Array(s.dropFirst(4))
        return "(+971) \(String(d[0..<2])) \(String(d[2..<5])) \(String(d[5..<9]))"
    }

    /// Persian and Arabic-Indic digits to ASCII, so a Farsi keyboard still works in number fields.
    static func asciiDigits(_ s: String) -> String {
        String(s.unicodeScalars.map { u -> Character in
            switch u.value {
            case 0x06F0...0x06F9: return Character(UnicodeScalar(u.value - 0x06F0 + 48)!)
            case 0x0660...0x0669: return Character(UnicodeScalar(u.value - 0x0660 + 48)!)
            default: return Character(u)
            }
        })
    }
}
