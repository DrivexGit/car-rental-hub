import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Globe } from "lucide-react";
import { LANGS, useI18n, type Lang } from "@/lib/i18n";

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(" ");

/** Language picker in the same style as the profile menu: a pill button that opens a rounded panel. `block` makes it full width. */
export function LangSelect({ block = false }: { block?: boolean }) {
  const { t, lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // close on a tap outside, or on Escape
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const pick = (l: Lang) => { setLang(l); setOpen(false); };

  return (
    <div ref={box} className={cx("relative", block && "w-full")}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} aria-label={t("Change language")}
        className={cx("flex h-10 items-center gap-2 rounded-full border border-line bg-white px-3.5 text-sm font-medium text-ink-muted transition hover:border-brand/40 hover:text-brand",
          block && "h-12 w-full px-4 text-[15px] text-ink")}>
        <Globe className="h-4 w-4" />
        <span>{LANGS.find((l) => l.value === lang)?.label}</span>
        <ChevronDown className={cx("ms-auto h-4 w-4 transition-transform duration-300", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul role="listbox" initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className={cx("absolute top-full z-50 mt-3 origin-top-right overflow-hidden rounded-2xl border border-line bg-white p-2 shadow-[0_24px_60px_-20px_rgb(var(--ink)/.35)] rtl:origin-top-left",
              block ? "inset-x-0" : "end-0 w-48")}>
            {LANGS.map((l) => (
              <li key={l.value} role="option" aria-selected={l.value === lang}>
                <button type="button" onClick={() => pick(l.value)}
                  className={cx("flex h-11 w-full items-center justify-between rounded-xl px-3 text-[15px] transition",
                    l.value === lang ? "bg-brand-soft font-semibold text-brand" : "text-ink-muted hover:bg-bg hover:text-ink")}>
                  {l.label}
                  {l.value === lang && <Check className="h-4 w-4" />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
