import { LANGS, useI18n, type Lang } from "@/lib/i18n";

/** Language picker as a dropdown. The native list is the most reliable one on phones, and it works with the keyboard and screen readers. */
export function LangSelect({ className = "" }: { className?: string }) {
  const { t, lang, setLang } = useI18n();
  return (
    <select aria-label={t("Change language")} value={lang} onChange={(e) => setLang(e.target.value as Lang)}
      className={`h-10 cursor-pointer rounded-full border border-line bg-white px-3.5 text-sm font-medium text-ink-muted transition hover:border-brand/40 hover:text-brand ${className}`}>
      {LANGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
    </select>
  );
}
