import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { CreditCard, Info, Loader2 } from "lucide-react";
import { EXTRA_LABELS, DEPOSIT_AMOUNT, carName, extraCost } from "@/data/catalog";
import { day, money } from "@/lib/format";
import { useStore } from "@/lib/store";
import { missingDocuments } from "@/data/documents";
import { api } from "@/lib/supabase";
import { BackBar, Button, Card, Dirham, Screen } from "@/components/ui";
import { periodCount, type Quote } from "@/screens/Reserve";
import { useI18n } from "@/lib/i18n";

/** Reservation step 2 of 3: summary + payment. The server re-prices and picks a free car. */
export default function Checkout() {
  const q = useLocation().state as (Quote & { qty: number }) | null;
  const nav = useNavigate();
  const { t } = useI18n();
  const { carById, payInvoice, refresh, documents } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);
  const car = q && carById(q.carId);
  if (!q || !car) return <Navigate to="/book" replace />;
  if (missingDocuments(documents).length) return <Navigate to={`/book/${q.carId}`} replace />; // documents were removed or rejected since step 1

  // The amount keeps its Dirham symbol, so split the sentence around a marker.
  const deposit = t("A refundable security deposit (from {amount}) is blocked on your card at pickup.", { amount: "{amount}" }).split("{amount}");

  const pay = async () => {
    setBusy(true); setError("");
    try {
      const b = await api<{ reservationId: string; invoiceId: string; payLater?: boolean }>("book", { modelId: q.carId, period: q.period, qty: q.qty, pickup: q.pickup, extras: q.extras, terms: agreed });
      await refresh();
      // "Pay at month end" customers: the booking is confirmed now and the invoice is collected later
      if (b.payLater) { nav(`/confirmed/${b.reservationId}`, { replace: true }); return; }
      try {
        const { redirected } = await payInvoice(b.invoiceId, `/confirmed/${b.reservationId}`);
        if (redirected) return;
      } catch { /* booking exists; payment can be retried from the booking */ }
      nav(`/confirmed/${b.reservationId}`, { replace: true });
    } catch (e) { setError((e as Error).message); setBusy(false); }
  };

  return (
    <Screen tabs={false} className="pb-36">
      <BackBar title={t("Review & pay")} right={<span className="text-sm text-ink-muted">{t("2 of 3")}</span>} />

      <Card className="flex items-center gap-3 p-3">
        <img src={car.image} alt="" className="h-16 w-24 object-contain" />
        <div>
          <p className="font-bold">{carName(car)}</p>
          <p className="text-sm text-ink-muted">{periodCount(t, q.period, q.qty)} · {t(car.category)}</p>
        </div>
      </Card>

      <Card className="mt-3 divide-y divide-line">
        <Row label={t("Pickup")} value={day(q.pickup)} />
        <Row label={t("Return")} value={day(q.dropoff)} />
        <Row label={t("Pickup location")} value={t("Drivex, Dubai")} />
      </Card>

      <h2 className="mb-2 mt-6 font-semibold">{t("Price")}</h2>
      <Card className="divide-y divide-line">
        <Row label={q.discount ? t("Rental ({n}% off)", { n: q.discount }) : t("Rental")} value={<><Dirham /> {money(q.base)}</>} />
        {q.extras.filter((id) => id in EXTRA_LABELS).map((id) => <Row key={id} label={t(EXTRA_LABELS[id])} value={<><Dirham /> {money(extraCost(id, q))}</>} />)}
        <Row label={t("VAT included")} value={<><Dirham /> {money(q.vat)}</>} />
        <Row label={<b>{t("Total")}</b>} value={<span className="text-xl font-bold"><Dirham /> {money(q.total)}</span>} />
      </Card>

      <div className="mt-3 flex gap-2.5 rounded-card bg-brand-soft p-3.5 text-sm text-brand">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        {q.extras.includes("no_deposit") ? <p>{t("No deposit is blocked on your card.")}</p> : <p>{deposit[0]}<Dirham /> {money(DEPOSIT_AMOUNT)}{deposit[1]}</p>}
      </div>

      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-card border border-line bg-white p-4 text-[15px]">
        <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-brand" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span className="flex-1">{t("I agree to the Terms & Rental rules")} <Link to="/terms" className="font-semibold text-brand underline">{t("Read the terms")}</Link></span>
      </label>

      <h2 className="mb-2 mt-6 font-semibold">{t("Payment")}</h2>
      <Card className="flex items-center gap-3 border-brand p-4">
        <CreditCard className="h-6 w-6 text-brand" />
        <div className="flex-1"><p className="font-medium">{t("Card or Apple Pay")}</p><p className="text-xs text-ink-muted">{t("Secure payment by Stripe")}</p></div>
        <span className="h-5 w-5 rounded-full border-[6px] border-brand" />
      </Card>
      {error && <p className="mt-4 rounded-card bg-danger-soft p-3 text-sm font-medium text-danger">{error}</p>}

      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] border-t border-line bg-white px-5 pt-3 lg:max-w-[720px] lg:px-10">
        <Button size="lg" className="mb-3" disabled={busy || !agreed} onClick={pay}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{t("Pay")} <Dirham /> {money(q.total)}</>}
        </Button>
      </div>
    </Screen>
  );
}

const Row = ({ label, value }: { label: React.ReactNode; value: React.ReactNode }) => (
  <div className="flex min-h-[52px] items-center justify-between px-4 py-2 text-[15px]"><span className="text-ink-muted">{label}</span><span className="font-medium">{value}</span></div>
);
