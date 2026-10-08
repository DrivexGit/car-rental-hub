import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { ArrowUp, Check, ChevronDown, CreditCard, FileText, Globe, Headphones, LogOut, MapPin, Phone, ShieldCheck, User } from "lucide-react";
import { useStore } from "@/lib/store";
import { LANGS, useI18n } from "@/lib/i18n";
import { THEMES, getTheme, setTheme } from "@/lib/theme";
import { COMPANY, SUPPORT_PHONE, whatsappLink } from "@/config";
import { Bell, Face } from "@/components/ui";

// Desktop (lg and up) shell: a header with the main navigation and the account menu, and a footer.
// On phones none of this renders: the bottom tab bar is used instead.

export const HEADER_H = 72;
const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(" ");

const NAV = [
  { to: "/", label: "Home" },
  { to: "/book", label: "Book" },
  { to: "/bookings", label: "Bookings" },
  { to: "/support", label: "Support" },
];

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z" /></svg>
);

export function DesktopHeader() {
  const { t, lang, setLang } = useI18n();
  const reduce = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const { scrollY, scrollYProgress } = useScroll();
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 8));
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });
  const { pathname } = useLocation();
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/"));

  return (
    <header style={{ height: HEADER_H }}
      className={cx("sticky top-0 z-40 hidden items-center transition-[background-color,box-shadow,backdrop-filter] duration-300 lg:flex",
        scrolled ? "bg-white/90 shadow-[0_1px_0_rgb(var(--line)),0_8px_24px_-12px_rgb(var(--ink)/.18)] backdrop-blur-xl" : "bg-bg/0")}>
      <div className="mx-auto flex w-full max-w-[1320px] items-center gap-8 px-10">
        <Link to="/" className="shrink-0" aria-label="Drivex"><img src="/logo-dark.png" alt="Drivex" className="h-8 transition-transform duration-300 hover:scale-[1.04]" /></Link>

        <nav className="flex items-center gap-1" aria-label="Main">
          {NAV.map(({ to, label }) => {
            const on = isActive(to);
            return (
              <NavLink key={to} to={to} end={to === "/"} className={cx("group relative rounded-full px-4 py-2 text-[15px] font-medium transition-colors", on ? "text-brand" : "text-ink-muted hover:text-ink")}>
                {on && <motion.span layoutId="header-pill" className="absolute inset-0 rounded-full bg-brand-soft" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                {!on && <span className="absolute inset-x-4 bottom-1 h-[2px] origin-[0%] scale-x-0 rounded-full bg-brand/50 transition-transform duration-300 group-hover:scale-x-100 rtl:origin-right" />}
                <span className="relative">{t(label)}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="ms-auto flex items-center gap-3">
          <button onClick={() => setLang(lang === "en" ? "ar" : "en")} aria-label={t("Change language")}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-sm font-medium text-ink-muted transition hover:border-brand/40 hover:text-brand">
            <Globe className="h-4 w-4" />{lang === "en" ? "العربية" : "English"}
          </button>
          <Bell />
          <AccountMenu />
        </div>
      </div>
      {!reduce && <motion.div aria-hidden style={{ scaleX: progress }} className="absolute inset-x-0 bottom-0 h-[2px] origin-[0%] bg-gradient-to-r from-brand to-brand/30 rtl:origin-right" />}
    </header>
  );
}

function AccountMenu() {
  const { user, signOut } = useStore();
  const { t } = useI18n();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [theme, setThemeState] = useState(getTheme());
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const items = [
    { to: "/profile", icon: User, label: "Profile" },
    { to: "/profile/payments", icon: CreditCard, label: "Payments" },
    { to: "/profile/documents", icon: FileText, label: "Documents" },
    { to: "/profile/security", icon: ShieldCheck, label: "Security" },
    { to: "/profile/legal", icon: Headphones, label: "Support & legal" },
  ];

  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={t("Profile")}
        className="flex h-10 items-center gap-2 rounded-full border border-line bg-white ps-1 pe-2.5 transition hover:border-brand/40">
        <Face size={32} />
        <ChevronDown className={cx("h-4 w-4 text-ink-muted transition-transform duration-300", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="menu" initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute end-0 top-full z-50 mt-3 w-72 origin-top-right overflow-hidden rounded-2xl border border-line bg-white p-2 shadow-[0_24px_60px_-20px_rgb(var(--ink)/.35)] rtl:origin-top-left">
            <div className="mb-1 flex items-center gap-3 rounded-xl bg-brand-soft p-3">
              <Face size={44} />
              <div className="min-w-0"><p className="truncate font-semibold">{user?.name}</p><p dir="ltr" className="truncate text-xs text-ink-muted rtl:text-end">{user?.phone}</p></div>
            </div>
            {items.map(({ to, icon: Icon, label }) => (
              <Link key={to} to={to} role="menuitem" className="flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] text-ink-muted transition hover:bg-bg hover:text-ink">
                <Icon className="h-[18px] w-[18px]" />{t(label)}
              </Link>
            ))}
            <div className="my-1 flex items-center justify-between rounded-xl px-3 py-2">
              <span className="text-[15px] text-ink-muted">{t("Appearance")}</span>
              <div className="flex gap-1.5">
                {THEMES.map((x) => (
                  <button key={x.value} onClick={() => { setTheme(x.value); setThemeState(x.value); }} aria-label={t(x.label)} aria-pressed={theme === x.value}
                    className={cx("grid h-7 w-7 place-items-center rounded-full ring-2 ring-offset-2 transition", theme === x.value ? "ring-brand" : "ring-transparent hover:ring-line")}
                    style={{ backgroundColor: x.value === "green" ? "#1f4d2f" : "#122a54" }}>
                    {theme === x.value && <Check className="h-3.5 w-3.5 text-white" />}
                  </button>
                ))}
              </div>
            </div>
            <button role="menuitem" onClick={() => { signOut(); nav("/"); }} className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[15px] text-danger transition hover:bg-danger-soft">
              <LogOut className="h-[18px] w-[18px]" />{t("Log out")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const up = (i: number) => ({ initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-40px" }, transition: { duration: 0.6, delay: i * 0.08, ease: [0.2, 0.8, 0.2, 1] as const } });

function FooterLink({ to, href, children }: { to?: string; href?: string; children: React.ReactNode }) {
  const cls = "group relative inline-block py-1 text-[15px] text-white/65 transition-colors hover:text-white";
  const line = <span className="absolute inset-x-0 bottom-0 h-px origin-[0%] scale-x-0 bg-white/70 transition-transform duration-300 group-hover:scale-x-100 rtl:origin-right" />;
  return to ? <Link to={to} className={cls}>{children}{line}</Link> : <a href={href} target="_blank" rel="noreferrer" className={cls}>{children}{line}</a>;
}

export function Footer() {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const year = new Date().getFullYear();
  const hello = whatsappLink("Hi Drivex!");

  return (
    <footer className="relative mt-20 hidden overflow-hidden bg-night text-white lg:block">
      <div aria-hidden className="road-dash absolute inset-x-0 top-0 h-[3px] opacity-70" />
      {/* soft brand glows that drift slowly */}
      <motion.div aria-hidden className="pointer-events-none absolute -top-40 start-[8%] h-[420px] w-[420px] rounded-full bg-brand/40 blur-[120px]"
        animate={reduce ? undefined : { x: [0, 60, 0], y: [0, 30, 0] }} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }} />
      <motion.div aria-hidden className="pointer-events-none absolute -bottom-52 end-[6%] h-[460px] w-[460px] rounded-full bg-brand/30 blur-[130px]"
        animate={reduce ? undefined : { x: [0, -50, 0], y: [0, -30, 0] }} transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }} />
      {/* oversized wordmark behind the content */}
      <p aria-hidden className="pointer-events-none absolute inset-x-0 -bottom-6 select-none text-center text-[clamp(120px,19vw,280px)] font-black leading-none tracking-tighter text-white/[0.035]">DRIVEX</p>

      <div className="relative mx-auto max-w-[1320px] px-10 pb-8 pt-16">
        <div className="grid grid-cols-12 gap-10">
          <motion.div {...up(0)} className="col-span-4">
            <img src="/logo.png" alt="Drivex" className="h-9" />
            <p className="mt-2 text-xs font-medium uppercase tracking-[.3em] text-white/50">{t("Drive. Easy.")}</p>
            <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-white/65">{t("Premium car rental in Dubai. Book in minutes, drive today.")}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <motion.a whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} href={hello} target="_blank" rel="noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#25d366] px-5 text-[15px] font-semibold text-[#06361a] shadow-[0_8px_24px_-8px_#25d366]"><WhatsAppIcon />{t("Chat on WhatsApp")}</motion.a>
              <motion.a whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} href={`tel:${SUPPORT_PHONE}`}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-white/20 px-5 text-[15px] font-semibold transition-colors hover:bg-white/10"><Phone className="h-4 w-4" />{t("Call us")}</motion.a>
            </div>
          </motion.div>

          <motion.nav {...up(1)} className="col-span-2 col-start-6" aria-label={t("Explore")}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-white/40">{t("Explore")}</h3>
            <ul>{NAV.map(({ to, label }) => <li key={to}><FooterLink to={to}>{t(label)}</FooterLink></li>)}</ul>
          </motion.nav>

          <motion.nav {...up(2)} className="col-span-2" aria-label={t("Account")}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-white/40">{t("Account")}</h3>
            <ul>
              <li><FooterLink to="/profile">{t("Profile")}</FooterLink></li>
              <li><FooterLink to="/profile/payments">{t("Payments")}</FooterLink></li>
              <li><FooterLink to="/profile/documents">{t("Documents")}</FooterLink></li>
              <li><FooterLink to="/notifications">{t("Notifications")}</FooterLink></li>
            </ul>
          </motion.nav>

          <motion.div {...up(3)} className="col-span-3">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-white/40">{t("Contact")}</h3>
            <ul>
              <li><FooterLink to="/support">{t("Support")}</FooterLink></li>
              <li><FooterLink to="/profile/legal">{t("Support & legal")}</FooterLink></li>
              <li className="flex items-center gap-2 pt-2 text-[15px] text-white/65"><Phone className="h-4 w-4 shrink-0 text-white/40" /><span dir="ltr">{SUPPORT_PHONE}</span></li>
              <li className="flex items-center gap-2 text-[15px] text-white/65"><MapPin className="h-4 w-4 shrink-0 text-white/40" />{t(COMPANY.address)}</li>
            </ul>
          </motion.div>
        </div>

        <div className="mt-14 flex items-center justify-between border-t border-white/10 pt-6 text-sm text-white/45">
          <p>© {year} {COMPANY.name}. {t("All rights reserved.")}</p>
          <motion.button whileHover={{ y: -2 }} onClick={() => window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })}
            className="group inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white">
            {t("Back to top")}<ArrowUp className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5" />
          </motion.button>
        </div>
      </div>
    </footer>
  );
}
