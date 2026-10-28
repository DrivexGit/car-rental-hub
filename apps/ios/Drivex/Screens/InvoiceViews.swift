import SwiftUI
import WebKit
import Supabase

/// Two small buttons on an invoice row: View (the tax invoice on screen) and Download (a PDF file to save or share).
/// An invoice the staff uploaded as a PDF is shown and saved as that same file, never rebuilt (as on the site).
struct InvoiceButtons: View {
    @Environment(AppStore.self) private var store
    let invoice: Invoice
    var detail: String? = nil
    @State private var viewing = false
    @State private var busy = false
    @State private var share: SharedFile?
    @State private var error = ""

    var body: some View {
        HStack(spacing: 8) {
            small("eye", t("View invoice")) { viewing = true }
            small("arrow.down.to.line", t("Download invoice"), busy: busy) { download() }
        }
        .sheet(isPresented: $viewing) {
            InvoiceSheet(invoice: invoice, html: html, error: error) { download() }
        }
        .sheet(item: $share) { ShareSheet(url: $0.url).ignoresSafeArea() }
    }

    private func small(_ icon: String, _ label: String, busy: Bool = false, action: @escaping () -> Void) -> some View {
        Button { Haptics.tap(); action() } label: {
            Group { if busy { ProgressView().controlSize(.small) } else { Image(systemName: icon).font(.system(size: 14)) } }
                .foregroundStyle(Color.inkMuted)
                .frame(width: 36, height: 36)
                .overlay(Circle().stroke(Color.line))
                .contentShape(Circle())
        }
        .buttonStyle(PressScale(scale: 0.9))
        .disabled(busy)
        .accessibilityLabel(label)
    }

    /// The tax invoice document, filled with the customer's and the seller's details (tenant settings win over the defaults).
    private var html: String? {
        guard invoice.filePath == nil, let user = store.user else { return nil }
        let s = store.seller
        let logo = UIImage(named: "LogoDark")?.pngData().map { "data:image/png;base64,\($0.base64EncodedString())" }
        return InvoiceDocument.html(
            invoice: invoice, detail: detail,
            to: .init(name: user.name, phone: user.phone, email: user.email, no: user.customerNo, nationality: user.nationality),
            company: .init(name: AppConfig.Company.name, address: s?.legalAddress ?? AppConfig.Company.address, trn: s?.trn,
                           phone: AppConfig.supportPhone, email: AppConfig.Company.email,
                           accountName: s?.bankAccountName, bankName: s?.bankName, iban: s?.iban, bic: s?.bic),
            logoDataURL: logo)
    }

    private func download() {
        busy = true; error = ""
        Task { @MainActor in
            defer { busy = false }
            do {
                let data: Data
                if let path = invoice.filePath {
                    // a short-lived link: the storage policy only lets the customer read their own invoices
                    let url = try await supabase.storage.from("invoices").createSignedURL(path: path, expiresIn: 300)
                    data = try await URLSession.shared.data(from: url).0
                } else if let html {
                    data = try await PDFRenderer.render(html: html)
                } else { return }
                let file = FileManager.default.temporaryDirectory.appendingPathComponent("\(invoice.number).pdf")
                try data.write(to: file, options: .atomic)
                if viewing { viewing = false; try? await Task.sleep(for: .milliseconds(450)) } // one sheet at a time
                share = SharedFile(url: file)
            } catch {
                self.error = invoice.filePath == nil ? t("Could not create the PDF. Please try again.") : t("Could not open the invoice. Please try again.")
                viewing = true // the sheet is where the message is shown
            }
        }
    }
}

struct SharedFile: Identifiable { let url: URL; var id: String { url.path } }

/// The invoice on screen, with the Download button.
private struct InvoiceSheet: View {
    @Environment(AppStore.self) private var store
    let invoice: Invoice
    let html: String?
    let error: String
    let download: () -> Void
    @State private var fileURL: URL?

    var body: some View {
        SheetFrame(title: invoice.number, large: true) {
            Group {
                if let html {
                    HTMLView(html: html)
                } else if let fileURL {
                    HTMLView(url: fileURL)
                } else {
                    ProgressView().tint(Color.brand).frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .frame(maxHeight: .infinity)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.line))
            ErrorText(message: error).padding(.top, 12)
            DXButton(size: .lg, action: download) {
                Image(systemName: "arrow.down.to.line")
                Text(t("Download PDF"))
            }
            .padding(.top, 16)
        }
        .task {
            if let path = invoice.filePath, fileURL == nil {
                fileURL = try? await supabase.storage.from("invoices").createSignedURL(path: path, expiresIn: 300)
            }
        }
    }
}

/// A web view for a document: an HTML string, or a file URL (the uploaded PDF).
struct HTMLView: UIViewRepresentable {
    var html: String? = nil
    var url: URL? = nil

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        config.defaultWebpagePreferences.allowsContentJavaScript = false // invoices are static HTML
        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        web.backgroundColor = .white
        if let html { web.loadHTMLString(html, baseURL: nil) } else if let url { web.load(URLRequest(url: url)) }
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}
}

/// The system share sheet: Save to Files, AirDrop, Mail, WhatsApp...
struct ShareSheet: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [url], applicationActivities: nil)
    }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}

/// Turns an HTML document into an A4 PDF (12 mm margins), paginated by the system's print layout.
@MainActor
enum PDFRenderer {
    private final class Loader: NSObject, WKNavigationDelegate {
        var done: CheckedContinuation<Void, Error>?
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { done?.resume(); done = nil }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { done?.resume(throwing: error); done = nil }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { done?.resume(throwing: error); done = nil }
    }

    private final class A4: UIPrintPageRenderer {
        private let page = CGRect(x: 0, y: 0, width: 595.2, height: 841.8)
        override var paperRect: CGRect { page }
        override var printableRect: CGRect { page.insetBy(dx: 34, dy: 34) }
    }

    static func render(html: String) async throws -> Data {
        let web = WKWebView(frame: CGRect(x: 0, y: 0, width: 794, height: 1123))
        let loader = Loader()
        web.navigationDelegate = loader
        try await withCheckedThrowingContinuation { (c: CheckedContinuation<Void, Error>) in
            loader.done = c
            web.loadHTMLString(html, baseURL: nil)
        }
        let renderer = A4()
        renderer.addPrintFormatter(web.viewPrintFormatter(), startingAtPageAt: 0)
        let data = NSMutableData()
        UIGraphicsBeginPDFContextToData(data, renderer.paperRect, nil)
        renderer.prepare(forDrawingPages: NSRange(location: 0, length: renderer.numberOfPages))
        for i in 0..<renderer.numberOfPages {
            UIGraphicsBeginPDFPage()
            renderer.drawPage(at: i, in: UIGraphicsGetPDFContextBounds())
        }
        UIGraphicsEndPDFContext()
        withExtendedLifetime(loader) {}
        return data as Data
    }
}
