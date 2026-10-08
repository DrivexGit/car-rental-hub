import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { COMPANY, whatsappLink } from "@/config";
import { LEGAL, type DocId } from "@/content/legal";
import { BackBar, Button, Logo, Screen } from "@/components/ui";

// Terms, privacy policy and account deletion. They are public (no sign-in needed) so they can be linked from the app stores and the website.

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z" /></svg>
);

const LINKS: { id: DocId; to: string; label: string }[] = [
  { id: "terms", to: "/terms", label: "Terms & conditions" },
  { id: "privacy", to: "/privacy", label: "Privacy policy" },
  { id: "delete", to: "/delete-account", label: "Delete my account" },
];

/** Signed-in users get the normal app page; visitors get a plain page with the logo and the same links. */
function Frame({ title, children }: { title: string; children: ReactNode }) {
  const { user } = useStore();
  const { t, lang, setLang } = useI18n();
  if (user) return <Screen tabs={false}><BackBar title={title} />{children}</Screen>;
  return (
    <div className="min-h-full bg-bg">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link to="/" aria-label="Drivex"><Logo className="h-8" /></Link>
        <div className="flex items-center gap-3">
          <button onClick={() => setLang(lang === "en" ? "ar" : "en")} className="h-9 rounded-full border border-line bg-white px-3.5 text-sm font-medium text-ink-muted">{lang === "en" ? "العربية" : "English"}</button>
          <Link to="/" className="text-sm font-semibold text-brand">{t("Back to the app")}</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-16">
        <h1 className="mb-4 text-3xl font-bold tracking-tight">{title}</h1>
        {children}
      </main>
      <footer className="border-t border-line py-6 text-center text-sm text-ink-muted">
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2" aria-label="Legal">
          {LINKS.map((l) => <Link key={l.id} to={l.to} className="hover:text-ink hover:underline">{t(l.label)}</Link>)}
        </nav>
        <p className="mt-3">© {new Date().getFullYear()} {COMPANY.name}</p>
      </footer>
    </div>
  );
}

function DocBody({ id }: { id: DocId }) {
  const { lang } = useI18n();
  const doc = LEGAL[id][lang];
  return (
    <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6 text-[15px] leading-relaxed">
      <p className="text-sm text-ink-faint">{doc.updated}</p>
      <p>{doc.intro}</p>
      {doc.sections.map((s) => (
        <section key={s.h}>
          <h2 className="mb-2 text-lg font-semibold">{s.h}</h2>
          <div className="space-y-2 text-ink-muted">
            {s.p.map((line) => line.startsWith("• ")
              ? <p key={line} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" /><span>{line.slice(2)}</span></p>
              : <p key={line}>{line}</p>)}
          </div>
        </section>
      ))}
    </motion.article>
  );
}

function Page({ id, children }: { id: DocId; children?: ReactNode }) {
  const { lang } = useI18n();
  return <Frame title={LEGAL[id][lang].title}><DocBody id={id} />{children}</Frame>;
}

export const Terms = () => <Page id="terms" />;
export const Privacy = () => <Page id="privacy" />;

export function DeleteAccount() {
  const { t } = useI18n();
  const { user } = useStore();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [reason, setReason] = useState("");
  const [sure, setSure] = useState(false);
  const [error, setError] = useState("");

  const text = [
    "Account deletion request",
    `Name: ${name.trim()}`,
    `Mobile: ${phone.trim()}`,
    email.trim() && `Email: ${email.trim()}`,
    reason.trim() && `Reason: ${reason.trim()}`,
    "I understand that deleting my account is permanent.",
  ].filter(Boolean).join("\n");

  const check = () => {
    if (name.trim().length < 2 || phone.replace(/\D/g, "").length < 9) { setError(t("Please enter your name and mobile number.")); return false; }
    if (!sure) { setError(t("Please confirm that you understand.")); return false; }
    setError(""); return true;
  };
  const byEmail = () => { if (check()) window.location.href = `mailto:${COMPANY.email}?subject=${encodeURIComponent("Account deletion request")}&body=${encodeURIComponent(text)}`; };
  const byWhatsApp = () => { if (check()) window.open(whatsappLink(text), "_blank", "noopener"); };

  const field = "h-12 w-full rounded-xl border border-line bg-white px-4 text-[15px] outline-none transition focus:border-brand/50 focus:shadow-[0_0_0_4px_rgb(var(--brand)/.12)]";
  return (
    <Page id="delete">
      <form onSubmit={(e) => e.preventDefault()} className="mt-8 space-y-3 rounded-card border border-line bg-white p-5 shadow-card" noValidate>
        <h2 className="text-lg font-semibold">{t("Your request")}</h2>
        <label className="block text-sm font-medium">{t("Full name")}<input className={`${field} mt-1`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
        <label className="block text-sm font-medium">{t("Mobile number")}<input dir="ltr" inputMode="tel" className={`${field} mt-1 rtl:text-end`} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971 50 123 4567" autoComplete="tel" /></label>
        <label className="block text-sm font-medium">{t("Email (optional)")}<input dir="ltr" type="email" className={`${field} mt-1 rtl:text-end`} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        <label className="block text-sm font-medium">{t("Reason (optional)")}<textarea className={`${field} mt-1 h-24 py-3`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></label>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-[rgb(var(--brand))]" checked={sure} onChange={(e) => setSure(e.target.checked)} />{t("I understand that deleting my account is permanent.")}</label>
        {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
        <div className="grid gap-3 pt-1 sm:grid-cols-2">
          <Button size="lg" onClick={byEmail}><Mail className="h-5 w-5" /> {t("Send by email")}</Button>
          <Button size="lg" variant="soft" onClick={byWhatsApp}><WhatsAppIcon /> {t("Send by WhatsApp")}</Button>
        </div>
        <p className="text-xs text-ink-muted">{t("This opens your email app or WhatsApp with the request ready to send. We reply from the same channel.")}</p>
      </form>
    </Page>
  );
}
