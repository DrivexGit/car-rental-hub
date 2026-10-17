-- Invoice rebuild (Kamyar item 4): one row per charge with its own VAT rate, payment history with categories,
-- a due date, and the seller's TRN and bank details on the tenant (not in the code).

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  sort integer NOT NULL DEFAULT 0,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('rental','delivery','no_deposit','extra_driver','child_seat','insurance','fine','salik','damage','other')),
  discount numeric NOT NULL DEFAULT 0 CHECK (discount >= 0),   -- already taken off `amount`; shown in its own column
  amount numeric NOT NULL,                                       -- what the customer pays for this row, VAT included
  vat_rate numeric NOT NULL DEFAULT 0.05 CHECK (vat_rate IN (0, 0.05)),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customer reads own invoice items" ON public.invoice_items;
CREATE POLICY "Customer reads own invoice items" ON public.invoice_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_items.invoice_id AND i.customer_id = auth.uid()));
DROP POLICY IF EXISTS "Staff all invoice items" ON public.invoice_items;
CREATE POLICY "Staff all invoice items" ON public.invoice_items FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS category text;  -- rental | deposit | fine | salik, for the transactions table

-- Seller details printed on every invoice. Empty until DriveX provides them; the invoice then shows "to be added".
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS trn text,
  ADD COLUMN IF NOT EXISTS legal_address text,
  ADD COLUMN IF NOT EXISTS bank_account_name text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS bic text;

-- Customers need the seller details to see the same invoice in the app. These columns are printed on invoices anyway.
DROP POLICY IF EXISTS "Customer reads seller details" ON public.tenants;
CREATE POLICY "Customer reads seller details" ON public.tenants FOR SELECT TO authenticated USING (public.is_customer());
