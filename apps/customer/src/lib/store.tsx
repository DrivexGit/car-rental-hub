import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { translate } from "@/lib/i18n";
import { api, supabase } from "@/lib/supabase";
import { carImage, slug, toFleet, type Car, type Period } from "@/data/catalog";

export type User = { id: string; phone: string; name: string; email?: string; avatarUrl?: string; notify: { bookings: boolean; invoices: boolean; offers: boolean } };
export type BookingStatus = "pending" | "upcoming" | "ongoing" | "overdue" | "completed" | "cancelled";
export type Booking = {
  id: string; car: Car; plate: string; period: Period; pickup: string; dropoff: string;
  total: number; extras: string[]; status: BookingStatus; rawStatus: string;
};
export type Invoice = { id: string; number: string; bookingId: string | null; amount: number; issued: string; status: "pending" | "paid" | "void"; paidAt?: string; description?: string };
export type Fine = { id: string; bookingId: string | null; type: "salik" | "traffic"; amount: number; date: string; place: string };
export type Offer = { id: string; kind: "car" | "partner"; title: string; subtitle?: string; off: number; image?: string; car?: Car; description?: string; terms?: string; location?: string; code?: string };
export type Specs = { engine?: string; transmission: string; fuel: string; seats: number; doors: number; bags: number; features: string[]; image?: string; gallery: string[] };
export type Note = { id: string; type: string; title: string; body?: string; link?: string; read: boolean; created: string };
export type Doc = { id: string; type: string; fileName: string; status: string; created: string };

type Data = { fleet: Car[]; bookings: Booking[]; invoices: Invoice[]; fines: Fine[]; offers: Offer[]; documents: Doc[]; specs: Record<string, Specs>; notes: Note[] };
type Store = Data & {
  ready: boolean;
  user: User | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (u: { name?: string; email?: string; notify?: User["notify"] }) => Promise<void>;
  setAvatar: (photo: Blob | null) => Promise<void>;
  payInvoice: (id: string, returnPath: string) => Promise<{ redirected: boolean }>;
  extend: (bookingId: string, days: number) => Promise<void>;
  carById: (id: string) => Car | undefined;
  markNotesRead: () => Promise<void>;
};

const empty: Data = { fleet: [], bookings: [], invoices: [], fines: [], offers: [], documents: [], specs: {}, notes: [] };

function statusOf(raw: string, start: string, end: string): BookingStatus {
  if (raw === "pending" || raw === "draft") return "pending";
  if (raw === "completed") return "completed";
  if (raw === "cancelled") return "cancelled";
  const now = Date.now();
  if (now < new Date(start).getTime()) return "upcoming";
  return now <= new Date(end).getTime() ? "ongoing" : "overdue";
}

async function loadAll(): Promise<{ user: User; data: Data } | null> {
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return null;
  const uid = s.session.user.id;
  const [c, v, r, i, f, o, d, sp, nt] = await Promise.all([
    supabase.from("customers").select("*").eq("id", uid).maybeSingle(),
    supabase.from("vehicles").select("id,make,model,year,categories,daily_price,weekly_price,monthly_price").neq("status", "unavailable"),
    supabase.from("reservations").select("id,status,start_datetime,end_datetime,rental_period,extras,total_amount,vehicles(id,make,model,year,categories,plate_number,daily_price,weekly_price,monthly_price)").eq("customer_id", uid).order("start_datetime", { ascending: false }),
    supabase.from("invoices").select("*").order("issued_at", { ascending: false }),
    supabase.from("fines").select("*").order("occurred_at", { ascending: false }),
    supabase.from("offers").select("*").order("sort_order"),
    supabase.from("customer_documents").select("id,document_type,file_name,verification_status,created_at").order("created_at", { ascending: false }),
    supabase.from("vehicle_model_specs").select("*"),
    supabase.from("notifications").select("*").eq("audience", "customer").order("created_at", { ascending: false }).limit(50),
  ]);
  if (!c.data) return null; // a staff account or a half-created customer

  const specs: Record<string, Specs> = Object.fromEntries((sp.data ?? []).map((x: any) => [slug(x.make, x.model), { engine: x.engine ?? undefined, transmission: x.transmission, fuel: x.fuel, seats: x.seats, doors: x.doors, bags: x.bags, features: x.features ?? [], image: x.image_url ?? undefined, gallery: x.gallery ?? [] }]));
  // Photos managed in the panel ("Car photos") win over the bundled /cars/ images.
  const fleet = toFleet(v.data ?? []).map((c) => (specs[c.id] ? { ...c, seats: specs[c.id].seats, image: specs[c.id].image ?? c.image } : c));
  const bookings: Booking[] = (r.data ?? []).map((x: any) => {
    const veh = x.vehicles;
    const car = fleet.find((k) => k.vehicleIds.includes(veh.id)) ?? toFleet([veh])[0] ?? {
      id: veh.id, make: veh.make, model: veh.model, year: veh.year, category: veh.categories?.[0] ?? "Car", daily: 0, weekly: 0, monthly: 0,
      image: carImage(veh.make, veh.model), seats: 5, vehicleIds: [veh.id],
    };
    return {
      id: x.id, car, plate: veh.plate_number, period: (x.rental_period || "daily") as Period,
      pickup: x.start_datetime, dropoff: x.end_datetime, total: Number(x.total_amount || 0), extras: x.extras ?? [],
      status: statusOf(x.status, x.start_datetime, x.end_datetime), rawStatus: x.status,
    };
  });
  const byTitle = (t: string) => fleet.find((k) => `${k.make} ${k.model}`.toLowerCase() === t.toLowerCase());

  return {
    user: {
      id: uid, phone: c.data.phone, name: c.data.full_name, email: c.data.email ?? undefined,
      avatarUrl: c.data.avatar_url ?? undefined,
      notify: { bookings: c.data.notify_bookings, invoices: c.data.notify_invoices, offers: c.data.notify_offers },
    },
    data: {
      fleet, bookings,
      invoices: (i.data ?? []).map((x: any) => ({ id: x.id, number: x.number, bookingId: x.reservation_id, amount: Number(x.amount), issued: x.issued_at, status: x.status, paidAt: x.paid_at ?? undefined, description: x.description ?? undefined })),
      fines: (f.data ?? []).map((x: any) => ({ id: x.id, bookingId: x.reservation_id, type: x.type, amount: Number(x.amount), date: x.occurred_at, place: x.location ?? "" })),
      offers: (o.data ?? []).map((x: any) => ({ id: x.id, kind: x.kind, title: x.title, subtitle: x.subtitle ?? undefined, off: x.discount_pct, image: x.image_url ?? undefined, car: x.kind === "car" ? byTitle(x.title) : undefined, description: x.description ?? undefined, terms: x.terms ?? undefined, location: x.location ?? undefined, code: x.redeem_code ?? undefined }))
        .filter((x: Offer) => x.kind === "partner" || x.car),
      specs,
      notes: (nt.data ?? []).map((x: any) => ({ id: x.id, type: x.type, title: x.title, body: x.body ?? undefined, link: x.link ?? undefined, read: !!x.read_at, created: x.created_at })),
      documents: (d.data ?? []).map((x: any) => ({ id: x.id, type: x.document_type, fileName: x.file_name, status: x.verification_status, created: x.created_at })),
    },
  };
}

const Ctx = createContext<Store>(null!);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<Data>(empty);

  const refresh = useCallback(async () => {
    const out = await loadAll().catch(() => null);
    setUser(out?.user ?? null);
    setData(out?.data ?? empty);
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
    // Deferred: calling supabase inside this callback deadlocks the auth lock (supabase-js known issue).
    const { data: sub } = supabase.auth.onAuthStateChange((e) => { if (e === "SIGNED_IN" || e === "SIGNED_OUT") setTimeout(refresh, 0); });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  // Live updates: new invoice/fine/booking notification → reload data.
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("me").on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `customer_id=eq.${user.id}` }, () => refresh()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, refresh]);

  const store: Store = {
    ...data, ready, user, refresh,
    carById: (id) => data.fleet.find((c) => c.id === id),
    markNotesRead: async () => {
      if (!data.notes.some((n) => !n.read)) return;
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("audience", "customer").is("read_at", null);
      setData((d) => ({ ...d, notes: d.notes.map((n) => ({ ...n, read: true })) }));
    },
    signOut: async () => { await supabase.auth.signOut(); },
    updateUser: async (u) => {
      const patch: Record<string, unknown> = {};
      if (u.name !== undefined) patch.full_name = u.name;
      if (u.email !== undefined) patch.email = u.email || null;
      if (u.notify) Object.assign(patch, { notify_bookings: u.notify.bookings, notify_invoices: u.notify.invoices, notify_offers: u.notify.offers });
      const { error } = await supabase.from("customers").update(patch).eq("id", user!.id);
      if (error) throw new Error(error.message);
      await refresh();
    },
    // One file per customer (avatars/<id>/avatar.<ext>); the stored URL carries a version so caches refresh.
    setAvatar: async (photo) => {
      const uid = user!.id;
      const bucket = supabase.storage.from("avatars");
      if (!photo) {
        const { error } = await supabase.from("customers").update({ avatar_url: null }).eq("id", uid);
        if (error) throw new Error(error.message);
        await bucket.remove([`${uid}/avatar.webp`, `${uid}/avatar.jpg`]);
      } else {
        const ext = photo.type === "image/webp" ? "webp" : "jpg";
        const path = `${uid}/avatar.${ext}`;
        const up = await bucket.upload(path, photo, { upsert: true, contentType: photo.type, cacheControl: "3600" });
        if (up.error) throw new Error(translate("Could not upload your photo. Please try again."));
        const url = `${bucket.getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
        const { error } = await supabase.from("customers").update({ avatar_url: url }).eq("id", uid);
        if (error) throw new Error(translate("Could not save your photo. Please try again."));
        await bucket.remove([`${uid}/avatar.${ext === "webp" ? "jpg" : "webp"}`]); // leftover from another device/browser
      }
      await refresh();
    },
    payInvoice: async (id, returnPath) => {
      const out = await api<{ url?: string; paid?: boolean }>("pay", { invoiceId: id, returnUrl: location.origin + returnPath });
      if (out.url) { location.href = out.url; return { redirected: true }; }
      await refresh();
      return { redirected: false };
    },
    extend: async (bookingId, days) => { await api("extend", { reservationId: bookingId, days }); await refresh(); },
  };
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
