import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Car, CreditCard, FileText, MessageCircle, Paperclip, Receipt, Siren } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { aed } from '@/lib/format';
import { cn } from '@/lib/utils';
import { buildTimeline, groupByDay, TIMELINE_FILTERS, type TimelineEvent, type TimelineKind, type Tone } from '@/lib/timeline';

const ICON: Record<TimelineKind, typeof Car> = { message: MessageCircle, booking: Car, payment: CreditCard, invoice: FileText, fine: Receipt, urgent: Siren, document: Paperclip };
const TONE: Record<Tone, string> = {
  default: 'bg-muted text-foreground border-muted',
  good: 'bg-emerald-50 text-emerald-900 border-emerald-100',
  warn: 'bg-amber-50 text-amber-900 border-amber-100',
  bad: 'bg-red-50 text-red-900 border-red-100',
};
const DOT: Record<Tone, string> = { default: 'bg-slate-400', good: 'bg-emerald-500', warn: 'bg-amber-500', bad: 'bg-red-500' };

type Props = {
  customerId: string | null;
  messages: any[];
  reservations: any[];
  documents: any[];
};

/** Everything that happened with this customer on one chat-like timeline: messages, bookings, invoices, payments, fines, urgent requests. */
export function LeadTimeline({ customerId, messages, reservations, documents }: Props) {
  const [extra, setExtra] = useState<{ invoices: any[]; payments: any[]; fines: any[]; urgent: any[] }>({ invoices: [], payments: [], fines: [], urgent: [] });
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<(typeof TIMELINE_FILTERS)[number]['id']>('all');
  const end = useRef<HTMLDivElement>(null);

  // Money and urgent requests belong to the app customer account, which may not exist for a lead that only used WhatsApp.
  useEffect(() => {
    if (!customerId) return;
    let live = true;
    Promise.all([
      supabase.from('invoices' as any).select('*').eq('customer_id', customerId),
      supabase.from('payments' as any).select('*').eq('customer_id', customerId),
      supabase.from('fines' as any).select('*').eq('customer_id', customerId),
      supabase.from('urgent_requests' as any).select('*').eq('customer_id', customerId),
    ]).then(([i, p, f, u]) => {
      if (!live) return;
      setFailed([i, p, f, u].some((r) => r.error));
      setExtra({ invoices: (i.data as any) || [], payments: (p.data as any) || [], fines: (f.data as any) || [], urgent: (u.data as any) || [] });
    });
    return () => { live = false; };
  }, [customerId]);

  const all = useMemo(() => buildTimeline({ messages, reservations, documents, ...extra }), [messages, reservations, documents, extra]);
  const kinds = TIMELINE_FILTERS.find((f) => f.id === filter)?.kinds ?? null;
  const events = useMemo(() => (kinds ? all.filter((e) => (kinds as readonly TimelineKind[]).includes(e.kind)) : all), [all, kinds]);
  const groups = useMemo(() => groupByDay(events), [events]);

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [events.length, filter]);

  return (
    <Card className="border-none shadow-md rounded-2xl overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 p-4" role="tablist" aria-label="Timeline filter">
        {TIMELINE_FILTERS.map((f) => {
          const count = f.kinds ? all.filter((e) => (f.kinds as readonly TimelineKind[]).includes(e.kind)).length : all.length;
          return (
            <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
              className={cn('rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-tight transition-colors',
                filter === f.id ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-muted-foreground/20 bg-background text-muted-foreground hover:bg-muted')}>
              {f.label} <span className="opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <CardContent className="max-h-[560px] overflow-y-auto p-6">
        {!customerId && <p className="mb-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">This lead has no app account yet, so invoices, payments, fines and urgent requests are not available. Messages, bookings and documents are shown.</p>}
        {failed && <p className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900"><AlertTriangle className="h-4 w-4" /> Some history could not be loaded.</p>}

        {!events.length && (
          <div className="flex flex-col items-center justify-center py-16 opacity-30">
            <MessageCircle className="mb-3 h-10 w-10" />
            <p className="text-sm font-black uppercase tracking-widest">Nothing here yet</p>
          </div>
        )}

        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key} aria-label={g.label}>
              <div className="mb-3 flex justify-center"><Badge variant="outline" className="text-[10px] font-bold uppercase text-muted-foreground">{g.label}</Badge></div>
              <ol className="space-y-3">{g.events.map((e) => <Row key={e.id} e={e} />)}</ol>
            </section>
          ))}
        </div>
        <div ref={end} />
      </CardContent>
    </Card>
  );
}

function Row({ e }: { e: TimelineEvent }) {
  const Icon = ICON[e.kind];
  const mine = e.side === 'team';
  return (
    <li className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div className={cn('flex max-w-[88%] gap-3 sm:max-w-[75%]', mine && 'flex-row-reverse')}>
        <span className={cn('mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full border bg-background', e.tone !== 'default' && 'border-transparent')} title={e.kind}>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </span>
        <div className={cn('rounded-2xl border px-4 py-3 text-[13px] leading-relaxed shadow-sm', TONE[e.tone], mine ? 'rounded-tr-none' : 'rounded-tl-none')}>
          <div className="flex items-start justify-between gap-4">
            <p className="font-semibold whitespace-pre-wrap break-words">{e.title}</p>
            {e.amount != null && <p className="shrink-0 font-black">{aed(e.amount)}</p>}
          </div>
          {e.detail && <p className="mt-0.5 text-xs opacity-80 whitespace-pre-wrap break-words">{e.detail}</p>}
          <p className="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase opacity-50">
            <span className={cn('h-1.5 w-1.5 rounded-full', DOT[e.tone])} />
            {new Date(e.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    </li>
  );
}
