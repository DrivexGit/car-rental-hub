import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type StaffNote = { id: string; type: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };
type Ctx = { notes: StaffNote[]; unread: number; markAllRead: () => Promise<void>; markRead: (id: string) => Promise<void>; reload: () => Promise<void> };
const NotesCtx = createContext<Ctx>({ notes: [], unread: 0, markAllRead: async () => {}, markRead: async () => {}, reload: async () => {} });

// Short two-tone chime (no audio file needed).
function chime(urgent: boolean) {
  try {
    const ctx = new AudioContext();
    (urgent ? [880, 660, 880, 660] : [660, 880]).forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.16; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.start(t); o.stop(t + 0.16);
    });
  } catch { /* autoplay blocked */ }
}

/** Staff notification feed: initial load + realtime inserts with toast and sound. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { tenantId } = useAuth();
  const [notes, setNotes] = useState<StaffNote[]>([]);

  const reload = useCallback(async () => {
    const { data } = await supabase.from('notifications' as any).select('*').eq('audience', 'staff').order('created_at', { ascending: false }).limit(200);
    setNotes((data as any) || []);
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    reload();
    const ch = supabase.channel('staff-notes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `tenant_id=eq.${tenantId}` }, (p) => {
        const n = p.new as StaffNote & { audience: string };
        if (n.audience !== 'staff') return;
        setNotes((x) => [n, ...x]);
        chime(n.type === 'urgent');
        toast[n.type === 'urgent' ? 'error' : 'success'](n.title, { description: n.body ?? undefined, duration: n.type === 'urgent' ? 30000 : 8000,
          action: n.link ? { label: 'Open', onClick: () => { window.location.href = n.link!; } } : undefined });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId, reload]);

  const markAllRead = async () => {
    await supabase.from('notifications' as any).update({ read_at: new Date().toISOString() }).eq('audience', 'staff').is('read_at', null);
    setNotes((x) => x.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  };
  const markRead = async (id: string) => {
    await supabase.from('notifications' as any).update({ read_at: new Date().toISOString() }).eq('id', id);
    setNotes((x) => x.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
  };

  return <NotesCtx.Provider value={{ notes, unread: notes.filter((n) => !n.read_at).length, markAllRead, markRead, reload }}>{children}</NotesCtx.Provider>;
}

export const useNotifications = () => useContext(NotesCtx);

const b64 = (s: string) => Uint8Array.from(atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/** Desktop/phone push for staff, so new bookings arrive even when the panel is closed. */
export async function enableStaffPush(): Promise<NotificationPermission | 'unsupported'> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  const perm = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (perm !== 'granted') return perm;
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(import.meta.env.VITE_VAPID_PUBLIC_KEY) }));
  const j = sub.toJSON();
  const { data } = await supabase.auth.getUser();
  if (data.user) await supabase.from('push_subscriptions' as any).upsert({ user_id: data.user.id, kind: 'staff', endpoint: j.endpoint, p256dh: j.keys!.p256dh, auth: j.keys!.auth }, { onConflict: 'endpoint' });
  return perm;
}
