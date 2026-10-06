import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantId } from '@/hooks/useTenantId';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pencil, Plus, Trash2 } from 'lucide-react';

type Offer = { id?: string; kind: 'car' | 'partner'; title: string; subtitle: string; discount_pct: number | string; image_url: string; description: string; terms: string; location: string; redeem_code: string; is_active: boolean; sort_order: number };
const blank = (kind: Offer['kind'] = 'car'): Offer => ({ kind, title: '', subtitle: kind === 'partner' ? 'Dining' : '', discount_pct: 10, image_url: '', description: '', terms: '', location: '', redeem_code: '', is_active: true, sort_order: 0 });

/** Car discounts (applied automatically to app bookings) and partner benefits shown in the customer app. */
export default function Offers() {
  const [rows, setRows] = useState<any[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [edit, setEdit] = useState<Offer | null>(null);
  const tenantId = useTenantId();
  const { toast } = useToast();

  const [codes, setCodes] = useState<any[]>([]);
  const [redeem, setRedeem] = useState('');
  const load = async () => {
    const [{ data }, c] = await Promise.all([
      supabase.from('offers' as any).select('*').order('kind').order('sort_order'),
      supabase.from('offer_codes' as any).select('offer_id, code, uses, last_used_at, customers(full_name, phone)').order('uses', { ascending: false }),
    ]);
    setRows((data as any) || []);
    setCodes((c.data as any) || []);
  };
  // Venue reported a customer's personal code → count one use.
  const recordUse = async () => {
    const code = redeem.trim().toUpperCase();
    if (!code) return;
    const { data, error } = await supabase.rpc('redeem_offer_code' as any, { p_code: code });
    const row = (data as any)?.[0];
    if (error || !row) { toast({ title: 'Code not found', description: error?.message ?? code, variant: 'destructive' }); return; }
    toast({ title: `Use recorded — ${row.offer_title}`, description: `${row.customer_name} · ${row.customer_phone} · ${row.uses} use(s) in total` });
    setRedeem(''); load();
  };
  const stats = (offerId: string) => {
    const list = codes.filter((c) => c.offer_id === offerId);
    return { count: list.length, uses: list.reduce((n, c) => n + c.uses, 0) };
  };
  useEffect(() => {
    load();
    supabase.from('vehicles').select('make, model').eq('is_active', true).then(({ data }) =>
      setModels(Array.from(new Set((data || []).map((v) => `${v.make} ${v.model}`))).sort()));
  }, []);

  const save = async () => {
    if (!edit) return;
    const pct = Number(edit.discount_pct);
    if (!edit.title.trim() || !(pct >= 1 && pct <= 90)) { toast({ title: 'Title and a discount between 1–90% are required', variant: 'destructive' }); return; }
    const row = { ...edit, discount_pct: pct, tenant_id: tenantId, subtitle: edit.subtitle || null, image_url: edit.image_url || null, description: edit.description || null, terms: edit.terms || null, location: edit.location || null, redeem_code: edit.redeem_code || null };
    const { error } = edit.id ? await supabase.from('offers' as any).update(row).eq('id', edit.id) : await supabase.from('offers' as any).insert(row);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Offer saved' }); setEdit(null); load();
  };

  const set = (p: Partial<Offer>) => setEdit((e) => (e ? { ...e, ...p } : e));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Offers</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEdit(blank('partner'))}><Plus className="mr-2 h-4 w-4" />Partner benefit</Button>
          <Button onClick={() => setEdit(blank('car'))}><Plus className="mr-2 h-4 w-4" />Car discount</Button>
        </div>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">Car discounts are shown on the app home screen and applied automatically when a customer books that model. Partner benefits give every customer their own personal code (base code + 5 characters) to show at the venue.</p>
      <div className="mb-4 flex max-w-md gap-2">
        <Input placeholder="Customer's code, e.g. DRIVEX45-F8E95" value={redeem} onChange={(e) => setRedeem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && recordUse()} className="font-mono" />
        <Button onClick={recordUse} disabled={!redeem.trim()}>Record use</Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Title</TableHead><TableHead>Discount</TableHead><TableHead>Base code</TableHead><TableHead>Customer codes</TableHead><TableHead>Active</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell><Badge variant={r.kind === 'car' ? 'default' : 'secondary'}>{r.kind === 'car' ? 'Car' : 'Partner'}</Badge></TableCell>
              <TableCell className="font-medium">{r.title}<div className="text-xs text-muted-foreground">{r.subtitle}</div></TableCell>
              <TableCell>{r.discount_pct}%</TableCell>
              <TableCell className="font-mono text-xs">{r.redeem_code || '—'}</TableCell>
              <TableCell className="text-xs">{r.kind === 'partner' ? (() => { const s = stats(r.id); return <span title={codes.filter((c) => c.offer_id === r.id).map((c) => `${c.code} · ${c.customers?.full_name ?? ''} · ${c.uses}`).join('\n')}>{s.count} codes · <b>{s.uses} uses</b></span>; })() : '—'}</TableCell>
              <TableCell><Switch checked={r.is_active} onCheckedChange={async (v) => { await supabase.from('offers' as any).update({ is_active: v }).eq('id', r.id); load(); }} /></TableCell>
              <TableCell className="whitespace-nowrap text-right">
                <Button size="icon" variant="ghost" onClick={() => setEdit({ ...blank(r.kind), ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? ''])) } as Offer)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={async () => { if (confirm('Delete this offer?')) { await supabase.from('offers' as any).delete().eq('id', r.id); load(); } }}><Trash2 className="h-4 w-4" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? 'Edit' : 'New'} {edit?.kind === 'car' ? 'car discount' : 'partner benefit'}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              {edit.kind === 'car' ? (
                <div><Label>Car model *</Label>
                  <Select value={edit.title} onValueChange={(v) => set({ title: v })}>
                    <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                    <SelectContent>{models.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Name *</Label><Input value={edit.title} onChange={(e) => set({ title: e.target.value })} /></div>
                    <div><Label>Category</Label><Input placeholder="Dining" value={edit.subtitle} onChange={(e) => set({ subtitle: e.target.value })} /></div>
                  </div>
                  <div><Label>Location</Label><Input placeholder="e.g. DIFC, Dubai" value={edit.location} onChange={(e) => set({ location: e.target.value })} /></div>
                  <div><Label>Description</Label><Textarea rows={2} value={edit.description} onChange={(e) => set({ description: e.target.value })} /></div>
                  <div><Label>Terms</Label><Textarea rows={2} value={edit.terms} onChange={(e) => set({ terms: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Code to show</Label><Input value={edit.redeem_code} onChange={(e) => set({ redeem_code: e.target.value.toUpperCase() })} /></div>
                    <div><Label>Image URL</Label><Input placeholder="https://…" value={edit.image_url} onChange={(e) => set({ image_url: e.target.value })} /></div>
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Discount % *</Label><Input type="number" min="1" max="90" value={edit.discount_pct} onChange={(e) => set({ discount_pct: e.target.value })} /></div>
                <div><Label>Order</Label><Input type="number" value={edit.sort_order} onChange={(e) => set({ sort_order: Number(e.target.value) })} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={edit.is_active} onCheckedChange={(v) => set({ is_active: v })} /> Active</label>
            </div>
          )}
          <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
