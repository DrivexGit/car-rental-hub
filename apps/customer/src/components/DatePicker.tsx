import { useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { addDays, daysBetween, isoDate, shortDay } from "@/lib/format";
import { Button, Sheet } from "@/components/ui";

const parse = (s?: string) => (s ? new Date(`${s}T12:00:00`) : undefined);
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

/** Bottom-sheet range calendar for pickup → return. */
export function DateRangeSheet({ open, onClose, from, to, onApply, onClear }: {
  open: boolean; onClose: () => void; from?: string; to?: string; onApply: (from: string, to: string) => void; onClear?: () => void;
}) {
  const [range, setRange] = useState<DateRange | undefined>(from ? { from: parse(from), to: parse(to) } : undefined);
  const nights = range?.from && range?.to ? daysBetween(range.from, range.to) : 0;
  return (
    <Sheet open={open} onClose={onClose} title="Rental dates">
      <div className="mb-3 grid grid-cols-2 gap-2 text-center">
        <Pill label="Pickup" value={range?.from ? shortDay(range.from) : "Select"} active={!range?.from} />
        <Pill label="Return" value={range?.to ? shortDay(range.to) : "Select"} active={!!range?.from && !range?.to} />
      </div>
      <div className="flex justify-center">
        <DayPicker mode="range" selected={range} onSelect={setRange} min={1} disabled={{ before: today() }} startMonth={today()} endMonth={addDays(today(), 365)}
          excludeDisabled weekStartsOn={1} className="drivex-cal" />
      </div>
      <div className="mt-4 flex gap-2">
        {onClear && <Button variant="ghost" className="flex-1" onClick={() => { setRange(undefined); onClear(); onClose(); }}>Clear</Button>}
        <Button className="flex-[2]" disabled={!range?.from || !range?.to} onClick={() => { onApply(isoDate(range!.from!), isoDate(range!.to!)); onClose(); }}>
          {nights ? `Apply · ${nights} day${nights > 1 ? "s" : ""}` : "Apply"}
        </Button>
      </div>
    </Sheet>
  );
}

/** Bottom-sheet single-day calendar. */
export function DateSheet({ open, onClose, value, onPick, title = "Pickup date" }: { open: boolean; onClose: () => void; value?: string; onPick: (d: string) => void; title?: string }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex justify-center">
        <DayPicker mode="single" selected={parse(value)} onSelect={(d) => { if (d) { onPick(isoDate(d)); onClose(); } }}
          disabled={{ before: today() }} startMonth={today()} endMonth={addDays(today(), 365)} weekStartsOn={1} className="drivex-cal" />
      </div>
    </Sheet>
  );
}

const Pill = ({ label, value, active }: { label: string; value: string; active: boolean }) => (
  <div className={`rounded-xl border px-3 py-2 transition-colors ${active ? "border-brand bg-brand-soft" : "border-line"}`}>
    <p className="text-xs text-ink-muted">{label}</p>
    <p className="font-semibold">{value}</p>
  </div>
);
