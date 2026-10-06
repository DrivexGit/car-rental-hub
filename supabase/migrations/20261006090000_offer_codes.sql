-- Personal partner-benefit codes: each customer gets their own code per partner offer
-- (instead of one shared code), and staff count every use from the panel.

CREATE TABLE IF NOT EXISTS public.offer_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  uses integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (offer_id, customer_id)
);
CREATE INDEX IF NOT EXISTS offer_codes_offer_idx ON public.offer_codes(offer_id);

ALTER TABLE public.offer_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customer reads own offer codes" ON public.offer_codes FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Staff all offer codes" ON public.offer_codes FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());

-- Returns the caller's code for a partner offer, creating it on first call.
-- Code = offer's base code (or "DRIVEX") + "-" + 5 random chars, e.g. DRIVEX45-K7Q2M.
CREATE OR REPLACE FUNCTION public.my_offer_code(p_offer uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.offers; c public.customers; v text; tries int := 0;
BEGIN
  SELECT * INTO c FROM customers WHERE id = auth.uid();
  IF c.id IS NULL THEN RAISE EXCEPTION 'not a customer'; END IF;
  SELECT * INTO o FROM offers WHERE id = p_offer AND tenant_id = c.tenant_id AND kind = 'partner' AND is_active;
  IF o.id IS NULL THEN RAISE EXCEPTION 'offer not found'; END IF;
  SELECT code INTO v FROM offer_codes WHERE offer_id = o.id AND customer_id = c.id;
  IF v IS NOT NULL THEN RETURN v; END IF;
  LOOP
    v := coalesce(nullif(upper(o.redeem_code), ''), 'DRIVEX') || '-' ||
         upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
    BEGIN
      INSERT INTO offer_codes (tenant_id, offer_id, customer_id, code) VALUES (c.tenant_id, o.id, c.id, v);
      RETURN v;
    EXCEPTION WHEN unique_violation THEN
      SELECT code INTO v FROM offer_codes WHERE offer_id = o.id AND customer_id = c.id;
      IF v IS NOT NULL THEN RETURN v; END IF;
      tries := tries + 1; IF tries > 5 THEN RAISE; END IF;
    END;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.my_offer_code(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_offer_code(uuid) TO authenticated;

-- Staff: record one use of a code (venue reported it). Returns the code row with customer + offer names.
CREATE OR REPLACE FUNCTION public.redeem_offer_code(p_code text)
RETURNS TABLE (code text, uses int, offer_title text, customer_name text, customer_phone text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_active_staff() THEN RAISE EXCEPTION 'staff only'; END IF;
  RETURN QUERY
  WITH u AS (
    UPDATE offer_codes oc SET uses = oc.uses + 1, last_used_at = now()
    WHERE oc.code = upper(trim(p_code)) AND oc.tenant_id = get_user_tenant_id()
    RETURNING oc.*
  )
  SELECT u.code, u.uses, o.title, cu.full_name, cu.phone
  FROM u JOIN offers o ON o.id = u.offer_id JOIN customers cu ON cu.id = u.customer_id;
END $$;
REVOKE ALL ON FUNCTION public.redeem_offer_code(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.redeem_offer_code(text) TO authenticated;
