-- Customer profile photos: customers.avatar_url + a public "avatars" bucket.
-- Each customer writes only inside their own folder: avatars/<customer id>/...
-- The app compresses to <=512px webp/jpeg before upload; the bucket caps size as a backstop.
-- Additive only. Do not apply to production without approval.

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS avatar_url text;

-- The URL must point at the customer's own folder in the avatars bucket (it is rendered in the panel).
DO $$ BEGIN
  ALTER TABLE public.customers ADD CONSTRAINT customers_avatar_url_own_folder CHECK (
    avatar_url IS NULL OR avatar_url LIKE '%/storage/v1/object/public/avatars/' || id::text || '/%'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 524288, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

-- Reads go through the public URL. The owner also needs SELECT for upsert (replace photo).
DO $$ BEGIN
  CREATE POLICY "Customer reads own avatar files" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Customer uploads own avatar" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Customer replaces own avatar" ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
    WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Customer deletes own avatar" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Staff can manage every avatar (e.g. remove an inappropriate photo).
DO $$ BEGIN
  CREATE POLICY "Staff manage avatars" ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'avatars' AND public.is_active_staff())
    WITH CHECK (bucket_id = 'avatars' AND public.is_active_staff());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
