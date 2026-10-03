import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CalendarPlus, CreditCard, FileText, TriangleAlert, UserPlus, CheckCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ago } from '@/lib/format';

const ICON: Record<string, typeof Bell> = { booking_new: CalendarPlus, booking_paid: CreditCard, urgent: TriangleAlert, document: FileText, customer_new: UserPlus };

export default function Notifications() {
  const { notes, unread, markAllRead, markRead } = useNotifications();
  const nav = useNavigate();
  const [urgent, setUrgent] = useState<any[]>([]);

  const loadUrgent = async () => {
    const { data } = await supabase.from('urgent_requests' as any).select('*, customers(full_name, phone)').eq('status', 'open').order('created_at', { ascending: false });
    setUrgent((data as any) || []);
  };
  useEffect(() => { loadUrgent(); }, [notes.length]);

  const handle = async (id: string) => {
    await supabase.from('urgent_requests' as any).update({ status: 'handled' }).eq('id', id);
    loadUrgent();
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        {unread > 0 && <Button variant="outline" size="sm" onClick={markAllRead}><CheckCheck className="mr-2 h-4 w-4" />Mark all read</Button>}
      </div>

      {urgent.length > 0 && (
        <div className="mb-6 space-y-2">
          <h2 className="text-sm font-semibold text-red-600">Open urgent requests</h2>
          {urgent.map((u) => (
            <Card key={u.id} className="flex items-start gap-3 border-red-200 bg-red-50 p-4">
              <TriangleAlert className="mt-0.5 h-5 w-5 text-red-600" />
              <div className="flex-1">
                <p className="font-semibold">{u.customers?.full_name} · <a className="underline" href={`tel:${u.customers?.phone}`}>{u.customers?.phone}</a></p>
                <p className="text-sm">{u.message}</p>
                <p className="text-xs text-muted-foreground">{ago(u.created_at)}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" asChild><a href={`https://wa.me/${String(u.customers?.phone || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a></Button>
                <Button size="sm" variant="outline" onClick={() => handle(u.id)}>Handled</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!notes.length && <p className="py-12 text-center text-muted-foreground">No notifications yet. New app bookings, payments, documents and urgent requests will show up here instantly.</p>}
      <div className="space-y-2">
        {notes.map((n) => {
          const Icon = ICON[n.type] ?? Bell;
          return (
            <Card key={n.id} onClick={() => { markRead(n.id); if (n.link) nav(n.link); }}
              className={`flex cursor-pointer items-start gap-3 p-4 transition hover:bg-muted/40 ${n.read_at ? '' : 'border-primary/40 bg-primary/5'}`}>
              <Icon className={`mt-0.5 h-5 w-5 ${n.type === 'urgent' ? 'text-red-600' : 'text-primary'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{n.title}</p>
                  {!n.read_at && <Badge className="h-5">new</Badge>}
                </div>
                {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{ago(n.created_at)}</span>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
