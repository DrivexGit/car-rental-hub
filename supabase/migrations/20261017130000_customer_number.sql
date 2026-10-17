-- Customer number and nationality, printed on the invoice ("Zohere Sista #23446", "Nationality: France").
-- Existing customers get a number now; new ones get the next number automatically.
-- The first number is a starting point to confirm with DriveX; it only needs to be unique.
CREATE SEQUENCE IF NOT EXISTS public.customer_no_seq START 30000;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS customer_no bigint,
  ADD COLUMN IF NOT EXISTS nationality text;

UPDATE public.customers SET customer_no = nextval('public.customer_no_seq') WHERE customer_no IS NULL;

ALTER TABLE public.customers ALTER COLUMN customer_no SET DEFAULT nextval('public.customer_no_seq');
CREATE UNIQUE INDEX IF NOT EXISTS customers_customer_no_key ON public.customers (customer_no);
