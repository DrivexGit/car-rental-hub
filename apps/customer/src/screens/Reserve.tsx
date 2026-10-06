import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Briefcase, CalendarDays, Check, DoorOpen, Fuel, Gauge, Minus, Plus, Settings2, ShieldCheck, Sparkles, Users } from "lucide-react";
import { DateSheet } from "@/components/DatePicker";
import { EXTRAS, PERIOD_DAYS, PERIOD_UNIT, carName, priceFor, type Car, type Period } from "@/data/catalog";
import { useStore } from "@/lib/store";
import { addDays, day, daysBetween, isoDate, money, shortDay } from "@/lib/format";
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
  const { carById, offers, specs: allSpecs } = useStore();
  const [picking, setPicking] = useState(false);
  const car = carById(carId);
  const off = offers.find((o) => o.kind === "car" && o.car?.id === carId)?.off ?? 0;
  const [period, setPeriod] = useState<Period>((params.get("period") as Period) || "daily");
  const from = params.get("from"), to = params.get("to");
  const [pickup, setPickup] = useState(from || isoDate(addDays(new Date(), 1)));
  const [qty, setQty] = useState(from && to ? Math.ceil(daysBetween(from, to) / PERIOD_DAYS[period]) : period === "daily" ? 3 : 1);
  const [extras, setExtras] = useState<string[]>(["full_cover"]);

  if (!car) return null;
  const specs = allSpecs[car.id];
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
        {!!specs?.gallery.length && <Gallery photos={specs.gallery} name={carName(car)} />}
        <div className="p-4">
          <p className="text-2xl font-bold">{carName(car)}</p>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-ink-muted">
            <span>{car.year} · {car.category}</span>
            <span className="inline-flex items-center gap-1"><Users className="h-4 w-4" /> {car.seats} seats</span>
            <span>{car.vehicleIds.length} in fleet</span>
            <span className="inline-flex items-center gap-1"><Fuel className="h-4 w-4" /> Full to full</span>
          </div>
          <div className="mt-3"><Price value={Math.round(priceFor(car, period) * (1 - off / 100))} unit={unit} old={off ? priceFor(car, period) : undefined} /></div>
        </div>
      </Card>

      {specs && (
        <>
          <h2 className="mb-2 mt-6 font-semibold">About this car</h2>
          <div className="grid grid-cols-3 gap-2">
            {([[Gauge, specs.engine ?? "—", "Engine"], [Settings2, specs.transmission, "Gearbox"], [Fuel, specs.fuel, "Fuel"],
               [Users, `${specs.seats} seats`, "Seats"], [DoorOpen, `${specs.doors} doors`, "Doors"], [Briefcase, `${specs.bags} bags`, "Luggage"]] as const).map(([Icon, v, l], i) => (
              <Card key={l} delay={0.05 * i} className="flex flex-col items-center gap-1 p-3 text-center">
                <Icon className="h-5 w-5 text-brand" />
                <span className="text-[13px] font-semibold leading-tight">{v}</span>
                <span className="text-[11px] text-ink-faint">{l}</span>
              </Card>
            ))}
          </div>
          {!!specs.features.length && (
            <div className="mt-3 flex flex-wrap gap-2">
              {specs.features.map((f) => <span key={f} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-3 py-1.5 text-[13px] font-medium text-brand"><Sparkles className="h-3.5 w-3.5" />{f}</span>)}
            </div>
          )}
        </>
      )}

      <h2 className="mb-2 mt-6 font-semibold">Rental plan</h2>
      <Segmented value={period} onChange={(p) => { setPeriod(p); setQty(p === "daily" ? 3 : 1); }} options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]} />

      <Card className="mt-3 divide-y divide-line">
        <button onClick={() => setPicking(true)} className="flex h-16 w-full items-center justify-between px-4 text-left active:bg-bg">
          <span className="font-medium">Pickup date</span>
          <span className="inline-flex items-center gap-2 font-semibold text-brand"><CalendarDays className="h-4 w-4" />{day(pickup)}</span>
        </button>
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

      <DateSheet open={picking} onClose={() => setPicking(false)} value={pickup} onPick={setPickup} />

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

/** Swipeable real photos of the model; tap one to see it full screen. */
function Gallery({ photos, name }: { photos: string[]; name: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <div className="no-scrollbar flex snap-x gap-2 overflow-x-auto px-4 pt-3">
        {photos.map((src, i) => (
          <button key={src} onClick={() => setOpen(src)} className="h-20 w-28 shrink-0 snap-start overflow-hidden rounded-xl bg-line" aria-label={`${name} photo ${i + 1}`}>
            <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      {open && (
        <button onClick={() => setOpen(null)} className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4" aria-label="Close photo">
          <img src={open} alt={name} className="max-h-full max-w-full rounded-xl object-contain" />
        </button>
      )}
    </>
  );
}
