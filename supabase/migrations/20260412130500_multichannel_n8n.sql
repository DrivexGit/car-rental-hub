-- 1) Create lead_channels table
CREATE TABLE public.lead_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    external_user_id TEXT NOT NULL,
    phone_number TEXT,
    username TEXT,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (tenant_id, channel, external_user_id)
);

CREATE TRIGGER update_lead_channels_updated_at BEFORE UPDATE ON public.lead_channels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.lead_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant read lead_channels" ON public.lead_channels FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant insert lead_channels" ON public.lead_channels FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant update lead_channels" ON public.lead_channels FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant delete lead_channels" ON public.lead_channels FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id());

CREATE INDEX idx_lead_channels_lead ON public.lead_channels(lead_id);
CREATE INDEX idx_lead_channels_tenant ON public.lead_channels(tenant_id);

-- 2) Update leads table
ALTER TABLE public.leads 
  DROP CONSTRAINT IF EXISTS leads_whatsapp_number_key,
  ALTER COLUMN whatsapp_number DROP NOT NULL;

ALTER TABLE public.leads
  ADD COLUMN primary_channel TEXT,
  ADD COLUMN display_name TEXT;

-- 3) Make tenant_id NOT NULL for major tables
ALTER TABLE public.vehicles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.vehicle_images ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.leads ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.messages ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.conversation_states ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.reservations ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.customer_documents ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.faq_entries ALTER COLUMN tenant_id SET NOT NULL;

-- 4) messages table extras
ALTER TABLE public.messages
  ADD COLUMN channel_message_id TEXT,
  ADD COLUMN raw_payload JSONB;

-- 5) reservations constraint and index
ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_dates_check CHECK (end_datetime > start_datetime);

CREATE INDEX idx_reservations_tenant_vehicle_dates 
  ON public.reservations(tenant_id, vehicle_id, start_datetime, end_datetime);
