import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useStore, type Invoice } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { invoiceHtml, printInvoice } from "@/lib/invoice";
import { COMPANY } from "@/config";

/** Opens the tax invoice in the print dialog; choosing "Save as PDF" downloads it. */
export function InvoiceDownload({ invoice, detail }: { invoice: Invoice; detail?: string }) {
  const { t } = useI18n();
  const { user } = useStore();
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    try {
      await printInvoice(invoiceHtml({
        invoice: { number: invoice.number, issued: invoice.issued, status: invoice.status, paidAt: invoice.paidAt, description: invoice.description, detail, amount: invoice.amount },
        to: { name: user?.name || "", phone: user?.phone, email: user?.email },
        company: COMPANY, logoUrl: `${location.origin}/logo-dark.png`,
      }));
    } finally { setBusy(false); }
  };
  return (
    <button type="button" onClick={open} disabled={busy} aria-label={t("Download invoice")} title={t("Download invoice")}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-ink-muted active:bg-bg disabled:opacity-50">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
    </button>
  );
}
