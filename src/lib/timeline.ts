// Merges everything that happened with one customer into a single chronological list (CRM style).
// Pure functions only, so the ordering and wording can be tested without a database.

export type TimelineKind = 'message' | 'booking' | 'payment' | 'invoice' | 'fine' | 'urgent' | 'document';
export type Tone = 'default' | 'good' | 'warn' | 'bad';

export type TimelineEvent = {
  id: string;
  at: string; // ISO timestamp
  kind: TimelineKind;
  /** Who did it: the customer, or the team/system. Decides the side of the bubble. */
  side: 'customer' | 'team';
  title: string;
  detail?: string;
  amount?: number;
  tone: Tone;
};

type Row = Record<string, any>;
export type TimelineSource = {
  messages?: Row[];
  reservations?: Row[];
  documents?: Row[];
  invoices?: Row[];
  payments?: Row[];
  fines?: Row[];
  urgent?: Row[];
};

const label = (s?: string | null) => (s ? s.replace(/_/g, ' ') : '');
const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '');

export function buildTimeline(src: TimelineSource): TimelineEvent[] {
  const out: TimelineEvent[] = [];

  for (const m of src.messages ?? []) {
    const inbound = m.direction === 'inbound';
    out.push({
      id: `msg-${m.id}`, at: m.created_at, kind: 'message', side: inbound ? 'customer' : 'team', tone: 'default',
      title: m.message_text,
      detail: inbound ? undefined : m.message_type === 'staff' ? 'Staff' : 'Robot',
    });
  }

  for (const r of src.reservations ?? []) {
    const v = r.vehicles;
    out.push({
      id: `res-${r.id}`, at: r.created_at, kind: 'booking', side: 'customer',
      title: `Booking ${r.status === 'cancelled' ? 'cancelled' : r.status === 'pending' ? 'awaiting payment' : 'confirmed'}${v ? `: ${v.make} ${v.model}` : ''}`,
      detail: [v?.plate_number, r.start_datetime && r.end_datetime ? `${day(r.start_datetime)} to ${day(r.end_datetime)}` : ''].filter(Boolean).join(' · ') || undefined,
      amount: r.total_amount != null ? Number(r.total_amount) : undefined,
      tone: r.status === 'cancelled' ? 'bad' : r.status === 'pending' ? 'warn' : 'good',
    });
  }

  for (const i of src.invoices ?? []) {
    out.push({
      id: `inv-${i.id}`, at: i.issued_at ?? i.created_at, kind: 'invoice', side: 'team',
      title: `Invoice ${i.number} ${i.status === 'void' ? 'voided' : 'issued'}`,
      detail: i.description || undefined, amount: Number(i.amount),
      tone: i.status === 'void' ? 'bad' : i.status === 'pending' ? 'warn' : 'default',
    });
  }

  for (const p of src.payments ?? []) {
    if (p.status === 'pending') continue; // not an outcome yet
    out.push({
      id: `pay-${p.id}`, at: p.created_at, kind: 'payment', side: 'customer',
      title: p.status === 'succeeded' ? 'Payment received' : 'Payment failed',
      detail: label(p.provider) || undefined, amount: Number(p.amount),
      tone: p.status === 'succeeded' ? 'good' : 'bad',
    });
  }

  for (const f of src.fines ?? []) {
    out.push({
      id: `fine-${f.id}`, at: f.occurred_at ?? f.created_at, kind: 'fine', side: 'team',
      title: f.type === 'salik' ? 'Salik charge' : 'Traffic fine',
      detail: f.location || undefined, amount: Number(f.amount), tone: f.type === 'salik' ? 'warn' : 'bad',
    });
  }

  for (const u of src.urgent ?? []) {
    out.push({
      id: `urg-${u.id}`, at: u.created_at, kind: 'urgent', side: 'customer',
      title: u.status === 'handled' ? 'Urgent request (handled)' : 'Urgent request',
      detail: u.message, tone: u.status === 'handled' ? 'default' : 'bad',
    });
  }

  for (const d of src.documents ?? []) {
    out.push({
      id: `doc-${d.id}`, at: d.created_at, kind: 'document', side: 'customer',
      title: `Uploaded ${label(d.document_type)}`,
      detail: [d.file_name, d.verification_status].filter(Boolean).join(' · ') || undefined,
      tone: d.verification_status === 'approved' ? 'good' : d.verification_status === 'rejected' ? 'bad' : 'default',
    });
  }

  return out
    .filter((e) => e.at && !Number.isNaN(new Date(e.at).getTime()))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime() || a.id.localeCompare(b.id));
}

/** Filter chips group the kinds. */
export const TIMELINE_FILTERS = [
  { id: 'all', label: 'All', kinds: null },
  { id: 'messages', label: 'Messages', kinds: ['message'] },
  { id: 'bookings', label: 'Bookings', kinds: ['booking'] },
  { id: 'money', label: 'Money', kinds: ['invoice', 'payment', 'fine'] },
  { id: 'urgent', label: 'Urgent', kinds: ['urgent'] },
  { id: 'documents', label: 'Documents', kinds: ['document'] },
] as const satisfies readonly { id: string; label: string; kinds: readonly TimelineKind[] | null }[];

/** Same-day events share one date heading. */
export function groupByDay(events: TimelineEvent[]): { key: string; label: string; events: TimelineEvent[] }[] {
  const groups: { key: string; label: string; events: TimelineEvent[] }[] = [];
  for (const e of events) {
    const d = new Date(e.at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const last = groups[groups.length - 1];
    if (last?.key === key) last.events.push(e);
    else groups.push({ key, label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }), events: [e] });
  }
  return groups;
}
