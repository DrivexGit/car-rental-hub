import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpDown, ChevronDown, ChevronRight, ClipboardList, FileText, SlidersHorizontal } from "lucide-react";
import { useStore, type Booking } from "@/lib/store";
import { PERIOD_DAYS, PERIOD_UNIT, carName, priceFor } from "@/data/catalog";
import { day } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { Button, Card, Chip, Empty, PageTitle, Price, Screen, Sheet, StatusDot, TopBar } from "@/components/ui";

const PRIORITY = { overdue: 0, pending: 1, ongoing: 2, upcoming: 3, completed: 4, cancelled: 5 };
const FILTERS = ["all", "pending", "overdue", "ongoing", "upcoming", "completed", "cancelled"] as const;

export default function Bookings() {
  const { bookings } = useStore();
  const { t } = useI18n();
  const FILTER_LABEL = { all: t("All"), pending: t("Awaiting payment"), overdue: t("Overdue"), ongoing: t("Ongoing"), upcoming: t("Upcoming"), completed: t("Completed"), cancelled: t("Cancelled") };
  const [sort, setSort] = useState<"priority" | "recent">("priority");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [sheet, setSheet] = useState(false);

  const list = bookings
    .filter((b) => filter === "all" || b.status === filter)
    .sort((a, b) => (sort === "priority" ? PRIORITY[a.status] - PRIORITY[b.status] : 0) || b.pickup.localeCompare(a.pickup));

  return (
    <Screen wide>
      <TopBar />
      <PageTitle title={t("My bookings")} />
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => setSort(sort === "priority" ? "recent" : "priority")} className="inline-flex items-center gap-1.5 text-sm font-medium">
          <ArrowUpDown className="h-4 w-4" /> {sort === "priority" ? t("Priority") : t("Most recent")} <ChevronDown className="h-4 w-4" />
        </button>
        <button onClick={() => setSheet(true)} className="inline-flex items-center gap-1.5 text-sm font-medium">
          <SlidersHorizontal className="h-4 w-4" /> {t("Filters")}{filter !== "all" && <span className="h-2 w-2 rounded-full bg-brand" />}
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        {list.map((b) => <BookingCard key={b.id} b={b} />)}
      </div>
      {!list.length && (
        <Empty icon={<ClipboardList />} title={bookings.length ? t("Nothing here") : t("No bookings yet")} text={bookings.length ? t("Try another filter.") : t("Find a car and book in a minute.")}
          action={bookings.length ? <Button variant="ghost" onClick={() => setFilter("all")}>{t("Show all")}</Button> : <Link to="/book"><Button arrow>{t("Find a car")}</Button></Link>} />
      )}

      <Sheet open={sheet} onClose={() => setSheet(false)} title={t("Show bookings")}>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => <Chip key={f} active={filter === f} onClick={() => { setFilter(f); setSheet(false); }}>{FILTER_LABEL[f]}</Chip>)}
        </div>
      </Sheet>
    </Screen>
  );
}

function BookingCard({ b }: { b: Booking }) {
  const nav = useNavigate();
  const { t } = useI18n();
  const car = b.car;
  const perDay = Math.round(priceFor(car, b.period) / PERIOD_DAYS[b.period]);
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-bold leading-tight">{carName(car)}</p>
          <p className="text-sm text-ink-muted">{car.year} · {t(car.category)}</p>
        </div>
        <StatusDot status={b.status} />
      </div>
      <div className="mt-2 flex items-center gap-3">
        <img src={car.image} alt="" className="h-[96px] w-[48%] object-contain" loading="lazy" />
        <div className="flex-1 space-y-2">
          <Price value={b.period === "daily" ? perDay : priceFor(car, b.period)} unit={t(PERIOD_UNIT[b.period])} />
          <Dates label={t("Pickup")} value={day(b.pickup)} />
          <Dates label={t("Return")} value={day(b.dropoff)} />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <button onClick={() => nav(`/bookings/${b.id}#invoice`)} className="inline-flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4" /> {t("Invoice")}</button>
        <Button size="sm" variant="soft" onClick={() => nav(`/bookings/${b.id}`)}>{t("View details")} <ChevronRight className="h-4 w-4 rtl:-scale-x-100" /></Button>
      </div>
    </Card>
  );
}

const Dates = ({ label, value }: { label: string; value: string }) => (
  <p className="flex justify-between text-[13px]"><span className="text-ink-faint">{label}</span><span className="font-medium">{value}</span></p>
);
