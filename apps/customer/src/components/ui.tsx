import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type HTMLMotionProps } from "framer-motion";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Bell as BellIcon, CarFront, ChevronRight, Headphones, Home, ClipboardList, User, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { money } from "@/lib/format";

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(" ");

/* UAE dirham sign (2025 symbol): a D crossed by two bars. */
export const Dirham = ({ className = "h-[0.8em] w-[0.8em]" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={cx("inline-block -mt-[0.12em] align-middle", className)} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-label="AED">
    <path d="M6 4v16h4.5a8 8 0 0 0 0-16H6z" />
    <path d="M2 10h18M2 14h18" strokeWidth="1.9" />
  </svg>
);

export const Price = ({ value, unit, old, size = "text-xl" }: { value: number; unit?: string; old?: number; size?: string }) => (
  <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
    <span className={cx(size, "font-bold tracking-tight")}><Dirham /> {money(value)}</span>
    {unit && <span className="text-sm text-ink-faint">/ {unit}</span>}
    {old && <span className="text-sm text-ink-faint line-through"><Dirham /> {money(old)}</span>}
  </span>
);

export const Logo = ({ className = "h-6" }: { className?: string }) => <img src="/logo-dark.png" alt="Drivex" className={className} />;

export function Avatar({ size = 40 }: { size?: number }) {
  const { user } = useStore();
  const initials = (user?.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <Link to="/profile" style={{ width: size, height: size }} className="grid place-items-center rounded-full bg-brand text-white font-semibold ring-2 ring-white shadow-card" aria-label="Profile">
      {initials}
    </Link>
  );
}

/** Top bar of every tab: logo left, avatar (or custom) right. */
export const TopBar = ({ right }: { right?: ReactNode }) => (
  <div className="flex items-center justify-between pt-3 pb-4">
    <Logo />
    {right ?? <div className="flex items-center gap-2.5"><Bell /><Avatar /></div>}
  </div>
);

function Bell() {
  const { notes } = useStore();
  const unread = notes.filter((n) => !n.read).length;
  return (
    <Link to="/notifications" onClick={tap} aria-label="Notifications" className="relative grid h-10 w-10 place-items-center rounded-full border border-line bg-white">
      <motion.span animate={unread ? { rotate: [0, -14, 12, -8, 0] } : {}} transition={{ duration: 0.8, repeat: unread ? Infinity : 0, repeatDelay: 4 }}>
        <BellIcon className="h-5 w-5" />
      </motion.span>
      {!!unread && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">{unread}</span>}
    </Link>
  );
}

export const PageTitle = ({ title, sub }: { title: ReactNode; sub?: ReactNode }) => (
  <div className="mb-5">
    <h1 className="text-[28px] leading-tight font-bold tracking-tight">{title}</h1>
    {sub && <p className="mt-1 text-[15px] text-ink-muted">{sub}</p>}
  </div>
);

/** Sub-page header with back arrow. */
export function BackBar({ title, right }: { title?: string; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="sticky top-0 z-20 -mx-5 mb-3 flex items-center gap-3 bg-bg/90 px-5 py-3 backdrop-blur">
      <button onClick={() => nav(-1)} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-card border border-line" aria-label="Back">
        <ArrowLeft className="h-5 w-5" />
      </button>
      <h1 className="flex-1 text-lg font-semibold">{title}</h1>
      {right}
    </div>
  );
}

export const Card = ({ children, className, onClick, delay = 0 }: { children: ReactNode; className?: string; onClick?: () => void; delay?: number }) => (
  <motion.div
    onClick={onClick ? () => { tap(); onClick(); } : undefined}
    initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay, ease: [0.2, 0.8, 0.2, 1] }}
    whileTap={onClick ? { scale: 0.975 } : undefined}
    className={cx("rounded-card border border-line bg-white shadow-card", onClick && "cursor-pointer", className)}>
    {children}
  </motion.div>
);

/** Light haptic tick on supported phones. */
export const tap = () => { try { navigator.vibrate?.(8); } catch { /* ignore */ } };

type BtnProps = Omit<HTMLMotionProps<"button">, "children"> & { children?: ReactNode } & { variant?: "primary" | "soft" | "ghost" | "danger"; size?: "sm" | "md" | "lg"; arrow?: boolean };
export function Button({ variant = "primary", size = "md", arrow, className, children, onClick, ...p }: BtnProps) {
  return (
    <motion.button
      {...p}
      onClick={(e) => { tap(); onClick?.(e); }}
      whileTap={p.disabled ? undefined : { scale: 0.95 }}
      transition={{ type: "spring", stiffness: 500, damping: 25 }}
      className={cx(
        "group relative inline-flex items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-xl font-semibold transition-colors disabled:opacity-40",
        size === "sm" && "h-9 px-3.5 text-sm",
        size === "md" && "h-11 px-5 text-[15px]",
        size === "lg" && "h-14 w-full px-6 text-base",
        variant === "primary" && "bg-brand text-white hover:bg-brand-dark",
        variant === "soft" && "bg-brand-soft text-brand",
        variant === "ghost" && "border border-line bg-white text-ink",
        variant === "danger" && "border border-danger/30 bg-white text-danger",
        className,
      )}
    >
      {children}
      {arrow && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-active:translate-x-1" />}
    </motion.button>
  );
}

export const Chip = ({ children, onClick, tone = "default", active }: { children: ReactNode; onClick?: () => void; tone?: "default" | "danger"; active?: boolean }) => (
  <motion.button
    whileTap={{ scale: 0.92 }}
    onClick={() => { tap(); onClick?.(); }}
    className={cx(
      "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3.5 text-sm font-medium transition active:scale-[.97]",
      tone === "danger" ? "border-danger/30 bg-white text-danger" : active ? "border-brand bg-brand text-white" : "border-line bg-white text-ink",
    )}
  >
    {children}
  </motion.button>
);

const STATUS = {
  overdue: ["bg-danger", "text-danger", "Overdue"],
  ongoing: ["bg-brand", "text-brand", "Ongoing"],
  upcoming: ["bg-amber-500", "text-amber-600", "Upcoming"],
  completed: ["bg-ink-faint", "text-ink-faint", "Completed"],
  pending: ["bg-amber-500", "text-amber-600", "Awaiting payment"],
  cancelled: ["bg-ink-faint", "text-ink-faint", "Cancelled"],
} as const;
export const StatusDot = ({ status }: { status: keyof typeof STATUS }) => (
  <span className={cx("inline-flex items-center gap-1.5 text-[13px] font-medium", STATUS[status][1])}>
    <span className={cx("h-2 w-2 rounded-full", STATUS[status][0])} />
    {STATUS[status][2]}
  </span>
);

export const Badge = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cx("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold", className ?? "bg-brand-soft text-brand")}>{children}</span>
);

export const SectionHead = ({ title, to }: { title: string; to?: string }) => (
  <div className="mb-3 mt-7 flex items-center justify-between">
    <h2 className="text-xl font-bold tracking-tight">{title}</h2>
    {to && <Link to={to} className="inline-flex items-center gap-1 text-sm text-ink-muted">View all <ArrowRight className="h-4 w-4" /></Link>}
  </div>
);

export function ListRow({ icon, label, value, to, onClick, danger }: { icon?: ReactNode; label: ReactNode; value?: ReactNode; to?: string; onClick?: () => void; danger?: boolean }) {
  const body = (
    <div className={cx("flex min-h-[56px] items-center gap-3.5 px-4 py-3", danger && "text-danger")}>
      {icon && <span className={cx("shrink-0", danger ? "text-danger" : "text-ink")}>{icon}</span>}
      <span className="flex-1 text-[15px] font-medium">{label}</span>
      {value && <span className="text-sm text-ink-muted">{value}</span>}
      {(to || onClick) && <ChevronRight className="h-5 w-5 text-ink-faint" />}
    </div>
  );
  if (to) return <Link to={to} className="block active:bg-bg">{body}</Link>;
  if (onClick) return <button onClick={onClick} className="block w-full text-left active:bg-bg">{body}</button>;
  return body;
}

export const ListGroup = ({ title, children }: { title?: string; children: ReactNode }) => (
  <div className="mb-5">
    {title && <p className="mb-2 px-1 text-[13px] text-ink-muted">{title}</p>}
    <Card className="divide-y divide-line overflow-hidden">{children}</Card>
  </div>
);

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="grid rounded-xl bg-[#ecebe6] p-1" style={{ gridTemplateColumns: `repeat(${options.length},1fr)` }}>
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} className={cx("h-10 rounded-lg text-sm font-medium transition", value === o.value ? "bg-white text-ink shadow-card font-semibold" : "text-ink-muted")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Bottom sheet used for pickers and confirmations. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  // Portal: animated pages (transforms) would otherwise trap the fixed overlay below the bottom bars.
  return createPortal(
    <AnimatePresence>
      {open && (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div onClick={(e) => e.stopPropagation()}
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 380, damping: 36 }}
        drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, i) => { if (i.offset.y > 120 || i.velocity.y > 600) onClose(); }}
        className="max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(env(safe-area-inset-bottom),24px)]">
        <div className="mx-auto -mt-2 mb-3 h-1.5 w-10 rounded-full bg-line" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-bg" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export const Empty = ({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) => (
  <div className="flex flex-col items-center px-6 py-16 text-center">
    <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand">{icon}</div>
    <p className="text-lg font-semibold">{title}</p>
    {text && <p className="mt-1 text-ink-muted">{text}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

const TABS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/book", label: "Book", icon: CarFront },
  { to: "/support", label: "Support", icon: Headphones },
  { to: "/bookings", label: "Bookings", icon: ClipboardList },
  { to: "/profile", label: "Profile", icon: User },
];

export function TabBar() {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] border-t border-line bg-white/95 backdrop-blur">
      <div className="grid grid-cols-5">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === "/"} onClick={tap} className={({ isActive }) => cx("relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium", isActive ? "text-brand" : "text-ink-faint")}>
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="tab-pill" className="absolute top-1.5 h-8 w-12 rounded-full bg-brand-soft" transition={{ type: "spring", stiffness: 500, damping: 35 }} />}
                <motion.span className="relative" animate={{ y: isActive ? -1 : 0, scale: isActive ? 1.08 : 1 }}><Icon className="h-6 w-6" strokeWidth={isActive ? 2.4 : 1.8} /></motion.span>
                <span className="relative">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/** Page wrapper for tab screens. */
export const Screen = ({ children, tabs = true, className }: { children: ReactNode; tabs?: boolean; className?: string }) => (
  <motion.main
    initial={{ opacity: 0, x: tabs ? 0 : 24, y: tabs ? 8 : 0 }} animate={{ opacity: 1, x: 0, y: 0 }}
    transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
    className={cx("pt-safe mx-auto min-h-full max-w-[480px] px-5", tabs ? "pb-28" : "pb-10", className)}>
    {children}
  </motion.main>
);
