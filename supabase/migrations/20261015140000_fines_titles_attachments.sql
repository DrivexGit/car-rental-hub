-- Fines & Salik: more kinds of charge, a title the customer sees, and an optional attachment (screenshot or PDF).
-- The attachment lives in a private bucket that only active staff can read or write.
ALTER TABLE public.fines DROP CONSTRAINT IF EXISTS fines_type_check;
ALTER TABLE public.fines ADD CONSTRAINT fines_type_check CHECK (type IN ('salik','salik_parking','traffic','damage','other'));
ALTER TABLE public.fines ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.fines ADD COLUMN IF NOT EXISTS attachment_path text;

INSERT INTO storage.buckets (id, name, public) VALUES ('fine-attachments', 'fine-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Staff manage fine attachments" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'fine-attachments' AND public.is_active_staff())
  WITH CHECK (bucket_id = 'fine-attachments' AND public.is_active_staff());
