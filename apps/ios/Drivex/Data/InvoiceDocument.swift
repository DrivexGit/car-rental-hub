import Foundation

/// The tax invoice as an HTML page: a line-by-line port of apps/customer/src/lib/invoice.ts (`invoiceHtml`), so the
/// invoice on the phone is the same document the site and the panel print. HTML because customer names can be Arabic
/// and the system draws every script correctly. Keep it in step with invoice.ts.
enum InvoiceDocument {
    static let vatRate = 0.05

    struct BillTo { let name: String; let phone: String?; let email: String?; let no: Int?; let nationality: String? }
    struct Company {
        let name: String, address: String, trn: String?, phone: String?, email: String?
        let accountName: String?, bankName: String?, iban: String?, bic: String?
    }

    struct Row { let description: String; let detail: String?; let vatRate: Double; let total: Double; let net: Double; let vat: Double; let discount: Double; let before: Double }

    private static func round2(_ n: Double) -> Double { ((n + .ulpOfOne) * 100).rounded() / 100 }

    /// Each row with its net, VAT and total. The prices include VAT, so the VAT is split out of each row's total at its own rate.
    static func rows(_ invoice: Invoice, detail: String?) -> [Row] {
        let src: [(description: String, detail: String?, amount: Double, discount: Double, rate: Double)] = invoice.lines.isEmpty
            ? [(invoice.description ?? "Car rental", detail, invoice.amount, 0, vatRate)]
            : invoice.lines.map { ($0.description, nil, $0.amount, $0.discount, $0.vatRate) }
        return src.map { l in
            let total = round2(l.amount)
            let net = l.rate > 0 ? round2(total / (1 + l.rate)) : total
            let discount = round2(l.discount)
            return Row(description: l.description, detail: l.detail, vatRate: l.rate, total: total, net: net, vat: round2(total - net), discount: discount, before: round2(total + discount))
        }
    }

    static func esc(_ s: Any?) -> String {
        guard let s else { return "" }
        return "\(s)".replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;").replacingOccurrences(of: "\"", with: "&quot;").replacingOccurrences(of: "'", with: "&#39;")
    }

    private static func money(_ n: Double) -> String {
        let f = NumberFormatter()
        f.locale = Locale(identifier: "en_US")
        f.numberStyle = .decimal
        f.minimumFractionDigits = 2
        f.maximumFractionDigits = 2
        return "AED \(f.string(from: NSNumber(value: n)) ?? String(format: "%.2f", n))"
    }

    /// UAE mobiles in groups: +971 50 123 4567. Anything else is shown as it is.
    private static func phone(_ p: String) -> String {
        let f = Fmt.phone(p)
        return f.hasPrefix("(+971) ") ? "+971 " + f.dropFirst(7) : p
    }

    private static func date(_ iso: String?) -> String {
        guard let iso, !iso.isEmpty else { return "" }
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_GB")
        f.timeZone = Fmt.dubai
        f.dateFormat = "dd MMM yyyy"
        return f.string(from: Fmt.date(iso))
    }

    private static let toBeAdded = "<span class=\"muted\">to be added</span>"

    static func html(invoice: Invoice, detail: String?, to: BillTo, company: Company, logoDataURL: String?) -> String {
        let lines = rows(invoice, detail: detail)
        let net = round2(lines.reduce(0) { $0 + $1.net }), vat = round2(lines.reduce(0) { $0 + $1.vat })
        let total = round2(invoice.amount)
        let paidAmount = round2(invoice.payments.reduce(0) { $0 + $1.amount })
        let remaining = round2(max(total - paidAmount, 0))
        let paid = invoice.status == .paid || (total > 0 && remaining == 0)
        let voided = invoice.status == .void
        let partly = !paid && !voided && paidAmount > 0
        let stamp = voided ? "VOID" : paid ? "PAID" : partly ? "PART PAID" : "UNPAID"
        let stampColor = voided ? "#6b7280" : paid ? "#15803d" : "#b45309"
        func bankRow(_ label: String, _ value: String?) -> String { "<tr><td class=\"muted\">\(label)</td><td>\(value.map { esc($0) } ?? toBeAdded)</td></tr>" }

        let rowsHtml = lines.map { r in
            """
            <tr>
              <td>\(esc(r.description))\(r.detail.map { "<div class=\"muted\">\(esc($0))</div>" } ?? "")</td>
              <td class="num">\(money(r.before))</td><td class="num">\(r.discount != 0 ? money(r.discount) : "—")</td>
              <td class="num">\(money(r.net))</td><td class="num">\(money(r.vat))</td><td class="num">\(money(r.total))</td>
            </tr>
            """
        }.joined()

        let payments = invoice.payments.isEmpty ? "" : """
          <div class="label" style="margin-top:26px">Transactions<span class="ar"> · المعاملات</span></div>
          <table>
            <thead><tr><th>#</th><th>Date</th><th>Payment method</th><th>Category</th><th class="num">Amount</th></tr></thead>
            <tbody>\(invoice.payments.enumerated().map { i, p in "<tr><td>\(i + 1)</td><td>\(esc(date(p.date)))</td><td>\(esc(p.method))</td><td>\(esc(p.category ?? ""))</td><td class=\"num\">\(money(p.amount))</td></tr>" }.joined())</tbody>
            <tfoot><tr><td colspan="4" class="num"><strong>Total paid</strong></td><td class="num"><strong>\(money(paidAmount))</strong></td></tr></tfoot>
          </table>
        """

        let billed = [
            "<strong>\(esc(to.name))</strong>" + (to.no.map { " #\(esc($0))" } ?? ""),
            to.nationality.map { "<br>Nationality: \(esc($0))" } ?? "",
            to.phone.map { "<br><span dir=\"ltr\">\(esc(phone($0)))</span>" } ?? "",
            to.email.map { "<br>\(esc($0))" } ?? "",
        ].joined()

        return """
        <!doctype html>
        <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>\(esc(invoice.number))</title>
        <style>
          @page { size: A4; margin: 16mm; }
          * { box-sizing: border-box; }
          body { font: 13px/1.5 Arial, Helvetica, sans-serif; color: #141414; margin: 0; -webkit-text-size-adjust: 100%; }
          .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
          .logo { height: 44px; }
          h1 { font-size: 22px; letter-spacing: .08em; margin: 0 0 4px; text-align: right; }
          .ar { font-family: Arial, Tahoma, sans-serif; direction: rtl; color: #6b6b6b; font-size: 11px; }
          .muted { color: #6b6b6b; }
          .right { text-align: right; }
          .stamp { display: inline-block; margin-top: 8px; padding: 2px 12px; border: 2px solid \(stampColor); color: \(stampColor); font-weight: 700; letter-spacing: .12em; border-radius: 6px; }
          .cols { display: flex; gap: 24px; margin: 28px 0 22px; }
          .cols > div { flex: 1; }
          .label { font-size: 10px; text-transform: uppercase; letter-spacing: .1em; color: #6b6b6b; margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #6b6b6b; border-bottom: 2px solid #141414; padding: 8px 6px; }
          td { padding: 10px 6px; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
          .num { text-align: right; white-space: nowrap; }
          .totals { width: 55%; margin: 14px 0 0 auto; }
          .totals td { border: 0; padding: 4px 6px; }
          .totals .grand td { border-top: 2px solid #141414; font-size: 15px; font-weight: 700; padding-top: 8px; }
          .bank td { border: 0; padding: 2px 6px 2px 0; }
          .sign { display: flex; gap: 18px; margin-top: 48px; }
          .sign > div { flex: 1; border-top: 1px solid #141414; padding-top: 6px; font-size: 11px; }
          @media screen and (max-width: 640px) {
            body { padding: 14px; }
            .top, .cols, .sign { flex-direction: column; gap: 14px; }
            h1, .right { text-align: left; }
            .totals { width: 100%; }
            table { font-size: 10.5px; }
            th, td { padding: 7px 2px; }
            th { font-size: 8.5px; letter-spacing: 0; }
          }
          .foot { margin-top: 36px; font-size: 11px; color: #6b6b6b; border-top: 1px solid #e5e5e5; padding-top: 10px; }
        </style></head>
        <body>
          <div class="top">
            <div>
              \(logoDataURL.map { "<img class=\"logo\" src=\"\($0)\" alt=\"\">" } ?? "<strong style=\"font-size:22px\">\(esc(company.name))</strong>")
              <div style="margin-top:8px"><strong>\(esc(company.name))</strong><br>\(esc(company.address))
                \(company.phone.map { "<br>\(esc($0))" } ?? "")\(company.email.map { "<br>\(esc($0))" } ?? "")
                <br>TRN: \(company.trn.map { esc($0) } ?? toBeAdded)</div>
            </div>
            <div class="right">
              <h1>TAX INVOICE</h1>
              <div class="ar">فاتورة ضريبية</div>
              <div><strong>\(esc(invoice.number))</strong></div>
              <div class="muted">Issued \(esc(date(invoice.issued)))</div>
              \(invoice.dueDate.map { "<div class=\"muted\">Due \(esc(date($0)))</div>" } ?? "")
              <div class="stamp">\(stamp)</div>
              \(paid && invoice.paidAt != nil ? "<div class=\"muted\" style=\"margin-top:4px\">Paid \(esc(date(invoice.paidAt)))</div>" : "")
            </div>
          </div>

          <div class="cols">
            <div><div class="label">Billed to</div>\(billed)</div>
          </div>

          <table>
            <thead><tr>
              <th>Description<div class="ar">الوصف</div></th>
              <th class="num">Amount<div class="ar">المبلغ</div></th>
              <th class="num">Discount<div class="ar">الخصم</div></th>
              <th class="num">Before tax<div class="ar">قبل الضريبة</div></th>
              <th class="num">VAT<div class="ar">الضريبة</div></th>
              <th class="num">Balance<div class="ar">الإجمالي</div></th>
            </tr></thead>
            <tbody>\(rowsHtml)</tbody>
          </table>

          <table class="totals">
            <tr><td>Subtotal before tax<div class="ar">المجموع قبل الضريبة</div></td><td class="num">\(money(net))</td></tr>
            <tr><td>VAT<div class="ar">ضريبة القيمة المضافة</div></td><td class="num">\(money(vat))</td></tr>
            <tr class="grand"><td>Invoice amount<div class="ar">مبلغ الفاتورة</div></td><td class="num">\(money(total))</td></tr>
            <tr><td>Paid<div class="ar">المدفوع</div></td><td class="num">\(money(paidAmount))</td></tr>
            <tr class="grand"><td>Remaining<div class="ar">المتبقي</div></td><td class="num">\(money(remaining))</td></tr>
          </table>

          \(payments)

          <div class="cols" style="margin-top:28px">
            <div><div class="label">Bank details<span class="ar"> · تفاصيل الحساب</span></div>
              <table class="bank">
                \(bankRow("Account name", company.accountName))
                \(bankRow("Bank", company.bankName))
                \(bankRow("IBAN", company.iban))
                \(bankRow("BIC / Swift", company.bic))
              </table>
            </div>
            <div><div class="label">Seller address<span class="ar"> · عنوان البائع</span></div>\(esc(company.address))</div>
          </div>

          <div class="sign">
            <div>Customer<div class="ar">العميل</div></div>
            <div>Manager<div class="ar">المدير</div></div>
            <div>Accountant<div class="ar">المحاسب</div></div>
          </div>

          <div class="foot">All amounts are in UAE dirhams (AED). VAT is 5% where shown; fines, Salik and insurance carry no VAT. Thank you for choosing \(esc(company.name)).</div>
        </body></html>
        """
    }
}
