import { admin, fail, getCustomer, json } from "./_lib.js";

// Drivex AI support. OpenAI-compatible chat endpoint (AI_BASE_URL / AI_API_KEY / AI_MODEL).
// Context (FAQ + the customer's own bookings, invoices, fines) is loaded server-side from Supabase.
// Urgent cases are flagged by keywords OR by the model, saved to urgent_requests and posted to STAFF_WEBHOOK_URL (n8n).

const URGENT = /\b(accident|crash|collision|hit|broke ?down|breakdown|won'?t start|flat tyre|flat tire|tow|police|stolen|theft|fire|smoke|injur|hurt|ambulance|locked out|lost (the )?key|emergency|stuck|urgent)\b|تصادف|خراب|پلیس|دزد|آتش|زخمی|اورژانس|فوری|گیر کرد|حادث|شرطة|عطل|سرقة|طوارئ|حريق/i;

const SYSTEM = (ctx: unknown, faq: { question: string; answer: string }[]) => `You are Drivex AI, the support assistant of Drivex Car Rental in Dubai.
Rules:
- Be warm, short and clear (2–4 sentences). Many customers are older: use simple words. Address the customer by first name.
- Answer from the FAQ and the customer's own data below. Never invent prices, policies or bookings.
- For extensions: they can tap "Extend rental" on the booking page. For payments: they can pay pending invoices with "Pay now".
- If you are unsure, or the request needs a human (changing car, disputes, damage), say our team will help and suggest WhatsApp.
- If the customer is in danger or stuck (accident, breakdown, police, theft, locked out, injury), tell them calmly what to do first (safety, 999 for police/ambulance if needed) and that our team has been alerted. Then end your reply with the exact tag [URGENT].
- Reply in the customer's language.

Customer data (JSON): ${JSON.stringify(ctx)}

FAQ:
${faq.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")}`;

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const me = await getCustomer(req);
  if (!me) return fail("Please sign in again.", 401);
  const { messages, urgentCall } = (await req.json().catch(() => ({}))) as { messages: Msg[]; urgentCall?: boolean };
  if (!Array.isArray(messages) || !messages.length) return fail("No messages");
  const clean = messages.slice(-12).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 2000) }));
  const last = clean[clean.length - 1].content;

  const db = admin();
  const [faq, res, inv, fines] = await Promise.all([
    db.from("faq_entries").select("question,answer").eq("tenant_id", me.tenant_id).eq("is_active", true).order("sort_order"),
    db.from("reservations").select("status,start_datetime,end_datetime,rental_period,vehicles(make,model,plate_number)").eq("customer_id", me.id),
    db.from("invoices").select("number,amount,status,description").eq("customer_id", me.id),
    db.from("fines").select("type,amount,location,occurred_at").eq("customer_id", me.id),
  ]);
  const context = { name: me.full_name, phone: me.phone, bookings: res.data, invoices: inv.data, fines: fines.data, today: new Date().toISOString().slice(0, 10) };

  let reply = "";
  try {
    const r = await fetch(`${process.env.AI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.AI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.AI_MODEL || "gpt-4.1-mini", stream: false, temperature: 0.3, messages: [{ role: "system", content: SYSTEM(context, faq.data ?? []) }, ...clean] }),
    });
    const data = await r.json();
    reply = data?.choices?.[0]?.message?.content?.trim() || "";
    if (!reply) console.error("[chat] AI error", data?.error?.code || r.status);
  } catch (e) { console.error("[chat] AI unreachable", e); }

  const urgent = !!urgentCall || URGENT.test(last) || reply.includes("[URGENT]");
  reply = reply.replace(/\s*\[URGENT\]\s*/g, " ").trim() ||
    (urgent ? "Our team has been alerted and will call you right away. If anyone is hurt, call 999." : "Sorry, I can't answer right now. Please message us on WhatsApp.");

  if (urgent) {
    await db.from("urgent_requests").insert({ tenant_id: me.tenant_id, customer_id: me.id, message: last });
    await notifyStaff({ name: me.full_name, phone: me.phone, message: last, at: new Date().toISOString() });
  }
  return json({ reply, urgent });
}

async function notifyStaff(payload: Record<string, unknown>) {
  const url = process.env.STAFF_WEBHOOK_URL;
  if (!url) { console.warn("[urgent] STAFF_WEBHOOK_URL not set", payload); return; }
  try {
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-drivex-key": process.env.STAFF_WEBHOOK_SECRET || "" }, body: JSON.stringify({ type: "urgent_support", ...payload }) });
  } catch (e) { console.error("[urgent] notify failed", e); }
}
