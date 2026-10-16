-- "Pay at month end": such a customer's bookings are confirmed without paying at checkout.
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS pay_monthly boolean NOT NULL DEFAULT false;

-- Only staff may switch pay_monthly; a customer flipping it would get bookings confirmed without paying.
CREATE OR REPLACE FUNCTION public.customers_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() = OLD.id AND NOT public.is_active_staff()
     AND (NEW.phone <> OLD.phone OR NEW.tenant_id <> OLD.tenant_id OR NEW.lead_id IS DISTINCT FROM OLD.lead_id
          OR NEW.pay_monthly IS DISTINCT FROM OLD.pay_monthly) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  RETURN NEW;
END $$;
