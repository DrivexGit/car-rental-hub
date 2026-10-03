import { useState } from "react";
import { CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { useStore, type Invoice } from "@/lib/store";
import { Button, Dirham, Sheet } from "@/components/ui";
import { money } from "@/lib/format";

/** Starts a Ziina payment. Returns true when the browser is being redirected to Ziina. */
export async function startZiinaPayment(amount: number, reference: string, returnPath: string) {
  try {
    const r = await fetch("/api/pay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount, reference, returnUrl: location.origin + returnPath }),
    });
    if (!r.ok) return false;
    const { url } = await r.json();
    if (url) { location.href = url; return true; }
  } catch { /* offline or not configured */ }
  return false;
}

export function PayInvoiceSheet({ invoice, open, onClose }: { invoice: Invoice; open: boolean; onClose: () => void }) {
  const { payInvoice } = useStore();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  const pay = async () => {
    setState("busy");
    if (await startZiinaPayment(invoice.amount, invoice.id, `/bookings/${invoice.bookingId}?paid=${invoice.id}`)) return;
    // ponytail: no Ziina key configured → simulated success so the flow can be tested.
    await new Promise((r) => setTimeout(r, 1200));
    payInvoice(invoice.id);
    setState("done");
  };
  const close = () => { onClose(); setState("idle"); };

  return (
    <Sheet open={open} onClose={close} title={state === "done" ? "Payment received" : "Pay invoice"}>
      {state === "done" ? (
        <div className="py-4 text-center">
          <CheckCircle2 className="mx-auto h-16 w-16 text-brand" />
          <p className="mt-3 text-lg font-semibold">Thank you!</p>
          <p className="text-ink-muted">Invoice {invoice.id} is paid.</p>
          <Button size="lg" className="mt-6" onClick={close}>Done</Button>
        </div>
      ) : (
        <>
          <div className="rounded-card bg-bg p-4">
            <div className="flex justify-between text-sm text-ink-muted"><span>Invoice</span><span>{invoice.id}</span></div>
            <div className="mt-2 flex items-baseline justify-between"><span className="font-medium">Amount due</span><span className="text-2xl font-bold"><Dirham /> {money(invoice.amount)}</span></div>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-card border border-line p-4">
            <CreditCard className="h-6 w-6 text-brand" />
            <div className="flex-1"><p className="font-medium">Card or Apple Pay</p><p className="text-xs text-ink-muted">Secure payment by Ziina</p></div>
          </div>
          <Button size="lg" className="mt-5" disabled={state === "busy"} onClick={pay}>
            {state === "busy" ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Pay <Dirham /> {money(invoice.amount)}</>}
          </Button>
        </>
      )}
    </Sheet>
  );
}
