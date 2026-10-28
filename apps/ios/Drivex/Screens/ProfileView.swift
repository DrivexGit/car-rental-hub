import SwiftUI

/// Profile tab: the customer's card, reminders for missing documents or email, and the settings menu.
struct ProfileView: View {
    @Environment(AppStore.self) private var store
    @Environment(Router.self) private var router
    @State private var theme = ThemeStore.shared
    @State private var appearance = false
    @State private var confirmLogout = false

    var body: some View {
        let missing = store.missingDocuments
        PageScroll {
            TopBar {
                Button { Haptics.tap(); router.select(.support) } label: {
                    Label(t("Support"), systemImage: "headphones").font(.dx(14, .medium)).foregroundStyle(Color.ink)
                }
                .buttonStyle(.plain)
            }
            PageTitle(t("My profile"))

            if let user = store.user {
                HStack(spacing: 16) {
                    Face(size: 64)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(user.name).font(.dx(18, .bold)).foregroundStyle(Color.ink).lineLimit(1)
                        Text(verbatim: user.email ?? Fmt.phone(user.phone)).font(.dx(14)).foregroundStyle(Color.inkMuted).lineLimit(1)
                            .environment(\.layoutDirection, .leftToRight)
                    }
                    Spacer(minLength: 0)
                    Button { Haptics.tap(); router.push(.editProfile) } label: {
                        Image(systemName: "pencil").font(.system(size: 18)).foregroundStyle(Color.ink)
                            .frame(width: 44, height: 44).overlay(Circle().stroke(Color.line))
                    }
                    .buttonStyle(PressScale(scale: 0.92))
                    .accessibilityLabel(t("Edit profile"))
                }
                .padding(16).card().padding(.bottom, 24)

                if !missing.isEmpty {
                    reminder(icon: "person.text.rectangle", fg: .danger, bg: .dangerSoft, iconBg: .danger,
                             title: t("Upload your documents"),
                             text: t("You need these before you can book: {list}.", ["list": missing.map { t($0.label) }.joined(separator: ", ")])) {
                        router.push(.documents)
                    }
                }
                if user.email == nil {
                    reminder(icon: "envelope", fg: .warnText, bg: .warnSoft, iconBg: .warn,
                             title: t("Add your email"), text: t("Your account has no email yet. Add one so we can reach you.")) {
                        router.push(.editProfile)
                    }
                    .padding(.bottom, 8)
                }
            }

            ListGroup(title: t("Account")) {
                ListRow(icon: "creditcard", label: t("Payments")) { router.push(.payments) }
                ListRow(icon: "checkmark.shield", label: t("Security")) { router.push(.security) }
                ListRow(icon: "doc.text", label: t("Documents")) { router.push(.documents) }
            }
            ListGroup(title: t("Preferences & support")) {
                ListRow(icon: "bell", label: t("Notifications")) { router.push(.notifications) }
                ListRow(icon: "globe", label: t("Change language"), value: I18n.shared.lang.label) { router.push(.language) }
                ListRow(icon: "paintpalette", label: t("Appearance"), value: t(theme.name.label)) { appearance = true }
                ListRow(icon: "headphones", label: t("Support & legal")) { router.push(.legal) }
                ListRow(icon: "gearshape.2", label: t("Other")) { router.push(.other) }
            }
            ListGroup {
                ListRow(icon: "rectangle.portrait.and.arrow.right", label: t("Log out"), danger: true) { confirmLogout = true }
            }
        }
        .refreshable { await store.refresh() }
        .sheet(isPresented: $appearance) {
            SheetFrame(title: t("Appearance")) {
                Segmented(value: theme.name, options: ThemeName.allCases.map { ($0, t($0.label)) }) { theme.set($0) }
            }
        }
        .confirmationDialog(t("Log out"), isPresented: $confirmLogout, titleVisibility: .hidden) {
            Button(t("Log out"), role: .destructive) {
                SupportChat.shared.clear()
                router.paths = [:]
                router.tab = .home
                Task { @MainActor in await store.signOut() }
            }
            Button(t("Cancel"), role: .cancel) {}
        }
    }

    private func reminder(icon: String, fg: Color, bg: Color, iconBg: Color, title: String, text: String, action: @escaping () -> Void) -> some View {
        Button { Haptics.tap(); action() } label: {
            HStack(spacing: 12) {
                Image(systemName: icon).font(.system(size: 17)).foregroundStyle(.white)
                    .frame(width: 40, height: 40).background(RoundedRectangle(cornerRadius: 12).fill(iconBg))
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.dx(16, .semibold)).foregroundStyle(fg)
                    Text(text).font(.dx(14)).foregroundStyle(Color.inkMuted).multilineTextAlignment(.leading)
                }
                Spacer(minLength: 0)
            }
            .padding(16)
            .background(RoundedRectangle(cornerRadius: 14).fill(bg))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(fg.opacity(0.3)))
        }
        .buttonStyle(PressScale())
        .padding(.top, -8)
        .padding(.bottom, 16)
    }
}
