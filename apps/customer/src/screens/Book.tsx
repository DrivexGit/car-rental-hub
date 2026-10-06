import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowUpDown, CalendarDays, ChevronRight, Search, SlidersHorizontal, Tag, Users } from "lucide-react";
import { PERIOD_UNIT, carName, priceFor, type Period } from "@/data/catalog";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { shortDay } from "@/lib/format";
import { DateRangeSheet } from "@/components/DatePicker";
import { Badge, Button, Card, Chip, Empty, PageTitle, Price, Screen, Segmented, Sheet, TopBar } from "@/components/ui";

const SORTS = { low: "Price: low to high", high: "Price: high to low", name: "Name A–Z" } as const;
type Sort = keyof typeof SORTS;

export default function Book() {
  const nav = useNavigate();
  const { fleet, offers } = useStore();
  const uniq = <T,>(xs: T[]) => Array.from(new Set(xs)).sort();
  const CATEGORIES = ["All", ...uniq(fleet.map((c) => c.category))];
  const BRANDS = ["All", ...uniq(fleet.map((c) => c.make))];
  const YEARS = ["All", ...uniq(fleet.map((c) => String(c.year)).filter((y) => y !== "0")).reverse()];
  const SEATS = ["All", ...uniq(fleet.map((c) => String(c.seats)))];
  const [params, setParams] = useSearchParams();
  const period = (params.get("period") as Period) || "daily";
  // "View all" on Home opens this page with only the discounted cars.
  const offersOnly = params.get("offers") === "1";
  const offerOff = useMemo(() => new Map(offers.filter((o) => o.kind === "car" && o.car).map((o) => [o.car!.id, o.off])), [offers]);
  const toggleOffers = () => setParams((s) => { if (offersOnly) s.delete("offers"); else s.set("offers", "1"); return s; }, { replace: true });
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("high");
  const [cat, setCat] = useState("All");
  const [brand, setBrand] = useState("All");
  const [year, setYear] = useState("All");
  const [seats, setSeats] = useState("All");
  const filtered = cat !== "All" || brand !== "All" || year !== "All" || seats !== "All";
  const clearAll = () => { setQ(""); setCat("All"); setBrand("All"); setYear("All"); setSeats("All"); };
  const [sheet, setSheet] = useState<null | "dates" | "sort" | "filter">(null);
  const [from, setFrom] = useState(params.get("from") || "");
  const [to, setTo] = useState(params.get("to") || "");

  // With dates: hide models whose every unit is already booked in that range.
  const [busy, setBusy] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!from || !to) { setBusy(new Set()); return; }
    supabase.rpc("busy_vehicle_ids", { p_from: `${from}T00:00:00+04:00`, p_to: `${to}T23:59:59+04:00` })
      .then(({ data }) => setBusy(new Set((data ?? []) as string[])));
  }, [from, to]);

  const cars = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = fleet.filter((c) => c.vehicleIds.some((v) => !busy.has(v)) && (!offersOnly || offerOff.has(c.id))
      && (cat === "All" || c.category === cat) && (brand === "All" || c.make === brand)
      && (year === "All" || String(c.year) === year) && (seats === "All" || String(c.seats) === seats)
      && `${c.make} ${carName(c)} ${c.category}`.toLowerCase().includes(term));
    return list.sort((a, b) => (sort === "name" ? carName(a).localeCompare(carName(b)) : (priceFor(a, period) - priceFor(b, period)) * (sort === "low" ? 1 : -1)));
  }, [fleet, busy, q, sort, cat, brand, year, seats, period, offersOnly, offerOff]);

  const setPeriod = (p: Period) => setParams((s) => { s.set("period", p); return s; }, { replace: true });
  const dateQuery = from && to ? `&from=${from}&to=${to}` : "";

  return (
    <Screen wide>
      <TopBar />
      <PageTitle title="Find your drive" />
      <div className="pt-safe sticky top-0 z-20 -mx-5 bg-bg/95 px-5 pb-3 pt-2 backdrop-blur lg:-mx-10 lg:px-10">

      <Segmented value={period} onChange={setPeriod} options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]} />

      <div className="mt-3 flex gap-2">
        <label className="flex h-12 flex-1 items-center gap-2.5 rounded-xl border border-line bg-white px-3.5">
          <Search className="h-5 w-5 text-ink-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cars" className="w-full bg-transparent text-[15px] outline-none placeholder:text-ink-faint" />
        </label>
        <IconBtn label="Sort" onClick={() => setSheet("sort")}><ArrowUpDown className="h-5 w-5" /></IconBtn>
        <IconBtn label="Filter" onClick={() => setSheet("filter")} dot={filtered}><SlidersHorizontal className="h-5 w-5" /></IconBtn>
      </div>
      </div>

      <Card className="mb-3" onClick={() => setSheet("dates")}>
        <div className="flex h-14 items-center gap-3 px-4">
          <CalendarDays className="h-5 w-5" />
          <span className="flex-1 text-[15px] font-medium">
            {from && to ? `${shortDay(from)} – ${shortDay(to)}` : <>Add rental dates <span className="font-normal text-ink-faint">(optional)</span></>}
          </span>
          <ChevronRight className="h-5 w-5 text-ink-faint" />
        </div>
      </Card>

      {!!offerOff.size && (
        <div className="mb-3 flex">
          <Chip active={offersOnly} onClick={toggleOffers}><Tag className="h-4 w-4" /> Offers only</Chip>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:gap-4 xl:grid-cols-3">
        {cars.map((c, i) => {
          const off = offersOnly ? offerOff.get(c.id) ?? 0 : 0;
          const base = priceFor(c, period);
          return (
          <Card key={c.id} className="p-4" delay={Math.min(i, 6) * 0.05}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-lg font-bold leading-tight">{carName(c)}</p>
              {!!off && <Badge className="shrink-0 bg-danger text-white">{off}% off</Badge>}
            </div>
            <p className="flex items-center gap-1.5 text-sm text-ink-muted">{c.year} · {c.category} · <Users className="h-3.5 w-3.5" /> {c.seats} seats</p>
            <img src={c.image} alt={carName(c)} className="mx-auto my-2 h-[130px] w-full object-contain" loading="lazy" />
            <div className="flex items-center justify-between">
              <Price value={off ? Math.round(base * (1 - off / 100)) : base} old={off ? base : undefined} unit={PERIOD_UNIT[period]} />
              <Button size="sm" arrow onClick={() => nav(`/book/${c.id}?period=${period}${off ? `&off=${off}` : ""}${dateQuery}`)}>View &amp; book</Button>
            </div>
          </Card>
          );
        })}
        {!cars.length && <div className="col-span-full"><Empty icon={<Search />} title={offersOnly ? "No offers right now" : "No cars found"} text={offersOnly ? "Turn off Offers only to see every car." : "Try another name or clear the filter."} action={<Button variant="ghost" onClick={clearAll}>Clear</Button>} /></div>}
      </div>

      <Sheet open={sheet === "sort"} onClose={() => setSheet(null)} title="Sort by">
        <div className="space-y-2">
          {(Object.keys(SORTS) as Sort[]).map((k) => (
            <button key={k} onClick={() => { setSort(k); setSheet(null); }} className={`flex h-14 w-full items-center justify-between rounded-xl border px-4 text-left font-medium ${sort === k ? "border-brand bg-brand-soft text-brand" : "border-line"}`}>
              {SORTS[k]}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === "filter"} onClose={() => setSheet(null)} title="Filter">
        {([["Car type", CATEGORIES, cat, setCat], ["Brand", BRANDS, brand, setBrand], ["Year", YEARS, year, setYear], ["Seats", SEATS, seats, setSeats]] as const).map(([label, opts, val, set]) => (
          <div key={label} className="mb-5">
            <p className="mb-2 text-sm font-semibold text-ink-muted">{label}</p>
            <div className="flex flex-wrap gap-2">
              {opts.map((k) => <Chip key={k} active={val === k} onClick={() => set(k)}>{label === "Seats" && k !== "All" ? `${k} seats` : k}</Chip>)}
            </div>
          </div>
        ))}
        <div className="flex gap-2">
          {filtered && <Button size="lg" variant="ghost" className="w-auto" onClick={clearAll}>Clear</Button>}
          <Button size="lg" onClick={() => setSheet(null)}>Show {cars.length} cars</Button>
        </div>
      </Sheet>

      <DateRangeSheet open={sheet === "dates"} onClose={() => setSheet(null)} from={from} to={to}
        onApply={(f, t) => { setFrom(f); setTo(t); }} onClear={() => { setFrom(""); setTo(""); }} />
    </Screen>
  );
}

const IconBtn = ({ children, label, onClick, dot }: { children: React.ReactNode; label: string; onClick: () => void; dot?: boolean }) => (
  <button onClick={onClick} aria-label={label} className="relative grid h-12 w-12 place-items-center rounded-xl border border-line bg-white">
    {children}
    {dot && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-brand" />}
  </button>
);

