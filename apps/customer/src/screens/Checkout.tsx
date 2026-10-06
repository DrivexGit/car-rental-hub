import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { CreditCard, Info, Loader2 } from "lucide-react";
import { EXTRAS, PERIOD_UNIT, carName } from "@/data/catalog";
import { day, money } from "@/lib/format";
import { useStore } from "@/lib/store";
import { api } from "@/lib/supabase";
import { BackBar, Button, Card, Dirham, Screen } from "@/components/ui";
import type { Quote } from "@/screens/Reserve";

/** Reservation step 2 of 3: summary + payment. The server re-prices and picks a free car. */
export default function Checkout() {
  const q = useLocation().state as (Quote & { qty: number }) | null;
  const nav = useNavigate();
  const { carById, payInvoice, refresh } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const car = q && carById(q.carId);
  if (!q || !car) return <Navigate to="/book" replace />;

  const pay = async () => {
    setBusy(true); setError("");
    try {
      const b = await api<{ reservationId: string; invoiceId: string }>("book", { modelId: q.carId, period: q.period, qty: q.qty, pickup: q.pickup, extras: q.extras });
      await refresh();
      try {
        const { redirected } = await payInvoice(b.invoiceId, `/confirmed/${b.reservationId}`);
        if (redirected) return;
      } catch { /* booking exists; payment can be retried from the booking */ }
      nav(`/confirmed/${b.reservationId}`, { replace: true });
    } catch (e) { setError((e as Error).message); setBusy(false); }
  };

  return (
    <Screen tabs={false} className="pb-36">
      <BackBar title="Review & pay" right={<span className="text-sm text-ink-muted">2 of 3</span>} />

      <Card className="flex items-center gap-3 p-3">
        <img src={car.image} alt="" className="h-16 w-24 object-contain" />
        <div>
          <p className="font-bold">{carName(car)}</p>
          <p className="text-sm text-ink-muted">{q.qty} {PERIOD_UNIT[q.period]}{q.qty > 1 ? "s" : ""} · {car.category}</p>
        </div>
      </Card>

      <Card className="mt-3 divide-y divide-line">
        <Row label="Pickup" value={day(q.pickup)} />
        <Row label="Return" value={day(q.dropoff)} />
        <Row label="Pickup location" value="Drivex, Dubai" />
      </Card>

      <h2 className="mb-2 mt-6 font-semibold">Price</h2>
      <Card className="divide-y divide-line">
        <Row label={`Rental${q.discount ? ` (${q.discount}% off)` : ""}`} value={<><Dirham /> {money(q.total - extrasCost(q))}</>} />
        {EXTRAS.filter((e) => q.extras.includes(e.id)).map((e) => <Row key={e.id} label={e.label} value={<><Dirham /> {money(e.daily * days(q))}</>} />)}
        <Row label={<b>Total</b>} value={<span className="text-xl font-bold"><Dirham /> {money(q.total)}</span>} />
      </Card>

      <div className="mt-3 flex gap-2.5 rounded-card bg-brand-soft p-3.5 text-sm text-brand">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>A refundable security deposit (from <Dirham /> 1,000) is blocked on your card at pickup.</p>
      </div>

      <h2 className="mb-2 mt-6 font-semibold">Payment</h2>
      <Card className="flex items-center gap-3 border-brand p-4">
        <CreditCard className="h-6 w-6 text-brand" />
        <div className="flex-1"><p className="font-medium">Card or Apple Pay</p><p className="text-xs text-ink-muted">Secure payment by Ziina</p></div>
        <span className="h-5 w-5 rounded-full border-[6px] border-brand" />
      </Card>
      {error && <p className="mt-4 rounded-card bg-danger-soft p-3 text-sm font-medium text-danger">{error}</p>}

      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] border-t border-line bg-white px-5 pt-3 lg:left-64 lg:max-w-[560px] lg:px-10">
        <Button size="lg" className="mb-3" disabled={busy} onClick={pay}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Pay <Dirham /> {money(q.total)}</>}
        </Button>
      </div>
    </Screen>
  );
}

const days = (q: Quote) => Math.round((new Date(q.dropoff).getTime() - new Date(q.pickup).getTime()) / 86400000);
const extrasCost = (q: Quote) => EXTRAS.filter((e) => q.extras.includes(e.id)).reduce((s, e) => s + e.daily * days(q), 0);
const Row = ({ label, value }: { label: React.ReactNode; value: React.ReactNode }) => (
  <div className="flex min-h-[52px] items-center justify-between px-4 py-2 text-[15px]"><span className="text-ink-muted">{label}</span><span className="font-medium">{value}</span></div>
);
