import { createHmac, timingSafeEqual } from "node:crypto";

// Stripe Checkout, without the Stripe SDK: plain HTTPS calls and a signature check for webhooks.
// Used when STRIPE_SECRET_KEY is set (a test key `sk_test_...` until DriveX gives the live key).

const API = "https://api.stripe.com/v1";
const auth = () => ({ Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` });

/** Creates a Checkout Session for one payment in AED. Returns the session id and the page the customer is sent to. */
export async function createCheckout(opts: { paymentId: string; invoiceNumber: string; amount: number; successUrl: string; cancelUrl: string }) {
  const form = new URLSearchParams({
    mode: "payment",
    client_reference_id: opts.paymentId,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "aed",
    "line_items[0][price_data][unit_amount]": String(Math.round(opts.amount * 100)),
    "line_items[0][price_data][product_data][name]": `Drivex ${opts.invoiceNumber}`,
    "metadata[payment_id]": opts.paymentId,
  });
  const res = await fetch(`${API}/checkout/sessions`, { method: "POST", headers: { ...auth(), "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Stripe error");
  return { id: data.id as string, url: data.url as string };
}

/** The session as Stripe has it now. `paid` is true once the customer has paid. */
export async function getCheckout(id: string) {
  const res = await fetch(`${API}/checkout/sessions/${encodeURIComponent(id)}`, { headers: auth() });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Stripe error");
  return { paid: data.payment_status === "paid", paymentId: (data.client_reference_id as string) ?? null, sessionId: data.id as string };
}

/** Checks a webhook's Stripe-Signature header against the raw body. Rejects requests older than five minutes. */
export function verifyWebhook(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return header.split(",").filter((p) => p.startsWith("v1=")).some((p) => {
    const sig = Buffer.from(p.slice(3)), exp = Buffer.from(expected);
    return sig.length === exp.length && timingSafeEqual(sig, exp);
  });
}
