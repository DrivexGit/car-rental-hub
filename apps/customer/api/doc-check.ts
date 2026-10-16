import { admin, fail, getCustomer, json } from "./_lib.js";

// AI check of an uploaded document (vision model, DriveX's own key): is it readable, is it the kind the customer said,
// and is it still valid? A document that fails is rejected at once, with the reason, and staff get a warning.
// One that passes stays "pending" for a person to approve. Only pictures are read; a PDF waits for a person.
// If the AI is down, nothing is rejected: the document just waits for a person as before.

const WANTED: Record<string, string> = {
  id_card: "Emirates ID or passport",
  driving_license: "driving licence",
  visa: "residence visa",
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  const me = await getCustomer(req);
  if (!me) return fail("Please sign in again.", 401);
  const { documentId } = await req.json().catch(() => ({}));
  if (typeof documentId !== "string") return fail("Missing document.");

  const db = admin();
  const { data: doc } = await db.from("customer_documents").select("*").eq("id", documentId).maybeSingle();
  if (!doc || doc.lead_id !== me.lead_id || doc.tenant_id !== me.tenant_id) return fail("Document not found.", 404);
  if (doc.verification_status !== "pending") return json({ status: doc.verification_status });
  if (!String(doc.mime_type || "").startsWith("image/")) return json({ status: "pending", checked: false });

  const { data: file, error: fileError } = await db.storage.from(doc.storage_bucket || "customer-documents").download(doc.storage_path);
  if (fileError || !file) return json({ status: "pending", checked: false });
  const image = `data:${doc.mime_type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;

  const expected = WANTED[doc.document_type] ?? "document";
  const prompt = `This is a customer's ${expected} for a car rental in Dubai. Reply with JSON only: ` +
    `{"type": "emirates_id" | "passport" | "driving_license" | "visa" | "other", "name": string | null, "number": string | null, ` +
    `"expiry": "YYYY-MM-DD" | null, "readable": boolean, "matches_expected": boolean}. ` +
    `"readable" is false if the picture is blurred, cut off or too dark to read the main details. "matches_expected" is false if it is not a ${expected}. ` +
    `Do not guess details you cannot read.`;
  let ai: any;
  try {
    const r = await fetch(`${process.env.AI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.AI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "gpt-4.1-mini", temperature: 0, response_format: { type: "json_object" },
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: image } }] }],
      }),
    });
    const data = await r.json();
    ai = JSON.parse(data?.choices?.[0]?.message?.content ?? "null");
  } catch (e) { console.error("[doc-check] AI unavailable", e); }
  if (!ai || typeof ai !== "object") return json({ status: "pending", checked: false });

  const today = new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 10); // UAE date
  const expiry = typeof ai.expiry === "string" && DATE.test(ai.expiry) ? ai.expiry : null;
  const problems: string[] = [];
  if (ai.readable !== true) problems.push("The picture is not clear enough to read. Please upload a clearer photo.");
  if (ai.matches_expected === false) problems.push(`This does not look like your ${expected}. Please upload the right document.`);
  if (expiry && expiry < today) problems.push(`This document expired on ${expiry}. Please upload a valid one.`);
  const status = problems.length ? "rejected" : "pending";
  const reason = problems.join(" ");

  const { error: updateError } = await db.from("customer_documents").update({
    ai_result: ai, expires_at: expiry, verification_status: status, reject_reason: problems.length ? reason : null,
  }).eq("id", doc.id);
  if (updateError) return fail(updateError.message, 500);

  if (problems.length) {
    await db.from("notifications").insert({
      tenant_id: doc.tenant_id, audience: "staff", type: "document",
      title: `AI rejected a ${doc.document_type.replace(/_/g, " ")}`, body: `${me.full_name}: ${reason}`, link: "/documents",
    });
  }
  return json({ status, reason: problems.length ? reason : undefined, checked: true });
}
