import SwiftUI

/// Terms, privacy policy and account deletion: the site's texts (legal.json, from apps/customer/src/content/legal.ts),
/// in the app's language. They open without signing in too, from the sign-in page.
enum Legal {
    struct Section: Decodable { let h: String; let p: [String] }
    struct Doc: Decodable { let title: String; let updated: String; let intro: String; let sections: [Section] }

    private static let all: [String: [String: Doc]] = {
        guard let url = Bundle.main.url(forResource: "legal", withExtension: "json"), let data = try? Data(contentsOf: url) else { return [:] }
        return (try? JSONDecoder().decode([String: [String: Doc]].self, from: data)) ?? [:]
    }()

    static func doc(_ id: String) -> Doc? { all[id]?[I18n.shared.lang.rawValue] ?? all[id]?["en"] }
}

struct LegalPage: View {
    let id: String
    var body: some View {
        let doc = Legal.doc(id)
        InnerPage(title: doc?.title ?? "") {
            if let doc { LegalBody(doc: doc) }
        }
    }
}

private struct LegalBody: View {
    let doc: Legal.Doc
    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            Text(doc.updated).font(.dx(14)).foregroundStyle(Color.inkFaint)
            Text(doc.intro).font(.dx(15)).foregroundStyle(Color.ink).lineSpacing(4)
            ForEach(doc.sections, id: \.h) { s in
                VStack(alignment: .leading, spacing: 8) {
                    Text(s.h).font(.dx(18, .semibold)).foregroundStyle(Color.ink)
                    ForEach(s.p, id: \.self) { line in
                        if line.hasPrefix("• ") {
                            HStack(alignment: .top, spacing: 8) {
                                Circle().fill(Color.brand).frame(width: 6, height: 6).padding(.top, 8)
                                Text(String(line.dropFirst(2)))
                            }
                        } else {
                            Text(line)
                        }
                    }
                    .font(.dx(15)).foregroundStyle(Color.inkMuted).lineSpacing(4)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .textSelection(.enabled)
        .appear()
    }
}

/// The account deletion page, with a request form sent by email or WhatsApp (nothing is deleted from the app itself).
struct DeleteAccountView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.openURL) private var openURL
    @State private var name = ""
    @State private var phone = ""
    @State private var email = ""
    @State private var reason = ""
    @State private var sure = false
    @State private var error = ""

    var body: some View {
        let doc = Legal.doc("delete")
        InnerPage(title: doc?.title ?? t("Delete my account")) {
            if let doc { LegalBody(doc: doc) }
            VStack(alignment: .leading, spacing: 12) {
                Text(t("Your request")).font(.dx(18, .semibold)).foregroundStyle(Color.ink)
                field(t("Full name"), $name)
                field(t("Mobile number"), $phone, placeholder: "+971 50 123 4567", ltr: true, keyboard: .phonePad)
                field(t("Email (optional)"), $email, ltr: true, keyboard: .emailAddress)
                VStack(alignment: .leading, spacing: 4) {
                    Text(t("Reason (optional)")).font(.dx(14, .medium)).foregroundStyle(Color.ink)
                    TextField("", text: $reason, axis: .vertical).lineLimit(3...5).font(.dx(15))
                        .padding(12).background(RoundedRectangle(cornerRadius: 12).fill(.white)).overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.line))
                        .onChange(of: reason) { _, v in if v.count > 500 { reason = String(v.prefix(500)) } }
                }
                Button { Haptics.tap(); sure.toggle() } label: {
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: sure ? "checkmark.square.fill" : "square").foregroundStyle(sure ? Color.brand : Color.inkFaint)
                        Text(t("I understand that deleting my account is permanent.")).foregroundStyle(Color.ink).multilineTextAlignment(.leading)
                    }
                    .font(.dx(14))
                }
                .buttonStyle(.plain)
                ErrorText(message: error)
                DXButton(size: .lg, action: byEmail) { Image(systemName: "envelope"); Text(t("Send by email")) }
                DXButton(variant: .soft, size: .lg, action: byWhatsApp) { WhatsAppMark().frame(width: 20, height: 20); Text(t("Send by WhatsApp")) }
                Text(t("This opens your email app or WhatsApp with the request ready to send. We reply from the same channel."))
                    .font(.dx(12)).foregroundStyle(Color.inkMuted)
            }
            .padding(20)
            .card()
            .padding(.top, 32)
        }
        .onAppear {
            name = store.user?.name ?? ""
            phone = store.user?.phone ?? ""
            email = store.user?.email ?? ""
        }
    }

    private var text: String {
        [
            "Account deletion request",
            "Name: \(name.trimmingCharacters(in: .whitespaces))",
            "Mobile: \(phone.trimmingCharacters(in: .whitespaces))",
            email.trimmingCharacters(in: .whitespaces).isEmpty ? nil : "Email: \(email.trimmingCharacters(in: .whitespaces))",
            reason.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : "Reason: \(reason.trimmingCharacters(in: .whitespacesAndNewlines))",
            "I understand that deleting my account is permanent.",
        ].compactMap { $0 }.joined(separator: "\n")
    }

    private func check() -> Bool {
        if name.trimmingCharacters(in: .whitespaces).count < 2 || phone.filter(\.isNumber).count < 9 { error = t("Please enter your name and mobile number."); return false }
        if !sure { error = t("Please confirm that you understand."); return false }
        error = ""
        return true
    }

    private func byEmail() {
        guard check() else { return }
        var c = URLComponents()
        c.scheme = "mailto"
        c.path = AppConfig.Company.email
        c.queryItems = [URLQueryItem(name: "subject", value: "Account deletion request"), URLQueryItem(name: "body", value: text)]
        if let url = c.url { openURL(url) }
    }

    private func byWhatsApp() { if check() { openURL(AppConfig.whatsappLink(text)) } }

    private func field(_ label: String, _ value: Binding<String>, placeholder: String = "", ltr: Bool = false, keyboard: UIKeyboardType = .default) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.dx(14, .medium)).foregroundStyle(Color.ink)
            TextField(placeholder, text: value)
                .keyboardType(keyboard).textInputAutocapitalization(ltr ? .never : .words).autocorrectionDisabled(ltr)
                .multilineTextAlignment(ltr && I18n.shared.lang.isRTL ? .trailing : .leading)
                .font(.dx(15)).padding(.horizontal, 16).frame(height: 48)
                .background(RoundedRectangle(cornerRadius: 12).fill(.white)).overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.line))
        }
    }
}
