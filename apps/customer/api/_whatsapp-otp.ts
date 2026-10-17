import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { admin } from "./_lib.js";

// One-time codes sent by WhatsApp (Cloud API, authentication template). Off until the WhatsApp credentials are set:
// WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_OTP_TEMPLATE (the approved template's name).
// Without them, sign-in keeps using OTP_TEST_CODE.

export const whatsappOtpOn = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_OTP_TEMPLATE);

const TTL_MS = 5 * 60_000;
const MAX_TRIES = 5;
const hash = (phone: string, code: string) => createHmac("sha256", process.env.AUTH_SECRET!).update(`${phone}:${code}`).digest("hex");

/** Makes a new 6-digit code, stores its hash (replacing older codes for this number) and sends it on WhatsApp. */
export async function sendWhatsAppCode(phone: string): Promise<boolean> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const db = admin();
  await db.from("otp_codes").delete().eq("phone", phone);
  const { error } = await db.from("otp_codes").insert({ phone, code_hash: hash(phone, code), expires_at: new Date(Date.now() + TTL_MS).toISOString() });
  if (error) throw error;
  const res = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone.replace(/^\+/, ""),
      type: "template",
      template: {
        name: process.env.WHATSAPP_OTP_TEMPLATE,
        language: { code: process.env.WHATSAPP_OTP_LANG || "en" },
        components: [
          { type: "body", parameters: [{ type: "text", text: code }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] }, // the copy-code button of an authentication template
        ],
      },
    }),
  });
  return res.ok;
}

/** True when the code matches the latest unexpired code for this number. A wrong try counts; after five the code is dead. */
export async function checkWhatsAppCode(phone: string, code: string): Promise<boolean> {
  const db = admin();
  const { data: row } = await db.from("otp_codes").select("id,code_hash,attempts,expires_at").eq("phone", phone).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!row || new Date(row.expires_at).getTime() < Date.now() || row.attempts >= MAX_TRIES) return false;
  const a = Buffer.from(row.code_hash), b = Buffer.from(hash(phone, String(code)));
  const ok = a.length === b.length && timingSafeEqual(a, b);
  if (ok) await db.from("otp_codes").delete().eq("id", row.id);
  else await db.from("otp_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
  return ok;
}
