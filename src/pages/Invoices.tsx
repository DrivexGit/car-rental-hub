import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantId } from '@/hooks/useTenantId';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CustomerSelect, ReservationSelect } from '@/components/CustomerSelect';
import { aed, fdate } from '@/lib/format';
import { Download, Plus, Upload } from 'lucide-react';
import { COMPANY } from '@/lib/company';
import { invoiceHtml } from '@/lib/invoice';
import { downloadInvoicePdf, type InvoiceAttachment } from '@/lib/invoicePdf';

/** How a payment is shown on the invoice's transactions table. */
const PAYMENT_METHOD: Record<string, string> = { ziina: 'Card (Ziina)', stripe: 'Card (Stripe)', manual: 'Cash / bank transfer', test: 'Test payment' };

const STATUS_STYLE: Record<string, string> = { pending: 'bg-amber-100 text-amber-800', paid: 'bg-emerald-100 text-emerald-800', void: 'bg-muted text-muted-foreground' };

/**
 * Marks an invoice paid outside the app (cash / bank) for what is still owed, and confirms its booking if it was waiting.
 * Only a pending invoice counts: the status is changed first, with a condition, so a second click or a second staff member records nothing.
 */
export async function markPaidManually(inv: any): Promise<'paid' | 'nothing-due'> {
  const { data: pays, error: readErr } = await supabase.from('payments' as any).select('amount').eq('invoice_id', inv.id).eq('status', 'succeeded');
  if (readErr) throw readErr;
  const paid = ((pays ?? []) as any[]).reduce((s, p) => s + Number(p.amount), 0);
  const due = Math.round((Number(inv.amount) - paid) * 100) / 100;
  if (due <= 0) return 'nothing-due';
  const now = new Date().toISOString();
  const { data: row, error } = await supabase.from('invoices' as any).update({ status: 'paid', paid_at: now }).eq('id', inv.id).eq('status', 'pending').select('id').maybeSingle();
  if (error) throw error;
  if (!row) return 'nothing-due';
  const { error: payErr } = await supabase.from('payments' as any).insert({ tenant_id: inv.tenant_id, invoice_id: inv.id, customer_id: inv.customer_id, amount: due, provider: 'manual', status: 'succeeded' });
  if (payErr) {
    await supabase.from('invoices' as any).update({ status: 'pending', paid_at: null }).eq('id', inv.id).eq('status', 'paid');
    throw payErr;
  }
  if (inv.reservation_id) await supabase.from('reservations').update({ status: 'confirmed' }).eq('id', inv.reservation_id).eq('status', 'pending');
  // invoices folded into this monthly one are paid with it
  await supabase.from('invoices' as any).update({ status: 'paid', paid_at: now }).eq('consolidated_into', inv.id).eq('status', 'pending');
  return 'paid';
}

/** Saves the tax invoice straight to the device as a PDF file (no print dialog). */
async function downloadInvoice(r: any, onError: (message: string) => void) {
  const v = r.reservations?.vehicles;
  try {
    // an invoice uploaded as a PDF is downloaded as that same file, unchanged
    if (r.file_path) {
      const { data, error } = await supabase.storage.from('invoices').createSignedUrl(r.file_path, 300);
      if (error || !data) throw new Error('Could not open the invoice file');
      const link = document.createElement('a');
      link.href = data.signedUrl; link.download = `${r.number}.pdf`;
      document.body.appendChild(link); link.click(); link.remove();
      return;
    }
    // Salik and fine screenshots that belong to this invoice go after it, one page each
    const { data: fines } = await supabase.from('fines' as any).select('title, attachment_path').eq('invoice_id', r.id).not('attachment_path', 'is', null);
    const attachments: InvoiceAttachment[] = await Promise.all(((fines ?? []) as any[]).map(async (f) => {
      const { data } = await supabase.storage.from('fine-attachments').createSignedUrl(f.attachment_path, 300);
      return { title: f.title || 'Attachment', name: String(f.attachment_path).split('/').pop() || 'file', url: data?.signedUrl ?? '' };
    }));
    // rows (each with its VAT rate), payments so far, and the seller's TRN and bank details from the tenant settings
    const [{ data: items }, { data: pays }, { data: seller }] = await Promise.all([
      supabase.from('invoice_items' as any).select('description, amount, discount, vat_rate, sort').eq('invoice_id', r.id).order('sort'),
      supabase.from('payments' as any).select('amount, provider, category, created_at').eq('invoice_id', r.id).eq('status', 'succeeded').order('created_at'),
      supabase.from('tenants' as any).select('trn, legal_address, bank_account_name, bank_name, iban, bic').eq('id', r.tenant_id).maybeSingle(),
    ]);
    const lines = ((items ?? []) as any[]).map((i) => ({ description: i.description, amount: Number(i.amount), discount: Number(i.discount), vatRate: Number(i.vat_rate) }));
    const payments = ((pays ?? []) as any[]).map((p) => ({ date: p.created_at, method: PAYMENT_METHOD[p.provider] ?? p.provider, category: p.category, amount: Number(p.amount) }));
    const s = seller as any;
    const company = { ...COMPANY, address: s?.legal_address || COMPANY.address, trn: s?.trn || COMPANY.trn, bank: { accountName: s?.bank_account_name, bankName: s?.bank_name, iban: s?.iban, bic: s?.bic } };
    await downloadInvoicePdf(invoiceHtml({
    invoice: { number: r.number, issued: r.issued_at, status: r.status, paidAt: r.paid_at, dueDate: r.due_date, description: r.description, detail: v ? `${v.make} ${v.model} · ${v.plate_number}` : undefined, amount: Number(r.amount), lines, payments },
    to: { name: r.customers?.full_name || 'Customer', phone: r.customers?.phone, email: r.customers?.email, no: r.customers?.customer_no, nationality: r.customers?.nationality },
    company, logoUrl: `${location.origin}/logo-dark.png`,
    }), `${r.number}.pdf`, attachments.filter((x) => x.url));
  } catch (err: any) {
    onError(err?.message || 'Could not create the PDF');
  }
}

export default function Invoices() {
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customer_id: '', reservation_id: '', amount: '', description: '', category: 'other' as 'other' | 'delivery' });
  // an invoice made outside the app: the PDF is uploaded as it is, and the total is typed in, or read from the PDF with the AI ("Read from PDF")
  const [paying, setPaying] = useState<string | null>(null); // the invoice being marked paid, so its button cannot be clicked twice
  const [upload, setUpload] = useState({ open: false, customer_id: '', reservation_id: '', amount: '', description: '', file: null as File | null, busy: false, reading: false });
  const tenantId = useTenantId();
  const { toast } = useToast();

  const load = async () => {
    let query = supabase.from('invoices' as any).select('*, customers(full_name, phone, email, customer_no, nationality), reservations(vehicles(make, model, plate_number))').is('consolidated_into', null).order('issued_at', { ascending: false }); // folded invoices show through their monthly one
    if (status !== 'all') query = query.eq('status', status);
    const { data } = await query;
    setRows((data as any) || []);
  };
  useEffect(() => { load(); }, [status]);

  const create = async () => {
    const amount = Number(form.amount);
    if (!form.customer_id || !(amount > 0) || !form.description.trim()) { toast({ title: 'Customer, amount and description are required', variant: 'destructive' }); return; }
    const description = form.description.trim();
    const { data: inv, error } = await supabase.from('invoices' as any).insert({ tenant_id: tenantId, customer_id: form.customer_id, reservation_id: form.reservation_id || null, amount, description }).select('id').single();
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    // one row, at the standard 5% VAT rate (the panel does not yet split a manual invoice into rows)
    // delivery is sold only on a manual invoice (not in the app); it carries the standard 5% VAT
    const { error: rowError } = await supabase.from('invoice_items' as any).insert({ tenant_id: tenantId, invoice_id: (inv as any).id, sort: 0, description, category: form.category, amount, discount: 0, vat_rate: 0.05 });
    if (rowError) { toast({ title: 'Error', description: rowError.message, variant: 'destructive' }); return; }
    toast({ title: 'Invoice sent to the customer' });
    setOpen(false); setForm({ customer_id: '', reservation_id: '', amount: '', description: '', category: 'other' }); load();
  };

  const markPaid = async (r: any) => {
    if (paying) return;
    setPaying(r.id);
    try {
      const result = await markPaidManually(r);
      toast(result === 'paid' ? { title: 'Marked as paid' } : { title: 'Nothing is left to pay on this invoice' });
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setPaying(null);
    }
  };

  // reads the total from the chosen PDF with the AI; the number is only filled in, staff check it and then send
  const readTotal = async () => {
    if (!upload.file || upload.file.type !== 'application/pdf') { toast({ title: 'Choose the PDF first', variant: 'destructive' }); return; }
    setUpload((u) => ({ ...u, reading: true }));
    try {
      const file64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(upload.file!);
      });
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_CUSTOMER_API_URL || 'https://drivex-customer.vercel.app'}/api/invoice-extract`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: file64 }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not read the invoice');
      setUpload((u) => ({ ...u, amount: String(body.total), reading: false }));
      toast({ title: 'Total read from the PDF', description: 'Check it before you send.' });
    } catch (err: any) {
      toast({ title: 'Could not read the total', description: err.message, variant: 'destructive' });
      setUpload((u) => ({ ...u, reading: false }));
    }
  };

  const uploadPdf = async () => {
    const amount = Number(upload.amount);
    if (!upload.customer_id || !(amount > 0) || !upload.file) { toast({ title: 'Customer, total and the PDF are required', variant: 'destructive' }); return; }
    if (upload.file.type !== 'application/pdf') { toast({ title: 'The invoice must be a PDF file', variant: 'destructive' }); return; }
    setUpload((u) => ({ ...u, busy: true }));
    try {
      const path = `${tenantId}/${crypto.randomUUID()}-${upload.file.name.replace(/[^\w.-]+/g, '_')}`;
      const { error: upError } = await supabase.storage.from('invoices').upload(path, upload.file, { contentType: 'application/pdf' });
      if (upError) throw upError;
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date()); // due the day it is issued
      const { error } = await supabase.from('invoices' as any).insert({
        tenant_id: tenantId, customer_id: upload.customer_id, reservation_id: upload.reservation_id || null, amount,
        description: upload.description.trim() || 'Invoice', file_path: path, source: 'uploaded', due_date: today,
      });
      if (error) throw error;
      toast({ title: 'Invoice uploaded and sent to the customer' });
      setUpload({ open: false, customer_id: '', reservation_id: '', amount: '', description: '', file: null, busy: false, reading: false }); load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setUpload((u) => ({ ...u, busy: false }));
    }
  };

  const filtered = rows.filter((r) => !q || `${r.number} ${r.customers?.full_name} ${r.customers?.phone} ${r.description}`.toLowerCase().includes(q.toLowerCase()));
  const total = (s: string) => rows.filter((r) => r.status === s).reduce((a, r) => a + Number(r.amount), 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setUpload((u) => ({ ...u, open: true }))}><Upload className="mr-2 h-4 w-4" />Upload PDF</Button>
          <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />New invoice</Button>
        </div>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Unpaid</p><p className="text-xl font-semibold text-amber-700">{aed(total('pending'))}</p></div>
        <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Paid</p><p className="text-xl font-semibold text-emerald-700">{aed(total('paid'))}</p></div>
      </div>
      <div className="mb-4 flex gap-3">
        <Input placeholder="Search number, customer…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="pending">Unpaid</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="void">Void</SelectItem></SelectContent>
        </Select>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Customer</TableHead><TableHead>For</TableHead><TableHead>Issued</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {filtered.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-xs">{r.number}</TableCell>
              <TableCell className="text-sm">{r.customers?.full_name}<div className="text-xs text-muted-foreground">{r.customers?.phone}</div></TableCell>
              <TableCell className="text-sm">{r.description}{r.reservations?.vehicles && <div className="text-xs text-muted-foreground">{r.reservations.vehicles.make} {r.reservations.vehicles.model} · {r.reservations.vehicles.plate_number}</div>}</TableCell>
              <TableCell className="text-xs">{fdate(r.issued_at)}{r.paid_at && <div className="text-muted-foreground">paid {fdate(r.paid_at)}</div>}</TableCell>
              <TableCell className="text-right font-medium">{aed(r.amount)}</TableCell>
              <TableCell><Badge className={STATUS_STYLE[r.status]}>{r.status === 'pending' ? 'unpaid' : r.status}</Badge></TableCell>
              <TableCell className="whitespace-nowrap text-right">
                <Button size="sm" variant="ghost" aria-label={`Download invoice ${r.number}`} title="Download invoice (PDF)" onClick={() => downloadInvoice(r, (message) => toast({ title: 'Could not create the PDF', description: message, variant: 'destructive' }))}><Download className="h-4 w-4" /></Button>
                {r.status === 'pending' && <>
                  <Button size="sm" variant="ghost" disabled={paying === r.id} onClick={() => markPaid(r)}>Mark paid</Button>
                  <Button size="sm" variant="ghost" onClick={async () => { await supabase.from('invoices' as any).update({ status: 'void' }).eq('id', r.id); load(); }}>Void</Button>
                </>}
              </TableCell>
            </TableRow>
          ))}
          {!filtered.length && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No invoices</TableCell></TableRow>}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New invoice</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Customer *</Label><CustomerSelect value={form.customer_id} onChange={(v) => setForm({ ...form, customer_id: v, reservation_id: '' })} /></div>
            <div><Label>Booking</Label><ReservationSelect customerId={form.customer_id} value={form.reservation_id} onChange={(v) => setForm({ ...form, reservation_id: v })} /></div>
            <div><Label>Description *</Label><Input placeholder="e.g. Car wash, late return, damage" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Amount (AED, VAT included) *</Label><Input type="number" min="1" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div><Label>Type</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as 'other' | 'delivery' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="other">Other</SelectItem><SelectItem value="delivery">Delivery</SelectItem></SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">The customer gets a notification and can pay it in the app.</p>
          </div>
          <DialogFooter><Button onClick={create}>Create invoice</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={upload.open} onOpenChange={(v) => setUpload((u) => ({ ...u, open: v }))}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Upload an invoice (PDF)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Customer *</Label><CustomerSelect value={upload.customer_id} onChange={(v) => setUpload({ ...upload, customer_id: v, reservation_id: '' })} /></div>
            <div><Label>Booking</Label><ReservationSelect customerId={upload.customer_id} value={upload.reservation_id} onChange={(v) => setUpload({ ...upload, reservation_id: v })} /></div>
            <div><Label>Description</Label><Input placeholder="e.g. Rental, 30 days" value={upload.description} onChange={(e) => setUpload({ ...upload, description: e.target.value })} /></div>
            <div><Label>PDF file *</Label><Input type="file" accept="application/pdf" onChange={(e) => setUpload({ ...upload, file: e.target.files?.[0] ?? null })} /></div>
            <div><Label>Total (AED, VAT included) *</Label>
              <div className="flex gap-2">
                <Input type="number" min="1" step="0.01" value={upload.amount} onChange={(e) => setUpload({ ...upload, amount: e.target.value })} />
                <Button type="button" variant="outline" onClick={readTotal} disabled={!upload.file || upload.reading}>{upload.reading ? 'Reading…' : 'Read from PDF'}</Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">The PDF is kept as it is; the customer sees and downloads the same file. "Read from PDF" fills the total only; check it before you send.</p>
          </div>
          <DialogFooter><Button onClick={uploadPdf} disabled={upload.busy}>Upload and send</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
