import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowUpDown, CalendarDays, ChevronRight, Search, SlidersHorizontal, Users } from "lucide-react";
import { PERIOD_UNIT, carName, priceFor, type Period } from "@/data/catalog";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { shortDay } from "@/lib/format";
import { DateRangeSheet } from "@/components/DatePicker";
import { Button, Card, Chip, Empty, PageTitle, Price, Screen, Segmented, Sheet, TopBar } from "@/components/ui";

const SORTS = { low: "Price: low to high", high: "Price: high to low", name: "Name A–Z" } as const;
type Sort = keyof typeof SORTS;

export default function Book() {
  const nav = useNavigate();
  const { fleet } = useStore();
  const CATEGORIES = ["All", ...Array.from(new Set(fleet.map((c) => c.category)))];
  const [params, setParams] = useSearchParams();
  const period = (params.get("period") as Period) || "daily";
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("high");
  const [cat, setCat] = useState("All");
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
    const list = fleet.filter((c) => c.vehicleIds.some((v) => !busy.has(v)) && (cat === "All" || c.category === cat) && carName(c).toLowerCase().includes(q.trim().toLowerCase()));
    return list.sort((a, b) => (sort === "name" ? carName(a).localeCompare(carName(b)) : (priceFor(a, period) - priceFor(b, period)) * (sort === "low" ? 1 : -1)));
  }, [fleet, busy, q, sort, cat, period]);

  const setPeriod = (p: Period) => setParams((s) => { s.set("period", p); return s; }, { replace: true });
  const dateQuery = from && to ? `&from=${from}&to=${to}` : "";

  return (
    <Screen>
      <TopBar />
      <PageTitle title="Find your drive" />

      <Segmented value={period} onChange={setPeriod} options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]} />

      <Card className="mt-3" onClick={() => setSheet("dates")}>
        <div className="flex h-14 items-center gap-3 px-4">
          <CalendarDays className="h-5 w-5" />
          <span className="flex-1 text-[15px] font-medium">
            {from && to ? `${shortDay(from)} – ${shortDay(to)}` : <>Add rental dates <span className="font-normal text-ink-faint">(optional)</span></>}
          </span>
          <ChevronRight className="h-5 w-5 text-ink-faint" />
        </div>
      </Card>

      <div className="mt-3 flex gap-2">
        <label className="flex h-12 flex-1 items-center gap-2.5 rounded-xl border border-line bg-white px-3.5">
          <Search className="h-5 w-5 text-ink-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cars" className="w-full bg-transparent text-[15px] outline-none placeholder:text-ink-faint" />
        </label>
        <IconBtn label="Sort" onClick={() => setSheet("sort")}><ArrowUpDown className="h-5 w-5" /></IconBtn>
        <IconBtn label="Filter" onClick={() => setSheet("filter")} dot={cat !== "All"}><SlidersHorizontal className="h-5 w-5" /></IconBtn>
      </div>

      <div className="mt-4 space-y-3">
        {cars.map((c, i) => (
          <Card key={c.id} className="p-4" delay={Math.min(i, 6) * 0.05}>
            <p className="text-lg font-bold leading-tight">{carName(c)}</p>
            <p className="flex items-center gap-1.5 text-sm text-ink-muted">{c.year} · {c.category} · <Users className="h-3.5 w-3.5" /> {c.seats} seats</p>
            <img src={c.image} alt={carName(c)} className="mx-auto my-2 h-[130px] w-full object-contain" loading="lazy" />
            <div className="flex items-center justify-between">
              <Price value={priceFor(c, period)} unit={PERIOD_UNIT[period]} />
              <Button size="sm" arrow onClick={() => nav(`/book/${c.id}?period=${period}${dateQuery}`)}>View &amp; book</Button>
            </div>
          </Card>
        ))}
        {!cars.length && <Empty icon={<Search />} title="No cars found" text="Try another name or clear the filter." action={<Button variant="ghost" onClick={() => { setQ(""); setCat("All"); }}>Clear</Button>} />}
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

      <Sheet open={sheet === "filter"} onClose={() => setSheet(null)} title="Car type">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((k) => <Chip key={k} active={cat === k} onClick={() => setCat(k)}>{k}</Chip>)}
        </div>
        <Button size="lg" className="mt-6" onClick={() => setSheet(null)}>Show {cars.length} cars</Button>
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

