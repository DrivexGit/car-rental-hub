-- Vehicles that are busy (pending/confirmed/blocked reservation overlapping the range).
-- Returns only ids so customers can see availability without seeing other people's bookings.
CREATE OR REPLACE FUNCTION public.busy_vehicle_ids(p_from timestamptz, p_to timestamptz)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT DISTINCT vehicle_id FROM public.reservations
  WHERE status IN ('pending','confirmed','blocked')
    AND start_datetime < p_to AND end_datetime > p_from
$$;
REVOKE ALL ON FUNCTION public.busy_vehicle_ids(timestamptz, timestamptz) FROM anon;

-- Customers register their own uploaded documents.
CREATE POLICY "Customer inserts own documents" ON public.customer_documents FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = 'customer' AND lead_id = (SELECT lead_id FROM public.customers WHERE id = auth.uid())
              AND tenant_id = (SELECT tenant_id FROM public.customers WHERE id = auth.uid()));
