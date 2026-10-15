// Turns the invoice document (lib/invoice.ts) into a real PDF file and saves it straight to the device.
// The document is drawn by the browser (so Arabic names come out right) and then placed on A4 pages.
// The two libraries are loaded only when someone taps Download, so they cost nothing on the first screen.

const A4_W = 794; // A4 at 96 dpi, in CSS pixels: the width the invoice is laid out for

/** A file that belongs to the invoice (a Salik or fine screenshot). Images are placed on the pages after the invoice; other files are listed. */
export type InvoiceAttachment = { title: string; name: string; url: string };

const readAsDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(blob); });
const imageSize = (src: string) => new Promise<{ w: number; h: number }>((resolve, reject) => { const i = new Image(); i.onload = () => resolve({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => reject(new Error("image")); i.src = src; });

export async function downloadInvoicePdf(html: string, fileName: string, attachments: InvoiceAttachment[] = []): Promise<void> {
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
    // attachments: one page each, after the invoice
    for (const a of attachments) {
      pdf.addPage();
      pdf.setFontSize(12);
      pdf.text(a.title, margin, margin + 6);
      const blob = await (await fetch(a.url)).blob();
      const isImage = blob.type.startsWith("image/");
      if (isImage) {
        const src = await readAsDataUrl(blob);
        const { w, h } = await imageSize(src);
        const maxH = pageH - margin * 2 - 14;
        const height = Math.min((imgW * h) / w, maxH);
        pdf.addImage(src, blob.type.includes("png") ? "PNG" : "JPEG", margin, margin + 10, (height * w) / h, height);
      } else {
        pdf.setFontSize(10);
        pdf.text(`Attached file: ${a.name}. Open it from the Fines page in the panel.`, margin, margin + 14);
      }
    }
    pdf.save(fileName);
  } finally {
    frame.remove();
  }
}
