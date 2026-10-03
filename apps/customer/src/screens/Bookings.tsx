import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpDown, ChevronDown, ChevronRight, ClipboardList, FileText, SlidersHorizontal } from "lucide-react";
import { useStore, type Booking } from "@/lib/store";
import { PERIOD_DAYS, PERIOD_UNIT, carById, carName, priceFor } from "@/data/catalog";
import { day } from "@/lib/format";
import { Button, Card, Chip, Empty, PageTitle, Price, Screen, Sheet, StatusDot, TopBar } from "@/components/ui";

const PRIORITY = { overdue: 0, ongoing: 1, upcoming: 2, completed: 3 };
const FILTERS = ["all", "overdue", "ongoing", "upcoming", "completed"] as const;

export default function Bookings() {
  const { bookings } = useStore();
  const [sort, setSort] = useState<"priority" | "recent">("priority");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [sheet, setSheet] = useState(false);

  const list = bookings
    .filter((b) => filter === "all" || b.status === filter)
    .sort((a, b) => (sort === "priority" ? PRIORITY[a.status] - PRIORITY[b.status] : 0) || b.pickup.localeCompare(a.pickup));

  return (
    <Screen>
      <TopBar />
      <PageTitle title="My bookings" />
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => setSort(sort === "priority" ? "recent" : "priority")} className="inline-flex items-center gap-1.5 text-sm font-medium">
          <ArrowUpDown className="h-4 w-4" /> {sort === "priority" ? "Priority" : "Most recent"} <ChevronDown className="h-4 w-4" />
        </button>
        <button onClick={() => setSheet(true)} className="inline-flex items-center gap-1.5 text-sm font-medium">
          <SlidersHorizontal className="h-4 w-4" /> Filters{filter !== "all" && <span className="h-2 w-2 rounded-full bg-brand" />}
        </button>
      </div>

      <div className="space-y-3">
        {list.map((b) => <BookingCard key={b.id} b={b} />)}
      </div>
      {!list.length && (
        <Empty icon={<ClipboardList />} title={bookings.length ? "Nothing here" : "No bookings yet"} text={bookings.length ? "Try another filter." : "Find a car and book in a minute."}
          action={bookings.length ? <Button variant="ghost" onClick={() => setFilter("all")}>Show all</Button> : <Link to="/book"><Button arrow>Find a car</Button></Link>} />
      )}

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Show bookings">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => <Chip key={f} active={filter === f} onClick={() => { setFilter(f); setSheet(false); }}>{f[0].toUpperCase() + f.slice(1)}</Chip>)}
        </div>
      </Sheet>
    </Screen>
  );
}

function BookingCard({ b }: { b: Booking }) {
  const nav = useNavigate();
  const car = carById(b.carId);
  const perDay = Math.round(priceFor(car, b.period) / PERIOD_DAYS[b.period]);
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-bold leading-tight">{carName(car)}</p>
          <p className="text-sm text-ink-muted">{car.year} · {car.category}</p>
        </div>
        <StatusDot status={b.status} />
      </div>
      <div className="mt-2 flex items-center gap-3">
        <img src={car.image} alt="" className="h-[96px] w-[48%] object-contain" loading="lazy" />
        <div className="flex-1 space-y-2">
          <Price value={b.period === "daily" ? perDay : priceFor(car, b.period)} unit={PERIOD_UNIT[b.period]} />
          <Dates label="Pickup" value={day(b.pickup)} />
          <Dates label="Return" value={day(b.dropoff)} />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <button onClick={() => nav(`/bookings/${b.id}#invoice`)} className="inline-flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4" /> Invoice</button>
        <Button size="sm" variant="soft" onClick={() => nav(`/bookings/${b.id}`)}>View details <ChevronRight className="h-4 w-4" /></Button>
      </div>
    </Card>
  );
}

const Dates = ({ label, value }: { label: string; value: string }) => (
  <p className="flex justify-between text-[13px]"><span className="text-ink-faint">{label}</span><span className="font-medium">{value}</span></p>
);
