import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VERIFICATION_STATUSES } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';

export default function Documents() {
  const [docs, setDocs] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const { toast } = useToast();

  const load = async () => {
    let q = supabase.from('customer_documents').select('*, leads(full_name, whatsapp_number)').order('created_at', { ascending: false });
    if (filter !== 'all') q = q.eq('verification_status', filter);
    const { data } = await q;
    setDocs(data || []);
  };

  useEffect(() => { load(); }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('customer_documents').update({ verification_status: status }).eq('id', id);
    toast({ title: `Document ${status}` });
    load();
  };

  const getDocUrl = async (doc: any) => {
    const { data } = await supabase.storage.from(doc.storage_bucket).createSignedUrl(doc.storage_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Customer Documents</h1>
      <div className="mb-4">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {VERIFICATION_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lead</TableHead><TableHead>Type</TableHead><TableHead>File</TableHead>
            <TableHead>Status</TableHead><TableHead>Uploaded</TableHead><TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {docs.map(d => (
            <TableRow key={d.id}>
              <TableCell className="text-sm">{(d.leads as any)?.full_name || (d.leads as any)?.whatsapp_number}</TableCell>
              <TableCell><Badge variant="outline">{d.document_type}</Badge></TableCell>
              <TableCell className="text-sm cursor-pointer text-primary hover:underline" onClick={() => getDocUrl(d)}>{d.file_name}</TableCell>
              <TableCell>
                <Select value={d.verification_status} onValueChange={v => updateStatus(d.id, v)}>
                  <SelectTrigger className="w-28 h-7"><SelectValue /></SelectTrigger>
                  <SelectContent>{VERIFICATION_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</TableCell>
              <TableCell></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
