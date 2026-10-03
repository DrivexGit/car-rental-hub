import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Check, Fuel, Minus, Plus, ShieldCheck, Users } from "lucide-react";
import { EXTRAS, PERIOD_DAYS, PERIOD_UNIT, carName, priceFor, type Car, type Period } from "@/data/catalog";
import { useStore } from "@/lib/store";
import { addDays, daysBetween, isoDate, money, shortDay } from "@/lib/format";
import { BackBar, Button, Card, Dirham, Price, Screen, Segmented } from "@/components/ui";

export type Quote = { carId: string; period: Period; qty: number; pickup: string; dropoff: string; extras: string[]; discount: number; total: number };

export function quote(car: Car, period: Period, qty: number, pickup: string, extras: string[], off = 0): Quote {
  const carId = car.id;
  const days = PERIOD_DAYS[period] * qty;
  const base = Math.round(priceFor(car, period) * qty * (1 - off / 100));
  const extrasTotal = EXTRAS.filter((e) => extras.includes(e.id)).reduce((s, e) => s + e.daily * days, 0);
  return { carId, period, qty, pickup, dropoff: isoDate(addDays(new Date(pickup), days)), extras, discount: off, total: base + extrasTotal };
}

/** Reservation step 1 of 3: car, period, dates, extras. */
export default function Reserve() {
  const { carId = "" } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { carById, offers } = useStore();
  const car = carById(carId);
  const off = offers.find((o) => o.kind === "car" && o.car?.id === carId)?.off ?? 0;
  const [period, setPeriod] = useState<Period>((params.get("period") as Period) || "daily");
  const from = params.get("from"), to = params.get("to");
  const [pickup, setPickup] = useState(from || isoDate(addDays(new Date(), 1)));
  const [qty, setQty] = useState(from && to ? Math.ceil(daysBetween(from, to) / PERIOD_DAYS[period]) : period === "daily" ? 3 : 1);
  const [extras, setExtras] = useState<string[]>(["full_cover"]);

  if (!car) return null;
  const q = quote(car, period, qty, pickup, extras, off);
  const unit = PERIOD_UNIT[period];
  const toggle = (id: string) => setExtras((x) => (x.includes(id) ? x.filter((i) => i !== id) : [...x, id]));

  return (
    <Screen tabs={false} className="pb-36">
      <BackBar title="Book your car" right={<span className="text-sm text-ink-muted">1 of 3</span>} />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-b from-[#eef0ee] to-white px-4 pt-4">
          <img src={car.image} alt={carName(car)} className="mx-auto h-[170px] w-full object-contain" />
        </div>
        <div className="p-4">
          <p className="text-2xl font-bold">{carName(car)}</p>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-ink-muted">
            <span>{car.year} · {car.category}</span>
            <span className="inline-flex items-center gap-1"><Users className="h-4 w-4" /> {car.seats} seats</span>
            <span className="inline-flex items-center gap-1"><Fuel className="h-4 w-4" /> Full to full</span>
          </div>
          <div className="mt-3"><Price value={Math.round(priceFor(car, period) * (1 - off / 100))} unit={unit} old={off ? priceFor(car, period) : undefined} /></div>
        </div>
      </Card>

      <h2 className="mb-2 mt-6 font-semibold">Rental plan</h2>
      <Segmented value={period} onChange={(p) => { setPeriod(p); setQty(p === "daily" ? 3 : 1); }} options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]} />

      <Card className="mt-3 divide-y divide-line">
        <label className="flex h-16 items-center justify-between px-4">
          <span className="font-medium">Pickup date</span>
          <input type="date" min={isoDate(new Date())} value={pickup} onChange={(e) => e.target.value && setPickup(e.target.value)} className="bg-transparent text-right font-semibold text-brand outline-none" />
        </label>
        <div className="flex h-16 items-center justify-between px-4">
          <span className="font-medium">Number of {unit}s</span>
          <div className="flex items-center gap-4">
            <RoundBtn onClick={() => setQty(Math.max(1, qty - 1))} label="Less"><Minus className="h-4 w-4" /></RoundBtn>
            <span className="w-6 text-center text-lg font-bold">{qty}</span>
            <RoundBtn onClick={() => setQty(Math.min(period === "daily" ? 29 : 12, qty + 1))} label="More"><Plus className="h-4 w-4" /></RoundBtn>
          </div>
        </div>
        <div className="flex h-14 items-center justify-between px-4 text-sm">
          <span className="text-ink-muted">Return</span>
          <span className="font-semibold">{shortDay(q.dropoff)}</span>
        </div>
      </Card>

      <h2 className="mb-2 mt-6 font-semibold">Extras</h2>
      <Card className="divide-y divide-line">
        {EXTRAS.map((e) => {
          const on = extras.includes(e.id);
          return (
            <button key={e.id} onClick={() => toggle(e.id)} className="flex min-h-[60px] w-full items-center gap-3 px-4 text-left">
              <span className={`grid h-6 w-6 place-items-center rounded-md border-2 ${on ? "border-brand bg-brand text-white" : "border-line"}`}>{on && <Check className="h-4 w-4" />}</span>
              <span className="flex-1 font-medium">{e.label}{e.id === "full_cover" && <ShieldCheck className="ml-1.5 inline h-4 w-4 text-brand" />}</span>
              <span className="text-sm text-ink-muted"><Dirham /> {e.daily} / day</span>
            </button>
          );
        })}
      </Card>

      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] border-t border-line bg-white px-5 pt-3">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-ink-muted">Total · {qty} {unit}{qty > 1 ? "s" : ""}</span>
          <span className="text-2xl font-bold"><Dirham /> {money(q.total)}</span>
        </div>
        <Button size="lg" arrow className="mb-3" onClick={() => nav("/checkout", { state: q })}>Continue</Button>
      </div>
    </Screen>
  );
}

const RoundBtn = ({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) => (
  <button onClick={onClick} aria-label={label} className="grid h-9 w-9 place-items-center rounded-full border border-line bg-white active:bg-bg">{children}</button>
);
