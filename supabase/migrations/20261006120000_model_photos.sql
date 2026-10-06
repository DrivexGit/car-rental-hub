-- Car photos per model (managed in the panel → "Car photos", shown in the customer app).
-- Files live in the public "vehicle-images" bucket under models/<slug>/.
ALTER TABLE public.vehicle_model_specs
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS gallery text[] NOT NULL DEFAULT '{}';

-- Every bookable model gets a specs row, so photos can be attached to it.
INSERT INTO public.vehicle_model_specs (tenant_id, make, model)
SELECT DISTINCT tenant_id, make, model FROM public.vehicles WHERE is_active
ON CONFLICT DO NOTHING;

-- Staff manage files in the public bucket (customers only read via public URL).
DO $$ BEGIN
  CREATE POLICY "Staff manage vehicle images" ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'vehicle-images' AND public.is_active_staff())
    WITH CHECK (bucket_id = 'vehicle-images' AND public.is_active_staff());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
