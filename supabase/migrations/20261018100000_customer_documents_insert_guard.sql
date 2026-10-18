-- A customer may only add a pending document that points at a file in their own folder of the private bucket.
-- Without this a customer could insert an "approved" row, or a row pointing at another customer's file.
DROP POLICY IF EXISTS "Customer inserts own documents" ON public.customer_documents;
CREATE POLICY "Customer inserts own documents" ON public.customer_documents FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = 'customer'
              AND lead_id = (SELECT lead_id FROM public.customers WHERE id = auth.uid())
              AND tenant_id = (SELECT tenant_id FROM public.customers WHERE id = auth.uid())
              AND verification_status = 'pending'
              AND storage_bucket = 'customer-documents'
              AND split_part(storage_path, '/', 1) = auth.uid()::text);
