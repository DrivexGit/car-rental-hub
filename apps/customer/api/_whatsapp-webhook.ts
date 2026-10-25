import { createHmac, timingSafeEqual } from "node:crypto";
import { admin, fail, json, TENANT_ID } from "./_lib.js";

// WhatsApp Cloud API webhook (Meta). Set this URL in the Meta app under WhatsApp > Configuration:
// Served at /api/whatsapp-webhook through stripe-webhook.ts (12-function Hobby limit).
//   GET  Meta checks the URL once: hub.verify_token must equal WHATSAPP_VERIFY_TOKEN, then hub.challenge is sent back.
//   POST each incoming customer message is saved to the lead's history (messages, inbound) and staff get a notification.
//        The body is signed with the app secret (X-Hub-Signature-256), so WHATSAPP_APP_SECRET is needed; without it
//        the endpoint answers 404, like the Stripe webhook without its secret.
// A message seen twice (Meta retries) is saved once. Delivery and read receipts are ignored.

const verify = (raw: string, header: string | null, secret: string) => {
  const sig = header?.replace(/^sha256=/, "") ?? "";
  const want = createHmac("sha256", secret).update(raw).digest("hex");
  return sig.length === want.length && timingSafeEqual(Buffer.from(sig), Buffer.from(want));
};

const textOf = (m: any): string => {
  if (m.type === "text") return m.text?.body ?? "";
  if (m.type === "button") return m.button?.text ?? "";
  if (m.type === "interactive") return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "";
  if (m.type === "location") return `[location] ${m.location?.latitude}, ${m.location?.longitude}`;
  const caption = m[m.type]?.caption;
  return `[${m.type}]${caption ? " " + caption : ""}`; // image, document, audio, video, sticker...
};

export async function GET(req: Request) {
  const u = new URL(req.url);
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (token && u.searchParams.get("hub.mode") === "subscribe" && u.searchParams.get("hub.verify_token") === token)
    return new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200, headers: { "content-type": "text/plain" } });
  return fail("Forbidden", 403);
}

export async function POST(req: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return fail("Webhook not configured.", 404);
  const raw = await req.text();
  if (!verify(raw, req.headers.get("x-hub-signature-256"), secret)) return fail("Bad signature.", 401);
  const body = JSON.parse(raw);
  if (body.object !== "whatsapp_business_account") return json({ ignored: true });

  const db = admin();
  let saved = 0;
  for (const entry of body.entry ?? []) for (const change of entry.changes ?? []) {
    const v = change.value ?? {};
    for (const m of v.messages ?? []) {
      if (!m.id || !m.from) continue;
      const { data: seen } = await db.from("messages").select("id").eq("channel_message_id", m.id).maybeSingle();
      if (seen) continue;
      const number = String(m.from).replace(/\D/g, "");
      const name = v.contacts?.find((c: any) => c.wa_id === m.from)?.profile?.name ?? null;

      let { data: lead } = await db.from("leads").select("id, full_name, current_stage").eq("tenant_id", TENANT_ID).eq("whatsapp_number", number)
        .order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (!lead) {
        ({ data: lead } = await db.from("leads").insert({
          tenant_id: TENANT_ID, whatsapp_number: number, full_name: name, display_name: name, source: "whatsapp",
          primary_channel: "whatsapp", status: "new", current_stage: "new_lead",
        }).select("id, full_name, current_stage").single());
      }
      if (!lead) { console.error("[whatsapp-webhook] could not find or create a lead for", number); continue; }

      const text = textOf(m);
      const { error } = await db.from("messages").insert({
        tenant_id: TENANT_ID, lead_id: lead.id, direction: "inbound", channel: "whatsapp", message_text: text || "[empty]",
        message_type: m.type ?? "text", channel_message_id: m.id, raw_payload: m, stage_at_time: lead.current_stage ?? null,
        ...(m.timestamp ? { created_at: new Date(Number(m.timestamp) * 1000).toISOString() } : {}),
      });
      if (error) { console.error("[whatsapp-webhook] message not saved", error.message); continue; }
      saved++;
      await db.from("leads").update({ last_message_at: new Date().toISOString() }).eq("id", lead.id);
      await db.from("notifications").insert({
        tenant_id: TENANT_ID, audience: "staff", type: "message", title: `WhatsApp from ${lead.full_name || name || "+" + number}`,
        body: text.slice(0, 140), link: `/leads/${lead.id}`,
      });
    }
  }
  return json({ received: true, saved }); // always 200 for a valid call, or Meta retries
}
