-- AI check of uploaded documents: the expiry date it read, and its full result.
ALTER TABLE public.customer_documents ADD COLUMN IF NOT EXISTS expires_at date;
ALTER TABLE public.customer_documents ADD COLUMN IF NOT EXISTS ai_result jsonb;
