import SwiftUI
import WebKit

/// The Stripe Checkout page, inside the app. Apple Pay and cards work in it (no script is injected into the page).
/// Stripe sends the customer back to a Drivex page with "?payment=<id>"; that page is never loaded here: the app catches
/// the address, closes the sheet and confirms the payment with the server (api/pay.ts, action "confirm").
struct PaymentView: View {
    let url: URL
    /// The payment id from the return address, or nil when the customer closed the page.
    let onFinish: (String?) -> Void
    @State private var loading = true

    var body: some View {
        NavigationStack {
            CheckoutWebView(url: url, loading: $loading) { onFinish($0) }
                .overlay { if loading { ProgressView().tint(Color.brand) } }
                .ignoresSafeArea(edges: .bottom)
                .navigationTitle(t("Payment"))
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button(t("Close")) { onFinish(nil) }
                    }
                    ToolbarItem(placement: .principal) {
                        Label(t("Secure payment by Stripe"), systemImage: "lock.fill").font(.dx(13, .medium)).foregroundStyle(Color.inkMuted)
                    }
                }
        }
        .interactiveDismissDisabled()
    }
}

private struct CheckoutWebView: UIViewRepresentable {
    let url: URL
    @Binding var loading: Bool
    let onReturn: (String?) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent() // nothing from the checkout stays on the phone
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.allowsBackForwardNavigationGestures = false
        web.load(URLRequest(url: url))
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        let parent: CheckoutWebView
        private var done = false
        init(_ parent: CheckoutWebView) { self.parent = parent }

        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else { return decisionHandler(.allow) }
            // back on the Drivex site: the payment page is finished
            if url.host == AppConfig.siteURL.host {
                decisionHandler(.cancel)
                guard !done else { return }
                done = true
                let id = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first { $0.name == "payment" }?.value
                parent.onReturn(id)
                return
            }
            // bank pages (3-D Secure) and Stripe stay here; other apps (a banking app link) open outside
            if let scheme = url.scheme, scheme != "https", scheme != "http", scheme != "about" {
                decisionHandler(.cancel)
                UIApplication.shared.open(url)
                return
            }
            decisionHandler(.allow)
        }

        /// Links that open a new window (terms, receipts) load in the same page.
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if action.targetFrame == nil { webView.load(action.request) }
            return nil
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) { parent.loading = true }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { parent.loading = false }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { parent.loading = false }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { parent.loading = false }
    }
}

/// Wraps an open Stripe page as an Identifiable for `.fullScreenCover(item:)`.
struct CheckoutPage: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}

/// Pay one invoice: the amount, the card / Apple Pay row, then Stripe. Shows "Thank you" when the payment went through.
struct PayInvoiceSheet: View {
    @Environment(AppStore.self) private var store
    let invoice: Invoice
    private enum Phase { case idle, busy, done }
    @State private var state: Phase = .idle
    @State private var error = ""
    @State private var page: CheckoutPage?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        SheetFrame(title: state == .done ? t("Payment received") : t("Pay invoice")) {
            if state == .done {
                VStack(spacing: 4) {
                    Image(systemName: "checkmark.circle").font(.system(size: 64, weight: .light)).foregroundStyle(Color.brand)
                    Text(t("Thank you!")).font(.dx(18, .semibold)).foregroundStyle(Color.ink).padding(.top, 12)
                    Text(t("Invoice {number} is paid.", ["number": invoice.number])).font(.dx(15)).foregroundStyle(Color.inkMuted)
                    DXButton(t("Done"), size: .lg) { dismiss() }.padding(.top, 24)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    HStack { Text(t("Invoice")); Spacer(); Text(verbatim: invoice.number) }.font(.dx(14)).foregroundStyle(Color.inkMuted)
                    if let d = invoice.description { Text(d).font(.dx(14)).foregroundStyle(Color.ink) }
                    HStack(alignment: .firstTextBaseline) {
                        Text(t("Amount due")).font(.dx(16, .medium)).foregroundStyle(Color.ink)
                        Spacer()
                        aed(invoice.amount, size: 24).foregroundStyle(Color.ink)
                    }
                }
                .padding(16)
                .background(RoundedRectangle(cornerRadius: 14).fill(Color.bg))
                CardMethodRow().padding(.top, 16)
                ErrorText(message: error).padding(.top, 12)
                DXButton(size: .lg, busy: state == .busy, action: pay) {
                    Text(t("Pay")) + Text(" ") + aed(invoice.amount, size: 16, weight: .semibold)
                }
                .padding(.top, 20)
            }
        }
        .fullScreenCover(item: $page) { p in
            PaymentView(url: p.url) { id in
                page = nil
                Task { @MainActor in
                    guard let id else { state = .idle; await store.refresh(); return }
                    state = .busy
                    state = await store.confirmPayment(id) ? .done : .idle
                    if state == .done { Haptics.success() }
                }
            }
        }
    }

    private func pay() {
        state = .busy; error = ""
        Task { @MainActor in
            do {
                switch try await store.payInvoice(invoice.id, returnPath: invoice.bookingId.map { "/bookings/\($0)" } ?? "/profile/payments") {
                case .checkout(let url): page = CheckoutPage(url: url)
                case .paid: state = .done
                }
            } catch {
                self.error = error.localizedDescription
                state = .idle
            }
        }
    }
}

/// "Card or Apple Pay · Secure payment by Stripe".
struct CardMethodRow: View {
    var selected = false
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "creditcard").font(.system(size: 22)).foregroundStyle(Color.brand)
            VStack(alignment: .leading, spacing: 2) {
                Text(t("Card or Apple Pay")).font(.dx(16, .medium)).foregroundStyle(Color.ink)
                Text(t("Secure payment by Stripe")).font(.dx(12)).foregroundStyle(Color.inkMuted)
            }
            Spacer()
            if selected { Circle().strokeBorder(Color.brand, lineWidth: 6).frame(width: 20, height: 20) }
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 14).fill(.white))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(selected ? Color.brand : Color.line))
    }
}
