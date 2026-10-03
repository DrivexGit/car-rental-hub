import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Phone, SendHorizontal, Sparkles, TriangleAlert } from "lucide-react";
import { useStore } from "@/lib/store";
import { carById, carName } from "@/data/catalog";
import { SUPPORT_PHONE, whatsappLink } from "@/config";
import { Avatar, Chip, Logo, Screen } from "@/components/ui";

type Msg = { role: "user" | "assistant"; content: string; urgent?: boolean };
const CHIPS = ["Extend my rental", "Payment help"];
const KEY = "drivex.support.chat";

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z" /></svg>
);

export default function Support() {
  const { user, bookings, invoices, fines } = useStore();
  const first = user!.name.split(" ")[0];
  const ask = (useLocation().state as { ask?: string } | null)?.ask;
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(KEY) || "[]"); } catch { return []; }
  });
  const [text, setText] = useState(ask ?? "");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(msgs)); } catch { /* ignore */ } end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  // Everything the assistant may know about this customer.
  const context = {
    name: user!.name,
    phone: user!.phone,
    bookings: bookings.map((b) => ({ car: carName(carById(b.carId)), plate: b.plate, status: b.status, pickup: b.pickup, return: b.dropoff, plan: b.period })),
    invoices: invoices.map((i) => ({ id: i.id, amount: i.amount, status: i.status })),
    fines: fines.filter((f) => !f.paid).map((f) => ({ type: f.type, amount: f.amount, place: f.place, date: f.date })),
  };

  const send = async (content: string, urgentCall = false) => {
    if (!content.trim() || busy) return;
    const next = [...msgs, { role: "user" as const, content: content.trim() }];
    setMsgs(next); setText(""); setBusy(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-12).map(({ role, content }) => ({ role, content })), context, urgentCall }),
      });
      const data = await r.json();
      setMsgs([...next, { role: "assistant", content: data.reply || "Sorry, something went wrong.", urgent: data.urgent }]);
    } catch {
      setMsgs([...next, { role: "assistant", content: "I can't connect right now. Please message us on WhatsApp or call us." }]);
    } finally { setBusy(false); }
  };

  return (
    <Screen className="flex min-h-full flex-col">
      <div className="flex items-center justify-between pb-4 pt-3"><Logo /><Avatar /></div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">How can we help?</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm"><Sparkles className="h-4 w-4 text-brand" /><b>Drivex AI</b><span className="text-ink-faint">· AI assistant</span></p>
        </div>
        <a href={whatsappLink(`Hi Drivex, this is ${user!.name}.`)} target="_blank" rel="noreferrer" aria-label="WhatsApp"
          className="grid h-12 w-12 place-items-center rounded-full bg-[#25d366]/10 text-[#1a9e4b]"><WhatsAppIcon /></a>
      </div>

      <div className="mt-5 flex-1 space-y-3">
        <Bubble role="assistant" content={`Hi ${first}. What can I help you with?`} />
        {!msgs.length && (
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            {CHIPS.map((c) => <Chip key={c} onClick={() => send(c)}>{c}</Chip>)}
            <Chip tone="danger" onClick={() => send("Urgent call — I need help now.", true)}><Phone className="h-4 w-4" /> Urgent call</Chip>
          </div>
        )}
        {msgs.map((m, i) => <Bubble key={i} {...m} />)}
        {busy && <div className="flex gap-1 px-4 py-3">{[0, 1, 2].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-ink-faint" style={{ animationDelay: `${d * 120}ms` }} />)}</div>}
        <div ref={end} />
      </div>

      {!!msgs.length && (
        <div className="no-scrollbar -mx-5 mb-2 flex gap-2 overflow-x-auto px-5">
          <Chip tone="danger" onClick={() => send("Urgent call — I need help now.", true)}><Phone className="h-4 w-4" /> Urgent call</Chip>
          {CHIPS.map((c) => <Chip key={c} onClick={() => send(c)}>{c}</Chip>)}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="sticky bottom-20 flex items-center gap-2 rounded-2xl border border-line bg-white p-1.5 pl-4 shadow-card">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask a question…" className="h-11 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-faint" />
        <button disabled={!text.trim() || busy} className="grid h-11 w-11 place-items-center rounded-xl bg-brand text-white disabled:opacity-40" aria-label="Send"><SendHorizontal className="h-5 w-5" /></button>
      </form>
    </Screen>
  );
}

function Bubble({ role, content, urgent }: Msg) {
  const mine = role === "user";
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${mine ? "rounded-br-md bg-brand text-white" : "rounded-bl-md bg-[#ecebe6]"}`}>{content}</div>
      {urgent && (
        <div className="mt-2 w-[85%] rounded-2xl border border-danger/30 bg-danger-soft p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-danger"><TriangleAlert className="h-4 w-4" /> Our team has been alerted</p>
          <a href={`tel:${SUPPORT_PHONE}`} className="mt-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-danger font-semibold text-white"><Phone className="h-4 w-4" /> Call Drivex now</a>
        </div>
      )}
    </div>
  );
}
