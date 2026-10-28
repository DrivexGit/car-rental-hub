import SwiftUI
import UIKit

@main
struct DrivexApp: App {
    @State private var store = AppStore()
    @State private var router = Router()
    @State private var i18n = I18n.shared
    @State private var theme = ThemeStore.shared

    init() {
        // car pictures and photos are loaded with AsyncImage, which uses the shared cache
        URLCache.shared = URLCache(memoryCapacity: 40 * 1024 * 1024, diskCapacity: 200 * 1024 * 1024)
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .environment(router)
                .environment(\.layoutDirection, i18n.lang.isRTL ? .rightToLeft : .leftToRight)
                .environment(\.locale, i18n.lang.locale)
                .tint(Color.brand)
                .preferredColorScheme(.light)
        }
    }
}

/// The page under the splash: sign-in, or the app with its tabs.
struct RootView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.scenePhase) private var phase
    @State private var splashDone = false

    var body: some View {
        ZStack {
            Color.bg.ignoresSafeArea()
            if !AppConfig.isConfigured {
                NotConfigured()
            } else if store.ready {
                if store.user != nil { MainView() } else { SignedOutView() }
            }
            if !splashDone { SplashView(ready: store.ready) { splashDone = true }.zIndex(10) }
        }
        .task { if AppConfig.isConfigured { store.start() } else { splashDone = true } }
        .onChange(of: phase) { _, p in
            // back in the app: the data may have changed (a payment, a new invoice)
            if p == .active, store.user != nil { Task { @MainActor in await store.refresh() } }
        }
    }
}

/// Signed out: the sign-in page, which also links to the public legal pages.
private struct SignedOutView: View {
    @State private var path: [Route] = []
    var body: some View {
        NavigationStack(path: $path) {
            LoginView(open: { path.append($0) })
                .toolbar(.hidden, for: .navigationBar)
                .navigationDestination(for: Route.self) { r in
                    switch r {
                    case .terms: LegalPage(id: "terms")
                    case .privacy: LegalPage(id: "privacy")
                    default: DeleteAccountView()
                    }
                }
        }
    }
}

/// Five tabs, each with its own stack of pages, and the site's bottom bar on the first page of each.
struct MainView: View {
    @Environment(Router.self) private var router
    @State private var visited: Set<AppTab> = [.home]

    var body: some View {
        ZStack {
            ForEach(AppTab.allCases) { tab in
                if visited.contains(tab) {
                    TabStack(tab: tab)
                        .opacity(router.tab == tab ? 1 : 0)
                        .allowsHitTesting(router.tab == tab)
                        .accessibilityHidden(router.tab != tab)
                }
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if router.isAtRoot { TabBar().transition(.move(edge: .bottom)) }
        }
        .animation(.easeOut(duration: 0.2), value: router.isAtRoot)
        .onChange(of: router.tab, initial: true) { _, t in visited.insert(t) }
        .overlay { OnboardingView() }
    }
}

private struct TabStack: View {
    @Environment(Router.self) private var router
    let tab: AppTab

    var body: some View {
        NavigationStack(path: router.path(tab)) {
            root
                .toolbar(.hidden, for: .navigationBar)
                .navigationDestination(for: Route.self) { RouteView(route: $0).toolbar(.hidden, for: .navigationBar) }
        }
    }

    @ViewBuilder private var root: some View {
        switch tab {
        case .home: HomeView()
        case .book: BookView()
        case .support: SupportView()
        case .bookings: BookingsView()
        case .profile: ProfileView()
        }
    }
}

private struct RouteView: View {
    let route: Route
    var body: some View {
        switch route {
        case let .reserve(carId, period, off, from, to): ReserveView(carId: carId, period: period, off: off, from: from, to: to)
        case .checkout(let q): CheckoutView(quote: q)
        case .confirmed(let id): ConfirmedView(id: id)
        case let .booking(id, section): BookingDetailView(id: id, section: section)
        case .inbox: InboxView()
        case .editProfile: EditProfileView()
        case .payments: PaymentsView()
        case .security: SecurityView()
        case .documents: DocumentsView()
        case .notifications: NotificationSettingsView()
        case .language: LanguageView()
        case .legal: SupportLegalView()
        case .other: OtherView()
        case .terms: LegalPage(id: "terms")
        case .privacy: LegalPage(id: "privacy")
        case .deleteAccount: DeleteAccountView()
        }
    }
}

/// The site's bottom bar: five tabs, the active one with a pill behind its icon and a line on top.
struct TabBar: View {
    @Environment(Router.self) private var router
    @Namespace private var ns

    var body: some View {
        HStack(spacing: 0) {
            ForEach(AppTab.allCases) { tab in
                let on = router.tab == tab
                Button {
                    Haptics.tap()
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { router.select(tab) }
                } label: {
                    VStack(spacing: 4) {
                        ZStack {
                            if on { Capsule().fill(Color.brandSoft).frame(width: 48, height: 32).matchedGeometryEffect(id: "pill", in: ns) }
                            Image(systemName: on ? tab.activeIcon : tab.icon)
                                .font(.system(size: 20, weight: on ? .semibold : .regular))
                                .scaleEffect(on ? 1.08 : 1)
                                .offset(y: on ? -1 : 0)
                        }
                        .frame(height: 32)
                        Text(t(tab.label)).font(.dx(11, .medium))
                    }
                    .foregroundStyle(on ? Color.brand : Color.inkFaint)
                    .frame(maxWidth: .infinity)
                    .frame(height: 64)
                    .overlay(alignment: .top) {
                        if on { UnevenRoundedRectangle(bottomLeadingRadius: 3, bottomTrailingRadius: 3).fill(Color.brand).frame(height: 3).padding(.horizontal, 16).matchedGeometryEffect(id: "line", in: ns) }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(t(tab.label))
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
        .background(Color.white.opacity(0.96).background(.ultraThinMaterial).ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) { Rectangle().fill(Color.line).frame(height: 1) }
        .shadow(color: Color.ink.opacity(0.08), radius: 12, y: -6)
    }
}

/// Shown only when Config/Secrets.xcconfig was not filled in.
private struct NotConfigured: View {
    var body: some View {
        EmptyState(icon: "gearshape", title: t("The app is not set up yet"), text: t("Add the Supabase URL and key in Config/Secrets.xcconfig, then build again."))
    }
}

// The pages hide the system navigation bar to draw the site's own header; this keeps the edge swipe that goes back.
extension UINavigationController: UIGestureRecognizerDelegate {
    override open func viewDidLoad() {
        super.viewDidLoad()
        interactivePopGestureRecognizer?.delegate = self
    }

    public func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        viewControllers.count > 1
    }
}
