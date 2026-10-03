import { admin, fail, getCustomer, json, markInvoicePaid } from "./_lib.js";

// Pay an invoice. With ZIINA_API_KEY: create a Ziina payment intent and return its checkout URL;
// the app calls action "confirm" when the customer comes back. Without a key: test payment, marked paid immediately.
export async function POST(req: Request) {
  const me = await getCustomer(req);
  if (!me) return fail("Please sign in again.", 401);
  const { action = "start", invoiceId, returnUrl, paymentId } = await req.json().catch(() => ({}));
  const db = admin();
  const key = process.env.ZIINA_API_KEY;

  if (action === "confirm") {
    const { data: p } = await db.from("payments").select("*").eq("id", paymentId).eq("customer_id", me.id).maybeSingle();
    if (!p || !key) return fail("Payment not found.", 404);
    const r = await fetch(`https://api-v2.ziina.com/api/payment_intent/${p.provider_ref}`, { headers: { Authorization: `Bearer ${key}` } });
    const intent = await r.json();
    const ok = intent?.status === "completed";
    await db.from("payments").update({ status: ok ? "succeeded" : intent?.status === "failed" ? "failed" : "pending" }).eq("id", p.id);
    if (ok) await markInvoicePaid(p.invoice_id);
    return json({ paid: ok, invoiceId: p.invoice_id });
  }

  const { data: inv } = await db.from("invoices").select("*").eq("id", invoiceId).eq("customer_id", me.id).maybeSingle();
  if (!inv) return fail("Invoice not found.", 404);
  if (inv.status !== "pending") return fail("This invoice is already paid.");

  if (!key) {
    await db.from("payments").insert({ tenant_id: me.tenant_id, invoice_id: inv.id, customer_id: me.id, amount: inv.amount, provider: "test", status: "succeeded" });
    await markInvoicePaid(inv.id);
    return json({ paid: true, test: true });
  }

  const { data: pay } = await db.from("payments").insert({ tenant_id: me.tenant_id, invoice_id: inv.id, customer_id: me.id, amount: inv.amount, provider: "ziina" }).select("id").single();
  const back = `${String(returnUrl).split("?")[0]}?payment=${pay!.id}`;
  const r = await fetch("https://api-v2.ziina.com/api/payment_intent", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: Math.round(Number(inv.amount) * 100), currency_code: "AED", message: `Drivex ${inv.number}`, success_url: back, cancel_url: back, test: process.env.ZIINA_TEST_MODE === "true" }),
  });
  const data = await r.json();
  if (!r.ok) return fail(data?.message || "Payment provider error", 502);
  await db.from("payments").update({ provider_ref: data.id }).eq("id", pay!.id);
  return json({ url: data.redirect_url });
}
