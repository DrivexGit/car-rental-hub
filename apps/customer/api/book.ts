import { admin, busyIds, fail, getCustomer, json, PERIOD_DAYS, slug, type Period } from "./_lib.js";
import { extrasTotal, isExtra } from "../src/data/pricing.js";
import { missingDocuments } from "../src/data/documents.js";
import { TERMS_VERSION } from "../src/data/terms.js";

// Creates a pending reservation + invoice. Price, discount and the actual car are decided here, never by the client.
export async function POST(req: Request) {
  const me = await getCustomer(req);
  if (!me) return fail("Please sign in again.", 401);
  const { modelId, period, qty, pickup, extras = [], terms } = await req.json().catch(() => ({}));
  if (!(period in PERIOD_DAYS)) return fail("Choose daily, weekly or monthly.");
  const n = Number(qty);
  if (!Number.isInteger(n) || n < 1 || n > (period === "daily" ? 29 : 12)) return fail("Invalid rental length.");
  const start = new Date(`${pickup}T10:00:00+04:00`);
  if (isNaN(+start) || start.getTime() < Date.now() - 86400000) return fail("Choose a pickup date from today.");
  const days = PERIOD_DAYS[period as Period] * n;
  const end = new Date(start.getTime() + days * 86400000);
  const ex = [...new Set(Array.isArray(extras) ? (extras as unknown[]).filter((e): e is string => typeof e === "string" && isExtra(e)) : [])];

  if (terms !== true) return fail("Please accept the Terms & Rental rules to book.");

  const db = admin();
  // The app already asks for the documents first; this keeps the rule even if someone calls the API directly.
  // A customer without a lead cannot upload documents (customer_documents.lead_id is required), so this is a set-up problem, not "no documents".
  if (!me.lead_id) return fail("Your account is not fully set up. Please contact support.", 409);
  if (!me.email?.trim()) return fail("Please add your email in your profile first.", 409);
  const { data: docRows, error: docErr } = await db.from("customer_documents").select("document_type,verification_status")
    .eq("lead_id", me.lead_id).eq("tenant_id", me.tenant_id);
  if (docErr) return fail(docErr.message, 500);
  if (missingDocuments((docRows ?? []).map((d) => ({ type: d.document_type, status: d.verification_status }))).length)
    return fail("Please upload your Emirates ID or passport and your driving licence first (Profile > Documents).", 403);
  const { data: cars } = await db.from("vehicles").select("id,make,model,plate_number,daily_price,weekly_price,monthly_price,status")
    .eq("tenant_id", me.tenant_id).eq("is_active", true).not("status", "in", "(maintenance,unavailable)");
  const units = (cars ?? []).filter((c) => slug(c.make, c.model) === modelId);
  if (!units.length) return fail("This car is no longer available.");
  const busy = await busyIds(start.toISOString(), end.toISOString());
  const car = units.find((c) => !busy.has(c.id));
  if (!car) return fail("This car is booked for those dates. Please pick other dates.", 409);

  const unit = Number(period === "daily" ? car.daily_price : period === "weekly" ? car.weekly_price : car.monthly_price);
  const { data: offer } = await db.from("offers").select("discount_pct").eq("tenant_id", me.tenant_id).eq("kind", "car")
    .eq("is_active", true).ilike("title", `${car.make} ${car.model}`).maybeSingle();
  const off = offer?.discount_pct ?? 0;
  const base = Math.round(unit * n * (1 - off / 100));
  const extrasCost = extrasTotal(ex, { base, period: period as Period, qty: n });
  const total = base + extrasCost;

  const { data: r, error } = await db.from("reservations").insert({
    tenant_id: me.tenant_id, vehicle_id: car.id, lead_id: me.lead_id, customer_id: me.id, source: "app",
    terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION,
    status: "pending", reservation_type: "booking", start_datetime: start.toISOString(), end_datetime: end.toISOString(),
    pickup_location: "Drivex, Dubai", return_location: "Drivex, Dubai", customer_name_snapshot: me.full_name,
    customer_phone_snapshot: me.phone, rental_period: period, extras: ex, total_amount: total,
    price_note: `${n} × ${period} @ ${unit}${off ? ` −${off}%` : ""} + extras ${extrasCost}`,
  }).select("id").single();
  if (error) return fail(error.message, 500);

  const { data: inv } = await db.from("invoices").insert({
    tenant_id: me.tenant_id, customer_id: me.id, reservation_id: r.id, amount: total,
    description: `Rental ${car.make} ${car.model} (${n} ${period})`,
  }).select("id").single();
  return json({ reservationId: r.id, invoiceId: inv!.id, total });
}
