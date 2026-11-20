-- Native app push: the Android app (Firebase Cloud Messaging) and the iPhone app (APNs) store a device token
-- in push_subscriptions next to the site's web-push subscriptions. For them `endpoint` is the token and the
-- web-push keys are empty.
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'web' CHECK (platform IN ('web','fcm','apns')),
  ALTER COLUMN p256dh DROP NOT NULL,
  ALTER COLUMN auth DROP NOT NULL;

-- A phone signs in as a new customer: its token moves to that customer (RLS would refuse to touch the old row).
CREATE OR REPLACE FUNCTION public.register_device(p_token text, p_platform text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR p_platform NOT IN ('fcm','apns') OR coalesce(length(p_token), 0) NOT BETWEEN 16 AND 4096 THEN
    RAISE EXCEPTION 'invalid device';
  END IF;
  DELETE FROM push_subscriptions WHERE endpoint = p_token AND platform = p_platform;
  INSERT INTO push_subscriptions (user_id, kind, endpoint, platform) VALUES (auth.uid(), 'customer', p_token, p_platform);
END $$;
REVOKE ALL ON FUNCTION public.register_device(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.register_device(text, text) TO authenticated;
