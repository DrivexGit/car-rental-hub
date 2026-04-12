import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { VEHICLE_STATUSES } from '@/lib/constants';
import { Upload } from 'lucide-react';

export default function Vehicles() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      let q = supabase.from('vehicles').select('*').order('created_at', { ascending: false });
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      const { data, error } = await q;
      if (error) console.error("Error fetching vehicles:", error);
      console.log("Fetched vehicles:", data?.length);
      setVehicles(data || []);
    };
    load();
  }, [statusFilter]);

  const filtered = vehicles.filter(v => {
    const s = search.toLowerCase();
    const plate = String(v.plate_number || '').toLowerCase();
    const make = String(v.make || '').toLowerCase();
    const model = String(v.model || '').toLowerCase();
    return plate.includes(s) || make.includes(s) || model.includes(s);
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">Vehicles (Total: {vehicles.length}, Filtered: {filtered.length})</h1>
        <Button onClick={() => navigate('/vehicles/import')}><Upload className="mr-2 h-4 w-4" />Import</Button>
      </div>
      <div className="flex gap-3 mb-4">
        <Input placeholder="Search plate, make, model…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {VEHICLE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Plate</TableHead>
            <TableHead>Make</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Year</TableHead>
            <TableHead>Color</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Location</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map(v => (
            <TableRow key={v.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/vehicles/${v.id}`)}>
              <TableCell className="font-mono">{v.plate_number}</TableCell>
              <TableCell>{v.make}</TableCell>
              <TableCell>{v.model}</TableCell>
              <TableCell>{v.year || '—'}</TableCell>
              <TableCell>{v.color || '—'}</TableCell>
              <TableCell><Badge variant={v.status === 'available' ? 'default' : 'secondary'}>{v.status}</Badge></TableCell>
              <TableCell>{v.current_location || '—'}</TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No vehicles found</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
