import { createHmac } from "node:crypto";
import { admin, anonClient, fail, json, TENANT_ID } from "./_lib.js";
import { allowed, clientIp, record } from "./_ratelimit.js";

// Phone sign-in. Each customer is a Supabase auth user with a hidden email + server-derived password,
// so the app gets a normal Supabase session and RLS works.
// ponytail: OTP is checked against OTP_TEST_CODE until an SMS provider is configured; then send/verify a real code here.

const normalize = (p: string) => {
  const ascii = String(p || "").replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660));
  const d = ascii.replace(/\D/g, "").replace(/^00/, "").replace(/^0/, "");
  const full = d.startsWith("971") ? d : `971${d}`;
  return /^9715\d{8}$/.test(full) ? `+${full}` : null;
};
const emailFor = (phone: string) => `c${phone.slice(1)}@customers.drivex.app`;
const passwordFor = (phone: string) => createHmac("sha256", process.env.AUTH_SECRET!).update(phone).digest("hex");

const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";

export async function POST(req: Request) {
  const { action, phone: raw, code, name } = await req.json().catch(() => ({}));
  const phone = normalize(raw);
  if (!phone) return fail("Enter a valid UAE mobile number.");

  const who = { phone, ip: clientIp(req) };

  if (action === "send") {
    // ponytail: when an SMS provider is connected, send the real code here (after this check).
    if (!(await allowed("send", who, { phone: [5, 10], ip: [20, 60] }))) return fail(TOO_MANY, 429);
    await record("send", who);
    return json({ ok: true, testMode: !process.env.SMS_PROVIDER });
  }

  if (action !== "verify") return fail("Unknown action");
  // Wrong guesses are limited, so a 6-digit code cannot be brute forced.
  if (!(await allowed("verify_fail", who, { phone: [5, 10], ip: [30, 60] }))) return fail(TOO_MANY, 429);
  if (String(code) !== (process.env.OTP_TEST_CODE || "")) {
    await record("verify_fail", who);
    return fail("Wrong code. Please try again.", 401);
  }

  const db = admin();
  const { data: existing } = await db.from("customers").select("id").eq("tenant_id", TENANT_ID).eq("phone", phone).maybeSingle();

  if (!existing) {
    const fullName = String(name || "").trim();
    if (fullName.length < 2) return json({ needName: true });

    let userId: string | undefined;
    const created = await db.auth.admin.createUser({ email: emailFor(phone), password: passwordFor(phone), email_confirm: true, user_metadata: { phone, full_name: fullName, kind: "customer" } });
    userId = created.data.user?.id;
    if (!userId) {
      // Auth user exists from an earlier half-finished sign-up: reuse it.
      const s = await anonClient().auth.signInWithPassword({ email: emailFor(phone), password: passwordFor(phone) });
      userId = s.data.user?.id;
    }
    if (!userId) return fail("Could not create your account.", 500);

    const { data: lead } = await db.from("leads").insert({
      tenant_id: TENANT_ID, full_name: fullName, whatsapp_number: phone.slice(1), source: "website",
      primary_channel: "app", status: "new", current_stage: "new_lead",
    }).select("id").single();
    const { error } = await db.from("customers").insert({ id: userId, tenant_id: TENANT_ID, lead_id: lead?.id ?? null, phone, full_name: fullName });
    if (error) return fail(error.message, 500);
  }

  const { data, error } = await anonClient().auth.signInWithPassword({ email: emailFor(phone), password: passwordFor(phone) });
  if (error || !data.session) return fail("Sign-in failed.", 500);
  return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
}
