-- Customer app (apps/customer): customer accounts, invoices, payments, fines, offers, urgent requests.
-- Customers only ever read their own rows; all writes that involve money go through server functions (service role).

-- 1) Customers: one row per auth user who signs in to the app.
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  phone text NOT NULL,
  full_name text NOT NULL,
  email text,
  notify_bookings boolean NOT NULL DEFAULT true,
  notify_invoices boolean NOT NULL DEFAULT true,
  notify_offers boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, phone)
);
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.is_customer() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.customers WHERE id = auth.uid()) $$;

-- 2) Reservations made from the app.
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rental_period text CHECK (rental_period IN ('daily','weekly','monthly')),
  ADD COLUMN IF NOT EXISTS extras text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS total_amount numeric;
CREATE INDEX IF NOT EXISTS idx_reservations_customer ON public.reservations(customer_id);

-- 3) Invoices, payments, fines.
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  number text NOT NULL DEFAULT ('INV-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(random()::text), 1, 4))),
  description text,
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','void')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices(customer_id);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  provider text NOT NULL,            -- 'ziina' | 'test'
  provider_ref text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);

CREATE TABLE IF NOT EXISTS public.fines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('salik','traffic')),
  amount numeric NOT NULL CHECK (amount >= 0),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  location text,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fines_customer ON public.fines(customer_id);

-- 4) Offers shown in the app (car discounts + partner benefits).
CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  kind text NOT NULL CHECK (kind IN ('car','partner')),
  title text NOT NULL,               -- car: "Make Model"; partner: venue name
  subtitle text,
  discount_pct integer NOT NULL CHECK (discount_pct BETWEEN 1 AND 90),
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5) Urgent support requests raised by the AI / "Urgent call".
CREATE TABLE IF NOT EXISTS public.urgent_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','handled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6) RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.urgent_requests ENABLE ROW LEVEL SECURITY;

-- Customers: own rows (read; profile fields editable).
CREATE POLICY "Customer reads self" ON public.customers FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Customer updates self" ON public.customers FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Customer reads own invoices" ON public.invoices FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Customer reads own payments" ON public.payments FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Customer reads own fines" ON public.fines FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Customer reads own reservations" ON public.reservations FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Customer reads fleet" ON public.vehicles FOR SELECT TO authenticated
  USING (is_active AND public.is_customer() AND tenant_id = (SELECT tenant_id FROM public.customers WHERE id = auth.uid()));
CREATE POLICY "Customer reads offers" ON public.offers FOR SELECT TO authenticated
  USING (is_active AND tenant_id = (SELECT tenant_id FROM public.customers WHERE id = auth.uid()));
CREATE POLICY "Customer reads own documents" ON public.customer_documents FOR SELECT TO authenticated
  USING (lead_id = (SELECT lead_id FROM public.customers WHERE id = auth.uid()));

-- Staff: full access within their tenant.
CREATE POLICY "Staff all customers" ON public.customers FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Staff all invoices" ON public.invoices FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Staff all payments" ON public.payments FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Staff all fines" ON public.fines FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Staff all offers" ON public.offers FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Staff all urgent" ON public.urgent_requests FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());

-- Customers can't change their phone, tenant or lead link.
CREATE OR REPLACE FUNCTION public.customers_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() = OLD.id AND NOT public.is_active_staff()
     AND (NEW.phone <> OLD.phone OR NEW.tenant_id <> OLD.tenant_id OR NEW.lead_id IS DISTINCT FROM OLD.lead_id) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER customers_guard BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.customers_guard();

-- 7) Customer document uploads: storage path "<auth uid>/<file>" in the private customer-documents bucket.
CREATE POLICY "Customer uploads own docs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'customer-documents' AND (storage.foldername(name))[1] = auth.uid()::text AND public.is_customer());
CREATE POLICY "Customer reads own docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'customer-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 8) Starting offers (same as the app launch content).
INSERT INTO public.offers (tenant_id, kind, title, subtitle, discount_pct, image_url, sort_order)
SELECT '22c42919-4f33-4463-ae13-39cc26993c64', k, t, s, d, i, o FROM (VALUES
  ('car', 'Mercedes-Benz GLE 53', NULL, 15, NULL, 1),
  ('car', 'Nissan Patrol Platinum', NULL, 20, NULL, 2),
  ('car', 'Mercedes-Benz GLB 250', NULL, 10, NULL, 3),
  ('car', 'MINI Cooper', NULL, 12, NULL, 4),
  ('partner', 'ZUMA', 'Dining', 45, '/img/dining-1.webp', 1),
  ('partner', 'Nusr-Et', 'Dining', 22, '/img/dining-2.webp', 2),
  ('partner', 'Al Noor', 'Dining', 30, '/img/dining-3.webp', 3)
) v(k, t, s, d, i, o)
WHERE NOT EXISTS (SELECT 1 FROM public.offers);
