-- Invoices uploaded by staff (Kamyar, meeting 16 Oct): the PDF they made is kept as it is, and the customer sees that same file.
-- The file lives in a private bucket: staff manage it, the customer can read only the files of their own invoices.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'system' CHECK (source IN ('system', 'uploaded'));

INSERT INTO storage.buckets (id, name, public) VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Staff manage invoice files" ON storage.objects;
CREATE POLICY "Staff manage invoice files" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'invoices' AND public.is_active_staff())
  WITH CHECK (bucket_id = 'invoices' AND public.is_active_staff());

DROP POLICY IF EXISTS "Customer reads own invoice files" ON storage.objects;
CREATE POLICY "Customer reads own invoice files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'invoices' AND EXISTS (
    SELECT 1 FROM public.invoices i WHERE i.file_path = storage.objects.name AND i.customer_id = auth.uid()
  ));
