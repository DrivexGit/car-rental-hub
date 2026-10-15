import { admin, fail, json } from "./_lib.js";
import { addDays, uaeToday } from "./_billing.js";

// Runs every day (see vercel.json). A document that expires within 30 days: the customer and staff are told once.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return fail("Not allowed.", 401);

  const db = admin();
  const today = uaeToday();
  const { data: docs, error } = await db.from("customer_documents").select("id,tenant_id,lead_id,document_type,expires_at")
    .gte("expires_at", today).lte("expires_at", addDays(today, 30)).is("expiry_reminded_at", null)
    .in("verification_status", ["pending", "approved"]);
  if (error) return fail(error.message, 500);

  let reminded = 0;
  for (const d of docs ?? []) {
    const what = String(d.document_type).replace(/_/g, " ");
    const { data: customer } = await db.from("customers").select("id,full_name").eq("lead_id", d.lead_id).maybeSingle();
    if (customer) {
      await db.from("notifications").insert({
        tenant_id: d.tenant_id, audience: "customer", customer_id: customer.id, type: "document",
        title: `Your ${what} expires on ${d.expires_at}`, body: "Upload the new one before it expires so you can keep booking.", link: "/profile/documents",
      });
    }
    await db.from("notifications").insert({
      tenant_id: d.tenant_id, audience: "staff", type: "document",
      title: `${what} expires on ${d.expires_at}`, body: customer?.full_name ?? null, link: "/documents",
    });
    await db.from("customer_documents").update({ expiry_reminded_at: new Date().toISOString() }).eq("id", d.id);
    reminded++;
  }
  return json({ reminded });
}
