import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CalendarCheck, FileText, Receipt } from "lucide-react";
import { useStore } from "@/lib/store";
import { BackBar, Card, Empty, Screen } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

const ICON: Record<string, typeof Bell> = { invoice: FileText, fine: Receipt, booking_confirmed: CalendarCheck };
const ago = (d: string, t: (k: string, v?: Record<string, string | number>) => string) => {
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  return m < 1 ? t("now") : m < 60 ? t("{n}m", { n: m }) : m < 1440 ? t("{n}h", { n: Math.round(m / 60) }) : t("{n}d", { n: Math.round(m / 1440) });
};

export default function Inbox() {
  const { t } = useI18n();
  const { notes, markNotesRead } = useStore();
  const nav = useNavigate();
  useEffect(() => { const t = setTimeout(markNotesRead, 1200); return () => clearTimeout(t); }, [markNotesRead]);
  return (
    <Screen tabs={false}>
      <BackBar title={t("Notifications")} />
      {!notes.length && <Empty icon={<Bell />} title={t("You're all caught up")} text={t("Invoices, Salik and booking updates show up here.")} />}
      <div className="space-y-2.5">
        {notes.map((n, i) => {
          const Icon = ICON[n.type] ?? Bell;
          return (
            <Card key={n.id} delay={i * 0.04} onClick={n.link ? () => nav(n.link!) : undefined} className="flex gap-3 p-4">
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${n.type === "fine" ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand"}`}><Icon className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-semibold">{n.title}</p>
                  <span className="shrink-0 text-xs text-ink-faint">{ago(n.created, t)}</span>
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
