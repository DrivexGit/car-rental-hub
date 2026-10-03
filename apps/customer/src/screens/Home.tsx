import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ChevronRight, FileText } from "lucide-react";
import { useStore } from "@/lib/store";
import { BANNERS, carName } from "@/data/catalog";
import { day, greeting } from "@/lib/format";
import { Badge, Button, Card, Dirham, PageTitle, Price, Screen, SectionHead, TopBar } from "@/components/ui";
import { PayInvoiceSheet } from "@/screens/PaySheet";

export default function Home() {
  const { user, invoices, offers } = useStore();
  const carOffers = offers.filter((o) => o.kind === "car");
  const partners = offers.filter((o) => o.kind === "partner");
  const nav = useNavigate();
  const pending = invoices.find((i) => i.status === "pending");
  const [paying, setPaying] = useState(false);
  const first = user!.name.split(" ")[0];

  return (
    <Screen>
      <TopBar />
      <PageTitle title={`${greeting()}, ${first}`} sub="Your next journey, beautifully taken care of." />

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

      {!!carOffers.length && <SectionHead title="Your Offers" to="/book" />}
      <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
        {carOffers.map(({ id, car, off }) => {
          const c = car!;
          const now = Math.round(c.daily * (1 - off / 100));
          return (
            <Card key={id} className="w-[170px] shrink-0 overflow-hidden" onClick={() => nav(`/book/${c.id}?period=daily&off=${off}`)}>
              <div className="relative h-[100px] bg-gradient-to-b from-[#eef0ee] to-white">
                <Badge className="absolute left-2 top-2 bg-brand text-white">{off}% off</Badge>
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
          <Card key={d.id} className="w-[170px] shrink-0 overflow-hidden">
            {d.image && <img src={d.image} alt={d.title} className="h-[100px] w-full object-cover" loading="lazy" />}
            <div className="flex items-center justify-between p-3">
              <div><p className="text-sm font-semibold">{d.title}</p><p className="text-xs text-ink-muted">{d.subtitle}</p></div>
              <Badge>{d.off}% off</Badge>
            </div>
          </Card>
        ))}
      </div>

      {pending && <PayInvoiceSheet invoice={pending} open={paying} onClose={() => setPaying(false)} />}
    </Screen>
  );
}

function Carousel() {
  const nav = useNavigate();
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setInterval(() => {
      const el = ref.current; if (!el) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % BANNERS.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <div>
      <div ref={ref} onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-card">
        {BANNERS.map((b) => (
          <div key={b.title} className="relative h-[190px] w-full shrink-0 snap-center overflow-hidden rounded-card bg-[#0b1a11] p-4 text-white">
            <img src={b.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
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
        {BANNERS.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-4 bg-ink" : "w-1.5 bg-ink-faint/50"}`} />)}
      </div>
    </div>
  );
}
