import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantId } from '@/hooks/useTenantId';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Globe, Car, Zap, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ─── Site Multipliers ───────────────────────────────────────────────────────

export default function SiteMultipliers() {
  const [sites, setSites] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ site_name: '', site_slug: '', price_multiplier: 1.0 });

  // Model prices state
  const [modelPrices, setModelPrices] = useState<any[]>([]);
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<any>(null);
  const [modelForm, setModelForm] = useState({
    make: '',
    model: '',
    daily_price: '' as string | number,
    weekly_price: '' as string | number,
    monthly_price: '' as string | number,
  });
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);
  const [pendingApplyId, setPendingApplyId] = useState<string | null>(null);
  const [pendingApplyLabel, setPendingApplyLabel] = useState('');

  const { toast } = useToast();
  const tenantId = useTenantId();

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadSites = async () => {
    try {
      const { data, error } = await supabase.from('site_settings').select('*').order('created_at');
      if (error) throw error;
      setSites(data || []);
    } catch (error: any) {
      toast({ title: 'Error loading sites', description: error.message, variant: 'destructive' });
    }
  };

  const loadModelPrices = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicle_model_prices')
        .select('*')
        .order('make')
        .order('model');
      if (error) throw error;
      setModelPrices(data || []);
    } catch (error: any) {
      toast({ title: 'Error loading model prices', description: error.message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    loadSites();
    loadModelPrices();
  }, []);

  // ── Site CRUD ──────────────────────────────────────────────────────────────

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

  const saveSite = async () => {
    if (!form.site_name || !form.site_slug) {
      toast({ title: 'Name and Slug (Domain) are required', variant: 'destructive' });
      return;
    }
    const dataToSave = { ...form, price_multiplier: Number(form.price_multiplier) };
    if (editing) {
      await supabase.from('site_settings').update(dataToSave).eq('id', editing.id);
      toast({ title: 'Site settings updated' });
    } else {
      await supabase.from('site_settings').insert({ ...dataToSave, tenant_id: tenantId });
      toast({ title: 'Site settings created' });
    }
    setDialogOpen(false);
    loadSites();
  };

  // ── Model Price CRUD ───────────────────────────────────────────────────────

  const openModelCreate = () => {
    setEditingModel(null);
    setModelForm({ make: '', model: '', daily_price: '', weekly_price: '', monthly_price: '' });
    setModelDialogOpen(true);
  };

  const openModelEdit = (mp: any) => {
    setEditingModel(mp);
    setModelForm({
      make: mp.make,
      model: mp.model,
      daily_price: mp.daily_price ?? '',
      weekly_price: mp.weekly_price ?? '',
      monthly_price: mp.monthly_price ?? '',
    });
    setModelDialogOpen(true);
  };

  const saveModelPrice = async () => {
    if (!modelForm.make || !modelForm.model) {
      toast({ title: 'Make and Model are required', variant: 'destructive' });
      return;
    }

    const dataToSave = {
      make: modelForm.make.trim(),
      model: modelForm.model.trim(),
      daily_price: modelForm.daily_price !== '' ? Number(modelForm.daily_price) : null,
      weekly_price: modelForm.weekly_price !== '' ? Number(modelForm.weekly_price) : null,
      monthly_price: modelForm.monthly_price !== '' ? Number(modelForm.monthly_price) : null,
    };

    if (editingModel) {
      const { error } = await supabase
        .from('vehicle_model_prices')
        .update(dataToSave)
        .eq('id', editingModel.id);
      if (error) {
        toast({ title: 'Error updating', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Model price updated' });
    } else {
      const { error } = await supabase
        .from('vehicle_model_prices')
        .insert({ ...dataToSave, tenant_id: tenantId });
      if (error) {
        toast({ title: 'Error creating', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Model price created' });
    }
    setModelDialogOpen(false);
    loadModelPrices();
  };

  const deleteModelPrice = async (id: string) => {
    const { error } = await supabase.from('vehicle_model_prices').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error deleting', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Model price deleted' });
    loadModelPrices();
  };

  // ── Apply model prices to all matching vehicles ────────────────────────────

  const requestApply = (mp: any) => {
    setPendingApplyId(mp.id);
    setPendingApplyLabel(`${mp.make} ${mp.model}`);
    setConfirmApplyOpen(true);
  };

  const confirmApply = async () => {
    if (!pendingApplyId) return;
    setConfirmApplyOpen(false);
    setApplyingId(pendingApplyId);
    try {
      const { data, error } = await supabase.rpc('apply_model_prices_to_vehicles', {
        p_model_price_id: pendingApplyId,
      });
      if (error) throw error;
      const count = data as number;
      toast({
        title: 'Prices applied',
        description: `Updated ${count} vehicle${count !== 1 ? 's' : ''} matching ${pendingApplyLabel}.`,
      });
    } catch (error: any) {
      toast({ title: 'Error applying prices', description: error.message, variant: 'destructive' });
    } finally {
      setApplyingId(null);
      setPendingApplyId(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-10">

      {/* ── Section 1: Site Multipliers ── */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold">Site Multipliers</h1>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Site
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          A global price multiplier applied when prices are displayed on a specific website domain.
        </p>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Site Name</TableHead>
              <TableHead>Slug / Domain</TableHead>
              <TableHead>Price Multiplier</TableHead>
              <TableHead className="w-[50px]" />
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
                <TableCell>×{s.price_multiplier}</TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {sites.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No sites configured
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      {/* ── Section 2: Vehicle Model Base Prices ── */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Car className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">Vehicle Model Base Prices</h2>
          </div>
          <Button onClick={openModelCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Model Price
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Set base prices (Daily / Weekly / Monthly) per vehicle make &amp; model.
          Click <strong>Apply to All Plates</strong> to push the prices to every vehicle of that model in the database.
        </p>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Make</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Daily (AED)</TableHead>
              <TableHead>Weekly (AED)</TableHead>
              <TableHead>Monthly (AED)</TableHead>
              <TableHead className="w-[180px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {modelPrices.map(mp => (
              <TableRow key={mp.id}>
                <TableCell className="font-medium">{mp.make}</TableCell>
                <TableCell>{mp.model}</TableCell>
                <TableCell>{mp.daily_price != null ? mp.daily_price.toLocaleString() : '—'}</TableCell>
                <TableCell>{mp.weekly_price != null ? mp.weekly_price.toLocaleString() : '—'}</TableCell>
                <TableCell>{mp.monthly_price != null ? mp.monthly_price.toLocaleString() : '—'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => requestApply(mp)}
                      disabled={applyingId === mp.id}
                      title="Apply these prices to all vehicles with this make & model"
                    >
                      <Zap className="mr-1 h-3 w-3" />
                      {applyingId === mp.id ? 'Applying…' : 'Apply to All Plates'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openModelEdit(mp)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteModelPrice(mp.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {modelPrices.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No model prices configured yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      {/* ── Site Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Site' : 'New Site'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Site Name</Label>
              <Input
                value={form.site_name}
                onChange={e => setForm({ ...form, site_name: e.target.value })}
                placeholder="e.g. Drivex"
              />
            </div>
            <div>
              <Label>Slug / Domain</Label>
              <Input
                value={form.site_slug}
                onChange={e => setForm({ ...form, site_slug: e.target.value })}
                placeholder="e.g. drivex.ae"
                disabled={!!editing}
              />
              {editing && (
                <p className="text-xs text-muted-foreground mt-1">Slug cannot be changed after creation.</p>
              )}
            </div>
            <div>
              <Label>Price Multiplier</Label>
              <Input
                type="number"
                step="0.01"
                value={form.price_multiplier}
                onChange={e => setForm({ ...form, price_multiplier: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                e.g. 1.1 for 10% increase, 0.95 for 5% discount.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveSite}>{editing ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Model Price Dialog ── */}
      <Dialog open={modelDialogOpen} onOpenChange={setModelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingModel ? 'Edit Model Price' : 'New Model Price'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Make</Label>
                <Input
                  value={modelForm.make}
                  onChange={e => setModelForm({ ...modelForm, make: e.target.value })}
                  placeholder="e.g. Toyota"
                  disabled={!!editingModel}
                />
              </div>
              <div>
                <Label>Model</Label>
                <Input
                  value={modelForm.model}
                  onChange={e => setModelForm({ ...modelForm, model: e.target.value })}
                  placeholder="e.g. Camry"
                  disabled={!!editingModel}
                />
              </div>
            </div>
            {editingModel && (
              <p className="text-xs text-muted-foreground -mt-1">Make / Model cannot be changed after creation.</p>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Daily (AED)</Label>
                <Input
                  type="number"
                  step="1"
                  value={modelForm.daily_price}
                  onChange={e => setModelForm({ ...modelForm, daily_price: e.target.value })}
                  placeholder="—"
                />
              </div>
              <div>
                <Label>Weekly (AED)</Label>
                <Input
                  type="number"
                  step="1"
                  value={modelForm.weekly_price}
                  onChange={e => setModelForm({ ...modelForm, weekly_price: e.target.value })}
                  placeholder="—"
                />
              </div>
              <div>
                <Label>Monthly (AED)</Label>
                <Input
                  type="number"
                  step="1"
                  value={modelForm.monthly_price}
                  onChange={e => setModelForm({ ...modelForm, monthly_price: e.target.value })}
                  placeholder="—"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Leave a field empty to keep existing vehicle prices unchanged when applying.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={saveModelPrice}>{editingModel ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Apply Dialog ── */}
      <AlertDialog open={confirmApplyOpen} onOpenChange={setConfirmApplyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply prices to all plates?</AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite the daily / weekly / monthly prices for <strong>every vehicle</strong> with
              make &amp; model matching <strong>{pendingApplyLabel}</strong> in the database. This action cannot
              be undone automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmApply}>Yes, Apply</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
