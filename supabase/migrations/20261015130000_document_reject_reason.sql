-- Why a document was rejected. The panel asks for a reason and shows it to the customer in a notification.
ALTER TABLE public.customer_documents ADD COLUMN IF NOT EXISTS reject_reason text;
