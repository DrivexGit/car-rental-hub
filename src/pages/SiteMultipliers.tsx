import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantId } from '@/hooks/useTenantId';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Globe } from 'lucide-react';

export default function SiteMultipliers() {
  const [sites, setSites] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ site_name: '', site_slug: '', price_multiplier: 1.0 });
  const { toast } = useToast();
  const tenantId = useTenantId();

  const load = async () => {
    const { data } = await supabase.from('site_settings').select('*').order('created_at');
    setSites(data || []);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { 
    setEditing(null); 
    setForm({ site_name: '', site_slug: '', price_multiplier: 1.0 }); 
    setDialogOpen(true); 
  };
  
  const openEdit = (s: any) => { 
    setEditing(s); 
    setForm({ site_name: s.site_name, site_slug: s.site_slug, price_multiplier: s.price_multiplier }); 
    setDialogOpen(true); 
  };

  const save = async () => {
    if (!form.site_name || !form.site_slug) { 
      toast({ title: 'Name and Slug (Domain) are required', variant: 'destructive' }); 
      return; 
    }
    
    const dataToSave = {
      ...form,
      price_multiplier: Number(form.price_multiplier)
    };

    if (editing) {
      await supabase.from('site_settings').update(dataToSave).eq('id', editing.id);
      toast({ title: 'Site settings updated' });
    } else {
      await supabase.from('site_settings').insert({ ...dataToSave, tenant_id: tenantId });
      toast({ title: 'Site settings created' });
    }
    setDialogOpen(false);
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">Site Multipliers</h1>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add Site</Button>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Site Name</TableHead>
            <TableHead>Slug / Domain</TableHead>
            <TableHead>Price Multiplier</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sites.map(s => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.site_name}</TableCell>
              <TableCell className="text-sm text-muted-foreground flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {s.site_slug}
              </TableCell>
              <TableCell>{s.price_multiplier}</TableCell>
              <TableCell>
                <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>
                  <Pencil className="h-3 w-3" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Site' : 'New Site'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Site Name</Label>
              <Input value={form.site_name} onChange={e => setForm({ ...form, site_name: e.target.value })} placeholder="e.g. Drivex" />
            </div>
            <div>
              <Label>Slug / Domain</Label>
              <Input value={form.site_slug} onChange={e => setForm({ ...form, site_slug: e.target.value })} placeholder="e.g. drivex.ae" disabled={!!editing} />
              {editing && <p className="text-xs text-muted-foreground mt-1">Slug cannot be changed after creation.</p>}
            </div>
            <div>
              <Label>Price Multiplier</Label>
              <Input type="number" step="0.01" value={form.price_multiplier} onChange={e => setForm({ ...form, price_multiplier: Number(e.target.value) })} />
              <p className="text-xs text-muted-foreground mt-1">e.g. 1.1 for 10% increase, 0.95 for 5% discount.</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save}>{editing ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
