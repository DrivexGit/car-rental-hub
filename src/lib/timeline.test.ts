import { describe, expect, it } from 'vitest';
import { buildTimeline, groupByDay, TIMELINE_FILTERS } from './timeline';

const at = (d: string) => `2026-10-0${d}T10:00:00.000Z`;

const src = {
  messages: [
    { id: 'm2', direction: 'outbound', message_type: 'staff', message_text: 'We will call you', created_at: at('3') },
    { id: 'm1', direction: 'inbound', message_text: 'Hi, I need a car', created_at: at('1') },
    { id: 'm3', direction: 'outbound', message_type: 'text', message_text: 'Bot reply', created_at: at('1') },
  ],
  reservations: [{ id: 'r1', status: 'pending', created_at: at('2'), start_datetime: at('5'), end_datetime: at('8'), total_amount: '3750', vehicles: { make: 'Mercedes', model: 'G63', plate_number: 'A 1234' } }],
  invoices: [{ id: 'i1', number: 'INV-1', status: 'pending', issued_at: at('2'), amount: '3750', description: 'G63 rental' }],
  payments: [
    { id: 'p1', status: 'pending', created_at: at('2'), amount: 3750, provider: 'ziina' },
    { id: 'p2', status: 'succeeded', created_at: at('4'), amount: 3750, provider: 'ziina' },
    { id: 'p3', status: 'failed', created_at: at('4'), amount: 3750, provider: 'ziina' },
  ],
  fines: [{ id: 'f1', type: 'salik', occurred_at: at('6'), amount: 4, location: 'Al Barsha' }, { id: 'f2', type: 'traffic', occurred_at: at('7'), amount: 400 }],
  urgent: [{ id: 'u1', status: 'open', message: 'Flat tyre', created_at: at('5') }],
  documents: [{ id: 'd1', document_type: 'driving_license', file_name: 'dl.jpg', verification_status: 'approved', created_at: at('1') }],
};

describe('buildTimeline', () => {
  const events = buildTimeline(src);

  it('is in chronological order, ties broken by id', () => {
    const times = events.map((e) => new Date(e.at).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    // same instant on day 1: document, bot reply, inbound message
    expect(events.filter((e) => e.at === at('1')).map((e) => e.id)).toEqual(['doc-d1', 'msg-m1', 'msg-m3']);
  });

  it('puts the customer on one side and the team on the other', () => {
    expect(events.find((e) => e.id === 'msg-m1')?.side).toBe('customer');
    expect(events.find((e) => e.id === 'msg-m2')?.side).toBe('team');
    expect(events.find((e) => e.id === 'urg-u1')?.side).toBe('customer');
    expect(events.find((e) => e.id === 'inv-i1')?.side).toBe('team');
  });

  it('labels who sent an outbound message', () => {
    expect(events.find((e) => e.id === 'msg-m2')?.detail).toBe('Staff');
    expect(events.find((e) => e.id === 'msg-m3')?.detail).toBe('Robot');
  });

  it('skips pending payments but keeps outcomes', () => {
    expect(events.some((e) => e.id === 'pay-p1')).toBe(false);
    expect(events.find((e) => e.id === 'pay-p2')).toMatchObject({ title: 'Payment received', tone: 'good', amount: 3750 });
    expect(events.find((e) => e.id === 'pay-p3')).toMatchObject({ title: 'Payment failed', tone: 'bad' });
  });

  it('describes bookings, fines and urgent requests', () => {
    expect(events.find((e) => e.id === 'res-r1')).toMatchObject({ title: 'Booking awaiting payment: Mercedes G63', tone: 'warn', amount: 3750 });
    expect(events.find((e) => e.id === 'fine-f1')).toMatchObject({ title: 'Salik charge', detail: 'Al Barsha', tone: 'warn' });
    expect(events.find((e) => e.id === 'fine-f2')).toMatchObject({ title: 'Traffic fine', tone: 'bad' });
    expect(events.find((e) => e.id === 'urg-u1')).toMatchObject({ detail: 'Flat tyre', tone: 'bad' });
    expect(events.find((e) => e.id === 'doc-d1')).toMatchObject({ title: 'Uploaded driving license', tone: 'good' });
  });

  it('drops events without a valid date and handles empty input', () => {
    expect(buildTimeline({ messages: [{ id: 'x', direction: 'inbound', message_text: 'a', created_at: null }] })).toEqual([]);
    expect(buildTimeline({})).toEqual([]);
  });
});

describe('groupByDay and filters', () => {
  it('groups same-day events under one heading', () => {
    const groups = groupByDay(buildTimeline(src));
    expect(groups.map((g) => g.events.length).reduce((a, b) => a + b, 0)).toBe(buildTimeline(src).length);
    expect(groups.length).toBe(7); // days 1..7
  });

  it('filters cover every kind exactly as expected', () => {
    const kinds = new Set(buildTimeline(src).map((e) => e.kind));
    const covered = new Set(TIMELINE_FILTERS.flatMap((f) => f.kinds ?? []));
    for (const k of kinds) expect(covered.has(k)).toBe(true);
  });
});
