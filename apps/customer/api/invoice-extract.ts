import { admin, fail, json } from "./_lib.js";

// Reads the total from an invoice PDF the staff are about to upload, so the total is not typed by hand.
// Staff only (a signed-in staff member of the tenant). The answer is a suggestion: the panel fills the total box and
// staff check it before the invoice is saved. Cheap model by default (AI_MODEL, gpt-4.1-mini), one PDF per call.
// If the AI is down or unsure, nothing is guessed: the total is left for staff to type.

const ORIGIN = process.env.PANEL_ORIGIN || "https://car-rental-hub-kappa.vercel.app";
const MAX_PDF_BYTES = 3 * 1024 * 1024; // base64 adds a third; the function body must stay under Vercel's 4.5 MB limit
const cors = { "Access-Control-Allow-Origin": ORIGIN, "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin" };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...cors } });

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

const amount = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 && v < 10_000_000 ? Math.round(v * 100) / 100 : null);

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return reply({ error: "Please sign in again." }, 401);
  const db = admin();
  const { data: auth } = await db.auth.getUser(token);
  if (!auth.user) return reply({ error: "Please sign in again." }, 401);
  const { data: staff } = await db.from("staff_profiles").select("tenant_id").eq("id", auth.user.id).eq("is_active", true).maybeSingle();
  if (!staff) return reply({ error: "Only staff can read invoices." }, 403);

  const { file } = await req.json().catch(() => ({}));
  if (typeof file !== "string" || !file) return reply({ error: "Missing PDF." }, 400);
  const bytes = Buffer.from(file, "base64");
  if (bytes.length === 0 || bytes.length > MAX_PDF_BYTES) return reply({ error: "This PDF is too large to read automatically. Type the total by hand." }, 413);
  if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") return reply({ error: "The file is not a PDF." }, 400);

  const prompt = "This is a car rental invoice from Dubai. Find the total amount the customer owes (the invoice amount, VAT included, in AED) " +
    "and what has already been paid and what remains, if they are printed. Reply with JSON only: " +
    `{"total": number | null, "paid": number | null, "remaining": number | null}. ` +
    "Use null for anything that is not clearly printed. Do not calculate or guess.";
  let ai: any;
  try {
    const r = await fetch(`${process.env.AI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.AI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "gpt-4.1-mini", temperature: 0, max_tokens: 120, response_format: { type: "json_object" },
        messages: [{ role: "user", content: [
          { type: "file", file: { filename: "invoice.pdf", file_data: `data:application/pdf;base64,${file}` } },
          { type: "text", text: prompt },
        ] }],
      }),
    });
    const data = await r.json();
    ai = JSON.parse(data?.choices?.[0]?.message?.content ?? "null");
  } catch (e) { console.error("[invoice-extract] AI unavailable", e); }
  if (!ai || typeof ai !== "object") return reply({ error: "Could not read the invoice. Type the total by hand." }, 503);

  const total = amount(ai.total);
  if (total === null) return reply({ error: "The total is not clear in this PDF. Type it by hand." }, 422);
  return reply({ total, paid: amount(ai.paid), remaining: amount(ai.remaining) });
}
