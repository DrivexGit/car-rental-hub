import { admin, busyIds, EXTRAS, fail, getCustomer, json, PERIOD_DAYS, slug, type Period } from "./_lib.js";

// Creates a pending reservation + invoice. Price, discount and the actual car are decided here, never by the client.
export async function POST(req: Request) {
  const me = await getCustomer(req);
  if (!me) return fail("Please sign in again.", 401);
  const { modelId, period, qty, pickup, extras = [] } = await req.json().catch(() => ({}));
  if (!(period in PERIOD_DAYS)) return fail("Choose daily, weekly or monthly.");
  const n = Number(qty);
  if (!Number.isInteger(n) || n < 1 || n > (period === "daily" ? 29 : 12)) return fail("Invalid rental length.");
  const start = new Date(`${pickup}T10:00:00+04:00`);
  if (isNaN(+start) || start.getTime() < Date.now() - 86400000) return fail("Choose a pickup date from today.");
  const days = PERIOD_DAYS[period as Period] * n;
  const end = new Date(start.getTime() + days * 86400000);
  const ex = (extras as string[]).filter((e) => e in EXTRAS);

  const db = admin();
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
  const extrasTotal = ex.reduce((s, e) => s + EXTRAS[e].daily * days, 0);
  const total = base + extrasTotal;

  const { data: r, error } = await db.from("reservations").insert({
    tenant_id: me.tenant_id, vehicle_id: car.id, lead_id: me.lead_id, customer_id: me.id, source: "app",
    status: "pending", reservation_type: "booking", start_datetime: start.toISOString(), end_datetime: end.toISOString(),
    pickup_location: "Drivex, Dubai", return_location: "Drivex, Dubai", customer_name_snapshot: me.full_name,
    customer_phone_snapshot: me.phone, rental_period: period, extras: ex, total_amount: total,
    price_note: `${n} × ${period} @ ${unit}${off ? ` −${off}%` : ""} + extras ${extrasTotal}`,
  }).select("id").single();
  if (error) return fail(error.message, 500);

  const { data: inv } = await db.from("invoices").insert({
    tenant_id: me.tenant_id, customer_id: me.id, reservation_id: r.id, amount: total,
    description: `Rental ${car.make} ${car.model} (${n} ${period})`,
  }).select("id").single();
  return json({ reservationId: r.id, invoiceId: inv!.id, total });
}
