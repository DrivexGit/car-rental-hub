-- Migration to add site settings and price multiplier function
-- Created at: 2026-05-18

-- Create site_settings table
CREATE TABLE IF NOT EXISTS public.site_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_slug TEXT UNIQUE NOT NULL,
    site_name TEXT NOT NULL,
    price_multiplier NUMERIC DEFAULT 1.0 NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Policies for staff
CREATE POLICY "Staff can read site_settings" ON public.site_settings 
    FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Staff can update site_settings" ON public.site_settings 
    FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Staff can insert site_settings" ON public.site_settings 
    FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());

-- Insert specific sites requested by user
-- Note: tenant_id is left NULL here as we don't know the specific tenant ID in the migration.
-- Users can assign them or create new ones in the UI.
INSERT INTO public.site_settings (site_slug, site_name, price_multiplier)
VALUES 
    ('drivex.ae', 'Drivex', 1.1),
    ('jumeirahcarrental.ae', 'Jumeirah Car Rental', 1.0),
    ('meydancarrental.ae', 'Meydan Car Rental', 0.95)
ON CONFLICT (site_slug) DO UPDATE 
SET price_multiplier = EXCLUDED.price_multiplier;

-- Create function to get vehicles with applied multiplier
CREATE OR REPLACE FUNCTION public.get_vehicles_for_site(p_site_slug TEXT)
RETURNS TABLE (
    id UUID,
    plate_number TEXT,
    make TEXT,
    model TEXT,
    daily_price NUMERIC,
    weekly_price NUMERIC,
    monthly_price NUMERIC
) AS $$
DECLARE
    v_multiplier NUMERIC;
    v_tenant_id UUID;
BEGIN
    -- Get multiplier and tenant_id for the site
    SELECT price_multiplier, tenant_id INTO v_multiplier, v_tenant_id FROM public.site_settings WHERE site_slug = p_site_slug;
    
    -- Fallback to 1.0 if not found
    IF v_multiplier IS NULL THEN
        v_multiplier := 1.0;
    END IF;

    RETURN QUERY
    SELECT 
        v.id,
        v.plate_number,
        v.make,
        v.model,
        ROUND(v.daily_price * v_multiplier, 0),
        ROUND(v.weekly_price * v_multiplier, 0),
        ROUND(v.monthly_price * v_multiplier, 0)

    FROM public.vehicles v
    WHERE v.is_active = true
      AND (v_tenant_id IS NULL OR v.tenant_id = v_tenant_id);
END;
$$ LANGUAGE plpgsql STABLE;
