
CREATE POLICY "Authenticated can create tenants" ON public.tenants FOR INSERT TO authenticated
  WITH CHECK (true);
