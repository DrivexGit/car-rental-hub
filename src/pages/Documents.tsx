import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VERIFICATION_STATUSES } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { FileText, Image as ImageIcon, FileArchive, Eye } from 'lucide-react';

export default function Documents() {
  const [docs, setDocs] = useState<any[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('all');
  const { toast } = useToast();

  const load = async () => {
    let q = supabase.from('customer_documents').select('*, leads(full_name, whatsapp_number)').order('created_at', { ascending: false });
    if (filter !== 'all') q = q.eq('verification_status', filter);
    const { data } = await q;
    const items = data || [];
    setDocs(items);

    if (items.length > 0) {
      const paths = items.map(d => d.storage_path);
      const { data: signedData } = await supabase.storage.from('customer-documents').createSignedUrls(paths, 3600);
      if (signedData) {
        const urls: Record<string, string> = {};
        signedData.forEach((sd: any) => {
          if (sd.signedUrl) urls[sd.path] = sd.signedUrl;
        });
        setSignedUrls(urls);
      }
    }
  };

  useEffect(() => { load(); }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('customer_documents').update({ verification_status: status }).eq('id', id);
    toast({ title: `Document ${status}` });
    load();
  };

  const getDocUrl = async (doc: any) => {
    // If we already have a signed URL from batch loading, use it
    if (signedUrls[doc.storage_path]) {
      window.open(signedUrls[doc.storage_path], '_blank');
      return;
    }
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
          <TableRow className="bg-muted/30">
            <TableHead className="w-20">Doc</TableHead>
            <TableHead>Lead</TableHead><TableHead>Type</TableHead><TableHead>File</TableHead>
            <TableHead>Status</TableHead><TableHead>Uploaded</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {docs.map(d => (
            <TableRow key={d.id} className="hover:bg-muted/10 transition-colors">
              <TableCell>
                <div 
                  className="w-12 h-12 rounded-lg border bg-muted/50 overflow-hidden flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all group relative"
                  onClick={() => getDocUrl(d)}
                >
                  {signedUrls[d.storage_path] && d.mime_type?.startsWith('image/') ? (
                    <img src={signedUrls[d.storage_path]} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                  ) : (
                    <div className="text-muted-foreground group-hover:text-primary transition-colors">
                      {d.mime_type?.includes('pdf') ? <FileText className="w-6 h-6" /> : 
                       d.mime_type?.includes('zip') || d.mime_type?.includes('rar') ? <FileArchive className="w-6 h-6" /> :
                       <ImageIcon className="w-6 h-6" />}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Eye className="w-5 h-5 text-white" />
                  </div>
                </div>
              </TableCell>
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
              <TableCell className="text-right"></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
