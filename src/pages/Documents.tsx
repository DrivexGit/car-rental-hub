import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VERIFICATION_STATUSES } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { FileText, Image as ImageIcon, FileArchive, Eye, LayoutGrid, List, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';

export default function Documents() {
  const [docs, setDocs] = useState<any[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const { toast } = useToast();

  const sanitizePath = (path: string) => {
    if (!path) return '';
    return path.startsWith('/') ? path.substring(1) : path;
  };

  const isImage = (doc: any) => {
    if (doc.mime_type?.startsWith('image/')) return true;
    const ext = doc.file_name?.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext || '');
  };

  const load = async () => {
    try {
      let q = supabase.from('customer_documents').select('*, leads(full_name, whatsapp_number)').order('created_at', { ascending: false });
      if (filter !== 'all') q = q.eq('verification_status', filter);
      const { data, error } = await q;
      
      if (error) throw error;
      
      const items = data || [];
      setDocs(items);

      if (items.length > 0) {
        // Group by bucket to handle multiple storage locations
        const buckets = Array.from(new Set(items.map(i => i.storage_bucket || 'customer-documents')));
        const allUrls: Record<string, string> = {};

        for (const bucket of buckets) {
          const bucketItems = items.filter(i => (i.storage_bucket || 'customer-documents') === bucket);
          const paths = bucketItems.map(d => d.storage_path);
          
          const { data: signedData, error: sError } = await supabase.storage.from(bucket).createSignedUrls(paths, 3600);
          
          if (sError) {
            console.error(`Error fetching signed URLs for bucket ${bucket}:`, sError.message);
            continue;
          }

          if (signedData) {
            signedData.forEach((sd: any) => {
              if (sd.signedUrl) {
                const cleanPath = sanitizePath(sd.path);
                allUrls[cleanPath] = sd.signedUrl;
              }
            });
          }
        }
        setSignedUrls(allUrls);
      }
    } catch (err: any) {
      console.error('Error loading documents:', err.message);
      toast({ title: 'Error loading documents', variant: 'destructive' });
    }
  };

  useEffect(() => { load(); }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('customer_documents').update({ verification_status: status }).eq('id', id);
    toast({ title: `Document ${status}` });
    load();
  };

  const getDocUrl = async (doc: any) => {
    const path = sanitizePath(doc.storage_path);
    
    // If we already have a signed URL from batch loading, use it
    if (signedUrls[path]) {
      window.open(signedUrls[path], '_blank');
      return;
    }
    
    try {
      const bucket = doc.storage_bucket || 'customer-documents';
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    } catch (err: any) {
      console.error('Error opening document:', err.message);
      toast({ title: 'Could not open document', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Customer Documents</h1>
        <div className="flex items-center gap-3 bg-muted/30 p-1.5 rounded-lg border">
          <Button 
            variant={viewMode === 'table' ? 'secondary' : 'ghost'} 
            size="sm" 
            onClick={() => setViewMode('table')}
            className="h-8 gap-2"
          >
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Table</span>
          </Button>
          <Button 
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
            size="sm" 
            onClick={() => setViewMode('grid')}
            className="h-8 gap-2"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Grid</span>
          </Button>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48 bg-card"><SelectValue placeholder="Filter by status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {VERIFICATION_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {viewMode === 'table' ? (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-20 py-4 px-6 text-xs uppercase tracking-wider font-semibold">Preview</TableHead>
                <TableHead className="py-4 px-6 text-xs uppercase tracking-wider font-semibold">Lead</TableHead>
                <TableHead className="py-4 px-6 text-xs uppercase tracking-wider font-semibold">Type</TableHead>
                <TableHead className="py-4 px-6 text-xs uppercase tracking-wider font-semibold">File</TableHead>
                <TableHead className="py-4 px-6 text-xs uppercase tracking-wider font-semibold text-center">Status</TableHead>
                <TableHead className="py-4 px-6 text-xs uppercase tracking-wider font-semibold">Uploaded</TableHead>
                <TableHead className="py-4 px-6 text-xs uppercase tracking-wider font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map(d => {
                const docUrl = signedUrls[sanitizePath(d.storage_path)];
                
                return (
                  <TableRow key={d.id} className="hover:bg-muted/10 transition-colors">
                    <TableCell className="py-4 px-6">
                      <div 
                        className="w-12 h-12 rounded-lg border bg-muted/50 overflow-hidden flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all group relative"
                        onClick={() => getDocUrl(d)}
                      >
                        {isImage(d) && docUrl ? (
                          <img src={docUrl} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                        ) : (
                          <div className="text-muted-foreground group-hover:text-primary transition-colors">
                            {d.mime_type?.includes('pdf') || d.file_name?.toLowerCase().endsWith('.pdf') ? <FileText className="w-6 h-6" /> : 
                             d.mime_type?.includes('zip') || d.file_name?.toLowerCase().match(/\.(zip|rar|7z)$/) ? <FileArchive className="w-6 h-6" /> :
                             <ImageIcon className="w-6 h-6" />}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Eye className="w-5 h-5 text-white" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 px-6 font-medium">
                      {(d.leads as any)?.full_name || (d.leads as any)?.whatsapp_number || 'Unknown Lead'}
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <Badge variant="outline" className="capitalize bg-primary/5 border-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold tracking-tight">
                        {d.document_type.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <a 
                        href={docUrl || '#'} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-sm font-medium hover:text-primary hover:underline transition-colors decoration-2 underline-offset-2 flex items-center gap-2 max-w-[240px] truncate"
                        onClick={(e) => {
                          if (!docUrl) {
                            e.preventDefault();
                            getDocUrl(d);
                          }
                        }}
                      >
                        {d.file_name}
                      </a>
                    </TableCell>
                    <TableCell className="py-4 px-6 text-center">
                      <Select value={d.verification_status} onValueChange={v => updateStatus(d.id, v)}>
                        <SelectTrigger className="w-28 h-7 text-[10px] font-bold uppercase tracking-wider bg-card">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VERIFICATION_STATUSES.map(s => <SelectItem key={s} value={s} className="text-[10px] uppercase font-bold">{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="py-4 px-6 text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                      {new Date(d.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="py-4 px-6 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => getDocUrl(d)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {docs.map(d => {
            const docUrl = signedUrls[sanitizePath(d.storage_path)];
            
            return (
              <Card key={d.id} className="group overflow-hidden border-muted-foreground/10 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-card rounded-xl">
                <div 
                  className="aspect-[4/3] bg-muted/40 relative flex items-center justify-center cursor-pointer overflow-hidden border-b"
                  onClick={() => getDocUrl(d)}
                >
                  {isImage(d) && docUrl ? (
                    <img src={docUrl} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  ) : (
                    <div className="text-muted-foreground/50 group-hover:text-primary transition-colors duration-300">
                      {d.mime_type?.includes('pdf') || d.file_name?.toLowerCase().endsWith('.pdf') ? <FileText className="w-16 h-16 opacity-20" /> : 
                       d.mime_type?.includes('zip') || d.file_name?.toLowerCase().match(/\.(zip|rar|7z)$/) ? <FileArchive className="w-16 h-16 opacity-20" /> :
                       <ImageIcon className="w-16 h-16 opacity-20" />}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                    <Button variant="secondary" size="sm" className="w-full gap-2 font-bold uppercase tracking-tighter text-xs">
                      <Eye className="h-4 w-4" /> View Document
                    </Button>
                  </div>
                </div>
                <CardHeader className="p-4 pb-0">
                  <div className="flex justify-between items-start gap-2">
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-primary/5 text-primary border-primary/20 shrink-0">
                      {d.document_type.replace(/_/g, ' ')}
                    </Badge>
                    <Select value={d.verification_status} onValueChange={v => updateStatus(d.id, v)}>
                      <SelectTrigger className="h-6 w-24 text-[9px] uppercase font-black tracking-widest border-muted shadow-none focus:ring-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VERIFICATION_STATUSES.map(s => <SelectItem key={s} value={s} className="text-[10px] uppercase font-bold">{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <h3 className="text-sm font-bold mt-3 line-clamp-1 group-hover:text-primary transition-colors">
                    {(d.leads as any)?.full_name || 'Anonymous Lead'}
                  </h3>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-bold">
                    <span className="truncate flex-1">{d.file_name}</span>
                    <span className="shrink-0">• {new Date(d.created_at).toLocaleDateString()}</span>
                  </div>
                </CardContent>
                <CardFooter className="p-4 pt-0">
                  <Button variant="outline" size="sm" className="w-full h-8 text-[10px] font-black uppercase tracking-widest gap-2 bg-card hover:bg-primary/5 hover:text-primary transition-all" asChild>
                    <a href={docUrl || '#'} target="_blank" rel="noreferrer" onClick={(e) => { if(!docUrl) { e.preventDefault(); getDocUrl(d); } }}>
                      <Download className="h-3 w-3" /> External Link
                    </a>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {docs.length === 0 && (
        <div className="py-24 text-center rounded-2xl border-2 border-dashed flex flex-col items-center justify-center space-y-4 bg-muted/10 grayscale opacity-40">
          <FileText className="h-12 w-12 text-muted-foreground" />
          <div className="space-y-1">
            <h3 className="font-semibold text-lg">No documents found</h3>
            <p className="text-sm text-muted-foreground">Adjust your filters to see more results</p>
          </div>
        </div>
      )}
    </div>
  );
}
