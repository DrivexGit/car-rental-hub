import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { aed, fdate } from '@/lib/format';

const initials = (name?: string) => (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const Face = ({ c, className }: { c: any; className?: string }) => (
  <Avatar className={className}><AvatarImage src={c.avatar_url ?? undefined} alt="" className="object-cover" /><AvatarFallback>{initials(c.full_name)}</AvatarFallback></Avatar>
);

export default function Customers() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [params, setParams] = useSearchParams();
  const openId = params.get('id');

  useEffect(() => {
    supabase.from('customers' as any).select('*, reservations(id, status, total_amount), invoices(amount, status)').order('created_at', { ascending: false })
      .then(({ data }) => setRows((data as any) || []));
  }, []);

  const filtered = rows.filter((r) => !q || `${r.full_name} ${r.phone} ${r.email ?? ''}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">App customers</h1>
      <Input placeholder="Search name, phone, email…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-xs" />
      <Table>
        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Joined</TableHead><TableHead className="text-right">Bookings</TableHead><TableHead className="text-right">Spent</TableHead><TableHead className="text-right">Unpaid</TableHead></TableRow></TableHeader>
        <TableBody>
          {filtered.map((r) => {
            const paid = (r.invoices || []).filter((i: any) => i.status === 'paid').reduce((a: number, i: any) => a + Number(i.amount), 0);
            const unpaid = (r.invoices || []).filter((i: any) => i.status === 'pending').reduce((a: number, i: any) => a + Number(i.amount), 0);
            return (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => setParams({ id: r.id })}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <Face c={r} className="h-9 w-9" />
                    <div>{r.full_name}<div className="text-xs text-muted-foreground">{r.email}</div></div>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{r.phone}</TableCell>
                <TableCell className="text-xs">{fdate(r.created_at)}</TableCell>
                <TableCell className="text-right">{(r.reservations || []).length}</TableCell>
                <TableCell className="text-right">{aed(paid)}</TableCell>
                <TableCell className="text-right">{unpaid ? <span className="font-medium text-amber-700">{aed(unpaid)}</span> : '—'}</TableCell>
              </TableRow>
            );
          })}
          {!filtered.length && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No app customers yet</TableCell></TableRow>}
        </TableBody>
      </Table>
      <Sheet open={!!openId} onOpenChange={(o) => !o && setParams({})}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">{openId && <CustomerDetail id={openId} />}</SheetContent>
      </Sheet>
    </div>
  );
}

function CustomerDetail({ id }: { id: string }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    Promise.all([
      supabase.from('customers' as any).select('*').eq('id', id).single(),
      supabase.from('reservations').select('*, vehicles(make, model, plate_number)').eq('customer_id' as any, id).order('start_datetime', { ascending: false }),
      supabase.from('invoices' as any).select('*').eq('customer_id', id).order('issued_at', { ascending: false }),
      supabase.from('fines' as any).select('*').eq('customer_id', id).order('occurred_at', { ascending: false }),
    ]).then(async ([c, r, i, f]) => {
      const cust: any = c.data;
      const docs = cust?.lead_id ? (await supabase.from('customer_documents').select('*').eq('lead_id', cust.lead_id)).data : [];
      setD({ c: cust, r: r.data || [], i: i.data || [], f: f.data || [], docs: docs || [] });
    });
  }, [id]);
  if (!d?.c) return <p className="text-muted-foreground">Loading…</p>;
  return (
    <div className="space-y-6">
      <SheetHeader><SheetTitle className="flex items-center gap-3"><Face c={d.c} className="h-14 w-14" />{d.c.full_name}</SheetTitle></SheetHeader>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Info label="Phone" value={<a className="underline" href={`tel:${d.c.phone}`}>{d.c.phone}</a>} />
        <Info label="Email" value={d.c.email || '—'} />
        <Info label="Joined" value={fdate(d.c.created_at)} />
        <Info label="WhatsApp" value={<a className="underline" target="_blank" rel="noreferrer" href={`https://wa.me/${d.c.phone.replace(/\D/g, '')}`}>Open chat</a>} />
      </div>
      <Section title={`Bookings (${d.r.length})`}>
        {d.r.map((r: any) => (
          <a key={r.id} href={`/reservations?id=${r.id}`} className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted/40">
            <span>{r.vehicles?.make} {r.vehicles?.model} · {r.vehicles?.plate_number}<span className="block text-xs text-muted-foreground">{fdate(r.start_datetime)} → {fdate(r.end_datetime)}</span></span>
            <span className="text-right"><Badge variant="outline">{r.status}</Badge><span className="block text-xs">{aed(r.total_amount)}</span></span>
          </a>
        ))}
      </Section>
      <Section title={`Invoices (${d.i.length})`}>
        {d.i.map((i: any) => (
          <div key={i.id} className="flex justify-between rounded-md border p-3 text-sm">
            <span>{i.number}<span className="block text-xs text-muted-foreground">{i.description}</span></span>
            <span className="text-right">{aed(i.amount)}<span className={`block text-xs ${i.status === 'pending' ? 'text-amber-700' : 'text-muted-foreground'}`}>{i.status === 'pending' ? 'unpaid' : i.status}</span></span>
          </div>
        ))}
      </Section>
      <Section title={`Fines & Salik (${d.f.length})`}>
        {d.f.map((f: any) => <div key={f.id} className="flex justify-between rounded-md border p-3 text-sm"><span>{f.type === 'salik' ? 'Salik' : 'Fine'} · {f.location}<span className="block text-xs text-muted-foreground">{fdate(f.occurred_at)}</span></span><span>{aed(f.amount)}</span></div>)}
      </Section>
      <Section title={`Documents (${d.docs.length})`}>
        {d.docs.map((x: any) => <div key={x.id} className="flex justify-between rounded-md border p-3 text-sm"><span>{x.document_type.replace('_', ' ')}<span className="block text-xs text-muted-foreground">{x.file_name}</span></span><Badge variant="outline">{x.verification_status}</Badge></div>)}
        {!!d.docs.length && <a href="/documents" className="text-xs underline">Review in Documents</a>}
      </Section>
    </div>
  );
}

const Info = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded-md bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>
);
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div><h3 className="mb-2 text-sm font-semibold">{title}</h3><div className="space-y-2">{children}</div></div>
);
