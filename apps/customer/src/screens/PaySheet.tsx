import { useState } from "react";
import { CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { useStore, type Invoice } from "@/lib/store";
import { Button, Dirham, Sheet } from "@/components/ui";
import { money } from "@/lib/format";

export function PayInvoiceSheet({ invoice, open, onClose }: { invoice: Invoice; open: boolean; onClose: () => void }) {
  const { payInvoice } = useStore();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");

  const pay = async () => {
    setState("busy"); setError("");
    try {
      const { redirected } = await payInvoice(invoice.id, invoice.bookingId ? `/bookings/${invoice.bookingId}` : "/profile/payments");
      if (!redirected) setState("done");
    } catch (e) { setError((e as Error).message); setState("idle"); }
  };
  const close = () => { onClose(); setState("idle"); setError(""); };

  return (
    <Sheet open={open} onClose={close} title={state === "done" ? "Payment received" : "Pay invoice"}>
      {state === "done" ? (
        <div className="py-4 text-center">
          <CheckCircle2 className="mx-auto h-16 w-16 text-brand" />
          <p className="mt-3 text-lg font-semibold">Thank you!</p>
          <p className="text-ink-muted">Invoice {invoice.number} is paid.</p>
          <Button size="lg" className="mt-6" onClick={close}>Done</Button>
        </div>
      ) : (
        <>
          <div className="rounded-card bg-bg p-4">
            <div className="flex justify-between text-sm text-ink-muted"><span>Invoice</span><span>{invoice.number}</span></div>
            {invoice.description && <p className="mt-1 text-sm">{invoice.description}</p>}
            <div className="mt-2 flex items-baseline justify-between"><span className="font-medium">Amount due</span><span className="text-2xl font-bold"><Dirham /> {money(invoice.amount)}</span></div>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-card border border-line p-4">
            <CreditCard className="h-6 w-6 text-brand" />
            <div className="flex-1"><p className="font-medium">Card or Apple Pay</p><p className="text-xs text-ink-muted">Secure payment by Ziina</p></div>
          </div>
          {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
          <Button size="lg" className="mt-5" disabled={state === "busy"} onClick={pay}>
            {state === "busy" ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Pay <Dirham /> {money(invoice.amount)}</>}
          </Button>
        </>
      )}
    </Sheet>
  );
}
