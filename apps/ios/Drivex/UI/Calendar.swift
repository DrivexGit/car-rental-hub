import SwiftUI

/// Month grids from this month for a year, weeks starting on Monday, days before today (UAE date) disabled.
/// Days are "yyyy-MM-dd" strings, so they compare in order. Same rules as the site's react-day-picker setup.
private struct MonthGrid: View {
    let month: Date
    let isSelected: (String) -> Bool
    let inRange: (String) -> Bool
    let onPick: (String) -> Void

    private var cal: Calendar { Fmt.uaeCalendar }
    private var today: String { Fmt.todayInUAE() }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.dx(17, .bold)).foregroundStyle(Color.ink).padding(.horizontal, 4)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7), spacing: 2) {
                ForEach(Array(weekdays.enumerated()), id: \.offset) { _, w in
                    Text(w).font(.dx(12, .medium)).foregroundStyle(Color.inkFaint).frame(height: 28)
                }
                ForEach(Array(cells.enumerated()), id: \.offset) { _, day in
                    if let day { cell(day) } else { Color.clear.frame(height: 44) }
                }
            }
        }
    }

    private func cell(_ day: String) -> some View {
        let disabled = day < today
        let selected = isSelected(day)
        let middle = !selected && inRange(day)
        return Button { Haptics.tap(); onPick(day) } label: {
            Text(String(Int(day.suffix(2)) ?? 0))
                .font(.dx(15, selected ? .bold : .regular))
                .foregroundStyle(disabled ? Color.inkFaint.opacity(0.6) : selected ? .white : day == today ? Color.brand : Color.ink)
                .frame(maxWidth: .infinity)
                .frame(height: 42)
                .background(RoundedRectangle(cornerRadius: 12).fill(selected ? Color.brand : middle ? Color.brandSoft : .clear))
        }
        .buttonStyle(PressScale(scale: 0.9))
        .disabled(disabled)
        .frame(height: 44)
    }

    private var title: String {
        let f = DateFormatter()
        f.calendar = cal
        f.locale = I18n.shared.lang.locale
        f.timeZone = Fmt.dubai
        f.setLocalizedDateFormatFromTemplate("MMMMyyyy")
        return f.string(from: month)
    }

    /// Monday first.
    private var weekdays: [String] {
        let f = DateFormatter()
        f.calendar = cal
        f.locale = I18n.shared.lang.locale
        let s = f.veryShortStandaloneWeekdaySymbols ?? ["S", "M", "T", "W", "T", "F", "S"]
        return Array(s[1...]) + [s[0]]
    }

    /// The month's days, with empty cells before the first so it falls under its weekday.
    private var cells: [String?] {
        guard let range = cal.range(of: .day, in: .month, for: month) else { return [] }
        let first = cal.component(.weekday, from: month) // 1 = Sunday
        let lead = (first + 5) % 7
        let days: [String?] = range.map { d in Fmt.dayString(cal.date(byAdding: .day, value: d - 1, to: month)!) }
        return Array(repeating: nil, count: lead) + days
    }
}

private func months() -> [Date] {
    let cal = Fmt.uaeCalendar
    let start = cal.date(from: cal.dateComponents([.year, .month], from: Fmt.date(Fmt.todayInUAE())))!
    return (0..<13).compactMap { cal.date(byAdding: .month, value: $0, to: start) }
}

/// Pickup -> return, for the Book filter.
struct DateRangeSheet: View {
    let from: String
    let to: String
    let onApply: (String, String) -> Void
    let onClear: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var start: String?
    @State private var end: String?

    var body: some View {
        SheetFrame(title: t("Rental dates"), large: true) {
            HStack(spacing: 8) {
                pill(t("Pickup"), start.map(Fmt.shortDay) ?? t("Select"), active: start == nil)
                pill(t("Return"), end.map(Fmt.shortDay) ?? t("Select"), active: start != nil && end == nil)
            }
            .padding(.bottom, 12)
            ScrollView {
                LazyVStack(spacing: 20) {
                    ForEach(months(), id: \.self) { m in
                        MonthGrid(month: m, isSelected: { $0 == start || $0 == end }, inRange: { d in
                            guard let s = start, let e = end else { return false }
                            return d > s && d < e
                        }, onPick: pick)
                    }
                }
            }
            .scrollIndicators(.hidden)
            HStack(spacing: 8) {
                DXButton(t("Clear"), variant: .ghost) { start = nil; end = nil; onClear(); dismiss() }
                    .frame(maxWidth: .infinity)
                DXButton(applyLabel, size: .md, disabled: start == nil || end == nil) {
                    if let s = start, let e = end { onApply(s, e); dismiss() }
                }
                .frame(maxWidth: .infinity)
                .layoutPriority(2)
            }
            .padding(.top, 16)
        }
        .onAppear {
            start = from.isEmpty ? nil : from
            end = to.isEmpty ? nil : to
        }
    }

    private var applyLabel: String {
        guard let s = start, let e = end else { return t("Apply") }
        let n = Fmt.daysBetween(s, e)
        return n > 1 ? t("Apply · {n} days", ["n": n]) : t("Apply · {n} day", ["n": n])
    }

    /// Like a range calendar: the first tap is the pickup, a later day is the return, an earlier day starts again.
    private func pick(_ d: String) {
        if let s = start, end == nil, d > s { end = d } else { start = d; end = nil }
    }

    private func pill(_ label: String, _ value: String, active: Bool) -> some View {
        VStack(spacing: 2) {
            Text(label).font(.dx(12)).foregroundStyle(Color.inkMuted)
            Text(value).font(.dx(15, .semibold)).foregroundStyle(Color.ink)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(RoundedRectangle(cornerRadius: 12).fill(active ? Color.brandSoft : .white))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(active ? Color.brand : Color.line))
    }
}

/// One day, for the pickup date.
struct DateSheet: View {
    let value: String
    var title: String? = nil
    let onPick: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        SheetFrame(title: title ?? t("Pickup date"), large: true) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 20) {
                        ForEach(months(), id: \.self) { m in
                            MonthGrid(month: m, isSelected: { $0 == value }, inRange: { _ in false }) { d in onPick(d); dismiss() }
                                .id(Fmt.dayString(m).prefix(7))
                        }
                    }
                }
                .scrollIndicators(.hidden)
                .onAppear { proxy.scrollTo(value.prefix(7), anchor: .top) }
            }
        }
    }
}
