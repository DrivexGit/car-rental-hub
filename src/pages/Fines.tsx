import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantId } from '@/hooks/useTenantId';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CustomerSelect, ReservationSelect } from '@/components/CustomerSelect';
import { aed, fdate } from '@/lib/format';
import { Paperclip, Plus, Trash2 } from 'lucide-react';

// The kinds of charge staff can add. The title is what the customer sees in the app; "Other" lets staff type their own.
const KINDS = [
  { type: 'salik', title: 'Salik', amount: '4' },
  { type: 'salik_parking', title: 'Salik Parking', amount: '' },
  { type: 'traffic', title: 'Traffic fine', amount: '' },
  { type: 'damage', title: 'Car damage', amount: '' },
  { type: 'other', title: 'Other', amount: '' },
] as const;
type Kind = (typeof KINDS)[number]['type'];

const kindTitle = (type: string) => KINDS.find((k) => k.type === type)?.title ?? type;
const BUCKET = 'fine-attachments'; // private; staff only (see the migration)

const blank = () => ({
  customer_id: '', reservation_id: '', type: 'salik' as Kind, title: '', amount: '4', location: '',
  occurred_at: new Date().toISOString().slice(0, 16), invoice: true, file: null as File | null,
});

export default function Fines() {
  const [rows, setRows] = useState<any[]>([]);
  const [type, setType] = useState('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);
  const tenantId = useTenantId();
  const { toast } = useToast();

  const load = async () => {
    let q = supabase.from('fines' as any).select('*, customers(full_name, phone), reservations(vehicles(make, model, plate_number)), invoices(number, status)').order('occurred_at', { ascending: false });
    if (type !== 'all') q = q.eq('type', type);
    const { data } = await q;
    setRows((data as any) || []);
  };
  useEffect(() => { load(); }, [type]);

  const pickKind = (k: (typeof KINDS)[number]) => setForm({ ...form, type: k.type, title: k.title, amount: k.amount });

  const create = async () => {
    const amount = Number(form.amount);
    const title = (form.type === 'other' ? form.title : kindTitle(form.type)).trim();
    if (!form.customer_id || !(amount >= 0) || !title) { toast({ title: 'Customer, title and amount are required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      let attachment_path: string | null = null;
      if (form.file) {
        const path = `${tenantId}/${crypto.randomUUID()}-${form.file.name.replace(/[^\w.-]+/g, '_')}`;
        const { error: upError } = await supabase.storage.from(BUCKET).upload(path, form.file, { contentType: form.file.type || undefined });
        if (upError) throw upError;
        attachment_path = path;
      }
      const label = `${title}${form.location ? ` — ${form.location}` : ''}`;
      let invoice_id: string | null = null;
      if (form.invoice && amount > 0) {
        const { data, error } = await supabase.from('invoices' as any).insert({ tenant_id: tenantId, customer_id: form.customer_id, reservation_id: form.reservation_id || null, amount, description: label }).select('id').single();
        if (error) throw error;
        invoice_id = (data as any).id;
      }
      const { error } = await supabase.from('fines' as any).insert({
        tenant_id: tenantId, customer_id: form.customer_id, reservation_id: form.reservation_id || null, type: form.type, title, amount,
        location: form.location || null, occurred_at: new Date(form.occurred_at).toISOString(), invoice_id, attachment_path,
      });
      if (error) throw error;
      toast({ title: `${title} added`, description: 'The customer sees it in the app.' });
      setOpen(false); setForm(blank()); load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openAttachment = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
    if (error || !data) { toast({ title: 'Could not open the attachment', variant: 'destructive' }); return; }
    window.open(data.signedUrl, '_blank');
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this record?')) return;
    await supabase.from('fines' as any).delete().eq('id', id);
    load();
  };

  const sum = rows.reduce((a, r) => a + Number(r.amount), 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Fines &amp; Salik</h1>
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Add</Button>
      </div>
      <div className="mb-4 flex items-center gap-3">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {KINDS.map((k) => <SelectItem key={k.type} value={k.type}>{k.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{rows.length} records · {aed(sum)}</span>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Customer</TableHead><TableHead>Car</TableHead><TableHead>Location</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Invoice</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-xs">{fdate(r.occurred_at)}</TableCell>
              <TableCell><Badge variant={r.type === 'salik' || r.type === 'salik_parking' ? 'secondary' : 'destructive'}>{r.title || kindTitle(r.type)}</Badge></TableCell>
              <TableCell className="text-sm">{r.customers?.full_name}<div className="text-xs text-muted-foreground">{r.customers?.phone}</div></TableCell>
              <TableCell className="text-xs">{r.reservations?.vehicles ? `${r.reservations.vehicles.make} ${r.reservations.vehicles.model} · ${r.reservations.vehicles.plate_number}` : '—'}</TableCell>
              <TableCell className="text-sm">{r.location || '—'}</TableCell>
              <TableCell className="text-right font-medium">{aed(r.amount)}</TableCell>
              <TableCell className="text-xs">{r.invoices ? `${r.invoices.number} (${r.invoices.status === 'pending' ? 'unpaid' : r.invoices.status})` : '—'}</TableCell>
              <TableCell className="flex items-center gap-1">
                {r.attachment_path && <Button size="icon" variant="ghost" aria-label="Open attachment" onClick={() => openAttachment(r.attachment_path)}><Paperclip className="h-4 w-4" /></Button>}
                <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
              </TableCell>
            </TableRow>
          ))}
          {!rows.length && <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">No fines or Salik yet</TableCell></TableRow>}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add a charge</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {KINDS.map((k) => (
                <Button key={k.type} type="button" variant={form.type === k.type ? 'default' : 'outline'} onClick={() => pickKind(k)}>{k.title}</Button>
              ))}
            </div>
            {form.type === 'other' && <div><Label>Title *</Label><Input placeholder="e.g. Key replacement" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>}
            <div><Label>Customer *</Label><CustomerSelect value={form.customer_id} onChange={(v) => setForm({ ...form, customer_id: v, reservation_id: '' })} /></div>
            <div><Label>Booking</Label><ReservationSelect customerId={form.customer_id} value={form.reservation_id} onChange={(v) => setForm({ ...form, reservation_id: v })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Amount (AED) *</Label><Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><Label>Date &amp; time</Label><Input type="datetime-local" value={form.occurred_at} onChange={(e) => setForm({ ...form, occurred_at: e.target.value })} /></div>
            </div>
            <div><Label>{form.type === 'salik' || form.type === 'salik_parking' ? 'Gate or zone' : 'Location / reason'}</Label><Input placeholder={form.type === 'salik' ? 'e.g. Al Barsha' : 'e.g. Sheikh Zayed Rd — speeding'} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div><Label>Attachment (screenshot or PDF)</Label><Input type="file" accept="image/*,application/pdf" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })} /></div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.invoice} onCheckedChange={(v) => setForm({ ...form, invoice: !!v })} /> Create an invoice so the customer can pay it in the app</label>
          </div>
          <DialogFooter><Button onClick={create} disabled={saving}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
