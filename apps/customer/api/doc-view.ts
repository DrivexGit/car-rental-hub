import { createHmac, timingSafeEqual } from "node:crypto";
import { admin, fail, getCustomer, json } from "./_lib.js";
import { allowed, clientIp, record } from "./_ratelimit.js";
import { checkWhatsAppCode, sendWhatsAppCode, whatsappOtpOn } from "./_whatsapp-otp.js";

// Viewing an approved document again needs a code sent to the customer's number (WhatsApp, same as sign-in), so a lost or
// lent phone cannot show the documents. Only this view is gated: the documents screen and uploads work as before.
//   send:   sends the code (when WhatsApp is off, the test code OTP_TEST_CODE is used, as at sign-in)
//   unlock: checks the code and returns a token that is good for five minutes. The app keeps it in memory only.
//   view:   with a valid token, returns a link to the file that expires in 60 seconds.

const UNLOCK_MS = 5 * 60_000;
const LINK_SECONDS = 60;

const sign = (customerId: string, exp: number) => createHmac("sha256", process.env.AUTH_SECRET!).update(`doc-view:${customerId}:${exp}`).digest("hex");
const makeToken = (customerId: string) => {
  const exp = Date.now() + UNLOCK_MS;
  return { token: `${exp}.${sign(customerId, exp)}`, expiresAt: exp };
};
const checkToken = (customerId: string, token: unknown) => {
  if (typeof token !== "string") return false;
  const [expRaw, mac] = token.split(".");
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now() || !mac) return false;
  const a = Buffer.from(mac), b = Buffer.from(sign(customerId, exp));
  return a.length === b.length && timingSafeEqual(a, b);
};

export async function POST(req: Request) {
  const me = await getCustomer(req);
  if (!me) return fail("Please sign in again.", 401);
  const body = await req.json().catch(() => ({}));
  const who = { phone: me.phone, ip: clientIp(req) };

  if (body.action === "send") {
    if (!(await allowed("send", who, { phone: [5, 10], ip: [20, 60] }))) return fail("Too many attempts. Please wait a few minutes and try again.", 429);
    await record("send", who);
    if (whatsappOtpOn()) {
      const sent = await sendWhatsAppCode(me.phone).catch(() => false);
      if (!sent) return fail("We could not send the code on WhatsApp. Please try again.", 502);
      return json({ ok: true, testMode: false });
    }
    return json({ ok: true, testMode: true });
  }

  if (body.action === "unlock") {
    if (!(await allowed("verify_fail", who, { phone: [5, 10], ip: [30, 60] }))) return fail("Too many attempts. Please wait a few minutes and try again.", 429);
    const code = String(body.code ?? "");
    const valid = whatsappOtpOn() ? await checkWhatsAppCode(me.phone, code) : code === (process.env.OTP_TEST_CODE || "");
    if (!valid) {
      await record("verify_fail", who);
      return fail("Wrong code. Please try again.", 401);
    }
    return json(makeToken(me.id));
  }

  if (body.action === "view") {
    if (!checkToken(me.id, body.unlock)) return fail("Please enter the code again.", 403);
    if (typeof body.documentId !== "string") return fail("Missing document.");
    const db = admin();
    const { data: doc } = await db.from("customer_documents").select("*").eq("id", body.documentId).maybeSingle();
    if (!doc || doc.lead_id !== me.lead_id || doc.tenant_id !== me.tenant_id) return fail("Document not found.", 404);
    if (doc.verification_status !== "approved") return fail("This document is not approved yet.", 403);
    const { data: link, error } = await db.storage.from(doc.storage_bucket || "customer-documents").createSignedUrl(doc.storage_path, LINK_SECONDS);
    if (error || !link) return fail("Could not open the document. Please try again.", 500);
    return json({ url: link.signedUrl, expiresIn: LINK_SECONDS });
  }

  return fail("Unknown action");
}
