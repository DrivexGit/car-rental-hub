import SwiftUI
import UIKit

// The site's building blocks (apps/customer/src/components/ui.tsx), drawn natively.

/// Light haptic tick, like the site's tap().
@MainActor enum Haptics {
    static func tap() { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    static func success() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
}

// MARK: - Dirham sign and prices

/// The UAE dirham sign (2025 symbol): a D crossed by two bars. Drawn once per size and used inside text.
enum Dirham {
    private static var cache: [CGFloat: UIImage] = [:]

    static func image(_ side: CGFloat) -> UIImage {
        let side = (side * 2).rounded() / 2
        if let img = cache[side] { return img }
        let s = side / 24 // the symbol is drawn on a 24-unit grid, as the site's SVG
        let img = UIGraphicsImageRenderer(size: CGSize(width: side, height: side)).image { _ in
            UIColor.black.setStroke()
            let d = UIBezierPath()
            d.move(to: CGPoint(x: 6 * s, y: 4 * s))
            d.addLine(to: CGPoint(x: 6 * s, y: 20 * s))
            d.addLine(to: CGPoint(x: 10.5 * s, y: 20 * s))
            d.addArc(withCenter: CGPoint(x: 10.5 * s, y: 12 * s), radius: 8 * s, startAngle: .pi / 2, endAngle: -.pi / 2, clockwise: false)
            d.close()
            d.lineWidth = 2.6 * s
            d.lineCapStyle = .round
            d.lineJoinStyle = .round
            d.stroke()
            let bars = UIBezierPath()
            for y in [10.0, 14.0] {
                bars.move(to: CGPoint(x: 2 * s, y: y * s))
                bars.addLine(to: CGPoint(x: 20 * s, y: y * s))
            }
            bars.lineWidth = 1.9 * s
            bars.lineCapStyle = .round
            bars.stroke()
        }.withRenderingMode(.alwaysTemplate)
        cache[side] = img
        return img
    }

    /// The sign as text, sized for a font of `size` points; it takes the text colour.
    static func text(_ size: CGFloat) -> Text {
        Text(Image(uiImage: image(size * 0.8))).baselineOffset(-size * 0.08)
    }
}

/// "<sign> 1,250" in one run of text.
func aed(_ amount: Double, size: CGFloat, weight: Font.Weight = .bold) -> Text {
    Dirham.text(size) + Text(" " + Fmt.money(amount)).font(.dx(size, weight))
}

/// Price with an optional unit ("/ day") and an old price struck through.
struct PriceView: View {
    let value: Double
    var unit: String? = nil
    var old: Double? = nil
    var size: CGFloat = 20

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            aed(value, size: size).foregroundStyle(Color.ink)
            if let unit { Text("/ \(unit)").font(.dx(14)).foregroundStyle(Color.inkFaint) }
            if let old {
                (Dirham.text(14) + Text(" " + Fmt.money(old)).font(.dx(14)))
                    .strikethrough().foregroundStyle(Color.inkFaint)
            }
        }
        .lineLimit(1)
        .fixedSize()
    }
}

// MARK: - Brand

/// The brand name as plain text (no logo mark), in the same weight as the splash screen.
struct Logo: View {
    var size: CGFloat = 22
    var color: Color = .brand
    var body: some View {
        Text(verbatim: "Drivex").font(.system(size: size, weight: .heavy)).tracking(-0.5).foregroundStyle(color)
            .environment(\.layoutDirection, .leftToRight)
    }
}

/// The customer's photo, or their initials when they have not uploaded one.
struct Face: View {
    @Environment(AppStore.self) private var store
    var size: CGFloat = 40
    var body: some View {
        ZStack {
            Circle().fill(Color.brand)
            if let url = store.user?.avatarURL.flatMap(URL.init(string:)) {
                AsyncImage(url: url) { img in img.resizable().scaledToFill() } placeholder: { initials }
            } else {
                initials
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .accessibilityHidden(true)
    }
    private var initials: some View {
        Text(store.user?.initials ?? "?").font(.system(size: size * 0.4, weight: .semibold)).foregroundStyle(.white)
    }
}

// MARK: - Bars and titles

/// Top bar of every tab: logo at the start, the bell and the photo at the end.
struct TopBar<Trailing: View>: View {
    @ViewBuilder var trailing: Trailing
    var body: some View {
        HStack {
            Logo()
            Spacer()
            trailing
        }
        .padding(.top, 12)
        .padding(.bottom, 16)
    }
}

extension TopBar where Trailing == DefaultTopBarItems {
    init() { trailing = DefaultTopBarItems() }
}

struct DefaultTopBarItems: View {
    var body: some View {
        HStack(spacing: 10) {
            BellButton()
            AvatarButton()
        }
    }
}

struct AvatarButton: View {
    @Environment(Router.self) private var router
    var body: some View {
        Button { Haptics.tap(); router.select(.profile) } label: {
            Face(size: 40).overlay(Circle().stroke(.white, lineWidth: 2)).shadow(color: Color.ink.opacity(0.06), radius: 1, y: 1)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(t("Profile"))
    }
}

/// The bell with the number of unread notifications; it rings now and then while there are any.
struct BellButton: View {
    @Environment(AppStore.self) private var store
    @Environment(Router.self) private var router
    @State private var ring = false

    var body: some View {
        let unread = store.unreadCount
        Button { Haptics.tap(); router.push(.inbox) } label: {
            Image(systemName: "bell")
                .font(.system(size: 18, weight: .regular))
                .foregroundStyle(Color.ink)
                .rotationEffect(.degrees(ring ? -14 : 0), anchor: .top)
                .frame(width: 40, height: 40)
                .background(Circle().fill(.white))
                .overlay(Circle().stroke(Color.line))
                .overlay(alignment: .topTrailing) {
                    if unread > 0 {
                        Text("\(unread)").font(.system(size: 11, weight: .bold)).foregroundStyle(.white)
                            .padding(.horizontal, 4).frame(minWidth: 20, minHeight: 20)
                            .background(Capsule().fill(Color.danger)).offset(x: 2, y: -2)
                    }
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(t("Notifications"))
        .task(id: unread) {
            guard unread > 0 else { return }
            while !Task.isCancelled {
                withAnimation(.easeInOut(duration: 0.15).repeatCount(5, autoreverses: true)) { ring = true }
                try? await Task.sleep(for: .seconds(0.8))
                withAnimation(.easeOut(duration: 0.1)) { ring = false }
                try? await Task.sleep(for: .seconds(4))
            }
        }
    }
}

struct PageTitle: View {
    let title: Text
    var sub: String? = nil
    init(_ title: String, sub: String? = nil) { self.title = Text(title); self.sub = sub }
    init(text: Text, sub: String? = nil) { title = text; self.sub = sub }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            title.font(.display(32)).foregroundStyle(Color.ink).fixedSize(horizontal: false, vertical: true)
            if let sub { Text(sub).font(.dx(15)).foregroundStyle(Color.inkMuted) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.bottom, 20)
    }
}

/// Header of an inner page: back arrow, title, and something at the end.
struct BackBar<Trailing: View>: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    @ViewBuilder var trailing: Trailing

    var body: some View {
        HStack(spacing: 12) {
            Button { Haptics.tap(); dismiss() } label: {
                Image(systemName: "arrow.left")
                    .font(.system(size: 17, weight: .medium))
                    .flipsForRightToLeftLayoutDirection(true)
                    .foregroundStyle(Color.ink)
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(.white))
                    .overlay(Circle().stroke(Color.line))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(t("Back"))
            Text(title).font(.dx(18, .semibold)).foregroundStyle(Color.ink).lineLimit(1)
            Spacer(minLength: 0)
            trailing
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(Color.bg.opacity(0.92).background(.ultraThinMaterial))
    }
}

extension BackBar where Trailing == EmptyView {
    init(title: String) { self.title = title; trailing = EmptyView() }
}

struct SectionHead: View {
    let title: String
    var action: (() -> Void)? = nil
    var body: some View {
        HStack {
            Text(title).font(.dx(20, .bold)).foregroundStyle(Color.ink)
            Spacer()
            if let action {
                Button { Haptics.tap(); action() } label: {
                    HStack(spacing: 4) {
                        Text(t("View all"))
                        Image(systemName: "arrow.right").flipsForRightToLeftLayoutDirection(true)
                    }
                    .font(.dx(14)).foregroundStyle(Color.inkMuted)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.top, 28)
        .padding(.bottom, 12)
    }
}

// MARK: - Cards

struct PressScale: ButtonStyle {
    var scale: CGFloat = 0.975
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scale : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

extension View {
    /// White rounded card with a hairline border, as on the site.
    func card(radius: CGFloat = 14) -> some View {
        background(RoundedRectangle(cornerRadius: radius).fill(.white))
            .overlay(RoundedRectangle(cornerRadius: radius).stroke(Color.line))
            .clipShape(RoundedRectangle(cornerRadius: radius))
            .shadow(color: Color.ink.opacity(0.04), radius: 1, y: 1)
    }

    /// Fades and lifts in when it first appears (the site's card entrance).
    func appear(delay: Double = 0) -> some View { modifier(AppearModifier(delay: delay)) }
}

private struct AppearModifier: ViewModifier {
    let delay: Double
    @State private var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduce
    func body(content: Content) -> some View {
        content
            .opacity(shown || reduce ? 1 : 0)
            .offset(y: shown || reduce ? 0 : 14)
            .onAppear { withAnimation(.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.4).delay(delay)) { shown = true } }
    }
}

/// A card that opens something: the whole card is the button.
struct CardButton<Content: View>: View {
    let action: () -> Void
    @ViewBuilder var content: Content
    var body: some View {
        Button { Haptics.tap(); action() } label: { content.card().contentShape(Rectangle()) }
            .buttonStyle(PressScale())
    }
}

// MARK: - Buttons

enum ButtonVariant { case primary, soft, ghost, danger }
enum ButtonSize { case sm, md, lg }

struct DXButton<Label: View>: View {
    var variant: ButtonVariant = .primary
    var size: ButtonSize = .md
    var arrow = false
    var busy = false
    var disabled = false
    let action: () -> Void
    @ViewBuilder var label: Label

    var body: some View {
        Button { Haptics.tap(); action() } label: {
            HStack(spacing: 6) {
                if busy { ProgressView().tint(fg) } else {
                    label
                    if arrow { Image(systemName: "arrow.right").font(.system(size: 14, weight: .semibold)).flipsForRightToLeftLayoutDirection(true) }
                }
            }
            .font(.dx(size == .sm ? 14 : size == .md ? 15 : 16, .semibold))
            .foregroundStyle(fg)
            .lineLimit(1)
            .padding(.horizontal, size == .sm ? 14 : size == .md ? 20 : 24)
            .frame(height: size == .sm ? 36 : size == .md ? 44 : 56)
            .frame(maxWidth: size == .lg ? .infinity : nil)
            .background(RoundedRectangle(cornerRadius: 12).fill(bg))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(border))
            .contentShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(PressScale(scale: 0.95))
        .disabled(disabled || busy)
        .opacity(disabled ? 0.4 : 1)
    }

    private var fg: Color {
        switch variant {
        case .primary: .white
        case .soft: .brand
        case .ghost: .ink
        case .danger: .danger
        }
    }
    private var bg: Color {
        switch variant {
        case .primary: .brand
        case .soft: .brandSoft
        case .ghost, .danger: .white
        }
    }
    private var border: Color {
        switch variant {
        case .primary, .soft: .clear
        case .ghost: .line
        case .danger: Color.danger.opacity(0.3)
        }
    }
}

extension DXButton where Label == Text {
    init(_ title: String, variant: ButtonVariant = .primary, size: ButtonSize = .md, arrow: Bool = false, busy: Bool = false, disabled: Bool = false, action: @escaping () -> Void) {
        self.variant = variant; self.size = size; self.arrow = arrow; self.busy = busy; self.disabled = disabled; self.action = action
        label = Text(title)
    }
}

struct Chip<Label: View>: View {
    var active = false
    var danger = false
    let action: () -> Void
    @ViewBuilder var label: Label

    var body: some View {
        Button { Haptics.tap(); action() } label: {
            HStack(spacing: 6) { label }
                .font(.dx(14, .medium))
                .foregroundStyle(danger ? Color.danger : active ? .white : Color.ink)
                .padding(.horizontal, 14)
                .frame(height: 40)
                .background(RoundedRectangle(cornerRadius: 12).fill(active && !danger ? Color.brand : .white))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(danger ? Color.danger.opacity(0.3) : active ? Color.brand : Color.line))
        }
        .buttonStyle(PressScale(scale: 0.92))
    }
}

extension Chip where Label == Text {
    init(_ title: String, active: Bool = false, danger: Bool = false, action: @escaping () -> Void) {
        self.active = active; self.danger = danger; self.action = action
        label = Text(title)
    }
}

// MARK: - Status, badges, lists

struct StatusDot: View {
    let status: BookingStatus
    var body: some View {
        HStack(spacing: 6) {
            Circle().fill(dot).frame(width: 8, height: 8)
            Text(t(label)).font(.dx(13, .medium)).foregroundStyle(text)
        }
    }
    private var dot: Color {
        switch status {
        case .overdue: .danger
        case .ongoing: .brand
        case .upcoming, .pending: .warn
        case .completed, .cancelled: .inkFaint
        }
    }
    private var text: Color {
        switch status {
        case .overdue: .danger
        case .ongoing: .brand
        case .upcoming, .pending: .warnText
        case .completed, .cancelled: .inkFaint
        }
    }
    private var label: String {
        switch status {
        case .overdue: "Overdue"
        case .ongoing: "Ongoing"
        case .upcoming: "Upcoming"
        case .completed: "Completed"
        case .pending: "Awaiting payment"
        case .cancelled: "Cancelled"
        }
    }
}

struct Badge: View {
    let text: String
    var fg: Color = .brand
    var bg: Color = .brandSoft
    var body: some View {
        Text(text).font(.dx(12, .semibold)).foregroundStyle(fg)
            .padding(.horizontal, 8).padding(.vertical, 2)
            .background(RoundedRectangle(cornerRadius: 6).fill(bg))
    }
}

/// A row of a settings-style list: icon, label, value, chevron when it opens something.
struct ListRow: View {
    var icon: String? = nil
    let label: String
    var value: String? = nil
    var danger = false
    var action: (() -> Void)? = nil

    var body: some View {
        if let action {
            Button { Haptics.tap(); action() } label: { row(chevron: true) }.buttonStyle(RowPress())
        } else {
            row(chevron: false)
        }
    }

    private func row(chevron: Bool) -> some View {
        HStack(spacing: 14) {
            if let icon { Image(systemName: icon).font(.system(size: 18)).frame(width: 22).foregroundStyle(danger ? Color.danger : Color.ink) }
            Text(label).font(.dx(15, .medium)).foregroundStyle(danger ? Color.danger : Color.ink)
            Spacer(minLength: 8)
            if let value { Text(value).font(.dx(14)).foregroundStyle(Color.inkMuted).lineLimit(1) }
            if chevron { Image(systemName: "chevron.right").font(.system(size: 14, weight: .semibold)).foregroundStyle(Color.inkFaint).flipsForRightToLeftLayoutDirection(true) }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .frame(minHeight: 56)
        .contentShape(Rectangle())
    }
}

/// Rows that darken while pressed, like `active:bg-bg` on the site.
struct RowPress: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.background(configuration.isPressed ? Color.bg : Color.clear)
    }
}

/// A titled card of rows with hairlines between them.
struct ListGroup<Content: View>: View {
    var title: String? = nil
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let title { Text(title).font(.dx(13)).foregroundStyle(Color.inkMuted).padding(.horizontal, 4) }
            Divided { content }.card()
        }
        .padding(.bottom, 20)
    }
}

/// Stacks its children with a hairline between each (the site's divide-y).
struct Divided<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        _VariadicView.Tree(DividedLayout()) { content }
    }
}

private struct DividedLayout: _VariadicView_UnaryViewRoot {
    @ViewBuilder
    func body(children: _VariadicView.Children) -> some View {
        VStack(spacing: 0) {
            ForEach(children) { child in
                child
                if child.id != children.last?.id { Rectangle().fill(Color.line).frame(height: 1) }
            }
        }
    }
}

struct Segmented<T: Hashable>: View {
    let value: T
    let options: [(value: T, label: String)]
    let onChange: (T) -> Void
    @Namespace private var ns

    var body: some View {
        HStack(spacing: 0) {
            ForEach(options.indices, id: \.self) { i in
                let o = options[i]
                let on = o.value == value
                Button { Haptics.tap(); withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) { onChange(o.value) } } label: {
                    Text(o.label)
                        .font(.dx(14, on ? .semibold : .medium))
                        .foregroundStyle(on ? Color.ink : Color.inkMuted)
                        .frame(maxWidth: .infinity)
                        .frame(height: 40)
                        .background {
                            if on { RoundedRectangle(cornerRadius: 9).fill(.white).shadow(color: Color.ink.opacity(0.05), radius: 1, y: 1).matchedGeometryEffect(id: "seg", in: ns) }
                        }
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color.muted))
    }
}

struct EmptyState<Action: View>: View {
    let icon: String
    let title: String
    var text: String? = nil
    @ViewBuilder var action: Action

    var body: some View {
        VStack(spacing: 0) {
            Image(systemName: icon).font(.system(size: 24)).foregroundStyle(Color.brand)
                .frame(width: 64, height: 64).background(Circle().fill(Color.brandSoft)).padding(.bottom, 16)
            Text(title).font(.dx(18, .semibold)).foregroundStyle(Color.ink)
            if let text { Text(text).font(.dx(15)).foregroundStyle(Color.inkMuted).padding(.top, 4) }
            action.padding(.top, 20)
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 24)
        .padding(.vertical, 64)
    }
}

extension EmptyState where Action == EmptyView {
    init(icon: String, title: String, text: String? = nil) {
        self.icon = icon; self.title = title; self.text = text; action = EmptyView()
    }
}

/// Error text in the site's danger colour.
struct ErrorText: View {
    let message: String
    var body: some View {
        if !message.isEmpty {
            Text(message).font(.dx(14, .medium)).foregroundStyle(Color.danger).frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityAddTraits(.isStaticText)
        }
    }
}

/// An alert box in a soft colour (danger, warning or brand).
struct NoticeBox<Content: View>: View {
    var fg: Color = .danger
    var bg: Color = .dangerSoft
    var icon: String? = nil
    @ViewBuilder var content: Content
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            if let icon { Image(systemName: icon).font(.system(size: 15)).padding(.top, 1) }
            content.frame(maxWidth: .infinity, alignment: .leading)
        }
        .font(.dx(14))
        .foregroundStyle(fg)
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 14).fill(bg))
    }
}

// MARK: - Images

/// A picture from the site or from storage. Car renders sit on white; `multiply` blends them into tinted cards, as on the site.
struct RemoteImage: View {
    let path: String?
    var fill = false
    var multiply = false

    var body: some View {
        AsyncImage(url: path.flatMap(AppConfig.url), transaction: Transaction(animation: .easeOut(duration: 0.2))) { phase in
            if let img = phase.image {
                (fill ? AnyView(img.resizable().scaledToFill()) : AnyView(img.resizable().scaledToFit()))
                    .blendMode(multiply ? .multiply : .normal)
            } else {
                Color.clear
            }
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Sheets

private struct SheetHeight: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = max(value, nextValue()) }
}

/// The site's bottom sheet: a title, a close button and the content. It is as tall as its content, or full height (`large`).
struct SheetFrame<Content: View>: View {
    let title: String
    var large = false
    @ViewBuilder var content: Content
    @Environment(\.dismiss) private var dismiss
    @State private var height: CGFloat = 320

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(title).font(.dx(18, .bold)).foregroundStyle(Color.ink).lineLimit(1)
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark").font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.ink)
                        .frame(width: 36, height: 36).background(Circle().fill(Color.bg))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(t("Close"))
            }
            .padding(.bottom, 16)
            content
            if large { Spacer(minLength: 0) }
        }
        .padding(.horizontal, 20)
        .padding(.top, 28)
        .padding(.bottom, 20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(GeometryReader { g in Color.clear.preference(key: SheetHeight.self, value: g.size.height) })
        .onPreferenceChange(SheetHeight.self) { if $0 > 0 { height = $0 } }
        .presentationDetents(large ? [.large] : [.height(height)])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(24)
        .presentationBackground(.white)
    }
}

// MARK: - Page layout

/// A scrolling page in the site's column: 20pt side margins on the page background.
struct PageScroll<Content: View>: View {
    var bottom: CGFloat = 32
    @ViewBuilder var content: Content
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) { content }
                .padding(.horizontal, 20)
                .padding(.bottom, bottom)
                .frame(maxWidth: 560)
                .frame(maxWidth: .infinity)
        }
        .scrollIndicators(.hidden)
        .background(Color.bg)
    }
}

/// An inner page: the back bar stays at the top while the rest scrolls.
struct InnerPage<Trailing: View, Content: View>: View {
    let title: String
    @ViewBuilder var trailing: Trailing
    @ViewBuilder var content: Content
    var body: some View {
        VStack(spacing: 0) {
            BackBar(title: title) { trailing }
            PageScroll(bottom: 40) { content }
        }
        .background(Color.bg)
        .toolbar(.hidden, for: .navigationBar)
    }
}

extension InnerPage where Trailing == EmptyView {
    init(title: String, @ViewBuilder content: () -> Content) {
        self.title = title; trailing = EmptyView(); self.content = content()
    }
}

/// The fixed action bar at the bottom of the booking steps.
struct BottomBar<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        VStack(spacing: 12) { content }
            .padding(.horizontal, 20)
            .padding(.top, 12)
            .padding(.bottom, 12)
            .frame(maxWidth: .infinity)
            .background(Color.white.shadow(.drop(color: Color.ink.opacity(0.06), radius: 12, y: -4)))
            .overlay(alignment: .top) { Rectangle().fill(Color.line).frame(height: 1) }
    }
}
