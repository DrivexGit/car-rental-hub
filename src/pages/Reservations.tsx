import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantId } from '@/hooks/useTenantId';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { RESERVATION_STATUSES, RESERVATION_TYPES } from '@/lib/constants';
import { Plus } from 'lucide-react';

export default function Reservations() {
  const [reservations, setReservations] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [form, setForm] = useState({ vehicle_id: '', lead_id: '', start_datetime: '', end_datetime: '', status: 'confirmed', reservation_type: 'booking', internal_note: '', pickup_location: '', return_location: '' });
  const { toast } = useToast();
  const tenantId = useTenantId();

  const load = async () => {
    let q = supabase.from('reservations').select('*, vehicles(plate_number, make, model), leads(full_name, whatsapp_number)').order('start_datetime', { ascending: false });
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    const { data } = await q;
    setReservations(data || []);
  };

  useEffect(() => { load(); }, [statusFilter]);

  const openCreate = async () => {
    const [v, l] = await Promise.all([
      supabase.from('vehicles').select('id, plate_number, make, model'),
      supabase.from('leads').select('id, full_name, whatsapp_number'),
    ]);
    setVehicles(v.data || []);
    setLeads(l.data || []);
    setForm({ vehicle_id: '', lead_id: '', start_datetime: '', end_datetime: '', status: 'confirmed', reservation_type: 'booking', internal_note: '', pickup_location: '', return_location: '' });
    setDialogOpen(true);
  };

  const createReservation = async () => {
    if (!form.vehicle_id || !form.start_datetime || !form.end_datetime) { toast({ title: 'Missing fields', variant: 'destructive' }); return; }
    if (!tenantId) { toast({ title: 'No tenant', variant: 'destructive' }); return; }
    const insert: any = { ...form, source: 'manual_admin', tenant_id: tenantId };
    if (!insert.lead_id) delete insert.lead_id;
    const { error } = await supabase.from('reservations').insert(insert);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Reservation created' });
    setDialogOpen(false);
    load();
  };

  const cancelReservation = async (id: string) => {
    await supabase.from('reservations').update({ status: 'cancelled' }).eq('id', id);
    toast({ title: 'Reservation cancelled' });
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">Reservations</h1>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />New Reservation</Button>
      </div>
      <div className="flex gap-3 mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {RESERVATION_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Vehicle</TableHead><TableHead>Customer</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {reservations.map(r => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-sm">{(r.vehicles as any)?.plate_number} {(r.vehicles as any)?.make}</TableCell>
              <TableCell className="text-sm">{(r.leads as any)?.full_name || r.customer_name_snapshot || '—'}</TableCell>
              <TableCell><Badge variant="outline">{r.reservation_type}</Badge></TableCell>
              <TableCell><Badge variant={r.status === 'confirmed' ? 'default' : 'secondary'}>{r.status}</Badge></TableCell>
              <TableCell className="text-xs">{new Date(r.start_datetime).toLocaleDateString()}</TableCell>
              <TableCell className="text-xs">{new Date(r.end_datetime).toLocaleDateString()}</TableCell>
              <TableCell>
                {!['cancelled', 'completed'].includes(r.status) && (
                  <Button size="sm" variant="ghost" onClick={() => cancelReservation(r.id)}>Cancel</Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Reservation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Vehicle *</Label>
              <Select value={form.vehicle_id} onValueChange={v => setForm({ ...form, vehicle_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.plate_number} — {v.make} {v.model}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lead (optional)</Label>
              <Select value={form.lead_id} onValueChange={v => setForm({ ...form, lead_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select lead" /></SelectTrigger>
                <SelectContent>{leads.map(l => <SelectItem key={l.id} value={l.id}>{l.full_name || l.whatsapp_number}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Start *</Label><Input type="datetime-local" value={form.start_datetime} onChange={e => setForm({ ...form, start_datetime: e.target.value })} /></div>
              <div><Label>End *</Label><Input type="datetime-local" value={form.end_datetime} onChange={e => setForm({ ...form, end_datetime: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Type</Label>
                <Select value={form.reservation_type} onValueChange={v => setForm({ ...form, reservation_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RESERVATION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RESERVATION_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Note</Label><Textarea value={form.internal_note} onChange={e => setForm({ ...form, internal_note: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter><Button onClick={createReservation}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
