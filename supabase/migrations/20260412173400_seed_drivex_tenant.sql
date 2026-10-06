-- The DriveX tenant was created by hand on production; later migrations seed rows for it.
-- This makes a fresh database (supabase start / db reset) work. No-op on production.
INSERT INTO public.tenants (id, name, slug, is_active)
VALUES ('22c42919-4f33-4463-ae13-39cc26993c64', 'drivex', 'drivex', true)
ON CONFLICT (id) DO NOTHING;
