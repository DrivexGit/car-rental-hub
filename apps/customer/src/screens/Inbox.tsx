import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CalendarCheck, FileText, Receipt } from "lucide-react";
import { useStore } from "@/lib/store";
import { BackBar, Card, Empty, Screen } from "@/components/ui";

const ICON: Record<string, typeof Bell> = { invoice: FileText, fine: Receipt, booking_confirmed: CalendarCheck };
const ago = (d: string) => {
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  return m < 1 ? "now" : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
};

export default function Inbox() {
  const { notes, markNotesRead } = useStore();
  const nav = useNavigate();
  useEffect(() => { const t = setTimeout(markNotesRead, 1200); return () => clearTimeout(t); }, [markNotesRead]);
  return (
    <Screen tabs={false}>
      <BackBar title="Notifications" />
      {!notes.length && <Empty icon={<Bell />} title="You're all caught up" text="Invoices, Salik and booking updates show up here." />}
      <div className="space-y-2.5">
        {notes.map((n, i) => {
          const Icon = ICON[n.type] ?? Bell;
          return (
            <Card key={n.id} delay={i * 0.04} onClick={n.link ? () => nav(n.link!) : undefined} className="flex gap-3 p-4">
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${n.type === "fine" ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand"}`}><Icon className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-semibold">{n.title}</p>
                  <span className="shrink-0 text-xs text-ink-faint">{ago(n.created)}</span>
                </div>
                {n.body && <p className="text-sm text-ink-muted">{n.body}</p>}
              </div>
              {!n.read && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" />}
            </Card>
          );
        })}
      </div>
    </Screen>
  );
}
