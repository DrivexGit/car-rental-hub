// Turns the invoice document (lib/invoice.ts) into a real PDF file and saves it straight to the device.
// The document is drawn by the browser (so Arabic names come out right) and then placed on A4 pages.
// The two libraries are loaded only when someone taps Download, so they cost nothing on the first screen.

const A4_W = 794; // A4 at 96 dpi, in CSS pixels: the width the invoice is laid out for

/** A file that belongs to the invoice (a Salik or fine screenshot or PDF). Images and PDFs are placed on the pages after the invoice; other files are listed. */
export type InvoiceAttachment = { title: string; name: string; url: string };

type Prepared =
  | { kind: "image"; title: string; src: string; mime: string; w: number; h: number }
  | { kind: "pdf"; title: string; bytes: ArrayBuffer }
  | { kind: "other"; title: string; name: string };

const readAsDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(blob); });
const imageSize = (src: string) => new Promise<{ w: number; h: number }>((resolve, reject) => { const i = new Image(); i.onload = () => resolve({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => reject(new Error("image")); i.src = src; });

/** Fetches each attachment once and sorts it into image, PDF or other. An encrypted or broken PDF is listed by name instead. */
async function prepare(attachments: InvoiceAttachment[]): Promise<Prepared[]> {
  return Promise.all(attachments.map(async (a): Promise<Prepared> => {
    const blob = await (await fetch(a.url)).blob();
    if (blob.type.startsWith("image/")) {
      const src = await readAsDataUrl(blob);
      const { w, h } = await imageSize(src);
      return { kind: "image", title: a.title, src, mime: blob.type, w, h };
    }
    if (blob.type === "application/pdf") {
      const bytes = await blob.arrayBuffer();
      try {
        const { PDFDocument } = await import("pdf-lib");
        await PDFDocument.load(bytes.slice(0)); // throws on an encrypted or damaged file
        return { kind: "pdf", title: a.title, bytes };
      } catch {
        return { kind: "other", title: a.title, name: a.name };
      }
    }
    return { kind: "other", title: a.title, name: a.name };
  }));
}

export async function downloadInvoicePdf(html: string, fileName: string, attachments: InvoiceAttachment[] = []): Promise<void> {
  const prepared = await prepare(attachments);
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  // off-screen but full size: a 0x0 frame renders blank on iPhones, which is what made the old download come out white
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${A4_W}px;height:1123px;border:0;visibility:hidden`;
  document.body.appendChild(frame);
  try {
    await new Promise<void>((resolve) => { frame.onload = () => resolve(); frame.srcdoc = html; });
    const doc = frame.contentDocument!;
    await Promise.all([...doc.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
    await doc.fonts?.ready;
    // html2canvas draws text a few pixels lower than the browser does; lift the text inside the stamp so it sits in the middle of its box
    const fix = doc.createElement("style"); fix.textContent = ".stamp { padding: 0 12px 6px !important; line-height: 1.4; }"; doc.head.appendChild(fix);
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
    const body = doc.body;
    const canvas = await html2canvas(body, { scale: 2, backgroundColor: "#ffffff", width: A4_W, windowWidth: A4_W, logging: false });

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth(), pageH = pdf.internal.pageSize.getHeight();
    const margin = 12;
    const imgW = pageW - margin * 2;
    const pxPerMm = canvas.width / imgW;
    const sliceH = Math.floor((pageH - margin * 2) * pxPerMm); // canvas pixels that fit on one page
    for (let y = 0, page = 0; y < canvas.height; y += sliceH, page++) {
      const h = Math.min(sliceH, canvas.height - y);
      const part = document.createElement("canvas");
      part.width = canvas.width; part.height = h;
      part.getContext("2d")!.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      if (page) pdf.addPage();
      pdf.addImage(part.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, imgW, h / pxPerMm);
    }
    // attachments: one page each, after the invoice. A PDF attachment gets a title page here and its own pages are inserted after it below.
    const embedded: { after: number; bytes: ArrayBuffer }[] = [];
    for (const a of prepared) {
      pdf.addPage();
      pdf.setFontSize(12);
      pdf.text(a.title, margin, margin + 6);
      if (a.kind === "image") {
        const maxH = pageH - margin * 2 - 14;
        const height = Math.min((imgW * a.h) / a.w, maxH);
        pdf.addImage(a.src, a.mime.includes("png") ? "PNG" : "JPEG", margin, margin + 10, (height * a.w) / a.h, height);
      } else if (a.kind === "pdf") {
        pdf.setFontSize(10);
        pdf.text("The attached PDF follows on the next page.", margin, margin + 14);
        embedded.push({ after: pdf.getNumberOfPages() - 1, bytes: a.bytes });
      } else {
        pdf.setFontSize(10);
        pdf.text(`Attached file: ${a.name}. Open it from the Fines page in the panel.`, margin, margin + 14);
      }
    }
    if (!embedded.length) {
      pdf.save(fileName);
      return;
    }
    // copy the attached PDFs' pages into the document, each right after its title page
    const { PDFDocument } = await import("pdf-lib");
    const merged = await PDFDocument.load(pdf.output("arraybuffer"));
    let added = 0;
    for (const part of embedded) {
      const src = await PDFDocument.load(part.bytes);
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach((page, i) => merged.insertPage(part.after + 1 + added + i, page));
      added += pages.length;
    }
    const out = await merged.save();
    const url = URL.createObjectURL(new Blob([out as BlobPart], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url; link.download = fileName;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } finally {
    frame.remove();
  }
}
