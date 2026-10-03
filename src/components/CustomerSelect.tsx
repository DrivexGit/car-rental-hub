import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type CustomerRow = { id: string; full_name: string; phone: string };

/** App customer picker + (optional) their reservations. */
export function CustomerSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  useEffect(() => { supabase.from('customers' as any).select('id, full_name, phone').order('full_name').then(({ data }) => setRows((data as any) || [])); }, []);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
      <SelectContent>{rows.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name} · {c.phone}</SelectItem>)}</SelectContent>
    </Select>
  );
}

export function ReservationSelect({ customerId, value, onChange }: { customerId: string; value: string; onChange: (id: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    if (!customerId) { setRows([]); return; }
    supabase.from('reservations').select('id, start_datetime, end_datetime, vehicles(make, model, plate_number)').eq('customer_id' as any, customerId).order('start_datetime', { ascending: false })
      .then(({ data }) => setRows((data as any) || []));
  }, [customerId]);
  return (
    <Select value={value || 'none'} onValueChange={(v) => onChange(v === 'none' ? '' : v)} disabled={!customerId}>
      <SelectTrigger><SelectValue placeholder="Booking (optional)" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No booking</SelectItem>
        {rows.map((r) => <SelectItem key={r.id} value={r.id}>{r.vehicles?.make} {r.vehicles?.model} · {r.vehicles?.plate_number} · {new Date(r.start_datetime).toLocaleDateString('en-GB')}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
