import { POST as whatsappPOST } from "./_whatsapp-webhook.js";
import { admin, fail, json, markPaidIfCovered } from "./_lib.js";
import { verifyWebhook } from "./_stripe.js";

// Stripe calls this when a Checkout payment completes, so an invoice is marked paid even if the customer
// never comes back to the app. Needs STRIPE_WEBHOOK_SECRET (the signing secret of this endpoint).
// Hobby plan allows 12 functions, so the WhatsApp webhook shares this one: /api/whatsapp-webhook is rewritten here (vercel.json).
export { GET } from "./_whatsapp-webhook.js";
export async function POST(req: Request) {
  if (req.headers.has("x-hub-signature-256")) return whatsappPOST(req);
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return fail("Webhook not configured.", 404);
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers.get("stripe-signature"), secret)) return fail("Bad signature.", 400);

  const event = JSON.parse(raw);
  if (event.type !== "checkout.session.completed") return json({ ignored: true });
  const session = event.data?.object;
  if (session?.payment_status !== "paid" || !session.client_reference_id) return json({ ignored: true });

  const db = admin();
  // a payment is counted once: only a pending one changes
  const { data: p } = await db.from("payments").update({ status: "succeeded", provider_ref: session.id }).eq("id", session.client_reference_id).eq("status", "pending")
    .select("invoice_id").maybeSingle();
  if (p) await markPaidIfCovered(p.invoice_id);
  return json({ received: true });
}
