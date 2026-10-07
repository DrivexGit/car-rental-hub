-- Sign-in attempt log used by apps/customer/api/auth.ts to rate limit code requests and wrong-code guesses.
-- Written and read only by the server (service role): RLS is on and no policy exists, so the app cannot touch it.
-- Additive only. Do not apply to production without approval.

CREATE TABLE IF NOT EXISTS public.auth_attempts (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind       text NOT NULL CHECK (kind IN ('send', 'verify_fail')),
  phone      text,
  ip         text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_auth_attempts_phone ON public.auth_attempts (kind, phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip    ON public.auth_attempts (kind, ip, created_at DESC);
