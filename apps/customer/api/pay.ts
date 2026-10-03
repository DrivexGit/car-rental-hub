// Creates a Ziina payment intent and returns its hosted checkout URL.
// Needs ZIINA_API_KEY; returns 501 when not configured so the app can fall back to a simulated payment.
export async function POST(req: Request) {
  const key = process.env.ZIINA_API_KEY;
  if (!key) return Response.json({ error: "Ziina not configured" }, { status: 501 });

  // ponytail: amount comes from the client. Once invoices live in Supabase, look the amount up by invoice id here.
  const { amount, reference, returnUrl } = await req.json();
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000 || typeof returnUrl !== "string")
    return Response.json({ error: "Invalid payment" }, { status: 400 });

  const r = await fetch("https://api-v2.ziina.com/api/payment_intent", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: Math.round(amount * 100), // fils
      currency_code: "AED",
      message: `Drivex ${String(reference).slice(0, 40)}`,
      success_url: returnUrl,
      cancel_url: returnUrl.split("?")[0],
      test: process.env.ZIINA_TEST_MODE === "true",
    }),
  });
  const data = await r.json();
  if (!r.ok) return Response.json({ error: data?.message || "Ziina error" }, { status: 502 });
  return Response.json({ id: data.id, url: data.redirect_url });
}
