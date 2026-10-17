import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { esc, invoiceHtml, invoiceRows, vatSplit } from './invoice';

const company = { name: 'Drivex Car Rental LLC', address: 'Dubai', trn: '100123456700003' };
const base = { number: 'INV-1', issued: '2026-10-05T10:00:00Z', status: 'pending', amount: 1050 };

describe('vatSplit', () => {
  it('splits a VAT-inclusive amount', () => {
    expect(vatSplit(1050)).toEqual({ net: 1000, vat: 50, total: 1050 });
    expect(vatSplit(105)).toEqual({ net: 100, vat: 5, total: 105 });
  });
  it('always adds up to exactly the amount charged', () => {
    for (const amount of [0.01, 1, 4, 19.99, 99.95, 333.33, 3750, 1234567.89]) {
      const { net, vat, total } = vatSplit(amount);
      expect(Math.round((net + vat) * 100)).toBe(Math.round(total * 100));
      expect(total).toBe(Math.round(amount * 100) / 100);
    }
  });
});

describe('esc', () => {
  it('escapes HTML so names and descriptions cannot inject markup', () => {
    expect(esc('<img src=x onerror=alert(1)>"\'&')).toBe('&lt;img src=x onerror=alert(1)&gt;&quot;&#39;&amp;');
    expect(esc(null)).toBe('');
  });
});

describe('invoiceHtml', () => {
  const html = (over = {}, to: { name: string; phone?: string } = { name: 'Test Customer', phone: '+971501234567' }) => invoiceHtml({ invoice: { ...base, ...over }, to, company });

  it('shows the TRN, number, VAT lines and the total', () => {
    const h = html();
    expect(h).toContain('TAX INVOICE');
    expect(h).toContain('TRN: 100123456700003');
    expect(h).toContain('INV-1');
    expect(h).toContain('AED 1,000.00');
    expect(h).toContain('AED 50.00');
    expect(h).toContain('AED 1,050.00');
  });
  it('flags a missing TRN instead of printing a blank', () => {
    expect(invoiceHtml({ invoice: base, to: { name: 'A' }, company: { name: 'X', address: 'Y' } })).toContain('to be added');
  });
  it('stamps PAID with the date, UNPAID and VOID', () => {
    expect(html({ status: 'paid', paidAt: '2026-10-06T10:00:00Z' })).toMatch(/PAID<\/div>\s*<div[^>]*>Paid 06 Oct 2026/);
    expect(html()).toContain('UNPAID');
    expect(html({ status: 'void' })).toContain('VOID');
  });
  it('keeps Arabic names intact and escapes hostile input', () => {
    expect(html({}, { name: 'محمد الكعبي' })).toContain('محمد الكعبي');
    const h = html({ description: '<script>x</script>' }, { name: '<b>Bob</b>' });
    expect(h).not.toContain('<script>x</script>');
    expect(h).toContain('&lt;b&gt;Bob&lt;/b&gt;');
  });
});

describe('invoice rows', () => {
  // rental 1,050 with VAT after a 100 discount (1,150 before it); full cover with no VAT; a child seat at 5%
  const lines = [
    { description: 'Rental', amount: 1050, discount: 100, vatRate: 0.05 },
    { description: 'Full coverage insurance', amount: 150, vatRate: 0 },
    { description: 'Child seat', amount: 105, vatRate: 0.05 },
  ];
  const withRows = (over = {}) => ({ ...base, amount: 1305, lines, ...over });

  it('takes VAT off each row at its own rate, and the rows add up to the invoice amount', () => {
    const h = invoiceHtml({ invoice: withRows(), to: { name: 'A' }, company });
    expect(h).toContain('AED 1,000.00'); // rental before tax
    expect(h).toContain('AED 100.00'); // rental discount column
    expect(h).toContain('AED 1,150.00'); // rental amount before the discount
    expect(h).toContain('AED 150.00'); // insurance has no VAT, so its net is its total
    expect(h).toContain('AED 100.00'); // child seat net
    expect(h).toContain('AED 1,305.00'); // invoice amount, VAT included
    expect(h).toContain('AED 55.00'); // VAT: 50 on the rental, 5 on the child seat
  });

  it('shows a partial payment and what is still due', () => {
    const h = invoiceHtml({ invoice: withRows({ payments: [{ date: '2026-10-07T10:00:00Z', method: 'Card (Ziina)', category: 'rental', amount: 500 }] }), to: { name: 'A' }, company });
    expect(h).toContain('PART PAID');
    expect(h).toContain('AED 500.00'); // paid
    expect(h).toContain('AED 805.00'); // remaining
    expect(h).toContain('Card (Ziina)');
  });

  it('is PAID once the payments cover the amount', () => {
    const h = invoiceHtml({ invoice: withRows({ payments: [{ date: '2026-10-07T10:00:00Z', method: 'Card (Ziina)', amount: 1305 }] }), to: { name: 'A' }, company });
    expect(h).toContain('PAID');
    expect(h).toContain('AED 0.00'); // remaining
  });

  it('shows the bank details from the company, or "to be added"', () => {
    const h = invoiceHtml({ invoice: base, to: { name: 'A' }, company: { ...company, bank: { iban: 'AE070331234567890123456', bankName: 'Example Bank' } } });
    expect(h).toContain('AE070331234567890123456');
    expect(h).toContain('Example Bank');
    expect(h).toContain('to be added'); // account name is not given
  });

  it('keeps an invoice without rows as one row at the standard rate', () => {
    expect(invoiceRows(base)).toEqual([expect.objectContaining({ total: 1050, net: 1000, vat: 50, discount: 0 })]);
  });
});

describe('the two copies of invoice.ts', () => {
  it('are identical (panel and customer app)', () => {
    const norm = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    expect(norm('apps/customer/src/lib/invoice.ts')).toBe(norm('src/lib/invoice.ts'));
  });
});
