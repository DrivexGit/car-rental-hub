// Documents a customer must have uploaded before booking. Shared with the server (api/book.ts), which enforces it.
// No imports on purpose: it is bundled into the browser as well.
// The visa page is not listed: it is only for tourists and nothing tells us who is one.

/** `id` is what the app uploads; `accept` lists every type that counts (staff can upload a passport in the panel). */
export const REQUIRED_DOCUMENTS = [
  { id: "id_card", label: "Emirates ID or passport", accept: ["id_card", "passport"] },
  { id: "driving_license", label: "Driving licence", accept: ["driving_license"] },
] as const;

type DocLike = { type: string; status: string };

/** Required documents that are missing, or were rejected and need uploading again. Waiting for review is fine. */
export function missingDocuments(docs: DocLike[]) {
  return REQUIRED_DOCUMENTS.filter((r) => !docs.some((d) => (r.accept as readonly string[]).includes(d.type) && d.status !== "rejected"));
}
