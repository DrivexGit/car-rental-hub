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

export default function Home() {
  const { user, invoices, offers } = useStore();
  const carOffers = offers.filter((o) => o.kind === "car");
  const partners = offers.filter((o) => o.kind === "partner");
  const nav = useNavigate();
  const pending = invoices.find((i) => i.status === "pending");
  const [paying, setPaying] = useState(false);
  const [benefit, setBenefit] = useState<Offer | null>(null);
  const first = user!.name.split(" ")[0];

  return (
    <Screen>
      <TopBar />
      <InstallBanner />
      <PushPrompt />
      <PageTitle title={<motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>{greeting()}, {first}</motion.span>} sub="Your next journey, beautifully taken care of." />

      <Carousel />

      {pending && (
        <div className="mt-4 flex items-center gap-3 rounded-card bg-danger-soft p-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-danger text-white"><FileText className="h-5 w-5" /></div>
          <div className="flex-1">
            <p className="text-[13px] font-medium text-danger">Pending invoice</p>
            <p className="flex items-baseline gap-2 whitespace-nowrap"><span className="text-xl font-bold"><Dirham /> {pending.amount}</span><span className="text-xs text-ink-muted">{day(pending.issued)}</span></p>
          </div>
          <Button size="sm" arrow onClick={() => setPaying(true)}>Pay now</Button>
        </div>
      )}

      {!!carOffers.length && <SectionHead title="Your Offers" to="/book?offers=1" />}
      <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
        {carOffers.map(({ id, car, off }) => {
          const c = car!;
          const now = Math.round(c.daily * (1 - off / 100));
          return (
            <Card key={id} className="w-[170px] shrink-0 overflow-hidden" onClick={() => nav(`/book/${c.id}?period=daily&off=${off}`)}>
              <div className="relative h-[100px] bg-gradient-to-b from-tint to-white">
                <Badge className="absolute left-2 top-2 bg-danger text-white">{off}% off</Badge>
                <img src={c.image} alt="" className="h-full w-full object-contain p-2" loading="lazy" />
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold leading-tight">{carName(c)}</p>
                    <p className="text-xs text-ink-muted">{c.category} · {c.year}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-ink-faint" />
                </div>
                <div className="mt-2"><Price value={now} unit="day" old={c.daily} size="text-base" /></div>
              </div>
            </Card>
          );
        })}
      </div>

      {!!partners.length && <SectionHead title="Dining benefits" />}
      <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
        {partners.map((d) => (
          <Card key={d.id} className="w-[170px] shrink-0 overflow-hidden" onClick={() => setBenefit(d)}>
            {d.image && <img src={d.image} alt={d.title} className="h-[100px] w-full object-cover" loading="lazy" />}
            <div className="flex items-center justify-between p-3">
              <div><p className="text-sm font-semibold">{d.title}</p><p className="text-xs text-ink-muted">{d.subtitle}</p></div>
              <Badge className="bg-danger-soft text-danger">{d.off}% off</Badge>
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
              <Badge className="bg-danger text-white">{benefit.off}% off</Badge>
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
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const held = useRef(false);
  // Index from the slide nearest the left edge — works for any slide width/gap.
  const indexOf = (el: HTMLDivElement) => {
    const kids = [...el.children] as HTMLElement[];
    const x = el.scrollLeft + kids[0].offsetLeft;
    return kids.reduce((best, k, n) => (Math.abs(k.offsetLeft - x) < Math.abs(kids[best].offsetLeft - x) ? n : best), 0);
  };
  const go = (n: number) => { const el = ref.current; if (!el) return; const kids = el.children as HTMLCollectionOf<HTMLElement>; el.scrollTo({ left: kids[n].offsetLeft - kids[0].offsetLeft, behavior: "smooth" }); };
  useEffect(() => {
    const t = setInterval(() => { const el = ref.current; if (el && !held.current) go((indexOf(el) + 1) % BANNERS.length); }, 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <div>
      <div ref={ref} onScroll={(e) => setI(indexOf(e.currentTarget))}
        onPointerDown={() => (held.current = true)} onPointerUp={() => setTimeout(() => (held.current = false), 4000)} onTouchStart={() => (held.current = true)} onTouchEnd={() => setTimeout(() => (held.current = false), 4000)}
        className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5">
        {BANNERS.map((b) => (
          <div key={b.title} className="relative h-[190px] w-[calc(100%-12px)] shrink-0 snap-start overflow-hidden rounded-card bg-hero p-4 text-white">
            <motion.img src={b.image} alt="" className="absolute inset-0 h-full w-full object-cover" initial={{ scale: 1.15 }} animate={{ scale: 1 }} transition={{ duration: 6, ease: "easeOut" }} />
            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent" />
            <p className="relative text-[10px] font-semibold uppercase tracking-[.15em] text-white/70">{b.kicker}</p>
            <p className="relative mt-1 w-[60%] text-[26px] font-bold leading-[1.05]">{b.title}</p>
            <p className="relative mt-1.5 w-[55%] text-[13px] text-white/80">{b.text}</p>
            <button onClick={() => nav(b.to)} className="absolute bottom-4 left-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold text-ink">
              {b.cta} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex justify-center gap-1.5">
        {BANNERS.map((_, k) => <button key={k} aria-label={`Slide ${k + 1}`} onClick={() => go(k)} className={`h-1.5 rounded-full transition-all ${k === i ? "w-4 bg-ink" : "w-1.5 bg-ink-faint/50"}`} />)}
      </div>
    </div>
  );
}

/** The customer's own code for a partner offer (created on first open), with a copy button. */
function BenefitCode({ offerId }: { offerId: string }) {
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
      <p className="text-xs uppercase tracking-widest text-brand">Your personal code — show it at the venue</p>
      {code ? (
        <>
          <p className="mt-1 whitespace-nowrap font-mono text-2xl font-bold tracking-wider text-brand">{code}</p>
          <Button size="sm" variant="ghost" className="mt-3" onClick={copy}>
            {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy code</>}
          </Button>
        </>
      ) : <Loader2 className="mx-auto mt-2 h-7 w-7 animate-spin text-brand" />}
    </motion.div>
  );
}
