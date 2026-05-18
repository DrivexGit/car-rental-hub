-- Migration: Add vehicle_model_prices table
-- This table lets admin set base daily/weekly/monthly prices per make+model
-- and apply them in bulk to all matching vehicles.
-- Created at: 2026-05-18

CREATE TABLE IF NOT EXISTS public.vehicle_model_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id),
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    daily_price NUMERIC,
    weekly_price NUMERIC,
    monthly_price NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (tenant_id, make, model)
);

-- Enable RLS
ALTER TABLE public.vehicle_model_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read vehicle_model_prices" ON public.vehicle_model_prices
    FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Staff can insert vehicle_model_prices" ON public.vehicle_model_prices
    FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Staff can update vehicle_model_prices" ON public.vehicle_model_prices
    FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Staff can delete vehicle_model_prices" ON public.vehicle_model_prices
    FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant_id());

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.update_vehicle_model_prices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vehicle_model_prices_updated_at ON public.vehicle_model_prices;
CREATE TRIGGER trg_vehicle_model_prices_updated_at
    BEFORE UPDATE ON public.vehicle_model_prices
    FOR EACH ROW EXECUTE FUNCTION public.update_vehicle_model_prices_updated_at();

-- Function: apply_model_prices_to_vehicles
-- Applies the base prices from vehicle_model_prices to all matching vehicles (same make+model+tenant)
CREATE OR REPLACE FUNCTION public.apply_model_prices_to_vehicles(p_model_price_id UUID)
RETURNS INT AS $$
DECLARE
    v_rec RECORD;
    v_count INT;
BEGIN
    -- Fetch the model price record
    SELECT * INTO v_rec FROM public.vehicle_model_prices WHERE id = p_model_price_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Model price record % not found', p_model_price_id;
    END IF;

    -- Update all vehicles matching make + model + tenant
    UPDATE public.vehicles
    SET
        daily_price   = COALESCE(v_rec.daily_price,   daily_price),
        weekly_price  = COALESCE(v_rec.weekly_price,  weekly_price),
        monthly_price = COALESCE(v_rec.monthly_price, monthly_price)
    WHERE
        LOWER(make)  = LOWER(v_rec.make)
        AND LOWER(model) = LOWER(v_rec.model)
        AND tenant_id = v_rec.tenant_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;
