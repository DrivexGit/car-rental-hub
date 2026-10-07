import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CarFront, ClipboardList, Headphones } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button, tap } from "@/components/ui";

const KEY = "drivex.onboarded";
const seen = () => { try { return !!localStorage.getItem(KEY); } catch { return true; } };

const SLIDES = [
  { icon: CarFront, title: "Book in a minute", text: "Pick a car, choose your dates and pay. That's it." },
  { icon: ClipboardList, title: "Everything in one place", text: "Your bookings, invoices, Salik and fines, always up to date." },
  { icon: Headphones, title: "Help when you need it", text: "Chat with Drivex AI any time, or call us if it's urgent." },
];

/** Three short slides on the first launch after sign-in. Skippable, shown once per device. */
export function Onboarding() {
  const { t, dir } = useI18n();
  const [show, setShow] = useState(() => !seen());
  const [i, setI] = useState(0);
  const [way, setWay] = useState(1); // 1 = forward, -1 = back; flips with the text direction
  const last = i === SLIDES.length - 1;

  const finish = () => { try { localStorage.setItem(KEY, "1"); } catch { /* shown again next time, harmless */ } setShow(false); };
  const go = (n: number) => { if (n < 0 || n >= SLIDES.length) return; setWay(n > i ? 1 : -1); setI(n); tap(); };
  const { icon: Icon, title, text } = SLIDES[i];
  const shift = way * (dir === "rtl" ? -1 : 1) * 40;

  return (
    <AnimatePresence>
      {show && (
        <motion.div className="pt-safe pb-safe fixed inset-0 z-[90] flex flex-col bg-bg" role="dialog" aria-modal="true" aria-label={t("Welcome")}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.25 } }}>
          <div className="mx-auto flex w-full max-w-[480px] justify-end px-6 pt-4">
            <button onClick={finish} className="h-10 px-2 text-sm font-medium text-ink-muted">{t("Skip")}</button>
          </div>

          <motion.div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center justify-center px-8 text-center"
            drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.2}
            onDragEnd={(_, d) => { const forward = (dir === "rtl" ? d.offset.x > 60 : d.offset.x < -60); const back = (dir === "rtl" ? d.offset.x < -60 : d.offset.x > 60); if (forward) go(i + 1); else if (back) go(i - 1); }}>
            <AnimatePresence mode="wait" custom={shift}>
              <motion.div key={i} custom={shift} className="flex flex-col items-center"
                initial={{ opacity: 0, x: shift }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -shift }} transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}>
                <motion.div className="mb-8 grid h-28 w-28 place-items-center rounded-[32px] bg-brand text-white shadow-card"
                  initial={{ scale: 0.7, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}>
                  <Icon className="h-14 w-14" strokeWidth={1.6} />
                </motion.div>
                <h2 className="text-[28px] font-bold leading-tight tracking-tight">{t(title)}</h2>
                <p className="mt-3 max-w-[300px] text-[16px] text-ink-muted">{t(text)}</p>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          <div className="mx-auto w-full max-w-[480px] px-6 pb-8">
            <div className="mb-6 flex justify-center gap-2" aria-hidden>
              {SLIDES.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-brand" : "w-1.5 bg-ink-faint/40"}`} />)}
            </div>
            <Button size="lg" arrow onClick={() => (last ? finish() : go(i + 1))}>{last ? t("Get started") : t("Next")}</Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
