import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, ChevronRight, Copy, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { useStore, type Offer } from "@/lib/store";
import { InstallBanner } from "@/components/InstallBanner";
import { PushPrompt } from "@/components/PushPrompt";
import { BANNERS, carName } from "@/data/catalog";
import { day, greeting } from "@/lib/format";
import { Badge, Button, Card, Dirham, PageTitle, Price, Screen, SectionHead, Sheet, TopBar } from "@/components/ui";
import { PayInvoiceSheet } from "@/screens/PaySheet";
import { useI18n } from "@/lib/i18n";

export default function Home() {
  const { t } = useI18n();
  const { user, invoices, offers } = useStore();
  const carOffers = offers.filter((o) => o.kind === "car");
  const partners = offers.filter((o) => o.kind === "partner");
  const nav = useNavigate();
  const pending = invoices.find((i) => i.status === "pending");
  const [paying, setPaying] = useState(false);
  const [benefit, setBenefit] = useState<Offer | null>(null);
  const first = user!.name.split(" ")[0];

  return (
    <Screen wide>
      <TopBar />
      <InstallBanner />
      <PushPrompt />
      <PageTitle title={<motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>{t("{greeting}, {name}", { greeting: t(greeting()), name: first })}</motion.span>} sub={t("Your next journey, beautifully taken care of.")} />

      <Carousel />

      {pending && (
        <div className="mt-4 flex items-center gap-3 rounded-card bg-danger-soft p-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-danger text-white"><FileText className="h-5 w-5" /></div>
          <div className="flex-1">
            <p className="text-[13px] font-medium text-danger">{t("Pending invoice")}</p>
            <p className="flex items-baseline gap-2 whitespace-nowrap"><span className="text-xl font-bold"><Dirham /> {pending.amount}</span><span className="text-xs text-ink-muted">{day(pending.issued)}</span></p>
          </div>
          <Button size="sm" arrow onClick={() => setPaying(true)}>{t("Pay now")}</Button>
        </div>
      )}

      {!!carOffers.length && <SectionHead title={t("Your Offers")} to="/book?offers=1" />}
      <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-4 lg:overflow-visible lg:px-0 xl:grid-cols-5">
        {carOffers.map(({ id, car, off }) => {
          const c = car!;
          const now = Math.round(c.daily * (1 - off / 100));
          return (
            <Card key={id} className="w-[170px] shrink-0 overflow-hidden lg:w-auto" onClick={() => nav(`/book/${c.id}?period=daily&off=${off}`)}>
              <div className="relative h-[100px] bg-gradient-to-b from-tint to-white lg:h-[150px]">
                <Badge className="absolute start-2 top-2 bg-danger text-white">{t("{n}% off", { n: off })}</Badge>
                <img src={c.image} alt="" className="h-full w-full object-contain p-2" loading="lazy" />
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold leading-tight">{carName(c)}</p>
                    <p className="text-xs text-ink-muted">{c.category} · {c.year}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-ink-faint rtl:-scale-x-100" />
                </div>
                <div className="mt-2"><Price value={now} unit={t("day")} old={c.daily} size="text-base" /></div>
              </div>
            </Card>
          );
        })}
      </div>

      {!!partners.length && <SectionHead title={t("Dining benefits")} />}
      <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-4 lg:overflow-visible lg:px-0 xl:grid-cols-5">
        {partners.map((d) => (
          <Card key={d.id} className="w-[170px] shrink-0 overflow-hidden lg:w-auto" onClick={() => setBenefit(d)}>
            {d.image && <img src={d.image} alt={d.title} className="h-[100px] w-full object-cover lg:h-[150px]" loading="lazy" />}
            <div className="flex items-center justify-between p-3">
              <div><p className="text-sm font-semibold">{d.title}</p><p className="text-xs text-ink-muted">{d.subtitle}</p></div>
              <Badge className="bg-danger-soft text-danger">{t("{n}% off", { n: d.off })}</Badge>
            </div>
          </Card>
        ))}
      </div>

      <Sheet open={!!benefit} onClose={() => setBenefit(null)} title={benefit?.title ?? ""}>
        {benefit && (
          <div>
            {benefit.image && <img src={benefit.image} alt="" className="h-44 w-full rounded-card object-cover" />}
            <div className="mt-4 flex items-center justify-between">
              <p className="text-ink-muted">{benefit.subtitle}{benefit.location ? ` · ${benefit.location}` : ""}</p>
              <Badge className="bg-danger text-white">{t("{n}% off", { n: benefit.off })}</Badge>
            </div>
            {benefit.description && <p className="mt-2 text-[15px]">{benefit.description}</p>}
            <BenefitCode offerId={benefit.id} />
            {benefit.terms && <p className="mt-4 text-xs text-ink-muted">{benefit.terms}</p>}
          </div>
        )}
      </Sheet>

      {pending && <PayInvoiceSheet invoice={pending} open={paying} onClose={() => setPaying(false)} />}
    </Screen>
  );
}

function Carousel() {
  const nav = useNavigate();
  const { t } = useI18n();
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const held = useRef(false);
  // Index of the slide nearest the start edge (left in LTR, right in RTL). Uses bounding rects, so it works in both directions.
  const indexOf = (el: HTMLDivElement) => {
    const kids = [...el.children] as HTMLElement[];
    const cs = getComputedStyle(el);
    const rtl = cs.direction === "rtl";
    const box = el.getBoundingClientRect();
    const pad = parseFloat(cs.paddingInlineStart) || 0;
    const edge = rtl ? box.right - pad : box.left + pad;
    const pos = (k: HTMLElement) => { const b = k.getBoundingClientRect(); return rtl ? b.right : b.left; };
    return kids.reduce((best, k, n) => (Math.abs(pos(k) - edge) < Math.abs(pos(kids[best]) - edge) ? n : best), 0);
  };
  // Scrolls only the carousel (never the page) by the distance from the slide to the start edge; the sign is the same in LTR and RTL.
  const go = (n: number) => {
    const el = ref.current; const kid = el?.children[n] as HTMLElement | undefined;
    if (!el || !kid) return;
    const cs = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    const pad = parseFloat(cs.paddingInlineStart) || 0;
    const b = kid.getBoundingClientRect();
    el.scrollBy({ left: cs.direction === "rtl" ? b.right - (box.right - pad) : b.left - (box.left + pad), behavior: "smooth" });
  };
  useEffect(() => {
    const timer = setInterval(() => { const el = ref.current; if (el && !held.current) go((indexOf(el) + 1) % BANNERS.length); }, 5000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div>
      <div ref={ref} onScroll={(e) => setI(indexOf(e.currentTarget))}
        onPointerDown={() => (held.current = true)} onPointerUp={() => setTimeout(() => (held.current = false), 4000)} onTouchStart={() => (held.current = true)} onTouchEnd={() => setTimeout(() => (held.current = false), 4000)}
        className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 lg:mx-0 lg:scroll-px-0 lg:px-0">
        {BANNERS.map((b) => (
          <div key={b.title} className="relative h-[190px] w-[calc(100%-12px)] shrink-0 lg:w-full snap-start overflow-hidden rounded-card bg-hero p-4 text-white lg:h-[340px] lg:p-10">
            <motion.img src={b.image} alt="" className="absolute inset-0 h-full w-full object-cover lg:object-[50%_70%]" initial={{ scale: 1.15 }} animate={{ scale: 1 }} transition={{ duration: 6, ease: "easeOut" }} />
            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent rtl:bg-gradient-to-l" />
            <p className="relative text-[10px] font-semibold uppercase tracking-[.15em] text-white/70 lg:text-xs">{t(b.kicker)}</p>
            <p className="relative mt-1 w-[60%] text-[26px] font-bold leading-[1.05] lg:mt-3 lg:w-[58%] lg:text-[34px] xl:w-[45%] xl:text-[48px]">{t(b.title)}</p>
            <p className="relative mt-1.5 w-[55%] text-[13px] text-white/80 lg:mt-3 lg:w-[50%] lg:text-base xl:mt-4 xl:w-[40%] xl:text-lg">{t(b.text)}</p>
            <button onClick={() => nav(b.to)} className="absolute bottom-4 start-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold text-ink lg:bottom-10 lg:start-10 lg:h-12 lg:px-5 lg:text-base">
              {t(b.cta)} <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex justify-center gap-1.5">
        {BANNERS.map((_, k) => <button key={k} aria-label={t("Slide {n}", { n: k + 1 })} onClick={() => go(k)} className={`h-1.5 rounded-full transition-all ${k === i ? "w-4 bg-ink" : "w-1.5 bg-ink-faint/50"}`} />)}
      </div>
    </div>
  );
}

/** The customer's own code for a partner offer (created on first open), with a copy button. */
function BenefitCode({ offerId }: { offerId: string }) {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setCode("");
    supabase.rpc("my_offer_code", { p_offer: offerId }).then(({ data }) => setCode((data as string) ?? ""));
  }, [offerId]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); } catch { /* ignore */ }
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };
  return (
    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.15, type: "spring" }}
      className="mt-5 rounded-card border-2 border-dashed border-brand bg-brand-soft p-4 text-center">
      <p className="text-xs uppercase tracking-widest text-brand">{t("Your personal code — show it at the venue")}</p>
      {code ? (
        <>
          <p dir="ltr" className="mt-1 whitespace-nowrap font-mono text-2xl font-bold tracking-wider text-brand">{code}</p>
          <Button size="sm" variant="ghost" className="mt-3" onClick={copy}>
            {copied ? <><Check className="h-4 w-4" /> {t("Copied")}</> : <><Copy className="h-4 w-4" /> {t("Copy code")}</>}
          </Button>
        </>
      ) : <Loader2 className="mx-auto mt-2 h-7 w-7 animate-spin text-brand" />}
    </motion.div>
  );
}
