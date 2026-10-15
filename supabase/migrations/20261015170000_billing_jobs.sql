-- Monthly billing and document reminders.
-- An invoice that was folded into a monthly invoice points at it, so it is not billed twice and is not paid twice.
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS consolidated_into uuid REFERENCES public.invoices(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_consolidated ON public.invoices(consolidated_into);
-- When the 30-day expiry reminder was sent, so it is sent only once.
ALTER TABLE public.customer_documents ADD COLUMN IF NOT EXISTS expiry_reminded_at timestamptz;
