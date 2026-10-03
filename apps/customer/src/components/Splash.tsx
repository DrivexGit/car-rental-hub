import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/** Animated launch screen: green wipe, the D mark sweeps in, the wordmark reveals, then everything lifts away. */
export function Splash({ ready }: { ready: boolean }) {
  const [minDone, setMinDone] = useState(false);
  const [show] = useState(() => { try { return !sessionStorage.getItem("drivex.splash"); } catch { return true; } });
  useEffect(() => {
    const t = setTimeout(() => { setMinDone(true); try { sessionStorage.setItem("drivex.splash", "1"); } catch { /* ignore */ } }, 1900);
    return () => clearTimeout(t);
  }, []);
  const visible = show && !(minDone && ready);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div key="splash" className="fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-brand"
          exit={{ clipPath: "circle(0% at 50% 46%)", transition: { duration: 0.6, ease: [0.7, 0, 0.3, 1] } }}
          initial={{ clipPath: "circle(150% at 50% 46%)" }}>
          {/* road lines rushing past */}
          {[0, 1, 2].map((i) => (
            <motion.span key={i} className="absolute left-0 h-[2px] w-40 rounded-full bg-white/15"
              style={{ top: `${36 + i * 14}%` }}
              initial={{ x: "-40vw" }} animate={{ x: "140vw" }}
              transition={{ duration: 1.1, delay: 0.15 * i, repeat: Infinity, ease: "easeIn" }} />
          ))}
          <div className="relative flex flex-col items-center">
            <motion.div className="relative" initial={{ x: -140, opacity: 0, skewX: -18 }} animate={{ x: 0, opacity: 1, skewX: 0 }}
              transition={{ type: "spring", stiffness: 140, damping: 14, delay: 0.15 }}>
              <img src="/icons/icon-512.png" alt="" className="h-24 w-24 rounded-[28px] shadow-2xl ring-1 ring-white/10" />
              <motion.span className="absolute inset-0 rounded-[28px] bg-gradient-to-r from-transparent via-white/40 to-transparent"
                initial={{ x: "-120%" }} animate={{ x: "120%" }} transition={{ duration: 0.8, delay: 0.75, ease: "easeInOut" }} />
            </motion.div>
            <motion.img src="/logo.png" alt="Drivex" className="mt-6 h-9"
              initial={{ clipPath: "inset(0 100% 0 0)", opacity: 0 }} animate={{ clipPath: "inset(0 0% 0 0)", opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.55, ease: [0.2, 0.8, 0.2, 1] }} />
            <motion.p className="mt-3 text-xs font-medium uppercase tracking-[.35em] text-white/60"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.05 }}>
              Drive. Easy.
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
