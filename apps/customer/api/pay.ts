import { admin, fail, getCustomer, json, markPaidIfCovered, remainingDue } from "./_lib.js";
import { createCheckout, getCheckout } from "./_stripe.js";

// Pay an invoice. Provider, in order of preference:
//  - STRIPE_SECRET_KEY: a Stripe Checkout page; the app calls action "confirm" when the customer comes back (the webhook also marks it).
//  - ZIINA_API_KEY: a Ziina payment page (kept until Stripe is live).
//  - neither: a test payment only when ALLOW_TEST_PAYMENTS=true; otherwise the payment is refused.
// The amount charged is what is still owed, so a customer can pay an invoice in parts.
export async function POST(req: Request) {
  const me = await getCustomer(req);
  if (!me) return fail("Please sign in again.", 401);
  const { action = "start", invoiceId, returnUrl, paymentId } = await req.json().catch(() => ({}));
  const db = admin();
  const ziina = process.env.ZIINA_API_KEY;

  if (action === "confirm") {
    const { data: p } = await db.from("payments").select("*").eq("id", paymentId).eq("customer_id", me.id).maybeSingle();
    if (!p) return fail("Payment not found.", 404);
    if (p.provider === "stripe" && process.env.STRIPE_SECRET_KEY) {
      const s = await getCheckout(p.provider_ref);
      if (s.paid) {
        await db.from("payments").update({ status: "succeeded" }).eq("id", p.id).eq("status", "pending");
        await markPaidIfCovered(p.invoice_id);
      }
      return json({ paid: s.paid, invoiceId: p.invoice_id });
    }
    if (!ziina) return fail("Payment not found.", 404);
    const r = await fetch(`https://api-v2.ziina.com/api/payment_intent/${p.provider_ref}`, { headers: { Authorization: `Bearer ${ziina}` } });
    const intent = await r.json();
    const ok = intent?.status === "completed";
    await db.from("payments").update({ status: ok ? "succeeded" : intent?.status === "failed" ? "failed" : "pending" }).eq("id", p.id);
    if (ok) await markPaidIfCovered(p.invoice_id);
    return json({ paid: ok, invoiceId: p.invoice_id });
  }

  const { data: inv } = await db.from("invoices").select("*").eq("id", invoiceId).eq("customer_id", me.id).maybeSingle();
  if (!inv) return fail("Invoice not found.", 404);
  if (inv.status !== "pending") return fail("This invoice is already paid.");
  if (inv.consolidated_into) return fail("This invoice is billed in your monthly invoice.");
  const due = await remainingDue(inv.id, inv.amount);
  if (due <= 0) return fail("This invoice is already paid.");
  const category = inv.reservation_id ? "rental" : "other";

  if (process.env.STRIPE_SECRET_KEY) {
    const { data: pay } = await db.from("payments").insert({ tenant_id: me.tenant_id, invoice_id: inv.id, customer_id: me.id, amount: due, provider: "stripe", category }).select("id").single();
    const back = `${String(returnUrl).split("?")[0]}?payment=${pay!.id}`;
    try {
      const session = await createCheckout({ paymentId: pay!.id, invoiceNumber: inv.number, amount: due, successUrl: back, cancelUrl: back });
      await db.from("payments").update({ provider_ref: session.id }).eq("id", pay!.id);
      return json({ url: session.url });
    } catch (err: any) {
      await db.from("payments").update({ status: "failed" }).eq("id", pay!.id);
      return fail(err?.message || "Payment provider error", 502);
    }
  }

  if (!ziina) {
    // without a provider the invoice is never paid for free: a test payment only when ALLOW_TEST_PAYMENTS is set (never in production)
    if (process.env.ALLOW_TEST_PAYMENTS !== "true") return fail("Online payment is not available yet. Please pay at our office.", 503);
    await db.from("payments").insert({ tenant_id: me.tenant_id, invoice_id: inv.id, customer_id: me.id, amount: due, provider: "test", status: "succeeded", category });
    await markPaidIfCovered(inv.id);
    return json({ paid: true, test: true, remaining: await remainingDue(inv.id, inv.amount) });
  }

  const { data: pay } = await db.from("payments").insert({ tenant_id: me.tenant_id, invoice_id: inv.id, customer_id: me.id, amount: due, provider: "ziina", category }).select("id").single();
  const back = `${String(returnUrl).split("?")[0]}?payment=${pay!.id}`;
  const r = await fetch("https://api-v2.ziina.com/api/payment_intent", {
    method: "POST",
    headers: { Authorization: `Bearer ${ziina}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: Math.round(due * 100), currency_code: "AED", message: `Drivex ${inv.number}`, success_url: back, cancel_url: back, test: process.env.ZIINA_TEST_MODE === "true" }),
  });
  const data = await r.json();
  if (!r.ok) return fail(data?.message || "Payment provider error", 502);
  await db.from("payments").update({ provider_ref: data.id }).eq("id", pay!.id);
  return json({ url: data.redirect_url });
}
