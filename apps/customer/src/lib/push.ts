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
  const key = b64(import.meta.env.VITE_VAPID_PUBLIC_KEY);
  const subscribe = () => reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  let sub = await reg.pushManager.getSubscription();
  // made with an older server key: pushes signed with the current key would be refused, so start over
  if (sub && !sameKey(sub.options.applicationServerKey, key)) { await sub.unsubscribe(); sub = null; }
  sub ??= await subscribe();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return perm;
  const save = (s: PushSubscription) => {
    const j = s.toJSON();
    return supabase.from("push_subscriptions").upsert(
      { user_id: data.user!.id, kind, endpoint: j.endpoint!, p256dh: j.keys!.p256dh, auth: j.keys!.auth },
      { onConflict: "endpoint" },
    );
  };
  if ((await save(sub)).error) {
    // this phone's subscription is still stored for another account (signed out without the app): use a fresh one
    await sub.unsubscribe();
    await save(await subscribe());
  }
  return perm;
}

/** On sign-out: this phone stops getting the customer's alerts, so the next person who signs in here never sees them. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

const sameKey = (a: ArrayBuffer | null, b: Uint8Array) => !!a && a.byteLength === b.length && new Uint8Array(a).every((x, i) => x === b[i]);
