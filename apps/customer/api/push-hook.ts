import webpush from "web-push";
import { admin, fail, json } from "./_lib.js";

// Called by the database (pg_net trigger on public.notifications) for every new notification.
// Sends a web-push to all staff devices, or to the customer's devices if their preference allows it.

const PREF: Record<string, string> = { booking_confirmed: "notify_bookings", invoice: "notify_invoices", fine: "notify_invoices", offer: "notify_offers" };
const APP_URL = "https://drivex-customer.vercel.app";
const PANEL_URL = process.env.PANEL_URL || "https://car-rental-hub-kappa.vercel.app";

export async function POST(req: Request) {
  if (!process.env.PUSH_HOOK_SECRET || req.headers.get("x-hook-secret") !== process.env.PUSH_HOOK_SECRET) return fail("Forbidden", 403);
  const n = await req.json();
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const db = admin();

  let userIds: string[] = [];
  if (n.audience === "staff") {
    const { data } = await db.from("staff_profiles").select("id").eq("tenant_id", n.tenant_id).eq("is_active", true);
    userIds = (data ?? []).map((s) => s.id);
  } else if (n.customer_id) {
    const pref = PREF[n.type];
    if (pref) {
      const { data: c } = await db.from("customers").select(pref).eq("id", n.customer_id).maybeSingle();
      if (c && (c as unknown as Record<string, boolean>)[pref] === false) return json({ sent: 0, skipped: "preference" });
    }
    userIds = [n.customer_id];
  }
  if (!userIds.length) return json({ sent: 0 });

  const { data: subs } = await db.from("push_subscriptions").select("*").in("user_id", userIds).eq("kind", n.audience);
  const url = (n.audience === "staff" ? PANEL_URL : APP_URL) + (n.link || "/");
  const payload = JSON.stringify({ title: n.title, body: n.body || "", url, tag: n.type });
  let sent = 0;
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { urgency: n.type === "urgent" ? "high" : "normal" });
      sent++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subscriptions").delete().eq("id", s.id); // expired device
      else console.error("[push]", e?.statusCode, e?.body);
    }
  }));
  return json({ sent });
}
