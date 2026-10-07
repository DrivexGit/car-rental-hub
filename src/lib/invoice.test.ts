import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { esc, invoiceHtml, vatSplit } from './invoice';

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

describe('the two copies of invoice.ts', () => {
  it('are identical (panel and customer app)', () => {
    const norm = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    expect(norm('apps/customer/src/lib/invoice.ts')).toBe(norm('src/lib/invoice.ts'));
  });
});
