import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { Button, Sheet } from "@/components/ui";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const KEY = "drivex.install.dismissed";
const standalone = () => matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isMobile = () => /android|iphone|ipad|ipod/i.test(navigator.userAgent);

let deferred: BIP | null = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as BIP; });

/** "Install the app" card on Home when opened in a phone browser. */
export function InstallBanner() {
  const [show, setShow] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);
  useEffect(() => {
    let dismissed = false;
    try { dismissed = !!localStorage.getItem(KEY); } catch { /* ignore */ }
    setShow(isMobile() && !standalone() && !dismissed);
  }, []);
  const dismiss = () => { setShow(false); try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ } };
  const install = async () => {
    if (deferred) { await deferred.prompt(); const r = await deferred.userChoice; if (r.outcome === "accepted") dismiss(); deferred = null; }
    else setIosHelp(true);
  };

  return (
    <>
      <AnimatePresence>
        {show && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mb-4 flex items-center gap-3 rounded-card border border-line bg-white p-3.5 shadow-card">
              <img src="/icons/icon-192.png" alt="" className="h-11 w-11 rounded-xl" />
              <div className="flex-1"><p className="font-semibold text-ink">Get the Drivex app</p><p className="text-xs text-ink-muted">Faster, full screen, with alerts.</p></div>
              <Button size="sm" onClick={install}><Download className="h-4 w-4" /> Install</Button>
              <button onClick={dismiss} aria-label="Dismiss" className="p-1 text-ink-faint"><X className="h-4 w-4" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Sheet open={iosHelp} onClose={() => setIosHelp(false)} title="Add Drivex to your Home Screen">
        <ol className="space-y-4 text-[15px]">
          <li className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-brand"><Share className="h-5 w-5" /></span>Tap <b>Share</b> in the browser bar{isIOS() ? "" : " (or the ⋮ menu)"}.</li>
          <li className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-brand"><SquarePlus className="h-5 w-5" /></span>Choose <b>Add to Home Screen</b>.</li>
          <li className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-brand"><img src="/icons/icon-192.png" className="h-5 w-5 rounded" alt="" /></span>Open Drivex from your Home Screen.</li>
        </ol>
        <Button size="lg" className="mt-6" onClick={() => { setIosHelp(false); dismiss(); }}>Got it</Button>
      </Sheet>
    </>
  );
}
