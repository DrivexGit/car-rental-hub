package com.drivex.app.data

import com.drivex.app.core.Fmt
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.floor
import kotlin.math.max

/**
 * The tax invoice as an HTML page: a line-by-line port of apps/customer/src/lib/invoice.ts (`invoiceHtml`), so the
 * invoice on the phone is the same document the site and the panel print. HTML because customer names can be Arabic and
 * the system draws every script correctly. Keep it in step with invoice.ts.
 */
object InvoiceDocument {
    const val VAT_RATE = 0.05

    data class BillTo(val name: String, val phone: String?, val email: String?, val no: Int?, val nationality: String?)
    data class Company(
        val name: String, val address: String, val trn: String?, val phone: String?, val email: String?,
        val accountName: String?, val bankName: String?, val iban: String?, val bic: String?,
    )
    data class Row(val description: String, val detail: String?, val vatRate: Double, val total: Double, val net: Double, val vat: Double, val discount: Double, val before: Double)

    private fun round2(n: Double) = floor((n + Math.ulp(1.0)) * 100 + 0.5) / 100

    /** Each row with its net, VAT and total. The prices include VAT, so the VAT is split out of each row's total at its own rate. */
    fun rows(invoice: Invoice, detail: String?): List<Row> {
        data class Src(val description: String, val detail: String?, val amount: Double, val discount: Double, val rate: Double)
        val src = if (invoice.lines.isEmpty()) listOf(Src(invoice.description ?: "Car rental", detail, invoice.amount, 0.0, VAT_RATE))
        else invoice.lines.map { Src(it.description, null, it.amount, it.discount, it.vatRate) }
        return src.map { l ->
            val total = round2(l.amount)
            val net = if (l.rate > 0) round2(total / (1 + l.rate)) else total
            val discount = round2(l.discount)
            Row(l.description, l.detail, l.rate, total, net, round2(total - net), discount, round2(total + discount))
        }
    }

    fun esc(s: Any?): String = (s ?: "").toString().replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;")

    private val moneyFormat = DecimalFormat("#,##0.00", DecimalFormatSymbols(Locale.US))
    private fun money(n: Double) = "AED ${moneyFormat.format(n)}"

    /** UAE mobiles in groups: +971 50 123 4567. Anything else is shown as it is. */
    private fun phone(p: String) = Fmt.phone(p).let { if (it.startsWith("(+971) ")) "+971 " + it.removePrefix("(+971) ") else p }

    private val dateFormat = DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.UK)
    private fun date(iso: String?) = if (iso.isNullOrEmpty()) "" else dateFormat.format(Fmt.instant(iso).atZone(Fmt.dubai))

    private const val TO_BE_ADDED = "<span class=\"muted\">to be added</span>"

    fun html(invoice: Invoice, detail: String?, to: BillTo, company: Company, logoDataUrl: String?): String {
        val lines = rows(invoice, detail)
        val net = round2(lines.sumOf { it.net })
        val vat = round2(lines.sumOf { it.vat })
        val total = round2(invoice.amount)
        val paidAmount = round2(invoice.payments.sumOf { it.amount })
        val remaining = round2(max(total - paidAmount, 0.0))
        val paid = invoice.status == "paid" || (total > 0 && remaining == 0.0)
        val voided = invoice.status == "void"
        val partly = !paid && !voided && paidAmount > 0
        val stamp = if (voided) "VOID" else if (paid) "PAID" else if (partly) "PART PAID" else "UNPAID"
        val stampColor = if (voided) "#6b7280" else if (paid) "#15803d" else "#b45309"
        fun bankRow(label: String, value: String?) = "<tr><td class=\"muted\">$label</td><td>${value?.let { esc(it) } ?: TO_BE_ADDED}</td></tr>"

        val rowsHtml = lines.joinToString("") { r ->
            """<tr>
      <td>${esc(r.description)}${r.detail?.let { "<div class=\"muted\">${esc(it)}</div>" } ?: ""}</td>
      <td class="num">${money(r.before)}</td><td class="num">${if (r.discount != 0.0) money(r.discount) else "—"}</td>
      <td class="num">${money(r.net)}</td><td class="num">${money(r.vat)}</td><td class="num">${money(r.total)}</td>
    </tr>"""
        }

        val payments = if (invoice.payments.isEmpty()) "" else """
  <div class="label" style="margin-top:26px">Transactions<span class="ar"> · المعاملات</span></div>
  <table>
    <thead><tr><th>#</th><th>Date</th><th>Payment method</th><th>Category</th><th class="num">Amount</th></tr></thead>
    <tbody>${invoice.payments.mapIndexed { i, p -> "<tr><td>${i + 1}</td><td>${esc(date(p.date))}</td><td>${esc(p.method)}</td><td>${esc(p.category ?: "")}</td><td class=\"num\">${money(p.amount)}</td></tr>" }.joinToString("")}</tbody>
    <tfoot><tr><td colspan="4" class="num"><strong>Total paid</strong></td><td class="num"><strong>${money(paidAmount)}</strong></td></tr></tfoot>
  </table>"""

        val billed = "<strong>${esc(to.name)}</strong>" + (to.no?.let { " #${esc(it)}" } ?: "") +
            (to.nationality?.let { "<br>Nationality: ${esc(it)}" } ?: "") +
            (to.phone?.let { "<br><span dir=\"ltr\">${esc(phone(it))}</span>" } ?: "") +
            (to.email?.let { "<br>${esc(it)}" } ?: "")

        return """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(invoice.number)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font: 13px/1.5 Arial, Helvetica, sans-serif; color: #141414; margin: 0; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .logo { height: 44px; }
  h1 { font-size: 22px; letter-spacing: .08em; margin: 0 0 4px; text-align: right; }
  .ar { font-family: Arial, Tahoma, sans-serif; direction: rtl; color: #6b6b6b; font-size: 11px; }
  .muted { color: #6b6b6b; }
  .right { text-align: right; }
  .stamp { display: inline-block; margin-top: 8px; padding: 2px 12px; border: 2px solid $stampColor; color: $stampColor; font-weight: 700; letter-spacing: .12em; border-radius: 6px; }
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
      ${logoDataUrl?.let { "<img class=\"logo\" src=\"$it\" alt=\"\">" } ?: "<strong style=\"font-size:22px\">${esc(company.name)}</strong>"}
      <div style="margin-top:8px"><strong>${esc(company.name)}</strong><br>${esc(company.address)}
        ${company.phone?.let { "<br>${esc(it)}" } ?: ""}${company.email?.let { "<br>${esc(it)}" } ?: ""}
        <br>TRN: ${company.trn?.let { esc(it) } ?: TO_BE_ADDED}</div>
    </div>
    <div class="right">
      <h1>TAX INVOICE</h1>
      <div class="ar">فاتورة ضريبية</div>
      <div><strong>${esc(invoice.number)}</strong></div>
      <div class="muted">Issued ${esc(date(invoice.issued))}</div>
      ${invoice.dueDate?.let { "<div class=\"muted\">Due ${esc(date(it))}</div>" } ?: ""}
      <div class="stamp">$stamp</div>
      ${if (paid && invoice.paidAt != null) "<div class=\"muted\" style=\"margin-top:4px\">Paid ${esc(date(invoice.paidAt))}</div>" else ""}
    </div>
  </div>

  <div class="cols">
    <div><div class="label">Billed to</div>$billed</div>
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
    <tbody>$rowsHtml</tbody>
  </table>

  <table class="totals">
    <tr><td>Subtotal before tax<div class="ar">المجموع قبل الضريبة</div></td><td class="num">${money(net)}</td></tr>
    <tr><td>VAT<div class="ar">ضريبة القيمة المضافة</div></td><td class="num">${money(vat)}</td></tr>
    <tr class="grand"><td>Invoice amount<div class="ar">مبلغ الفاتورة</div></td><td class="num">${money(total)}</td></tr>
    <tr><td>Paid<div class="ar">المدفوع</div></td><td class="num">${money(paidAmount)}</td></tr>
    <tr class="grand"><td>Remaining<div class="ar">المتبقي</div></td><td class="num">${money(remaining)}</td></tr>
  </table>

  $payments

  <div class="cols" style="margin-top:28px">
    <div><div class="label">Bank details<span class="ar"> · تفاصيل الحساب</span></div>
      <table class="bank">
        ${bankRow("Account name", company.accountName)}
        ${bankRow("Bank", company.bankName)}
        ${bankRow("IBAN", company.iban)}
        ${bankRow("BIC / Swift", company.bic)}
      </table>
    </div>
    <div><div class="label">Seller address<span class="ar"> · عنوان البائع</span></div>${esc(company.address)}</div>
  </div>

  <div class="sign">
    <div>Customer<div class="ar">العميل</div></div>
    <div>Manager<div class="ar">المدير</div></div>
    <div>Accountant<div class="ar">المحاسب</div></div>
  </div>

  <div class="foot">All amounts are in UAE dirhams (AED). VAT is 5% where shown; fines, Salik and insurance carry no VAT. Thank you for choosing ${esc(company.name)}.</div>
</body></html>"""
    }
}
