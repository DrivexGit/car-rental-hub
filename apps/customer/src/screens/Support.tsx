import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Phone, SendHorizontal, Sparkles, TriangleAlert } from "lucide-react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/supabase";
import { SUPPORT_PHONE, whatsappLink } from "@/config";
import { Avatar, Chip, Logo, Screen } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

type Msg = { role: "user" | "assistant"; content: string; urgent?: boolean };
const CHIPS = ["Extend my rental", "Payment help"];
const KEY = "drivex.support.chat";

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z" /></svg>
);

export default function Support() {
  const { t } = useI18n();
  const { user } = useStore();
  const first = user!.name.split(" ")[0];
  const ask = (useLocation().state as { ask?: string } | null)?.ask;
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(KEY) || "[]"); } catch { return []; }
  });
  const [text, setText] = useState(ask ?? "");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  // The desktop card scrolls inside itself: start at the latest message (this never moves the page).
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, []);

  // Follow the conversation only when a message arrives, never on opening the page (that used to jump the page to the bottom).
  const shown = useRef(msgs.length);
  useEffect(() => {
    try { sessionStorage.setItem(KEY, JSON.stringify(msgs)); } catch { /* ignore */ }
    if (msgs.length > shown.current) end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    shown.current = msgs.length;
  }, [msgs]);


  const send = async (content: string, urgentCall = false) => {
    if (!content.trim() || busy) return;
    const next = [...msgs, { role: "user" as const, content: content.trim() }];
    setMsgs(next); setText(""); setBusy(true);
    try {
      const data = await api<{ reply: string; urgent: boolean }>("chat", { messages: next.slice(-12).map(({ role, content }) => ({ role, content })), urgentCall });
      setMsgs([...next, { role: "assistant", content: data.reply || t("Sorry, something went wrong."), urgent: data.urgent }]);
    } catch {
      setMsgs([...next, { role: "assistant", content: t("I can't connect right now. Please message us on WhatsApp or call us.") }]);
    } finally { setBusy(false); }
  };

  return (
    <Screen wide className="flex min-h-full flex-col">
      <div className="flex items-center justify-between pb-4 pt-3 lg:hidden"><Logo /><Avatar /></div>

      {/* On desktop the conversation sits in a card; on phones this wrapper adds nothing. */}
      <div className="contents lg:relative lg:mx-auto lg:flex lg:w-full lg:max-w-[980px] lg:flex-col lg:overflow-hidden lg:rounded-[28px] lg:border lg:border-line lg:bg-white lg:shadow-[0_30px_80px_-30px_rgb(var(--ink)/.28)]">
        {!reduce && (
          <div aria-hidden className="absolute inset-x-0 top-0 hidden h-[3px] overflow-hidden lg:block">
            <motion.div className="h-full w-1/3 bg-gradient-to-r from-transparent via-brand to-transparent" animate={{ x: ["-100%", "300%"] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }} />
          </div>
        )}
        <div className="flex items-start justify-between lg:items-center lg:gap-5 lg:border-b lg:border-line lg:bg-gradient-to-b lg:from-brand-soft/70 lg:to-transparent lg:px-8 lg:py-6">
          <span className="relative me-1 hidden h-14 w-14 shrink-0 lg:block">
            {!reduce && <span className="absolute inset-0 animate-ping rounded-full bg-brand/20 [animation-duration:2.6s]" />}
            <span className="relative grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-lg"><Sparkles className="h-6 w-6" /></span>
            <span className="absolute -bottom-0.5 -end-0.5 h-4 w-4 rounded-full border-2 border-white bg-[#22c55e]" />
          </span>
          <div className="lg:flex-1">
            <h1 className="text-[28px] font-bold tracking-tight lg:text-[32px]">{t("How can we help?")}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm"><Sparkles className="h-4 w-4 text-brand lg:hidden" /><b>Drivex AI</b><span className="text-ink-faint">· {t("AI assistant")}</span></p>
          </div>
          <a href={whatsappLink(`Hi Drivex, this is ${user!.name}.`)} target="_blank" rel="noreferrer" aria-label="WhatsApp"
            className="grid h-12 w-12 place-items-center rounded-full bg-[#25d366]/10 text-[#1a9e4b] transition hover:scale-105 hover:bg-[#25d366]/20"><WhatsAppIcon /></a>
        </div>

        <div ref={box} className="mt-5 flex-1 space-y-3 lg:mt-0 lg:h-[min(480px,calc(100dvh-420px))] lg:min-h-[300px] lg:flex-none lg:overflow-y-auto lg:px-8 lg:py-6">
          <Bubble role="assistant" content={t("Hi {name}. What can I help you with?", { name: first })} />
          {!msgs.length && (
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:px-0">
              {CHIPS.map((c) => <Chip key={c} onClick={() => send(t(c))}>{t(c)}</Chip>)}
              <Chip tone="danger" onClick={() => send(t("Urgent call — I need help now."), true)}><Phone className="h-4 w-4" /> {t("Urgent call")}</Chip>
            </div>
          )}
          {msgs.map((m, i) => <Bubble key={i} {...m} />)}
          {busy && <div className="flex gap-1 px-4 py-3">{[0, 1, 2].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-ink-faint" style={{ animationDelay: `${d * 120}ms` }} />)}</div>}
          <div ref={end} />
        </div>

        <div className="contents lg:block lg:border-t lg:border-line lg:bg-bg/60 lg:px-6 lg:py-4">
          {!!msgs.length && (
            <div className="no-scrollbar -mx-5 mb-2 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:px-0">
              <Chip tone="danger" onClick={() => send(t("Urgent call — I need help now."), true)}><Phone className="h-4 w-4" /> {t("Urgent call")}</Chip>
              {CHIPS.map((c) => <Chip key={c} onClick={() => send(t(c))}>{t(c)}</Chip>)}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="sticky bottom-20 flex items-center gap-2 rounded-2xl border border-line bg-white p-1.5 ps-4 shadow-card transition-shadow focus-within:border-brand/40 focus-within:shadow-[0_0_0_4px_rgb(var(--brand)/.12)] lg:static">
            <input value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} placeholder={t("Ask a question…")} className="h-11 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-faint lg:h-12 lg:text-base" />
            <button disabled={!text.trim() || busy} className="grid h-11 w-11 place-items-center rounded-xl bg-brand text-white transition active:scale-95 disabled:opacity-40 lg:h-12 lg:w-12" aria-label={t("Send")}><SendHorizontal className="h-5 w-5 rtl:-scale-x-100" /></button>
          </form>
        </div>
      </div>
    </Screen>
  );
}

function Bubble({ role, content, urgent }: Msg) {
  const { t } = useI18n();
  const mine = role === "user";
  return (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div className={`max-w-[85%] whitespace-pre-wrap lg:max-w-[70%] break-words rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${mine ? "rounded-ee-md bg-brand text-white" : "rounded-es-md bg-muted"}`} dir="auto">{content}</div>
      {urgent && (
        <div className="mt-2 w-[85%] rounded-2xl border border-danger/30 bg-danger-soft p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-danger"><TriangleAlert className="h-4 w-4" /> {t("Our team has been alerted")}</p>
          <a href={`tel:${SUPPORT_PHONE}`} className="mt-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-danger font-semibold text-white"><Phone className="h-4 w-4" /> {t("Call Drivex now")}</a>
        </div>
      )}
    </motion.div>
  );
}
