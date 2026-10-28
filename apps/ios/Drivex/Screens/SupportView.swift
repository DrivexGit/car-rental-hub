import SwiftUI

/// Support tab: chat with Drivex AI (api/chat.ts), quick questions, an urgent call that alerts the team, WhatsApp.
/// The conversation lasts while the app is open, like the site keeps it for the browser tab.
struct SupportView: View {
    @Environment(AppStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(\.openURL) private var openURL
    @State private var chat = SupportChat.shared
    @State private var text = ""
    @FocusState private var focused: Bool

    private let chips = ["Extend my rental", "Payment help"]

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        TopBar { AvatarButton() }
                        header
                        Bubble(message: .init(role: .assistant, content: t("Hi {name}. What can I help you with?", ["name": store.user?.firstName ?? ""])))
                        if chat.messages.isEmpty { quickChips(urgentFirst: false) }
                        ForEach(chat.messages) { m in Bubble(message: m) }
                        if chat.busy { TypingDots() }
                        Color.clear.frame(height: 1).id("end")
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 12)
                    .frame(maxWidth: 560)
                    .frame(maxWidth: .infinity)
                }
                .scrollIndicators(.hidden)
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: chat.messages.count) { withAnimation { proxy.scrollTo("end", anchor: .bottom) } }
                .onChange(of: chat.busy) { withAnimation { proxy.scrollTo("end", anchor: .bottom) } }
            }
            composer
        }
        .background(Color.bg)
        .onAppear(perform: takeDraft)
        .onChange(of: router.supportDraft) { takeDraft() }
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text(t("How can we help?")).font(.display(30)).foregroundStyle(Color.ink)
                HStack(spacing: 6) {
                    Image(systemName: "sparkles").foregroundStyle(Color.brand)
                    Text(verbatim: "Drivex AI").bold().foregroundStyle(Color.ink)
                    Text("· " + t("AI assistant")).foregroundStyle(Color.inkFaint)
                }
                .font(.dx(14))
            }
            Spacer()
            Button {
                Haptics.tap()
                openURL(AppConfig.whatsappLink("Hi Drivex, this is \(store.user?.name ?? "")."))
            } label: {
                WhatsAppMark().frame(width: 24, height: 24).foregroundStyle(Color.whatsapp)
                    .frame(width: 48, height: 48).background(Circle().fill(Color.whatsapp.opacity(0.1)))
            }
            .buttonStyle(PressScale(scale: 0.92))
            .accessibilityLabel("WhatsApp")
        }
        .padding(.bottom, 8)
    }

    private func quickChips(urgentFirst: Bool) -> some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                if urgentFirst { urgentChip }
                ForEach(chips, id: \.self) { c in Chip(t(c)) { send(t(c)) } }
                if !urgentFirst { urgentChip }
            }
            .padding(.horizontal, 20)
        }
        .scrollIndicators(.hidden)
        .padding(.horizontal, -20)
    }

    private var urgentChip: some View {
        Chip(danger: true, action: { send(t("Urgent call — I need help now."), urgent: true) }) {
            Image(systemName: "phone"); Text(t("Urgent call"))
        }
    }

    private var composer: some View {
        VStack(spacing: 8) {
            if !chat.messages.isEmpty { quickChips(urgentFirst: true) }
            HStack(spacing: 8) {
                TextField(t("Ask a question…"), text: $text, axis: .vertical)
                    .font(.dx(15)).lineLimit(1...4).focused($focused)
                    .submitLabel(.send)
                    .onSubmit { send(text) }
                    .onChange(of: text) { _, v in if v.count > 2000 { text = String(v.prefix(2000)) } }
                    .padding(.leading, 16)
                Button { send(text) } label: {
                    Image(systemName: "paperplane.fill").font(.system(size: 17)).flipsForRightToLeftLayoutDirection(true).foregroundStyle(.white)
                        .frame(width: 44, height: 44).background(RoundedRectangle(cornerRadius: 12).fill(Color.brand))
                }
                .buttonStyle(PressScale(scale: 0.95))
                .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || chat.busy)
                .opacity(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || chat.busy ? 0.4 : 1)
                .accessibilityLabel(t("Send"))
            }
            .padding(6)
            .background(RoundedRectangle(cornerRadius: 16).fill(.white))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(focused ? Color.brand.opacity(0.4) : Color.line))
            .shadow(color: focused ? Color.brand.opacity(0.12) : Color.ink.opacity(0.04), radius: focused ? 4 : 1)
            .padding(.horizontal, 20)
        }
        .padding(.vertical, 10)
        .frame(maxWidth: 560)
        .frame(maxWidth: .infinity)
        .background(Color.bg)
    }

    private func takeDraft() {
        if let d = router.supportDraft { text = d; router.supportDraft = nil; focused = true }
    }

    private func send(_ content: String, urgent: Bool = false) {
        let c = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !c.isEmpty, !chat.busy else { return }
        text = ""
        Task { @MainActor in await chat.send(c, urgent: urgent) }
    }
}

/// The conversation, kept for as long as the app runs.
@MainActor
@Observable
final class SupportChat {
    static let shared = SupportChat()
    struct Message: Identifiable, Equatable {
        enum Role: String { case user, assistant }
        let id = UUID()
        let role: Role
        let content: String
        var urgent = false
    }
    private(set) var messages: [Message] = []
    private(set) var busy = false

    func send(_ content: String, urgent: Bool) async {
        messages.append(.init(role: .user, content: content))
        busy = true
        defer { busy = false }
        do {
            let out = try await API.post("chat", [
                "messages": messages.suffix(12).map { ["role": $0.role.rawValue, "content": $0.content] },
                "urgentCall": urgent,
            ])
            messages.append(.init(role: .assistant, content: out["reply"].text ?? t("Sorry, something went wrong."), urgent: out["urgent"].bool ?? false))
        } catch {
            messages.append(.init(role: .assistant, content: t("I can't connect right now. Please message us on WhatsApp or call us.")))
        }
    }

    func clear() { messages = [] }
}

private struct Bubble: View {
    @Environment(\.openURL) private var openURL
    let message: SupportChat.Message
    @State private var shown = false

    var body: some View {
        let mine = message.role == .user
        VStack(alignment: mine ? .trailing : .leading, spacing: 8) {
            Text(message.content)
                .font(.dx(15)).lineSpacing(3)
                .foregroundStyle(mine ? .white : Color.ink)
                .padding(.horizontal, 16).padding(.vertical, 12)
                .background(UnevenRoundedRectangle(topLeadingRadius: 16, bottomLeadingRadius: mine ? 16 : 6, bottomTrailingRadius: mine ? 6 : 16, topTrailingRadius: 16)
                    .fill(mine ? Color.brand : Color.muted))
                .padding(mine ? .leading : .trailing, 56) // about 85% of the width, like the site
                .textSelection(.enabled)
            if message.urgent {
                VStack(alignment: .leading, spacing: 8) {
                    Label(t("Our team has been alerted"), systemImage: "exclamationmark.triangle").font(.dx(14, .semibold)).foregroundStyle(Color.danger)
                    Button { openURL(URL(string: "tel:\(AppConfig.supportPhone)")!) } label: {
                        Label(t("Call Drivex now"), systemImage: "phone.fill").font(.dx(15, .semibold)).foregroundStyle(.white)
                            .frame(maxWidth: .infinity).frame(height: 44).background(RoundedRectangle(cornerRadius: 12).fill(Color.danger))
                    }
                    .buttonStyle(PressScale(scale: 0.97))
                }
                .padding(12)
                .background(RoundedRectangle(cornerRadius: 16).fill(Color.dangerSoft))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.danger.opacity(0.3)))
                .padding(.trailing, 56)
            }
        }
        .frame(maxWidth: .infinity, alignment: mine ? .trailing : .leading)
        .opacity(shown ? 1 : 0)
        .offset(y: shown ? 0 : 10)
        .onAppear { withAnimation(.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.25)) { shown = true } }
    }
}

private struct TypingDots: View {
    @State private var up = false
    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<3) { d in
                Circle().fill(Color.inkFaint).frame(width: 8, height: 8)
                    .offset(y: up ? -4 : 0)
                    .animation(.easeInOut(duration: 0.4).repeatForever().delay(Double(d) * 0.12), value: up)
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .onAppear { up = true }
    }
}

/// The WhatsApp mark (same drawing as the site's icon).
struct WhatsAppMark: View {
    var body: some View {
        Canvas { ctx, size in
            let s = size.width / 24
            var p = Path()
            p.addEllipse(in: CGRect(x: 2 * s, y: 2 * s, width: 20 * s, height: 20 * s))
            ctx.stroke(p, with: .foreground, lineWidth: 1.8 * s)
            var tail = Path()
            tail.move(to: CGPoint(x: 3.4 * s, y: 17.1 * s))
            tail.addLine(to: CGPoint(x: 2 * s, y: 22 * s))
            tail.addLine(to: CGPoint(x: 7 * s, y: 20.7 * s))
            tail.closeSubpath()
            ctx.fill(tail, with: .foreground)
            ctx.draw(Text(Image(systemName: "phone.fill")).font(.system(size: 9 * s)), at: CGPoint(x: 12 * s, y: 12 * s))
        }
        .environment(\.layoutDirection, .leftToRight)
    }
}
