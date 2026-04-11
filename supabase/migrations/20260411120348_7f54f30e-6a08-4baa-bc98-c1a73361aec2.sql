
-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1) staff_profiles (created FIRST so is_active_staff can reference it)
CREATE TABLE public.staff_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'admin',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER update_staff_profiles_updated_at BEFORE UPDATE ON public.staff_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper function to check if user is active staff
CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE id = auth.uid() AND is_active = true
  )
$$;

-- RLS for staff_profiles
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own profile readable" ON public.staff_profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Own profile insertable" ON public.staff_profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Staff can read staff_profiles" ON public.staff_profiles FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE POLICY "Staff can insert staff_profiles" ON public.staff_profiles FOR INSERT TO authenticated WITH CHECK (public.is_active_staff());
CREATE POLICY "Staff can update staff_profiles" ON public.staff_profiles FOR UPDATE TO authenticated USING (public.is_active_staff());

-- 2) vehicles
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_row_number INTEGER,
  plate_number TEXT UNIQUE NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  color TEXT,
  categories_raw TEXT,
  categories TEXT[],
  current_location TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  expected_return_date TIMESTAMPTZ,
  upcoming_reservations_raw TEXT,
  latest_return_date TIMESTAMPTZ,
  odometer INTEGER,
  chassis_number TEXT UNIQUE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read vehicles" ON public.vehicles FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE POLICY "Staff can insert vehicles" ON public.vehicles FOR INSERT TO authenticated WITH CHECK (public.is_active_staff());
CREATE POLICY "Staff can update vehicles" ON public.vehicles FOR UPDATE TO authenticated USING (public.is_active_staff());
CREATE POLICY "Staff can delete vehicles" ON public.vehicles FOR DELETE TO authenticated USING (public.is_active_staff());
CREATE INDEX idx_vehicles_plate ON public.vehicles(plate_number);
CREATE INDEX idx_vehicles_status ON public.vehicles(status);
CREATE INDEX idx_vehicles_make ON public.vehicles(make);
CREATE INDEX idx_vehicles_model ON public.vehicles(model);
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) vehicle_images
CREATE TABLE public.vehicle_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  storage_bucket TEXT NOT NULL DEFAULT 'vehicle-images',
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicle_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read vehicle_images" ON public.vehicle_images FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE POLICY "Staff can insert vehicle_images" ON public.vehicle_images FOR INSERT TO authenticated WITH CHECK (public.is_active_staff());
CREATE POLICY "Staff can update vehicle_images" ON public.vehicle_images FOR UPDATE TO authenticated USING (public.is_active_staff());
CREATE POLICY "Staff can delete vehicle_images" ON public.vehicle_images FOR DELETE TO authenticated USING (public.is_active_staff());
CREATE INDEX idx_vehicle_images_vehicle ON public.vehicle_images(vehicle_id);

-- 4) leads
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_number TEXT UNIQUE NOT NULL,
  full_name TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  current_stage TEXT NOT NULL DEFAULT 'new_lead',
  notes TEXT,
  assigned_staff_id UUID REFERENCES public.staff_profiles(id),
  last_message_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read leads" ON public.leads FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE POLICY "Staff can insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (public.is_active_staff());
CREATE POLICY "Staff can update leads" ON public.leads FOR UPDATE TO authenticated USING (public.is_active_staff());
CREATE POLICY "Staff can delete leads" ON public.leads FOR DELETE TO authenticated USING (public.is_active_staff());
CREATE INDEX idx_leads_whatsapp ON public.leads(whatsapp_number);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_stage ON public.leads(current_stage);
CREATE INDEX idx_leads_staff ON public.leads(assigned_staff_id);
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  message_text TEXT NOT NULL,
  detected_intent TEXT,
  stage_at_time TEXT,
  message_type TEXT NOT NULL DEFAULT 'text',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read messages" ON public.messages FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE POLICY "Staff can insert messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (public.is_active_staff());
CREATE INDEX idx_messages_lead ON public.messages(lead_id);
CREATE INDEX idx_messages_created ON public.messages(created_at);
CREATE INDEX idx_messages_direction ON public.messages(direction);

-- 6) conversation_states
CREATE TABLE public.conversation_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  current_stage TEXT NOT NULL DEFAULT 'new_lead',
  last_intent TEXT,
  missing_fields JSONB,
  collected_fields JSONB,
  selected_vehicle_id UUID REFERENCES public.vehicles(id),
  quoted_options JSONB,
  ai_summary TEXT,
  handoff_needed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.conversation_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read conversation_states" ON public.conversation_states FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE POLICY "Staff can insert conversation_states" ON public.conversation_states FOR INSERT TO authenticated WITH CHECK (public.is_active_staff());
CREATE POLICY "Staff can update conversation_states" ON public.conversation_states FOR UPDATE TO authenticated USING (public.is_active_staff());
CREATE TRIGGER update_conversation_states_updated_at BEFORE UPDATE ON public.conversation_states FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7) reservations
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id),
  source TEXT NOT NULL DEFAULT 'chatbot',
  status TEXT NOT NULL DEFAULT 'draft',
  reservation_type TEXT NOT NULL DEFAULT 'booking',
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ NOT NULL,
  pickup_location TEXT,
  return_location TEXT,
  customer_name_snapshot TEXT,
  customer_phone_snapshot TEXT,
  price_note TEXT,
  internal_note TEXT,
  created_by_staff_id UUID REFERENCES public.staff_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read reservations" ON public.reservations FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE POLICY "Staff can insert reservations" ON public.reservations FOR INSERT TO authenticated WITH CHECK (public.is_active_staff());
CREATE POLICY "Staff can update reservations" ON public.reservations FOR UPDATE TO authenticated USING (public.is_active_staff());
CREATE POLICY "Staff can delete reservations" ON public.reservations FOR DELETE TO authenticated USING (public.is_active_staff());
CREATE INDEX idx_reservations_vehicle ON public.reservations(vehicle_id);
CREATE INDEX idx_reservations_lead ON public.reservations(lead_id);
CREATE INDEX idx_reservations_start ON public.reservations(start_datetime);
CREATE INDEX idx_reservations_end ON public.reservations(end_datetime);
CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8) customer_documents
CREATE TABLE public.customer_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES public.reservations(id),
  document_type TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'customer-documents',
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  uploaded_by TEXT NOT NULL DEFAULT 'customer',
  verification_status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read customer_documents" ON public.customer_documents FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE POLICY "Staff can insert customer_documents" ON public.customer_documents FOR INSERT TO authenticated WITH CHECK (public.is_active_staff());
CREATE POLICY "Staff can update customer_documents" ON public.customer_documents FOR UPDATE TO authenticated USING (public.is_active_staff());
CREATE POLICY "Staff can delete customer_documents" ON public.customer_documents FOR DELETE TO authenticated USING (public.is_active_staff());
CREATE INDEX idx_customer_documents_lead ON public.customer_documents(lead_id);

-- 9) faq_entries
CREATE TABLE public.faq_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.faq_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read faq_entries" ON public.faq_entries FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE POLICY "Staff can insert faq_entries" ON public.faq_entries FOR INSERT TO authenticated WITH CHECK (public.is_active_staff());
CREATE POLICY "Staff can update faq_entries" ON public.faq_entries FOR UPDATE TO authenticated USING (public.is_active_staff());
CREATE POLICY "Staff can delete faq_entries" ON public.faq_entries FOR DELETE TO authenticated USING (public.is_active_staff());
CREATE TRIGGER update_faq_entries_updated_at BEFORE UPDATE ON public.faq_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('vehicle-images', 'vehicle-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('customer-documents', 'customer-documents', false);

-- Storage policies
CREATE POLICY "Vehicle images publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'vehicle-images');
CREATE POLICY "Staff can upload vehicle images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'vehicle-images' AND public.is_active_staff());
CREATE POLICY "Staff can update vehicle images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'vehicle-images' AND public.is_active_staff());
CREATE POLICY "Staff can delete vehicle images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'vehicle-images' AND public.is_active_staff());
CREATE POLICY "Staff can read customer documents" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'customer-documents' AND public.is_active_staff());
CREATE POLICY "Staff can upload customer documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'customer-documents' AND public.is_active_staff());
CREATE POLICY "Staff can update customer documents" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'customer-documents' AND public.is_active_staff());
CREATE POLICY "Staff can delete customer documents" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'customer-documents' AND public.is_active_staff());
