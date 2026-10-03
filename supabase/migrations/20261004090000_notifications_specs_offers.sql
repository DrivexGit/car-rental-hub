-- Notifications (staff + customer) with web-push fan-out, car model specs, richer partner offers.

CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1) Notifications. audience 'staff' (all staff of the tenant) or 'customer' (one customer).
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  audience text NOT NULL CHECK (audience IN ('staff','customer')),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  type text NOT NULL,          -- booking_new | booking_paid | urgent | document | customer_new | invoice | fine | booking_confirmed
  title text NOT NULL,
  body text,
  link text,                   -- path inside the panel or the app
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON public.notifications(tenant_id, audience, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff notifications" ON public.notifications FOR ALL TO authenticated
  USING (audience = 'staff' AND tenant_id = get_user_tenant_id()) WITH CHECK (audience = 'staff' AND tenant_id = get_user_tenant_id());
CREATE POLICY "Customer notifications" ON public.notifications FOR SELECT TO authenticated USING (audience = 'customer' AND customer_id = auth.uid());
CREATE POLICY "Customer marks read" ON public.notifications FOR UPDATE TO authenticated USING (audience = 'customer' AND customer_id = auth.uid());
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 2) Web-push subscriptions (one row per browser/device).
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('staff','customer')),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own push subscriptions" ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3) Push fan-out: every new notification is POSTed to the app's /api/push-hook (URL + secret in private config).
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE IF NOT EXISTS private.app_config (key text PRIMARY KEY, value text NOT NULL);

CREATE OR REPLACE FUNCTION public.notifications_push() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE u text; s text;
BEGIN
  SELECT value INTO u FROM private.app_config WHERE key = 'push_hook_url';
  SELECT value INTO s FROM private.app_config WHERE key = 'push_hook_secret';
  IF u IS NOT NULL THEN
    PERFORM net.http_post(url := u, body := to_jsonb(NEW), headers := jsonb_build_object('Content-Type','application/json','x-hook-secret', coalesce(s,'')));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER notifications_push AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.notifications_push();

-- 4) Event triggers that create notifications.
CREATE OR REPLACE FUNCTION public.notify_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE car text; who text;
BEGIN
  IF TG_TABLE_NAME = 'reservations' THEN
    IF NEW.customer_id IS NULL THEN RETURN NEW; END IF;
    SELECT make || ' ' || model INTO car FROM vehicles WHERE id = NEW.vehicle_id;
    who := coalesce(NEW.customer_name_snapshot, 'A customer');
    IF TG_OP = 'INSERT' THEN
      INSERT INTO notifications (tenant_id, audience, type, title, body, link)
      VALUES (NEW.tenant_id, 'staff', 'booking_new', 'New booking: ' || car,
              who || ' · ' || to_char(NEW.start_datetime AT TIME ZONE 'Asia/Dubai', 'DD Mon') || ' → ' || to_char(NEW.end_datetime AT TIME ZONE 'Asia/Dubai', 'DD Mon') || ' · AED ' || coalesce(NEW.total_amount::text, '—'),
              '/reservations?id=' || NEW.id);
    ELSIF OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
      INSERT INTO notifications (tenant_id, audience, type, title, body, link)
      VALUES (NEW.tenant_id, 'staff', 'booking_paid', 'Booking paid: ' || car, who || ' paid AED ' || coalesce(NEW.total_amount::text, '—'), '/reservations?id=' || NEW.id);
      INSERT INTO notifications (tenant_id, audience, customer_id, type, title, body, link)
      VALUES (NEW.tenant_id, 'customer', NEW.customer_id, 'booking_confirmed', 'Booking confirmed', 'Your ' || car || ' is booked for ' || to_char(NEW.start_datetime AT TIME ZONE 'Asia/Dubai', 'DD Mon') || '.', '/bookings/' || NEW.id);
    END IF;
  ELSIF TG_TABLE_NAME = 'urgent_requests' THEN
    SELECT full_name || ' (' || phone || ')' INTO who FROM customers WHERE id = NEW.customer_id;
    INSERT INTO notifications (tenant_id, audience, type, title, body, link)
    VALUES (NEW.tenant_id, 'staff', 'urgent', '🚨 Urgent: ' || coalesce(who, 'customer'), left(NEW.message, 200), '/notifications');
  ELSIF TG_TABLE_NAME = 'customer_documents' THEN
    IF NEW.uploaded_by = 'customer' THEN
      SELECT full_name INTO who FROM leads WHERE id = NEW.lead_id;
      INSERT INTO notifications (tenant_id, audience, type, title, body, link)
      VALUES (NEW.tenant_id, 'staff', 'document', 'New document to review', coalesce(who, 'Customer') || ' uploaded ' || replace(NEW.document_type, '_', ' '), '/documents');
    END IF;
  ELSIF TG_TABLE_NAME = 'customers' THEN
    INSERT INTO notifications (tenant_id, audience, type, title, body, link)
    VALUES (NEW.tenant_id, 'staff', 'customer_new', 'New app customer', NEW.full_name || ' · ' || NEW.phone, '/customers?id=' || NEW.id);
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    INSERT INTO notifications (tenant_id, audience, customer_id, type, title, body, link)
    VALUES (NEW.tenant_id, 'customer', NEW.customer_id, 'invoice', 'New invoice ' || NEW.number,
            coalesce(NEW.description, 'Invoice') || ' · AED ' || NEW.amount, CASE WHEN NEW.reservation_id IS NULL THEN '/profile/payments' ELSE '/bookings/' || NEW.reservation_id END);
  ELSIF TG_TABLE_NAME = 'fines' THEN
    INSERT INTO notifications (tenant_id, audience, customer_id, type, title, body, link)
    VALUES (NEW.tenant_id, 'customer', NEW.customer_id, 'fine', CASE WHEN NEW.type = 'salik' THEN 'New Salik charge' ELSE 'New traffic fine' END,
            coalesce(NEW.location, '') || ' · AED ' || NEW.amount, CASE WHEN NEW.reservation_id IS NULL THEN '/bookings' ELSE '/bookings/' || NEW.reservation_id END);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER notify_reservations AFTER INSERT OR UPDATE OF status ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.notify_events();
CREATE TRIGGER notify_urgent AFTER INSERT ON public.urgent_requests FOR EACH ROW EXECUTE FUNCTION public.notify_events();
CREATE TRIGGER notify_documents AFTER INSERT ON public.customer_documents FOR EACH ROW EXECUTE FUNCTION public.notify_events();
CREATE TRIGGER notify_customers AFTER INSERT ON public.customers FOR EACH ROW EXECUTE FUNCTION public.notify_events();
-- Invoices made at booking time are paid right away; only notify for invoices created later (extensions, staff).
CREATE TRIGGER notify_invoices AFTER INSERT ON public.invoices FOR EACH ROW
  WHEN (NEW.description IS NULL OR NEW.description NOT LIKE 'Rental %') EXECUTE FUNCTION public.notify_events();
CREATE TRIGGER notify_fines AFTER INSERT ON public.fines FOR EACH ROW EXECUTE FUNCTION public.notify_events();

-- 5) Partner offers: details shown when the customer taps a benefit.
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS terms text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS redeem_code text;
UPDATE public.offers SET
  description = CASE title
    WHEN 'ZUMA' THEN 'Contemporary Japanese izakaya dining in DIFC.'
    WHEN 'Nusr-Et' THEN 'Signature steakhouse experience.'
    WHEN 'Al Noor' THEN 'Arabic and international cuisine with city views.' END,
  terms = 'Show this screen to the restaurant before you order. Valid during an active Drivex rental. Not combinable with other offers.',
  redeem_code = 'DRIVEX' || discount_pct
WHERE kind = 'partner' AND description IS NULL;

-- 6) Car model specs (typical specs per model; editable by staff).
CREATE TABLE IF NOT EXISTS public.vehicle_model_specs (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  make text NOT NULL,
  model text NOT NULL,
  engine text,
  transmission text NOT NULL DEFAULT 'Automatic',
  fuel text NOT NULL DEFAULT 'Petrol',
  seats integer NOT NULL DEFAULT 5,
  doors integer NOT NULL DEFAULT 4,
  bags integer NOT NULL DEFAULT 2,
  features text[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (tenant_id, make, model)
);
ALTER TABLE public.vehicle_model_specs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff all specs" ON public.vehicle_model_specs FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Customer reads specs" ON public.vehicle_model_specs FOR SELECT TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.customers WHERE id = auth.uid()));

INSERT INTO public.vehicle_model_specs (tenant_id, make, model, engine, seats, doors, bags, features)
SELECT '22c42919-4f33-4463-ae13-39cc26993c64', m, mo, e, s, d, b, f FROM (VALUES
  ('Audi','A6','2.0L Turbo',5,4,3, ARRAY['Leather seats','Apple CarPlay','Cruise control']),
  ('Chevrolet','Captiva','1.5L Turbo',7,5,3, ARRAY['7 seats','Rear camera','Bluetooth']),
  ('Chevrolet','Groove','1.5L',5,5,2, ARRAY['Rear camera','Bluetooth']),
  ('Chevrolet','Tahoe','5.3L V8',7,5,5, ARRAY['7 seats','Leather seats','Apple CarPlay','Rear camera']),
  ('Citroen','C3','1.2L',5,5,2, ARRAY['Bluetooth','Air conditioning']),
  ('Dodge','Charger','3.6L V6',5,4,3, ARRAY['Apple CarPlay','Rear camera']),
  ('FIAT','500','1.4L',4,3,1, ARRAY['Bluetooth','Easy to park']),
  ('Ford','Escape','1.5L Turbo',5,5,3, ARRAY['Apple CarPlay','Rear camera']),
  ('GAC','GS3','1.5L Turbo',5,5,2, ARRAY['Rear camera','Bluetooth']),
  ('GAC','M8','2.0L Turbo',7,5,4, ARRAY['7 seats','Captain chairs','Rear camera']),
  ('Hyundai','Accent','1.6L',5,4,2, ARRAY['Bluetooth','Air conditioning']),
  ('Hyundai','Creta','1.5L',5,5,2, ARRAY['Apple CarPlay','Rear camera']),
  ('Hyundai','Elantra','2.0L',5,4,3, ARRAY['Apple CarPlay','Rear camera']),
  ('Hyundai','i10 Grand','1.2L',5,5,1, ARRAY['Bluetooth','Easy to park']),
  ('Hyundai','Santa Fe','2.5L',7,5,4, ARRAY['7 seats','Apple CarPlay','Rear camera']),
  ('Jetour','T2','2.0L Turbo',5,5,4, ARRAY['Panoramic screen','Rear camera']),
  ('Mercedes-Benz','GLB 250','2.0L Turbo',7,5,3, ARRAY['7 seats','Leather seats','Apple CarPlay']),
  ('Mercedes-Benz','GLE 53','3.0L Turbo hybrid',5,5,4, ARRAY['AMG','Leather seats','Panoramic roof','Apple CarPlay']),
  ('Mercedes-Benz','S 580','4.0L V8 Turbo',5,4,3, ARRAY['Chauffeur-class comfort','Massage seats','Panoramic roof']),
  ('MG','ZS','1.5L',5,5,2, ARRAY['Rear camera','Bluetooth']),
  ('MINI','Cooper','1.5L Turbo',4,3,1, ARRAY['Apple CarPlay','Easy to park']),
  ('Mitsubishi','ASX','2.0L',5,5,2, ARRAY['Rear camera','Bluetooth']),
  ('Nissan','Kicks','1.6L',5,5,2, ARRAY['Apple CarPlay','Rear camera']),
  ('Nissan','Patrol','V6',7,5,5, ARRAY['7 seats','4x4','Rear camera']),
  ('Nissan','Patrol Platinum','3.5L V6 Twin-turbo',7,5,5, ARRAY['7 seats','4x4','Leather seats','Apple CarPlay']),
  ('Opel','Crossland','1.2L Turbo',5,5,2, ARRAY['Apple CarPlay','Rear camera']),
  ('Toyota','Corolla','1.6L',5,4,3, ARRAY['Apple CarPlay','Rear camera']),
  ('Toyota','Fortuner','2.7L',7,5,4, ARRAY['7 seats','4x4','Rear camera']),
  ('Toyota','Yaris','1.5L',5,4,2, ARRAY['Bluetooth','Air conditioning'])
) v(m, mo, e, s, d, b, f)
ON CONFLICT DO NOTHING;
