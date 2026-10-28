import SwiftUI
import Observation

/// The five tabs of the site's bottom bar.
enum AppTab: String, CaseIterable, Identifiable {
    case home, book, support, bookings, profile
    var id: String { rawValue }
    var label: String {
        switch self {
        case .home: "Home"
        case .book: "Book"
        case .support: "Support"
        case .bookings: "Bookings"
        case .profile: "Profile"
        }
    }
    var icon: String {
        switch self {
        case .home: "house"
        case .book: "car.side"
        case .support: "headphones"
        case .bookings: "list.clipboard"
        case .profile: "person"
        }
    }
    var activeIcon: String { self == .support ? icon : "\(icon).fill" }
}

/// Pages that open on top of a tab (the site's routes).
enum Route: Hashable {
    case reserve(carId: String, period: Period, off: Int, from: String?, to: String?)
    case checkout(Quote)
    case confirmed(String)
    case booking(String, section: String?)
    case inbox
    case editProfile, payments, security, documents, notifications, language, legal, other
    case terms, privacy, deleteAccount
}

/// Where the customer is: the tab, the pages open on each tab, and the Book tab's filters that other pages set.
@Observable
final class Router {
    var tab: AppTab = .home
    var paths: [AppTab: [Route]] = [:]
    /// The Book tab's period and "offers only", set by the Home banners and "View all".
    var bookPeriod: Period = .daily
    var bookOffersOnly = false
    /// A question to put in the Support composer ("Get help with this booking").
    var supportDraft: String?

    func path(_ tab: AppTab) -> Binding<[Route]> {
        Binding(get: { self.paths[tab] ?? [] }, set: { self.paths[tab] = $0 })
    }
    var isAtRoot: Bool { (paths[tab] ?? []).isEmpty }

    func push(_ r: Route) { paths[tab, default: []].append(r) }
    func pop() { if !(paths[tab] ?? []).isEmpty { paths[tab]!.removeLast() } }
    /// Replaces the pages of the current tab (Checkout -> Confirmed, like `replace: true` on the site).
    func replace(with r: Route) { paths[tab] = [r] }

    /// A tap on a tab: back to its first page when it is already open.
    func select(_ t: AppTab) {
        if tab == t { paths[t] = [] } else { tab = t }
    }

    func openBook(period: Period? = nil, offersOnly: Bool = false) {
        if let period { bookPeriod = period }
        bookOffersOnly = offersOnly
        paths[.book] = []
        tab = .book
    }

    func openSupport(ask: String? = nil) {
        supportDraft = ask
        paths[.support] = []
        tab = .support
    }

    /// Opens a site link from a notification ("/bookings/<id>#invoice", "/profile/payments", ...).
    func open(link: String) {
        let parts = link.split(separator: "#", maxSplits: 1).map(String.init)
        let path = parts.first ?? "/"
        let section = parts.count > 1 ? parts[1] : nil
        let seg = path.split(separator: "/").map(String.init)
        switch seg.first {
        case "bookings" where seg.count == 2: tab = .bookings; paths[.bookings] = [.booking(seg[1], section: section)]
        case "bookings": select(.bookings)
        case "book": openBook()
        case "support": openSupport()
        case "profile":
            let sub: [String: Route] = ["payments": .payments, "documents": .documents, "edit": .editProfile, "notifications": .notifications]
            tab = .profile
            paths[.profile] = seg.count > 1 ? sub[seg[1]].map { [$0] } ?? [] : []
        case "notifications": push(.inbox)
        default: tab = .home; paths[.home] = []
        }
    }
}

/// Where a notification takes the customer: the page it links to, at the part it is about (src/data/notifications.ts).
func noteLink(type: String, link: String?) -> String {
    let to = (link?.isEmpty == false ? link! : "/")
    guard to.range(of: #"^/bookings/[^/#?]+$"#, options: .regularExpression) != nil else { return to }
    return type == "fine" ? "\(to)#fines" : type == "invoice" ? "\(to)#invoice" : to
}
