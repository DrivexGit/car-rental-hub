import Foundation

/// Days until the return (ongoing), days late (overdue) or days until pickup (upcoming); nothing for other statuses.
/// Same wording and UAE-day counting as the site (src/lib/bookingTime.ts).
func timeLabel(_ b: Booking) -> (text: String, late: Bool)? {
    switch b.status {
    case .ongoing, .overdue:
        let left = Fmt.daysUntil(b.dropoff)
        if left < 0 || b.status == .overdue {
            let n = max(1, -left)
            return (n == 1 ? t("{n} day overdue", ["n": n]) : t("{n} days overdue", ["n": n]), true)
        }
        return (left == 0 ? t("Due today") : left == 1 ? t("{n} day left", ["n": left]) : t("{n} days left", ["n": left]), false)
    case .upcoming:
        let n = Fmt.daysUntil(b.pickup)
        return (n <= 0 ? t("Starts today") : n == 1 ? t("Starts tomorrow") : t("Starts in {n} days", ["n": n]), false)
    default:
        return nil
    }
}

/// "3 days" / "1 week" / "2 months", translated.
func periodCount(_ period: Period, _ n: Int) -> String {
    switch period {
    case .daily: n == 1 ? t("{n} day", ["n": n]) : t("{n} days", ["n": n])
    case .weekly: n == 1 ? t("{n} week", ["n": n]) : t("{n} weeks", ["n": n])
    case .monthly: n == 1 ? t("{n} month", ["n": n]) : t("{n} months", ["n": n])
    }
}
