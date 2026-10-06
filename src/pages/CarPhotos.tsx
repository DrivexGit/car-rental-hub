import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ImagePlus, Loader2, Replace, X } from 'lucide-react';

type Model = { tenant_id: string; make: string; model: string; image_url: string | null; gallery: string[] };
const BUCKET = 'vehicle-images';
const slug = (make: string, model: string) => `${make}-${model}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Studio photo + gallery per car model. The customer app shows these on the car cards and car page. */
export default function CarPhotos() {
  const [rows, setRows] = useState<Model[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');
  const { toast } = useToast();

  const load = async () => {
    const { data } = await supabase.from('vehicle_model_specs' as any).select('tenant_id, make, model, image_url, gallery').order('make').order('model');
    setRows((data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const upload = async (m: Model, file: File, kind: 'studio' | 'gallery') => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const path = `models/${slug(m.make, m.model)}/${kind === 'studio' ? `studio-${name}` : `gallery/${name}`}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '31536000', contentType: file.type });
    if (error) throw error;
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  };

  const save = async (m: Model, patch: Partial<Model>) => {
    const { error } = await supabase.from('vehicle_model_specs' as any).update(patch).eq('tenant_id', m.tenant_id).eq('make', m.make).eq('model', m.model);
    if (error) throw error;
    setRows((r) => r.map((x) => (x.make === m.make && x.model === m.model ? { ...x, ...patch } : x)));
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); toast({ title: 'Saved — the app shows it on next open' }); }
    catch (e) { toast({ title: 'Upload failed', description: (e as Error).message, variant: 'destructive' }); }
    finally { setBusy(''); }
  };

  const pick = (multiple: boolean, onFiles: (f: File[]) => void) => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = 'image/*'; i.multiple = multiple;
    i.onchange = () => i.files && onFiles([...i.files]);
    i.click();
  };

  const list = rows.filter((m) => `${m.make} ${m.model}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Car photos</h1>
        <Input placeholder="Search model" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        The studio photo (car on a white or transparent background) is shown on the car cards in the app. Gallery photos appear on the car page.
        Models without a studio photo use the app's built-in image.
      </p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((m) => {
          const key = `${m.make}|${m.model}`;
          return (
            <Card key={key}>
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-semibold">{m.make} {m.model}</p>
                  {busy === key && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
                <div className="relative grid h-36 place-items-center rounded-lg bg-muted/40">
                  {m.image_url ? <img src={m.image_url} alt="" className="h-full w-full object-contain p-2" /> : <span className="text-xs text-muted-foreground">No studio photo</span>}
                  <Button size="sm" variant="secondary" className="absolute bottom-2 right-2" disabled={!!busy}
                    onClick={() => pick(false, ([f]) => run(key, async () => save(m, { image_url: await upload(m, f, 'studio') })))}>
                    <Replace className="mr-1 h-3.5 w-3.5" />{m.image_url ? 'Replace' : 'Upload'}
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.gallery.map((src) => (
                    <div key={src} className="group relative h-14 w-20 overflow-hidden rounded-md bg-muted">
                      <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                      <button aria-label="Remove photo" disabled={!!busy}
                        onClick={() => confirm('Remove this photo from the gallery?') && run(key, () => save(m, { gallery: m.gallery.filter((g) => g !== src) }))}
                        className="absolute right-0.5 top-0.5 hidden rounded-full bg-black/70 p-0.5 text-white group-hover:block"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                  <button disabled={!!busy} aria-label="Add gallery photos"
                    onClick={() => pick(true, (files) => run(key, async () => { const urls = []; for (const f of files) urls.push(await upload(m, f, 'gallery')); await save(m, { gallery: [...m.gallery, ...urls] }); }))}
                    className="grid h-14 w-20 place-items-center rounded-md border border-dashed text-muted-foreground hover:bg-muted/50"><ImagePlus className="h-5 w-5" /></button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{m.gallery.length} gallery photo{m.gallery.length === 1 ? '' : 's'}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
