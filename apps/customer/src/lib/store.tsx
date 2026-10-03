import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { FLEET, priceFor, PERIOD_DAYS, type Period } from "@/data/catalog";
import { addDays, isoDate } from "@/lib/format";

export type User = { phone: string; name: string; email?: string };
export type Booking = {
  id: string; carId: string; plate: string; period: Period;
  pickup: string; dropoff: string; total: number; extras: string[];
  status: "upcoming" | "ongoing" | "overdue" | "completed";
};
export type Invoice = { id: string; bookingId: string; amount: number; issued: string; status: "pending" | "paid"; paidAt?: string };
export type Fine = { id: string; bookingId: string; type: "salik" | "traffic"; amount: number; date: string; place: string; paid: boolean };

type State = { user: User | null; knownPhones: Record<string, string>; bookings: Booking[]; invoices: Invoice[]; fines: Fine[] };
type Store = State & {
  signIn: (phone: string, name?: string) => void;
  signOut: () => void;
  updateUser: (u: Partial<User>) => void;
  book: (b: Omit<Booking, "id" | "plate" | "status">) => Booking;
  payInvoice: (id: string) => void;
  extend: (bookingId: string, days: number) => void;
};

const KEY = "drivex.customer.v1";
const empty: State = { user: null, knownPhones: {}, bookings: [], invoices: [], fines: [] };
const uid = () => Math.random().toString(36).slice(2, 10);
const plate = () => `${"ABCDEFGHJKLMNPRS"[Math.floor(Math.random() * 16)]} ${Math.floor(10000 + Math.random() * 89999)}`;

// ponytail: demo data in localStorage so the whole app is clickable before the
// customers/invoices/fines tables exist. Replace with Supabase queries (TASKS §2).
function seed(): Pick<State, "bookings" | "invoices" | "fines"> {
  const now = new Date();
  const g = FLEET.find((c) => c.id.includes("patrol")) ?? FLEET[0];
  const s = FLEET.find((c) => c.id.includes("gle")) ?? FLEET[1];
  const e = FLEET.find((c) => c.id.includes("corolla")) ?? FLEET[2];
  const bookings: Booking[] = [
    { id: uid(), carId: g.id, plate: plate(), period: "monthly", pickup: isoDate(addDays(now, -22)), dropoff: isoDate(addDays(now, 8)), total: priceFor(g, "monthly"), extras: ["full_cover"], status: "ongoing" },
    { id: uid(), carId: s.id, plate: plate(), period: "weekly", pickup: isoDate(addDays(now, -10)), dropoff: isoDate(addDays(now, -3)), total: priceFor(s, "weekly"), extras: [], status: "overdue" },
    { id: uid(), carId: e.id, plate: plate(), period: "weekly", pickup: isoDate(addDays(now, -60)), dropoff: isoDate(addDays(now, -53)), total: priceFor(e, "weekly"), extras: [], status: "completed" },
  ];
  return {
    bookings,
    invoices: [
      { id: "INV-1042", bookingId: bookings[1].id, amount: 350, issued: isoDate(addDays(now, -3)), status: "pending" },
      { id: "INV-1031", bookingId: bookings[0].id, amount: bookings[0].total, issued: isoDate(addDays(now, -22)), status: "paid", paidAt: isoDate(addDays(now, -22)) },
      { id: "INV-0988", bookingId: bookings[2].id, amount: bookings[2].total, issued: isoDate(addDays(now, -60)), status: "paid", paidAt: isoDate(addDays(now, -60)) },
    ],
    fines: [
      { id: uid(), bookingId: bookings[0].id, type: "salik", amount: 4, date: isoDate(addDays(now, -2)), place: "Al Barsha gate", paid: false },
      { id: uid(), bookingId: bookings[0].id, type: "salik", amount: 4, date: isoDate(addDays(now, -5)), place: "Al Garhoud bridge", paid: false },
      { id: uid(), bookingId: bookings[0].id, type: "traffic", amount: 300, date: isoDate(addDays(now, -9)), place: "Sheikh Zayed Rd — speeding", paid: false },
    ],
  };
}

const Ctx = createContext<Store>(null!);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, set] = useState<State>(() => {
    try { return { ...empty, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return empty; }
  });
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } }, [s]);

  const store: Store = {
    ...s,
    signIn: (phone, name) => set((p) => {
      const known = name ?? p.knownPhones[phone];
      const fresh = !p.bookings.length;
      return { ...p, ...(fresh ? seed() : {}), user: { phone, name: known || "Guest" }, knownPhones: { ...p.knownPhones, [phone]: known || "Guest" } };
    }),
    signOut: () => set((p) => ({ ...p, user: null })),
    updateUser: (u) => set((p) => ({ ...p, user: p.user && { ...p.user, ...u }, knownPhones: p.user && u.name ? { ...p.knownPhones, [p.user.phone]: u.name } : p.knownPhones })),
    book: (b) => {
      const nb: Booking = { ...b, id: uid(), plate: plate(), status: "upcoming" };
      set((p) => ({
        ...p,
        bookings: [nb, ...p.bookings],
        invoices: [{ id: `INV-${1100 + p.invoices.length}`, bookingId: nb.id, amount: b.total, issued: isoDate(new Date()), status: "paid", paidAt: isoDate(new Date()) }, ...p.invoices],
      }));
      return nb;
    },
    payInvoice: (id) => set((p) => ({ ...p, invoices: p.invoices.map((i) => (i.id === id ? { ...i, status: "paid", paidAt: isoDate(new Date()) } : i)) })),
    extend: (bookingId, days) => set((p) => {
      const b = p.bookings.find((x) => x.id === bookingId)!;
      const car = FLEET.find((c) => c.id === b.carId)!;
      const amount = Math.round((priceFor(car, b.period) / PERIOD_DAYS[b.period]) * days);
      return {
        ...p,
        bookings: p.bookings.map((x) => (x.id === bookingId ? { ...x, dropoff: isoDate(addDays(new Date(x.dropoff), days)), status: x.status === "overdue" ? "ongoing" : x.status } : x)),
        invoices: [{ id: `INV-${1100 + p.invoices.length}`, bookingId, amount, issued: isoDate(new Date()), status: "pending" }, ...p.invoices],
      };
    }),
  };
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
