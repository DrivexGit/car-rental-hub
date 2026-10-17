import { admin, busyIds, fail, getCustomer, json, PERIOD_DAYS, type Period } from "./_lib.js";
import { RENTAL_VAT } from "../src/data/pricing.js";
import { uaeToday } from "./_billing.js";

// Extends an active reservation by N days and adds an invoice for the extra days.
export async function POST(req: Request) {
  const me = await getCustomer(req);
  if (!me) return fail("Please sign in again.", 401);
  const { reservationId, days } = await req.json().catch(() => ({}));
  const d = Number(days);
  if (![1, 3, 7, 30].includes(d)) return fail("Invalid extension.");

  const db = admin();
  const { data: r } = await db.from("reservations").select("*, vehicles(make,model,daily_price,weekly_price,monthly_price)")
    .eq("id", reservationId).eq("customer_id", me.id).maybeSingle();
  if (!r || r.status !== "confirmed") return fail("Only confirmed rentals can be extended.");

  const newEnd = new Date(new Date(r.end_datetime).getTime() + d * 86400000);
  const busy = await busyIds(r.end_datetime, newEnd.toISOString(), r.id);
  if (busy.has(r.vehicle_id)) return fail("This car is booked right after your rental. Please contact us.", 409);

  const period = (r.rental_period || "daily") as Period;
  const v = r.vehicles;
  const unit = Number(period === "daily" ? v.daily_price : period === "weekly" ? v.weekly_price : v.monthly_price);
  const amount = Math.round((unit / PERIOD_DAYS[period]) * d); // the price includes VAT

  await db.from("reservations").update({ end_datetime: newEnd.toISOString(), total_amount: Number(r.total_amount || 0) + amount }).eq("id", r.id);
  const description = `Extension +${d} day${d > 1 ? "s" : ""} — ${v.make} ${v.model}`;
  const { data: inv, error: invErr } = await db.from("invoices").insert({
    tenant_id: me.tenant_id, customer_id: me.id, reservation_id: r.id, amount, description, due_date: uaeToday(),
  }).select("id").single();
  if (invErr) return fail(invErr.message, 500);
  const { error: itemErr } = await db.from("invoice_items").insert({ tenant_id: me.tenant_id, invoice_id: inv!.id, sort: 0, description, category: "rental", amount, vat_rate: RENTAL_VAT });
  if (itemErr) return fail(itemErr.message, 500);
  return json({ invoiceId: inv!.id, amount, end: newEnd.toISOString() });
}
