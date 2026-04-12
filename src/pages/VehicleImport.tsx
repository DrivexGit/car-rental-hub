import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantId } from '@/hooks/useTenantId';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Upload } from 'lucide-react';

interface ParsedRow {
  source_row_number?: number;
  plate_number: string;
  make: string;
  model: string;
  year?: number;
  color?: string;
  categories_raw?: string;
  categories?: string[];
  current_location?: string;
  status: string;
  expected_return_date?: string;
  upcoming_reservations_raw?: string;
  latest_return_date?: string;
  odometer?: number;
  chassis_number?: string;
}

const COLUMN_MAP: Record<string, keyof ParsedRow> = {
  '#': 'source_row_number',
  'Plate Number': 'plate_number',
  'Make': 'make',
  'Model': 'model',
  'Year': 'year',
  'Color': 'color',
  'Categories': 'categories_raw',
  'Current Location': 'current_location',
  'Status': 'status',
  'Expected Return Date': 'expected_return_date',
  'Upcoming Reservations': 'upcoming_reservations_raw',
  'Latest Return Date': 'latest_return_date',
  'Odometer': 'odometer',
  'Chassis Number': 'chassis_number',
};

export default function VehicleImport() {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [result, setResult] = useState<{ inserted: number; updated: number; skipped: number; failed: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const tenantId = useTenantId();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
      const mapped: ParsedRow[] = raw.filter(r => Object.values(r).some(v => v != null && v !== '')).map(r => {
        const out: any = {};
        for (const [excelCol, dbCol] of Object.entries(COLUMN_MAP)) {
          if (r[excelCol] !== undefined) out[dbCol] = r[excelCol];
        }
        if (out.status) out.status = String(out.status).toLowerCase().trim();
        if (!['available', 'booked', 'maintenance', 'unavailable'].includes(out.status)) out.status = 'available';
        if (out.categories_raw) out.categories = String(out.categories_raw).split(',').map((s: string) => s.trim()).filter(Boolean);
        if (out.year) out.year = Number(out.year) || undefined;
        if (out.odometer) out.odometer = Number(out.odometer) || undefined;
        return out as ParsedRow;
      }).filter(r => r.plate_number && r.make && r.model);
      setRows(mapped);
      setResult(null);
    };
    reader.readAsBinaryString(file);
  };

  const doImport = async () => {
    if (!tenantId) { toast({ title: 'No tenant assigned', variant: 'destructive' }); return; }
    setImporting(true);
    let inserted = 0, updated = 0, skipped = 0, failed = 0;
    for (const row of rows) {
      try {
        const { data: existing } = await supabase.from('vehicles').select('id').eq('plate_number', row.plate_number).maybeSingle();
        if (existing) {
          const { error } = await supabase.from('vehicles').update(row).eq('id', existing.id);
          if (error) failed++; else updated++;
        } else {
          const { error } = await supabase.from('vehicles').insert({ ...row, tenant_id: tenantId });
          if (error) failed++; else inserted++;
        }
      } catch { failed++; }
    }
    setResult({ inserted, updated, skipped, failed });
    setImporting(false);
    toast({ title: 'Import complete', description: `${inserted} inserted, ${updated} updated, ${failed} failed` });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/vehicles')}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-semibold">Import Vehicles</h1>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm">Upload Excel or CSV</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="block" />
          <p className="text-xs text-muted-foreground">Expected columns: #, Plate Number, Make, Model, Year, Color, Categories, Current Location, Status, Expected Return Date, Upcoming Reservations, Latest Return Date, Odometer, Chassis Number</p>
        </CardContent>
      </Card>
      {rows.length > 0 && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Preview ({rows.length} rows)</CardTitle>
              <Button onClick={doImport} disabled={importing}><Upload className="mr-2 h-4 w-4" />{importing ? 'Importing…' : 'Import All'}</Button>
            </CardHeader>
            <CardContent className="overflow-auto max-h-96">
              <Table>
                <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Plate</TableHead><TableHead>Make</TableHead><TableHead>Model</TableHead><TableHead>Year</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.slice(0, 50).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.source_row_number || i + 1}</TableCell>
                      <TableCell className="font-mono">{r.plate_number}</TableCell>
                      <TableCell>{r.make}</TableCell><TableCell>{r.model}</TableCell>
                      <TableCell>{r.year || '—'}</TableCell><TableCell>{r.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {result && (
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div><div className="text-2xl font-bold text-green-600">{result.inserted}</div><p className="text-xs text-muted-foreground">Inserted</p></div>
                  <div><div className="text-2xl font-bold text-blue-600">{result.updated}</div><p className="text-xs text-muted-foreground">Updated</p></div>
                  <div><div className="text-2xl font-bold text-yellow-600">{result.skipped}</div><p className="text-xs text-muted-foreground">Skipped</p></div>
                  <div><div className="text-2xl font-bold text-red-600">{result.failed}</div><p className="text-xs text-muted-foreground">Failed</p></div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
