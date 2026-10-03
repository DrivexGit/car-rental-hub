import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Car, CheckCircle2, FileBadge, FileText, Headphones, RefreshCw, ShieldCheck, TimerReset, TriangleAlert } from "lucide-react";
import { useStore, type Invoice } from "@/lib/store";
import { EXTRAS, PERIOD_DAYS, carById, carName, priceFor } from "@/data/catalog";
import { day, money, shortDay } from "@/lib/format";
import { BackBar, Badge, Button, Card, Dirham, ListGroup, ListRow, Screen, Sheet, StatusDot } from "@/components/ui";
import { PayInvoiceSheet } from "@/screens/PaySheet";
import { whatsappLink } from "@/config";

export default function BookingDetail() {
  const { id } = useParams();
  const { hash } = useLocation();
  const nav = useNavigate();
  const { bookings, invoices, fines, extend } = useStore();
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [sheet, setSheet] = useState<null | "extend" | "mulkiya" | "insurance">(null);
  const b = bookings.find((x) => x.id === id);

  useEffect(() => { if (hash) document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" }); }, [hash]);
  if (!b) return null;

  const car = carById(b.carId);
  const myInvoices = invoices.filter((i) => i.bookingId === b.id);
  const myFines = fines.filter((f) => f.bookingId === b.id);
  const total = (new Date(b.dropoff).getTime() - new Date(b.pickup).getTime()) / 86400000;
  const left = Math.ceil((new Date(b.dropoff).getTime() - Date.now()) / 86400000);
  const active = b.status === "ongoing" || b.status === "overdue";
  const perDay = Math.round(priceFor(car, b.period) / PERIOD_DAYS[b.period]);
  const insured = b.extras.includes("full_cover");

  return (
    <Screen tabs={false}>
      <BackBar title="Booking details" right={<StatusDot status={b.status} />} />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-b from-[#eef0ee] to-white px-4 pt-3"><img src={car.image} alt="" className="mx-auto h-[150px] object-contain" /></div>
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div><p className="text-xl font-bold">{carName(car)}</p><p className="text-sm text-ink-muted">{car.year} · {car.category}</p></div>
            <span className="rounded-lg border-2 border-ink px-2 py-0.5 font-mono text-sm font-bold">{b.plate}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Info label="Pickup" value={day(b.pickup)} />
            <Info label="Return" value={day(b.dropoff)} />
          </div>
          {active && (
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-sm">
                <span className={left < 0 ? "font-semibold text-danger" : "font-semibold"}>{left < 0 ? `${-left} day${left === -1 ? "" : "s"} overdue` : `${left} day${left === 1 ? "" : "s"} left`}</span>
                <span className="text-ink-muted">{Math.round(total)} days total</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-bg">
                <div className={`h-full rounded-full ${left < 0 ? "bg-danger" : "bg-brand"}`} style={{ width: `${Math.min(100, Math.max(4, ((total - left) / total) * 100))}%` }} />
              </div>
            </div>
          )}
          {active && <Button size="lg" className="mt-4" onClick={() => setSheet("extend")}><TimerReset className="h-5 w-5" /> Extend rental</Button>}
        </div>
      </Card>

      {b.status === "overdue" && (
        <div className="mt-3 flex gap-2.5 rounded-card bg-danger-soft p-3.5 text-sm text-danger">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          Your return date has passed. Extend the rental or return the car to avoid extra charges.
        </div>
      )}

      <h2 id="invoice" className="mb-2 mt-6 scroll-mt-20 font-semibold">Invoices</h2>
      <Card className="divide-y divide-line">
        {myInvoices.map((i) => (
          <div key={i.id} className="flex min-h-[64px] items-center gap-3 px-4 py-3">
            <FileText className="h-5 w-5 text-ink-muted" />
            <div className="flex-1"><p className="font-medium">{i.id}</p><p className="text-xs text-ink-muted">{day(i.issued)}</p></div>
            <div className="text-right">
              <p className="font-bold"><Dirham /> {money(i.amount)}</p>
              {i.status === "paid" ? <span className="inline-flex items-center gap-1 text-xs text-brand"><CheckCircle2 className="h-3.5 w-3.5" /> Paid</span>
                : <button onClick={() => setPaying(i)} className="text-xs font-semibold text-danger underline">Pay now</button>}
            </div>
          </div>
        ))}
        {!myInvoices.length && <p className="px-4 py-4 text-sm text-ink-muted">No invoices yet.</p>}
      </Card>

      <h2 className="mb-2 mt-6 font-semibold">Salik &amp; fines</h2>
      <Card className="divide-y divide-line">
        {myFines.map((f) => (
          <div key={f.id} className="flex min-h-[60px] items-center gap-3 px-4 py-3">
            <Badge className={f.type === "salik" ? "bg-brand-soft text-brand" : "bg-danger-soft text-danger"}>{f.type === "salik" ? "Salik" : "Fine"}</Badge>
            <div className="flex-1"><p className="text-sm font-medium">{f.place}</p><p className="text-xs text-ink-muted">{shortDay(f.date)}</p></div>
            <p className="font-semibold"><Dirham /> {f.amount}</p>
          </div>
        ))}
        {!myFines.length && <p className="px-4 py-4 text-sm text-ink-muted">No Salik or fines. Drive safe!</p>}
      </Card>
      {!!myFines.length && <p className="mt-2 px-1 text-xs text-ink-muted">Salik and fines are added to your next invoice.</p>}

      <div className="mt-6">
        <ListGroup title="Car & documents">
          <ListRow icon={<FileBadge className="h-5 w-5" />} label="Car registration (Mulkiya)" onClick={() => setSheet("mulkiya")} />
          <ListRow icon={<ShieldCheck className="h-5 w-5" />} label="Insurance" value={insured ? "Full cover" : "Basic"} onClick={() => setSheet("insurance")} />
          {active && <ListRow icon={<RefreshCw className="h-5 w-5" />} label="Change car" onClick={() => window.open(whatsappLink(`Hi, I'd like to change my car (${carName(car)}, ${b.plate}).`))} />}
          <ListRow icon={<Headphones className="h-5 w-5" />} label="Get help with this booking" onClick={() => nav("/support", { state: { ask: `I need help with my ${carName(car)} booking (${b.plate}).` } })} />
        </ListGroup>
      </div>

      {paying && <PayInvoiceSheet invoice={paying} open onClose={() => setPaying(null)} />}

      <Sheet open={sheet === "extend"} onClose={() => setSheet(null)} title="Extend rental">
        <p className="mb-4 text-sm text-ink-muted">Current return: <b className="text-ink">{day(b.dropoff)}</b></p>
        <div className="space-y-2">
          {[1, 3, 7, 30].map((d) => (
            <button key={d} onClick={() => { extend(b.id, d); setSheet(null); }} className="flex h-14 w-full items-center justify-between rounded-xl border border-line px-4 active:bg-bg">
              <span className="font-medium">+ {d} day{d > 1 ? "s" : ""}</span>
              <span className="font-semibold"><Dirham /> {money(perDay * d)}</span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs text-ink-muted">An invoice is added to this booking. You can pay it right away.</p>
      </Sheet>

      <Sheet open={sheet === "mulkiya"} onClose={() => setSheet(null)} title="Car registration">
        <DocCard icon={<Car className="h-6 w-6" />} rows={[["Vehicle", carName(car)], ["Plate", b.plate], ["Year", String(car.year)], ["Owner", "Drivex Car Rental LLC"]]} />
        <p className="mt-3 text-center text-xs text-ink-muted">Show this screen if the police ask for the car papers.</p>
      </Sheet>

      <Sheet open={sheet === "insurance"} onClose={() => setSheet(null)} title="Insurance">
        <DocCard icon={<ShieldCheck className="h-6 w-6" />} rows={[["Cover", insured ? "Full cover (zero excess)" : "Basic (third party + excess)"], ["Valid", `${shortDay(b.pickup)} – ${shortDay(b.dropoff)}`], ["Plate", b.plate]]} />
        {!insured && <p className="mt-3 text-sm text-ink-muted">Upgrade to full cover for <Dirham /> {EXTRAS[0].daily} / day — ask us in Support.</p>}
      </Sheet>
    </Screen>
  );
}

const Info = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl bg-bg p-3"><p className="text-xs text-ink-muted">{label}</p><p className="font-semibold">{value}</p></div>
);

// ponytail: shows booking data; swap for the real scanned Mulkiya/insurance PDFs from storage when they're uploaded.
const DocCard = ({ icon, rows }: { icon: React.ReactNode; rows: [string, string][] }) => (
  <div className="rounded-card border border-line bg-gradient-to-br from-brand-soft to-white p-4">
    <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-brand text-white">{icon}</div>
    {rows.map(([k, v]) => <p key={k} className="flex justify-between border-b border-line/70 py-2 text-sm last:border-0"><span className="text-ink-muted">{k}</span><span className="font-semibold">{v}</span></p>)}
  </div>
);
