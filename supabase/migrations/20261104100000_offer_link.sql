-- Partner offers can link to the venue's page (Instagram, website), shown as a button in the customer app.
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS link_url text;
