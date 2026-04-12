
-- 1. Create tenants table
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 2. Add tenant_id to all main tables
ALTER TABLE public.staff_profiles ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.vehicles ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.vehicle_images ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.leads ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.messages ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.conversation_states ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.reservations ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.customer_documents ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.faq_entries ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);

-- 3. Indexes on tenant_id
CREATE INDEX idx_staff_profiles_tenant ON public.staff_profiles(tenant_id);
CREATE INDEX idx_vehicles_tenant ON public.vehicles(tenant_id);
CREATE INDEX idx_vehicle_images_tenant ON public.vehicle_images(tenant_id);
CREATE INDEX idx_leads_tenant ON public.leads(tenant_id);
CREATE INDEX idx_messages_tenant ON public.messages(tenant_id);
CREATE INDEX idx_conversation_states_tenant ON public.conversation_states(tenant_id);
CREATE INDEX idx_reservations_tenant ON public.reservations(tenant_id);
CREATE INDEX idx_customer_documents_tenant ON public.customer_documents(tenant_id);
CREATE INDEX idx_faq_entries_tenant ON public.faq_entries(tenant_id);

-- 4. Security definer function to get tenant_id for current user
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.staff_profiles WHERE id = auth.uid() AND is_active = true LIMIT 1
$$;

-- 5. Drop all existing RLS policies and recreate with tenant filtering

-- staff_profiles
DROP POLICY IF EXISTS "Own profile insertable" ON public.staff_profiles;
DROP POLICY IF EXISTS "Own profile readable" ON public.staff_profiles;
DROP POLICY IF EXISTS "Staff can insert staff_profiles" ON public.staff_profiles;
DROP POLICY IF EXISTS "Staff can read staff_profiles" ON public.staff_profiles;
DROP POLICY IF EXISTS "Staff can update staff_profiles" ON public.staff_profiles;

CREATE POLICY "Staff can read own tenant profiles" ON public.staff_profiles FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() OR id = auth.uid());
CREATE POLICY "Staff can insert own profile" ON public.staff_profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "Staff can update own tenant profiles" ON public.staff_profiles FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- vehicles
DROP POLICY IF EXISTS "Staff can delete vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Staff can insert vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Staff can read vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Staff can update vehicles" ON public.vehicles;

CREATE POLICY "Tenant read vehicles" ON public.vehicles FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant insert vehicles" ON public.vehicles FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant update vehicles" ON public.vehicles FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant delete vehicles" ON public.vehicles FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id());

-- vehicle_images
DROP POLICY IF EXISTS "Staff can delete vehicle_images" ON public.vehicle_images;
DROP POLICY IF EXISTS "Staff can insert vehicle_images" ON public.vehicle_images;
DROP POLICY IF EXISTS "Staff can read vehicle_images" ON public.vehicle_images;
DROP POLICY IF EXISTS "Staff can update vehicle_images" ON public.vehicle_images;

CREATE POLICY "Tenant read vehicle_images" ON public.vehicle_images FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant insert vehicle_images" ON public.vehicle_images FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant update vehicle_images" ON public.vehicle_images FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant delete vehicle_images" ON public.vehicle_images FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id());

-- leads
DROP POLICY IF EXISTS "Staff can delete leads" ON public.leads;
DROP POLICY IF EXISTS "Staff can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Staff can read leads" ON public.leads;
DROP POLICY IF EXISTS "Staff can update leads" ON public.leads;

CREATE POLICY "Tenant read leads" ON public.leads FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant update leads" ON public.leads FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant delete leads" ON public.leads FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id());

-- messages
DROP POLICY IF EXISTS "Staff can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Staff can read messages" ON public.messages;

CREATE POLICY "Tenant read messages" ON public.messages FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant insert messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());

-- conversation_states
DROP POLICY IF EXISTS "Staff can insert conversation_states" ON public.conversation_states;
DROP POLICY IF EXISTS "Staff can read conversation_states" ON public.conversation_states;
DROP POLICY IF EXISTS "Staff can update conversation_states" ON public.conversation_states;

CREATE POLICY "Tenant read conversation_states" ON public.conversation_states FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant insert conversation_states" ON public.conversation_states FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant update conversation_states" ON public.conversation_states FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id());

-- reservations
DROP POLICY IF EXISTS "Staff can delete reservations" ON public.reservations;
DROP POLICY IF EXISTS "Staff can insert reservations" ON public.reservations;
DROP POLICY IF EXISTS "Staff can read reservations" ON public.reservations;
DROP POLICY IF EXISTS "Staff can update reservations" ON public.reservations;

CREATE POLICY "Tenant read reservations" ON public.reservations FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant insert reservations" ON public.reservations FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant update reservations" ON public.reservations FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant delete reservations" ON public.reservations FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id());

-- customer_documents
DROP POLICY IF EXISTS "Staff can delete customer_documents" ON public.customer_documents;
DROP POLICY IF EXISTS "Staff can insert customer_documents" ON public.customer_documents;
DROP POLICY IF EXISTS "Staff can read customer_documents" ON public.customer_documents;
DROP POLICY IF EXISTS "Staff can update customer_documents" ON public.customer_documents;

CREATE POLICY "Tenant read customer_documents" ON public.customer_documents FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant insert customer_documents" ON public.customer_documents FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant update customer_documents" ON public.customer_documents FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant delete customer_documents" ON public.customer_documents FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id());

-- faq_entries
DROP POLICY IF EXISTS "Staff can delete faq_entries" ON public.faq_entries;
DROP POLICY IF EXISTS "Staff can insert faq_entries" ON public.faq_entries;
DROP POLICY IF EXISTS "Staff can read faq_entries" ON public.faq_entries;
DROP POLICY IF EXISTS "Staff can update faq_entries" ON public.faq_entries;

CREATE POLICY "Tenant read faq_entries" ON public.faq_entries FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant insert faq_entries" ON public.faq_entries FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant update faq_entries" ON public.faq_entries FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant delete faq_entries" ON public.faq_entries FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id());

-- tenants RLS
CREATE POLICY "Staff can read own tenant" ON public.tenants FOR SELECT TO authenticated
  USING (id = get_user_tenant_id());
