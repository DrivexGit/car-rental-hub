// Tax invoice for a customer invoice: builds a print-ready HTML document and opens the browser's print dialog
// ("Save as PDF"). HTML rather than a PDF library on purpose: customer names can be Arabic, and the browser
// renders every script correctly. No dependency.
//
// NOTE: this file exists twice, in src/lib/ (panel) and apps/customer/src/lib/ (customer app). Keep them identical;
// src/lib/invoice.test.ts fails when they differ.

export const VAT_RATE = 0.05; // UAE VAT

export type InvoiceData = {
  number: string;
  issued: string; // ISO date
  status: 'pending' | 'paid' | 'void' | string;
  paidAt?: string | null;
  description?: string | null;
  /** Second line under the description, e.g. the car and plate. */
  detail?: string | null;
  /** Total the customer pays, VAT included. */
  amount: number;
};
export type BillTo = { name: string; phone?: string | null; email?: string | null };
export type Company = { name: string; address: string; trn?: string; phone?: string; email?: string };

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Splits a VAT-inclusive amount into net, VAT and total. The total is always exactly the amount charged. */
export function vatSplit(gross: number) {
  const total = round2(gross);
  const net = round2(total / (1 + VAT_RATE));
  return { net, vat: round2(total - net), total };
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const money = (n: number) => `AED ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

export function invoiceHtml({ invoice, to, company, logoUrl }: { invoice: InvoiceData; to: BillTo; company: Company; logoUrl?: string }): string {
  const { net, vat, total } = vatSplit(invoice.amount);
  const paid = invoice.status === 'paid';
  const voided = invoice.status === 'void';
  const stamp = voided ? 'VOID' : paid ? 'PAID' : 'UNPAID';
  const stampColor = voided ? '#6b7280' : paid ? '#15803d' : '#b45309';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(invoice.number)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font: 13px/1.5 Arial, Helvetica, sans-serif; color: #141414; margin: 0; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .logo { height: 44px; }
  h1 { font-size: 22px; letter-spacing: .08em; margin: 0 0 4px; text-align: right; }
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
  .foot { margin-top: 36px; font-size: 11px; color: #6b6b6b; border-top: 1px solid #e5e5e5; padding-top: 10px; }
</style></head>
<body>
  <div class="top">
    <div>
      ${logoUrl ? `<img class="logo" src="${esc(logoUrl)}" alt="">` : `<strong style="font-size:22px">${esc(company.name)}</strong>`}
      <div style="margin-top:8px"><strong>${esc(company.name)}</strong><br>${esc(company.address)}
        ${company.phone ? `<br>${esc(company.phone)}` : ''}${company.email ? `<br>${esc(company.email)}` : ''}
        <br>TRN: ${company.trn ? esc(company.trn) : '<span class="muted">to be added</span>'}</div>
    </div>
    <div class="right">
      <h1>TAX INVOICE</h1>
      <div><strong>${esc(invoice.number)}</strong></div>
      <div class="muted">Issued ${esc(date(invoice.issued))}</div>
      <div class="stamp">${stamp}</div>
      ${paid && invoice.paidAt ? `<div class="muted" style="margin-top:4px">Paid ${esc(date(invoice.paidAt))}</div>` : ''}
    </div>
  </div>

  <div class="cols">
    <div><div class="label">Billed to</div><strong>${esc(to.name)}</strong>${to.phone ? `<br><span dir="ltr">${esc(to.phone)}</span>` : ''}${to.email ? `<br>${esc(to.email)}` : ''}</div>
  </div>

  <table>
    <thead><tr><th>Description</th><th class="num">Amount (excl. VAT)</th><th class="num">VAT 5%</th><th class="num">Total</th></tr></thead>
    <tbody><tr>
      <td>${esc(invoice.description || 'Car rental')}${invoice.detail ? `<div class="muted">${esc(invoice.detail)}</div>` : ''}</td>
      <td class="num">${money(net)}</td><td class="num">${money(vat)}</td><td class="num">${money(total)}</td>
    </tr></tbody>
  </table>

  <table class="totals">
    <tr><td>Subtotal (excl. VAT)</td><td class="num">${money(net)}</td></tr>
    <tr><td>VAT 5%</td><td class="num">${money(vat)}</td></tr>
    <tr class="grand"><td>Total ${paid ? 'paid' : 'due'}</td><td class="num">${money(total)}</td></tr>
  </table>

  <div class="foot">All amounts are in UAE dirhams (AED) and include 5% VAT. Thank you for choosing ${esc(company.name)}.</div>
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
