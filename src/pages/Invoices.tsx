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
import { Plus } from 'lucide-react';

const STATUS_STYLE: Record<string, string> = { pending: 'bg-amber-100 text-amber-800', paid: 'bg-emerald-100 text-emerald-800', void: 'bg-muted text-muted-foreground' };

/** Marks an invoice paid outside the app (cash / bank) and confirms its booking if it was waiting. */
export async function markPaidManually(inv: any) {
  await supabase.from('invoices' as any).update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', inv.id);
  await supabase.from('payments' as any).insert({ tenant_id: inv.tenant_id, invoice_id: inv.id, customer_id: inv.customer_id, amount: inv.amount, provider: 'manual', status: 'succeeded' });
  if (inv.reservation_id) await supabase.from('reservations').update({ status: 'confirmed' }).eq('id', inv.reservation_id).eq('status', 'pending');
}

export default function Invoices() {
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customer_id: '', reservation_id: '', amount: '', description: '' });
  const tenantId = useTenantId();
  const { toast } = useToast();

  const load = async () => {
    let query = supabase.from('invoices' as any).select('*, customers(full_name, phone), reservations(vehicles(make, model, plate_number))').order('issued_at', { ascending: false });
    if (status !== 'all') query = query.eq('status', status);
    const { data } = await query;
    setRows((data as any) || []);
  };
  useEffect(() => { load(); }, [status]);

  const create = async () => {
    const amount = Number(form.amount);
    if (!form.customer_id || !(amount > 0) || !form.description.trim()) { toast({ title: 'Customer, amount and description are required', variant: 'destructive' }); return; }
    const { error } = await supabase.from('invoices' as any).insert({ tenant_id: tenantId, customer_id: form.customer_id, reservation_id: form.reservation_id || null, amount, description: form.description.trim() });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Invoice sent to the customer' });
    setOpen(false); setForm({ customer_id: '', reservation_id: '', amount: '', description: '' }); load();
  };

  const filtered = rows.filter((r) => !q || `${r.number} ${r.customers?.full_name} ${r.customers?.phone} ${r.description}`.toLowerCase().includes(q.toLowerCase()));
  const total = (s: string) => rows.filter((r) => r.status === s).reduce((a, r) => a + Number(r.amount), 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />New invoice</Button>
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
                {r.status === 'pending' && <>
                  <Button size="sm" variant="ghost" onClick={async () => { await markPaidManually(r); toast({ title: 'Marked as paid' }); load(); }}>Mark paid</Button>
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
            <div><Label>Amount (AED) *</Label><Input type="number" min="1" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground">The customer gets a notification and can pay it in the app.</p>
          </div>
          <DialogFooter><Button onClick={create}>Create invoice</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
