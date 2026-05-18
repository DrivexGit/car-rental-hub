import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Globe, Car, Edit2, Save, X, Loader2 } from 'lucide-react';
import { useTenantId } from '@/hooks/useTenantId';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ModelGroup {
  make: string;
  model: string;
  plate_count: number;
  daily_price: number | null;
  weekly_price: number | null;
  monthly_price: number | null;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function SiteMultipliers() {
  // ── Site multipliers state ─────────────────────────────────────────────────
  const [sites, setSites] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ site_name: '', site_slug: '', price_multiplier: 1.0 });

  // ── Model prices state ─────────────────────────────────────────────────────
  const [modelGroups, setModelGroups] = useState<ModelGroup[]>([]);
  const [isEditingPrices, setIsEditingPrices] = useState(false);
  const [editedModelPrices, setEditedModelPrices] = useState<Record<string, Partial<ModelGroup>>>({});
  const [isSaving, setIsSaving] = useState(false);

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

  /**
   * Read distinct make+model from the vehicles table.
   * For the price columns we take MIN — if all plates of a model share
   * the same price the value will equal that price; if they differ the
   * admin will overwrite them when they save.
   */
  const loadModelGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('make, model, daily_price, weekly_price, monthly_price')
        .order('make')
        .order('model');

      if (error) throw error;

      // Group client-side by make+model
      const map: Record<string, ModelGroup> = {};
      for (const row of data || []) {
        const key = `${row.make}__${row.model}`;
        if (!map[key]) {
          map[key] = {
            make: row.make,
            model: row.model,
            plate_count: 0,
            daily_price: row.daily_price,
            weekly_price: row.weekly_price,
            monthly_price: row.monthly_price,
          };
        } else {
          map[key].plate_count += 1;
          // If prices differ across plates, show null (mixed)
          if (map[key].daily_price !== row.daily_price) map[key].daily_price = null;
          if (map[key].weekly_price !== row.weekly_price) map[key].weekly_price = null;
          if (map[key].monthly_price !== row.monthly_price) map[key].monthly_price = null;
        }
        map[key].plate_count = (map[key].plate_count || 0);
      }

      // Count plates properly
      const countMap: Record<string, number> = {};
      for (const row of data || []) {
        const key = `${row.make}__${row.model}`;
        countMap[key] = (countMap[key] || 0) + 1;
      }
      const groups = Object.values(map).map(g => ({
        ...g,
        plate_count: countMap[`${g.make}__${g.model}`] || 1,
      }));

      setModelGroups(groups);
    } catch (error: any) {
      toast({ title: 'Error loading vehicles', description: error.message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    loadSites();
    loadModelGroups();
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

  // ── Model price inline editing ─────────────────────────────────────────────

  const handleModelPriceChange = (make: string, model: string, field: string, value: string) => {
    const key = `${make}__${model}`;
    const numValue = value === '' ? null : parseFloat(value);
    setEditedModelPrices(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [field]: numValue },
    }));
  };

  const handleSaveModelPrices = async () => {
    const entries = Object.entries(editedModelPrices);
    if (entries.length === 0) {
      setIsEditingPrices(false);
      return;
    }

    setIsSaving(true);
    let totalUpdated = 0;

    try {
      for (const [key, prices] of entries) {
        const [make, model] = key.split('__');
        // Only send fields that were actually changed
        const updateData: Record<string, any> = {};
        if (prices.daily_price !== undefined) updateData.daily_price = prices.daily_price;
        if (prices.weekly_price !== undefined) updateData.weekly_price = prices.weekly_price;
        if (prices.monthly_price !== undefined) updateData.monthly_price = prices.monthly_price;

        if (Object.keys(updateData).length === 0) continue;

        const { count, error } = await supabase
          .from('vehicles')
          .update(updateData)
          .ilike('make', make)
          .ilike('model', model)
          .select('id', { count: 'exact', head: true });

        if (error) throw error;
        totalUpdated += count || 0;
      }

      toast({
        title: 'Prices updated',
        description: `Applied to vehicles matching ${entries.length} model(s).`,
      });
      setEditedModelPrices({});
      setIsEditingPrices(false);
      await loadModelGroups();
    } catch (err: any) {
      toast({ title: 'Error saving prices', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEditPrices = () => {
    setEditedModelPrices({});
    setIsEditingPrices(false);
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
                <TableCell className="text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    {s.site_slug}
                  </span>
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
                <TableCell colSpan={4} className="text-center text-muted-foreground">No sites configured</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      {/* ── Section 2: Model Base Prices (from vehicles table) ── */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Car className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">Model Base Prices</h2>
          </div>

          {!isEditingPrices ? (
            <Button variant="outline" onClick={() => setIsEditingPrices(true)}>
              <Edit2 className="mr-2 h-4 w-4" />
              Edit Prices
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={cancelEditPrices} disabled={isSaving}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleSaveModelPrices} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Changes
              </Button>
            </div>
          )}
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Set daily / weekly / monthly prices by vehicle model. Saving will apply the price to{' '}
          <strong>all license plates</strong> of that model in the database.
          {isEditingPrices && (
            <span className="text-yellow-600 dark:text-yellow-400 ml-1">
              — Edit mode active. Changes will overwrite prices for all plates of each model.
            </span>
          )}
        </p>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Make</TableHead>
              <TableHead>Model</TableHead>
              <TableHead className="text-center">Plates</TableHead>
              <TableHead>Daily (AED)</TableHead>
              <TableHead>Weekly (AED)</TableHead>
              <TableHead>Monthly (AED)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {modelGroups.map(mg => {
              const key = `${mg.make}__${mg.model}`;
              const overrides = editedModelPrices[key] || {};

              const currentDaily   = overrides.daily_price   !== undefined ? overrides.daily_price   : mg.daily_price;
              const currentWeekly  = overrides.weekly_price  !== undefined ? overrides.weekly_price  : mg.weekly_price;
              const currentMonthly = overrides.monthly_price !== undefined ? overrides.monthly_price : mg.monthly_price;

              return (
                <TableRow key={key}>
                  <TableCell className="font-medium">{mg.make}</TableCell>
                  <TableCell>{mg.model}</TableCell>
                  <TableCell className="text-center text-muted-foreground text-sm">{mg.plate_count}</TableCell>

                  {/* Daily */}
                  <TableCell>
                    {isEditingPrices ? (
                      <Input
                        type="number"
                        className="w-24 h-8"
                        defaultValue={mg.daily_price ?? ''}
                        placeholder={mg.daily_price === null ? 'Mixed' : ''}
                        onChange={e => handleModelPriceChange(mg.make, mg.model, 'daily_price', e.target.value)}
                      />
                    ) : (
                      <span className="font-medium">
                        {mg.daily_price != null ? `${mg.daily_price.toLocaleString()} AED` : <span className="text-muted-foreground text-xs">Mixed</span>}
                      </span>
                    )}
                  </TableCell>

                  {/* Weekly */}
                  <TableCell>
                    {isEditingPrices ? (
                      <Input
                        type="number"
                        className="w-24 h-8"
                        defaultValue={mg.weekly_price ?? ''}
                        placeholder={mg.weekly_price === null ? 'Mixed' : ''}
                        onChange={e => handleModelPriceChange(mg.make, mg.model, 'weekly_price', e.target.value)}
                      />
                    ) : (
                      <span className="font-medium">
                        {mg.weekly_price != null ? `${mg.weekly_price.toLocaleString()} AED` : <span className="text-muted-foreground text-xs">Mixed</span>}
                      </span>
                    )}
                  </TableCell>

                  {/* Monthly */}
                  <TableCell>
                    {isEditingPrices ? (
                      <Input
                        type="number"
                        className="w-24 h-8"
                        defaultValue={mg.monthly_price ?? ''}
                        placeholder={mg.monthly_price === null ? 'Mixed' : ''}
                        onChange={e => handleModelPriceChange(mg.make, mg.model, 'monthly_price', e.target.value)}
                      />
                    ) : (
                      <span className="font-medium">
                        {mg.monthly_price != null ? `${mg.monthly_price.toLocaleString()} AED` : <span className="text-muted-foreground text-xs">Mixed</span>}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {modelGroups.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No vehicles found
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
    </div>
  );
}
