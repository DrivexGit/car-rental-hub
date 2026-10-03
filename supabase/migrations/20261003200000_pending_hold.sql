-- Unpaid (pending) bookings hold a car for 30 minutes only; keep in sync with HOLD_MINUTES in apps/customer/api/_lib.ts.
CREATE OR REPLACE FUNCTION public.busy_vehicle_ids(p_from timestamptz, p_to timestamptz)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT DISTINCT vehicle_id FROM public.reservations
  WHERE start_datetime < p_to AND end_datetime > p_from
    AND (status IN ('confirmed','blocked') OR (status = 'pending' AND created_at > now() - interval '30 minutes'))
$$;
