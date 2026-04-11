import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { VEHICLE_STATUSES } from '@/lib/constants';
import { ArrowLeft, Upload, Trash2 } from 'lucide-react';

export default function VehicleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [vehicle, setVehicle] = useState<any>(null);
  const [images, setImages] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    if (!id) return;
    const [v, img, res] = await Promise.all([
      supabase.from('vehicles').select('*').eq('id', id).single(),
      supabase.from('vehicle_images').select('*').eq('vehicle_id', id).order('sort_order'),
      supabase.from('reservations').select('*, leads(full_name, whatsapp_number)').eq('vehicle_id', id).order('start_datetime'),
    ]);
    setVehicle(v.data);
    setImages(img.data || []);
    setReservations(res.data || []);
  };

  useEffect(() => { load(); }, [id]);

  const updateVehicle = async (updates: any) => {
    await supabase.from('vehicles').update(updates).eq('id', id);
    toast({ title: 'Vehicle updated' });
    load();
  };

  const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploading(true);
    const path = `${id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('vehicle-images').upload(path, file);
    if (error) { toast({ title: 'Upload failed', description: error.message, variant: 'destructive' }); setUploading(false); return; }
    await supabase.from('vehicle_images').insert({
      vehicle_id: id, storage_path: path, file_name: file.name,
      mime_type: file.type, file_size: file.size, sort_order: images.length,
    });
    toast({ title: 'Image uploaded' });
    setUploading(false);
    load();
  };

  const deleteImage = async (img: any) => {
    await supabase.storage.from('vehicle-images').remove([img.storage_path]);
    await supabase.from('vehicle_images').delete().eq('id', img.id);
    toast({ title: 'Image deleted' });
    load();
  };

  const getImageUrl = (path: string) => {
    const { data } = supabase.storage.from('vehicle-images').getPublicUrl(path);
    return data.publicUrl;
  };

  if (!vehicle) return <div className="p-8 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/vehicles')}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-semibold">{vehicle.make} {vehicle.model} — {vehicle.plate_number}</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Vehicle Info</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <p><strong>Plate:</strong> {vehicle.plate_number}</p>
            <p><strong>Year:</strong> {vehicle.year || '—'}</p>
            <p><strong>Color:</strong> {vehicle.color || '—'}</p>
            <p><strong>Location:</strong> {vehicle.current_location || '—'}</p>
            <p><strong>Odometer:</strong> {vehicle.odometer || '—'}</p>
            <p><strong>Chassis:</strong> {vehicle.chassis_number || '—'}</p>
            <div className="flex items-center gap-2">
              <strong>Status:</strong>
              <Select value={vehicle.status} onValueChange={v => updateVehicle({ status: v })}>
                <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{VEHICLE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {vehicle.notes && <p><strong>Notes:</strong> {vehicle.notes}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Images ({images.length})</CardTitle>
            <label className="cursor-pointer">
              <Input type="file" accept="image/*" className="hidden" onChange={uploadImage} disabled={uploading} />
              <Button size="sm" variant="outline" asChild><span><Upload className="mr-1 h-3 w-3" />{uploading ? 'Uploading…' : 'Upload'}</span></Button>
            </label>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {images.map(img => (
                <div key={img.id} className="relative group">
                  <img src={getImageUrl(img.storage_path)} alt={img.file_name} className="w-full h-24 object-cover rounded" />
                  <button onClick={() => deleteImage(img)} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {images.length === 0 && <p className="text-muted-foreground text-sm col-span-3">No images</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Reservations ({reservations.length})</CardTitle></CardHeader>
        <CardContent>
          {reservations.map(r => (
            <div key={r.id} className="flex justify-between items-center border-b py-2 text-sm">
              <div>
                <Badge variant="outline">{r.status}</Badge>
                <Badge variant="outline" className="ml-1">{r.reservation_type}</Badge>
                <span className="ml-2">{(r.leads as any)?.full_name || r.customer_name_snapshot || '—'}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(r.start_datetime).toLocaleDateString()} – {new Date(r.end_datetime).toLocaleDateString()}
              </span>
            </div>
          ))}
          {reservations.length === 0 && <p className="text-muted-foreground text-sm">No reservations</p>}
        </CardContent>
      </Card>
    </div>
  );
}
