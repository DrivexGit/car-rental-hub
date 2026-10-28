import SwiftUI

/// Notifications: invoices, fines and booking updates. Opening the page marks them read; a tap goes where they point.
struct InboxView: View {
    @Environment(AppStore.self) private var store
    @Environment(Router.self) private var router

    var body: some View {
        InnerPage(title: t("Notifications")) {
            if store.notes.isEmpty {
                EmptyState(icon: "bell", title: t("You're all caught up"), text: t("Invoices, Salik and booking updates show up here."))
            }
            LazyVStack(spacing: 10) {
                ForEach(Array(store.notes.enumerated()), id: \.element.id) { i, n in
                    Group {
                        if let link = n.link {
                            CardButton(action: { router.open(link: noteLink(type: n.type, link: link)) }) { row(n) }
                        } else {
                            row(n).card()
                        }
                    }
                    .appear(delay: Double(i) * 0.04)
                }
            }
        }
        .refreshable { await store.refresh() }
        .task {
            try? await Task.sleep(for: .seconds(1.2))
            await store.markNotesRead()
        }
    }

    private func row(_ n: Note) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon(n.type)).font(.system(size: 18))
                .foregroundStyle(n.type == "fine" ? Color.danger : Color.brand)
                .frame(width: 40, height: 40)
                .background(RoundedRectangle(cornerRadius: 12).fill(n.type == "fine" ? Color.dangerSoft : Color.brandSoft))
            VStack(alignment: .leading, spacing: 2) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(n.title).font(.dx(16, .semibold)).foregroundStyle(Color.ink).lineLimit(1)
                    Spacer(minLength: 0)
                    Text(ago(n.created)).font(.dx(12)).foregroundStyle(Color.inkFaint)
                }
                if let body = n.body { Text(body).font(.dx(14)).foregroundStyle(Color.inkMuted).multilineTextAlignment(.leading) }
            }
            if !n.read { Circle().fill(Color.brand).frame(width: 10, height: 10).padding(.top, 6) }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func icon(_ type: String) -> String {
        switch type {
        case "invoice": "doc.text"
        case "fine": "receipt"
        case "booking_confirmed": "calendar.badge.checkmark"
        default: "bell"
        }
    }

    private func ago(_ d: String) -> String {
        let m = Int((Date().timeIntervalSince(Fmt.date(d)) / 60).rounded())
        if m < 1 { return t("now") }
        if m < 60 { return t("{n}m", ["n": m]) }
        if m < 1440 { return t("{n}h", ["n": Int((Double(m) / 60).rounded())]) }
        return t("{n}d", ["n": Int((Double(m) / 1440).rounded())])
    }
}
