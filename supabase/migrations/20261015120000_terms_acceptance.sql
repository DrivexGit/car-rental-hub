-- Terms acceptance at checkout: when the customer ticked "I agree" and which version of the terms it was.
-- Existing reservations stay NULL (they were made before the checkbox existed).
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text;
