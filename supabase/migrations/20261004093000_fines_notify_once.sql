-- A fine that already has an invoice is announced by the invoice notification; don't notify twice.
DROP TRIGGER IF EXISTS notify_fines ON public.fines;
CREATE TRIGGER notify_fines AFTER INSERT ON public.fines FOR EACH ROW WHEN (NEW.invoice_id IS NULL) EXECUTE FUNCTION public.notify_events();
