-- Migration: Strip n8n automation footer from message text
-- Author: Antigravity
-- Date: 2026-04-13

-- 1) Create the cleanup function
CREATE OR REPLACE FUNCTION public.clean_n8n_footer()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process if message_text contains the footer
    IF NEW.message_text LIKE '%This message was sent automatically with n8n%' THEN
        NEW.message_text := REPLACE(NEW.message_text, 'This message was sent automatically with n8n', '');
        -- Trim whitespace and potential leading/trailing newlines
        NEW.message_text := TRIM(BOTH E'\n' FROM TRIM(NEW.message_text));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2) Create the trigger to run BEFORE INSERT or UPDATE
DROP TRIGGER IF EXISTS trg_clean_n8n_footer ON public.messages;
CREATE TRIGGER trg_clean_n8n_footer
BEFORE INSERT OR UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.clean_n8n_footer();

-- 3) Clean up historical data
UPDATE public.messages 
SET message_text = TRIM(BOTH E'\n' FROM TRIM(REPLACE(message_text, 'This message was sent automatically with n8n', '')))
WHERE message_text LIKE '%This message was sent automatically with n8n%';
