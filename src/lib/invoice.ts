// Tax invoice for a customer invoice: builds a print-ready HTML document and opens the browser's print dialog
// ("Save as PDF"). HTML rather than a PDF library on purpose: customer names can be Arabic, and the browser
// renders every script correctly. No dependency.
//
// Each row has its own VAT rate (5% on rental, delivery, no-deposit and driver/child seat; 0% on insurance, fines and Salik).
// Totals are VAT-inclusive amounts split per row. The invoice amount is always the sum of its rows.
//
// NOTE: this file exists twice, in src/lib/ (panel) and apps/customer/src/lib/ (customer app). Keep them identical;
// src/lib/invoice.test.ts fails when they differ.

export const VAT_RATE = 0.05; // UAE VAT

/** One row of the invoice. `amount` is the price for the row after its discount, VAT included; the VAT inside it is worked out at `vatRate`. */
export type InvoiceLine = {
  description: string;
  /** Shown under the description, e.g. the car and plate. */
  detail?: string | null;
  amount: number;
  /** Already taken off `amount`; shown in its own column. */
  discount?: number;
  /** 0.05 or 0. Defaults to the standard rate. */
  vatRate?: number;
};

/** A successful payment. A partial payment leaves the rest of the invoice as Remaining. */
export type InvoicePayment = { date: string; method: string; category?: string | null; amount: number };

export type InvoiceData = {
  number: string;
  issued: string; // ISO date
  status: 'pending' | 'paid' | 'void' | string;
  paidAt?: string | null;
  dueDate?: string | null; // ISO date
  description?: string | null;
  /** Second line under the description, e.g. the car and plate. Used only when there are no rows. */
  detail?: string | null;
  /** Total the customer pays, VAT included. Equals the sum of `lines`. */
  amount: number;
  /** The rows. Without rows the whole amount is one row at the standard rate. */
  lines?: InvoiceLine[];
  payments?: InvoicePayment[];
};
export type BillTo = { name: string; phone?: string | null; email?: string | null };
export type Company = {
  name: string;
  address: string;
  trn?: string | null;
  phone?: string;
  email?: string;
  bank?: { accountName?: string | null; bankName?: string | null; iban?: string | null; bic?: string | null };
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Splits a VAT-inclusive amount into net, VAT and total. The total is always exactly the amount charged. */
export function vatSplit(gross: number) {
  const total = round2(gross);
  const net = round2(total / (1 + VAT_RATE));
  return { net, vat: round2(total - net), total };
}

/** Each row with its net, VAT and total. The prices include VAT, so the VAT is split out of each row's total at its own rate. */
export function invoiceRows(invoice: InvoiceData) {
  const src: InvoiceLine[] = invoice.lines?.length
    ? invoice.lines
    : [{ description: invoice.description || 'Car rental', detail: invoice.detail, amount: invoice.amount }];
  return src.map((l) => {
    const rate = l.vatRate ?? VAT_RATE;
    const total = round2(l.amount);
    const net = rate > 0 ? round2(total / (1 + rate)) : total;
    const discount = round2(l.discount ?? 0);
    return { ...l, vatRate: rate, total, net, vat: round2(total - net), discount, before: round2(total + discount) };
  });
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const money = (n: number) => `AED ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** UAE mobiles in groups: +971 50 123 4567. Anything else is shown as it is. */
const phone = (p: string) => { const m = /^\+971(\d{2})(\d{3})(\d{4})$/.exec(p.replace(/\s/g, '')); return m ? `+971 ${m[1]} ${m[2]} ${m[3]}` : p; };
const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Dubai' }) : '');
const TO_BE_ADDED = '<span class="muted">to be added</span>';

export function invoiceHtml({ invoice, to, company, logoUrl }: { invoice: InvoiceData; to: BillTo; company: Company; logoUrl?: string }): string {
  const rows = invoiceRows(invoice);
  const sum = (f: (r: (typeof rows)[number]) => number) => round2(rows.reduce((s, r) => s + f(r), 0));
  const net = sum((r) => r.net), vat = sum((r) => r.vat);
  const total = round2(invoice.amount);
  const paidAmount = round2((invoice.payments ?? []).reduce((s, p) => s + Number(p.amount), 0));
  const remaining = round2(Math.max(total - paidAmount, 0));
  const paid = invoice.status === 'paid' || (total > 0 && remaining === 0);
  const voided = invoice.status === 'void';
  const partly = !paid && !voided && paidAmount > 0;
  const stamp = voided ? 'VOID' : paid ? 'PAID' : partly ? 'PART PAID' : 'UNPAID';
  const stampColor = voided ? '#6b7280' : paid ? '#15803d' : '#b45309';
  const bank = company.bank ?? {};
  const bankRow = (label: string, value?: string | null) => `<tr><td class="muted">${label}</td><td>${value ? esc(value) : TO_BE_ADDED}</td></tr>`;
  return `<!doctype html>
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
  .stamp { display: inline-block; margin-top: 8px; padding: 2px 12px; border: 2px solid ${stampColor}; color: ${stampColor}; font-weight: 700; letter-spacing: .12em; border-radius: 6px; }
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
      ${logoUrl ? `<img class="logo" src="${esc(logoUrl)}" alt="">` : `<strong style="font-size:22px">${esc(company.name)}</strong>`}
      <div style="margin-top:8px"><strong>${esc(company.name)}</strong><br>${esc(company.address)}
        ${company.phone ? `<br>${esc(company.phone)}` : ''}${company.email ? `<br>${esc(company.email)}` : ''}
        <br>TRN: ${company.trn ? esc(company.trn) : TO_BE_ADDED}</div>
    </div>
    <div class="right">
      <h1>TAX INVOICE</h1>
      <div class="ar">فاتورة ضريبية</div>
      <div><strong>${esc(invoice.number)}</strong></div>
      <div class="muted">Issued ${esc(date(invoice.issued))}</div>
      ${invoice.dueDate ? `<div class="muted">Due ${esc(date(invoice.dueDate))}</div>` : ''}
      <div class="stamp">${stamp}</div>
      ${paid && invoice.paidAt ? `<div class="muted" style="margin-top:4px">Paid ${esc(date(invoice.paidAt))}</div>` : ''}
    </div>
  </div>

  <div class="cols">
    <div><div class="label">Billed to</div><strong>${esc(to.name)}</strong>${to.phone ? `<br><span dir="ltr">${esc(phone(to.phone))}</span>` : ''}${to.email ? `<br>${esc(to.email)}` : ''}</div>
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
    <tbody>${rows.map((r) => `<tr>
      <td>${esc(r.description)}${r.detail ? `<div class="muted">${esc(r.detail)}</div>` : ''}</td>
      <td class="num">${money(r.before)}</td><td class="num">${r.discount ? money(r.discount) : '—'}</td>
      <td class="num">${money(r.net)}</td><td class="num">${money(r.vat)}</td><td class="num">${money(r.total)}</td>
    </tr>`).join('')}</tbody>
  </table>

  <table class="totals">
    <tr><td>Subtotal before tax<div class="ar">المجموع قبل الضريبة</div></td><td class="num">${money(net)}</td></tr>
    <tr><td>VAT<div class="ar">ضريبة القيمة المضافة</div></td><td class="num">${money(vat)}</td></tr>
    <tr class="grand"><td>Invoice amount<div class="ar">مبلغ الفاتورة</div></td><td class="num">${money(total)}</td></tr>
    <tr><td>Paid<div class="ar">المدفوع</div></td><td class="num">${money(paidAmount)}</td></tr>
    <tr class="grand"><td>Remaining<div class="ar">المتبقي</div></td><td class="num">${money(remaining)}</td></tr>
  </table>

  ${(invoice.payments ?? []).length ? `
  <div class="label" style="margin-top:26px">Transactions<span class="ar"> · المعاملات</span></div>
  <table>
    <thead><tr><th>#</th><th>Date</th><th>Payment method</th><th>Category</th><th class="num">Amount</th></tr></thead>
    <tbody>${(invoice.payments ?? []).map((p, i) => `<tr><td>${i + 1}</td><td>${esc(date(p.date))}</td><td>${esc(p.method)}</td><td>${esc(p.category || '')}</td><td class="num">${money(Number(p.amount))}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="4" class="num"><strong>Total paid</strong></td><td class="num"><strong>${money(paidAmount)}</strong></td></tr></tfoot>
  </table>` : ''}

  <div class="cols" style="margin-top:28px">
    <div><div class="label">Bank details<span class="ar"> · تفاصيل الحساب</span></div>
      <table class="bank">
        ${bankRow('Account name', bank.accountName)}
        ${bankRow('Bank', bank.bankName)}
        ${bankRow('IBAN', bank.iban)}
        ${bankRow('BIC / Swift', bank.bic)}
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
</body></html>`;
}

/** Opens the print dialog for the document (choose "Save as PDF"). The file name defaults to the document title. */
export async function printInvoice(html: string): Promise<void> {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const cleanup = () => frame.remove();
  await new Promise<void>((resolve) => { frame.onload = () => resolve(); frame.srcdoc = html; });
  const win = frame.contentWindow!;
  const imgs = [...win.document.images];
  await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
  win.addEventListener('afterprint', cleanup);
  setTimeout(cleanup, 120000); // in case the browser never fires afterprint
  win.focus();
  win.print();
}
