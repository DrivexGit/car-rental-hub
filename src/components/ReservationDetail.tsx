import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RESERVATION_STATUSES } from '@/lib/constants';
import { aed, fdate, fdatetime } from '@/lib/format';
import { markPaidManually } from '@/pages/Invoices';
import { useToast } from '@/hooks/use-toast';

const EXTRA_LABEL: Record<string, string> = { full_cover: 'Full insurance cover', extra_driver: 'Additional driver', child_seat: 'Child seat' };

/** Everything about one booking: customer, car, dates, money (invoices + payments), fines. */
export function ReservationDetail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const [d, setD] = useState<any>(null);
  const { toast } = useToast();
  const load = async () => {
    const [r, i, p, f] = await Promise.all([
      supabase.from('reservations').select('*, vehicles(make, model, year, color, plate_number), leads(full_name, whatsapp_number), customers(full_name, phone, email)' as any).eq('id', id).single(),
      supabase.from('invoices' as any).select('*').eq('reservation_id', id).order('issued_at'),
      supabase.from('payments' as any).select('*, invoices!inner(reservation_id)').eq('invoices.reservation_id', id).order('created_at'),
      supabase.from('fines' as any).select('*').eq('reservation_id', id).order('occurred_at'),
    ]);
    setD({ r: r.data, i: i.data || [], p: p.data || [], f: f.data || [] });
  };
  useEffect(() => { load(); }, [id]);
  if (!d?.r) return <p className="text-muted-foreground">Loading…</p>;
  const { r } = d;
  const cust = r.customers || { full_name: r.leads?.full_name || r.customer_name_snapshot, phone: r.customer_phone_snapshot || r.leads?.whatsapp_number };
  const billed = d.i.filter((x: any) => x.status !== 'void').reduce((a: number, x: any) => a + Number(x.amount), 0);
  const paid = d.i.filter((x: any) => x.status === 'paid').reduce((a: number, x: any) => a + Number(x.amount), 0);
  const days = Math.round((new Date(r.end_datetime).getTime() - new Date(r.start_datetime).getTime()) / 86400000);

  const setStatus = async (status: string) => {
    await supabase.from('reservations').update({ status }).eq('id', id);
    toast({ title: `Status: ${status}` }); load(); onChanged();
  };

  return (
    <div className="space-y-6">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">{r.vehicles?.make} {r.vehicles?.model} <Badge variant="outline">{r.source === 'app' ? 'App' : r.source}</Badge></SheetTitle>
      </SheetHeader>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Info label="Customer" value={<>{cust?.full_name || '—'}{cust?.phone && <a className="block text-xs underline" href={`tel:${cust.phone}`}>{cust.phone}</a>}</>} />
        <Info label="Car" value={<>{r.vehicles?.plate_number}<span className="block text-xs text-muted-foreground">{r.vehicles?.year} · {r.vehicles?.color}</span></>} />
        <Info label="Pickup" value={fdatetime(r.start_datetime)} />
        <Info label="Return" value={fdatetime(r.end_datetime)} />
        <Info label="Plan" value={`${r.rental_period ?? '—'} · ${days} day${days === 1 ? '' : 's'}`} />
        <Info label="Extras" value={(r.extras || []).map((e: string) => EXTRA_LABEL[e] ?? e).join(', ') || 'None'} />
        <Info label="Booking total" value={aed(r.total_amount)} />
        <Info label="Paid / billed" value={<span className={paid < billed ? 'text-amber-700' : 'text-emerald-700'}>{aed(paid)} / {aed(billed)}</span>} />
      </div>
      {r.price_note && <p className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">Price breakdown: {r.price_note}</p>}

      <div className="flex items-center gap-2">
        <span className="text-sm">Status</span>
        <Select value={r.status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{RESERVATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        {r.status === 'confirmed' && new Date(r.end_datetime) < new Date() && <Button size="sm" onClick={() => setStatus('completed')}>Car returned</Button>}
      </div>

      <Section title="Invoices">
        {d.i.map((x: any) => (
          <div key={x.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
            <span>{x.number}<span className="block text-xs text-muted-foreground">{x.description} · {fdate(x.issued_at)}</span></span>
            <span className="flex items-center gap-2">
              {aed(x.amount)}
              <Badge variant={x.status === 'paid' ? 'default' : 'secondary'}>{x.status === 'pending' ? 'unpaid' : x.status}</Badge>
              {x.status === 'pending' && <Button size="sm" variant="outline" onClick={async () => { await markPaidManually(x); load(); onChanged(); }}>Mark paid</Button>}
            </span>
          </div>
        ))}
        {!d.i.length && <p className="text-sm text-muted-foreground">No invoices.</p>}
      </Section>

      <Section title="Payments">
        {d.p.map((x: any) => (
          <div key={x.id} className="flex justify-between rounded-md border p-3 text-sm">
            <span>{x.provider === 'ziina' ? 'Card (Ziina)' : x.provider === 'manual' ? 'Cash / bank (manual)' : 'Test payment'}<span className="block text-xs text-muted-foreground">{fdatetime(x.created_at)}{x.provider_ref ? ` · ${x.provider_ref}` : ''}</span></span>
            <span>{aed(x.amount)} <Badge variant="outline">{x.status}</Badge></span>
          </div>
        ))}
        {!d.p.length && <p className="text-sm text-muted-foreground">No payments.</p>}
      </Section>

      <Section title="Fines & Salik">
        {d.f.map((x: any) => <div key={x.id} className="flex justify-between rounded-md border p-3 text-sm"><span>{x.type === 'salik' ? 'Salik' : 'Fine'} · {x.location}<span className="block text-xs text-muted-foreground">{fdate(x.occurred_at)}</span></span><span>{aed(x.amount)}</span></div>)}
        {!d.f.length && <p className="text-sm text-muted-foreground">None. Add them in Fines &amp; Salik.</p>}
      </Section>

      {r.internal_note && <Section title="Note"><p className="text-sm">{r.internal_note}</p></Section>}
    </div>
  );
}

const Info = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded-md bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><div className="font-medium">{value}</div></div>
);
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div><h3 className="mb-2 text-sm font-semibold">{title}</h3><div className="space-y-2">{children}</div></div>
);
