import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BellRing, X } from "lucide-react";
import { enablePush, pushSupported } from "@/lib/push";
import { Button } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

const KEY = "drivex.push.asked";

/** Asks once to turn on notifications (invoices, Salik, booking updates). Re-subscribes silently if already granted. */
export function PushPrompt() {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!pushSupported()) return;
    if (Notification.permission === "granted") { enablePush().catch(() => {}); return; }
    let asked = false;
    try { asked = !!localStorage.getItem(KEY); } catch { /* ignore */ }
    if (Notification.permission === "default" && !asked) setShow(true);
  }, []);
  const close = () => { setShow(false); try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ } };
  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
          <div className="mb-4 flex items-center gap-3 rounded-card border border-brand/20 bg-brand-soft p-3.5">
            <motion.div animate={{ rotate: [0, -15, 15, -8, 0] }} transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 2.5 }}
              className="grid h-11 w-11 place-items-center rounded-xl bg-brand text-white"><BellRing className="h-5 w-5" /></motion.div>
            <div className="flex-1"><p className="font-semibold text-brand">{t("Turn on notifications")}</p><p className="text-xs text-ink-muted">{t("Invoices, Salik and booking updates.")}</p></div>
            <Button size="sm" onClick={async () => { await enablePush().catch(() => {}); close(); }}>{t("Allow")}</Button>
            <button onClick={close} aria-label={t("Not now")} className="p-1 text-ink-faint"><X className="h-4 w-4" /></button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
