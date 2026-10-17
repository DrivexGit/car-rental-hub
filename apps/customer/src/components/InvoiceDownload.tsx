import { useState } from "react";
import { Download, Eye, Loader2 } from "lucide-react";
import { useStore, type Invoice } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { invoiceHtml } from "@/lib/invoice";
import { downloadInvoicePdf } from "@/lib/invoicePdf";
import { COMPANY } from "@/config";
import { Sheet } from "@/components/ui";

/** Two small buttons on an invoice row: View (shows the tax invoice on screen) and Download (saves it as a PDF file). */
export function InvoiceDownload({ invoice, detail }: { invoice: Invoice; detail?: string }) {
  const { t } = useI18n();
  const { user, seller } = useStore();
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [error, setError] = useState("");
  // the seller's TRN, address and bank details come from the tenant settings; the static config is the fallback
  const company = { ...COMPANY, address: seller?.legal_address || COMPANY.address, trn: seller?.trn || COMPANY.trn, bank: { accountName: seller?.bank_account_name, bankName: seller?.bank_name, iban: seller?.iban, bic: seller?.bic } };
  const html = () => invoiceHtml({
    invoice: { number: invoice.number, issued: invoice.issued, status: invoice.status, paidAt: invoice.paidAt, dueDate: invoice.dueDate, description: invoice.description, detail, amount: invoice.amount, lines: invoice.lines, payments: invoice.payments },
    to: { name: user?.name || "", phone: user?.phone, email: user?.email },
    company, logoUrl: `${location.origin}/logo-dark.png`,
  });
  const download = async () => {
    setBusy(true); setError("");
    try { await downloadInvoicePdf(html(), `${invoice.number}.pdf`); }
    catch { setError(t("Could not create the PDF. Please try again.")); setViewing(true); } // the sheet is where the message is shown
    finally { setBusy(false); }
  };
  const btn = "grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-ink-muted active:bg-bg disabled:opacity-50";
  return (
    <>
      <button type="button" onClick={() => setViewing(true)} aria-label={t("View invoice")} title={t("View invoice")} className={btn}><Eye className="h-4 w-4" /></button>
      <button type="button" onClick={download} disabled={busy} aria-label={t("Download invoice")} title={t("Download invoice")} className={btn}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      </button>
      <Sheet open={viewing} onClose={() => setViewing(false)} title={invoice.number}>
        <iframe title={invoice.number} srcDoc={viewing ? html() : ""} className="h-[58vh] w-full rounded-xl border border-line bg-white" />
        {error && <p role="alert" className="mt-3 text-sm font-medium text-danger">{error}</p>}
        <button type="button" onClick={download} disabled={busy} className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand font-semibold text-white disabled:opacity-60">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />} {t("Download PDF")}
        </button>
      </Sheet>
    </>
  );
}
