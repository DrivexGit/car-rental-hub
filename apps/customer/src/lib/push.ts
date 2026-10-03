import { supabase } from "@/lib/supabase";

const b64 = (s: string) => {
  const p = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + p).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** Asks for permission (if needed) and stores this device's push subscription. Returns the final permission. */
export async function enablePush(kind: "customer" | "staff" = "customer"): Promise<NotificationPermission | "unsupported"> {
  if (!pushSupported()) return "unsupported";
  const perm = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (perm !== "granted") return perm;
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(import.meta.env.VITE_VAPID_PUBLIC_KEY) }));
  const j = sub.toJSON();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    await supabase.from("push_subscriptions").upsert(
      { user_id: data.user.id, kind, endpoint: j.endpoint!, p256dh: j.keys!.p256dh, auth: j.keys!.auth },
      { onConflict: "endpoint" },
    );
  }
  return perm;
}
