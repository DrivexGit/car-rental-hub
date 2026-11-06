-- Partner offers may be an intro only, with no discount.
ALTER TABLE public.offers ALTER COLUMN discount_pct DROP NOT NULL;
ALTER TABLE public.offers DROP CONSTRAINT IF EXISTS offers_discount_pct_check;
ALTER TABLE public.offers ADD CONSTRAINT offers_discount_pct_check CHECK (discount_pct IS NULL AND kind = 'partner' OR discount_pct BETWEEN 1 AND 90);
