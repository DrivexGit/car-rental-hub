-- "Pay at month end": such a customer's bookings are confirmed without paying at checkout.
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS pay_monthly boolean NOT NULL DEFAULT false;
