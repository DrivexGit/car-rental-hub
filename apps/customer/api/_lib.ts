import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Shared helpers for server functions. Files starting with "_" are not routes on Vercel.

export const TENANT_ID = process.env.TENANT_ID!;
let _admin: SupabaseClient | null = null;
export const admin = () =>
  (_admin ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }));

/** A fresh anon client for password sign-in, so the service-role client never holds a user session. */
export const anonClient = () => createClient(process.env.SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

export const json = (data: unknown, status = 200) => Response.json(data, { status });
export const fail = (message: string, status = 400) => json({ error: message }, status);

export type Customer = { id: string; tenant_id: string; lead_id: string | null; phone: string; full_name: string; email: string | null };

/** Resolves the signed-in customer from the Bearer token, or null. */
export async function getCustomer(req: Request): Promise<Customer | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return null;
  const { data } = await admin().auth.getUser(token);
  if (!data.user) return null;
  const { data: c } = await admin().from("customers").select("*").eq("id", data.user.id).maybeSingle();
  return c as Customer | null;
}

export const slug = (make: string, model: string) => `${make}-${model}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const PERIOD_DAYS = { daily: 1, weekly: 7, monthly: 30 } as const;
export type Period = keyof typeof PERIOD_DAYS;
export const EXTRAS: Record<string, { label: string; daily: number }> = {
  full_cover: { label: "Full insurance cover", daily: 45 },
  extra_driver: { label: "Additional driver", daily: 25 },
  child_seat: { label: "Child seat", daily: 15 },
};

export const HOLD_MINUTES = 30;

/** Vehicle ids that already have an overlapping pending/confirmed/blocked reservation. */
export async function busyIds(from: string, to: string, exceptReservation?: string) {
  let q = admin().from("reservations").select("vehicle_id,status,created_at").in("status", ["pending", "confirmed", "blocked"])
    .lt("start_datetime", to).gt("end_datetime", from);
  if (exceptReservation) q = q.neq("id", exceptReservation);
  const { data } = await q;
  // Unpaid app bookings hold the car for 30 minutes only.
  const holdFrom = Date.now() - HOLD_MINUTES * 60000;
  return new Set((data ?? []).filter((r) => r.status !== "pending" || new Date(r.created_at).getTime() > holdFrom).map((r) => r.vehicle_id as string));
}

/** Marks an invoice paid and confirms its reservation if it was waiting for payment. */
export async function markInvoicePaid(invoiceId: string) {
  const { data: inv } = await admin().from("invoices").update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", invoiceId).eq("status", "pending").select("reservation_id").maybeSingle();
  if (inv?.reservation_id)
    await admin().from("reservations").update({ status: "confirmed" }).eq("id", inv.reservation_id).eq("status", "pending");
}
