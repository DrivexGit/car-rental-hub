-- One-time codes sent by WhatsApp at sign-in. Only a hash of the code is stored, and the code expires after 5 minutes.
-- Read and written by the server only (service role), so RLS is on and no policy is given to the app.
CREATE TABLE IF NOT EXISTS public.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON public.otp_codes (phone, created_at DESC);
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
