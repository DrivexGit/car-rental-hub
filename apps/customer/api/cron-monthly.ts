import { admin, fail, json } from "./_lib.js";
import { planConsolidation, planSalik, previousMonth, type Plan } from "./_billing.js";

// Runs on the 1st of each month (see vercel.json). Bills last month's Salik and parking in one invoice per customer,
// and puts the open rental invoices of "pay at month end" customers into one invoice per customer.
// Vercel sends CRON_SECRET as a bearer token, so nobody else can run it.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return fail("Not allowed.", 401);

  const db = admin();
  const { end, label } = previousMonth(new Date());

  const { data: fines, error: fineError } = await db.from("fines").select("id,tenant_id,customer_id,type,amount,occurred_at")
    .is("invoice_id", null).in("type", ["salik", "salik_parking"]).lt("occurred_at", end); // older unbilled ones too, if they were entered late
  if (fineError) return fail(fineError.message, 500);
  const salik = planSalik(fines ?? [], label);
  for (const p of salik) await createInvoice(db, p, "fines").catch((e) => console.error("salik invoice", p.customer_id, e));

  const { data: monthly, error: custError } = await db.from("customers").select("id").eq("pay_monthly", true);
  if (custError) return fail(custError.message, 500);
  const payMonthly = new Set((monthly ?? []).map((c) => c.id));
  let rentals: Plan[] = [];
  if (payMonthly.size) {
    const { data: invoices, error: invError } = await db.from("invoices").select("id,tenant_id,customer_id,amount,issued_at,consolidated_into,status")
      .in("customer_id", [...payMonthly]).eq("status", "pending").is("consolidated_into", null).not("reservation_id", "is", null)
      .lt("issued_at", end);
    if (invError) return fail(invError.message, 500);
    rentals = planConsolidation((invoices ?? []) as any, payMonthly, label);
    for (const p of rentals) await createInvoice(db, p, "invoices").catch((e) => console.error("monthly invoice", p.customer_id, e));
  }
  return json({ month: label, salikInvoices: salik.length, monthlyRentalInvoices: rentals.length });
}

/** Creates the invoice for a plan and links the rows it bills, so they are never billed twice. */
async function createInvoice(db: ReturnType<typeof admin>, p: Plan, linkTable: "fines" | "invoices") {
  const { data: inv, error } = await db.from("invoices").insert({ tenant_id: p.tenant_id, customer_id: p.customer_id, amount: p.amount, description: p.description, status: "pending" }).select("id").single();
  if (error) throw error;
  const link = linkTable === "fines" ? { invoice_id: inv.id } : { consolidated_into: inv.id };
  const { error: linkError } = await db.from(linkTable).update(link).in("id", p.ids);
  if (linkError) throw linkError;
}
