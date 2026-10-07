import { admin } from "./_lib.js";

// Sliding-window limits backed by the auth_attempts table (see supabase/migrations/20261007120000_auth_attempts.sql).
// A serverless function has no memory between requests, so counters live in the database.
// If the table is missing the check fails open and logs: sign-in keeps working, it just is not limited.

export type Kind = "send" | "verify_fail";
type Who = { phone?: string | null; ip?: string | null };
/** [max attempts, window in minutes] per phone number and per IP address. */
export type Limits = { phone?: [number, number]; ip?: [number, number] };

export const clientIp = (req: Request) => (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;

/** True when the caller is still under every limit. */
export async function allowed(kind: Kind, who: Who, limits: Limits): Promise<boolean> {
  try {
    for (const field of ["phone", "ip"] as const) {
      const value = who[field], limit = limits[field];
      if (!value || !limit) continue;
      const since = new Date(Date.now() - limit[1] * 60000).toISOString();
      const { count, error } = await admin().from("auth_attempts").select("id", { count: "exact", head: true })
        .eq("kind", kind).eq(field, value).gte("created_at", since);
      if (error) throw error;
      if ((count ?? 0) >= limit[0]) return false;
    }
    return true;
  } catch (e) {
    console.error("rate limit check failed; allowing the request (is auth_attempts migrated?)", e);
    return true;
  }
}

export async function record(kind: Kind, who: Who) {
  try {
    await admin().from("auth_attempts").insert({ kind, phone: who.phone ?? null, ip: who.ip ?? null });
    // Keep the table small: rows older than a day are of no use to any window.
    // The builder only sends the request when thenned, so do not just void it.
    admin().from("auth_attempts").delete().lt("created_at", new Date(Date.now() - 86400000).toISOString()).then(() => {}, () => {});
  } catch (e) {
    console.error("could not record auth attempt", e);
  }
}
