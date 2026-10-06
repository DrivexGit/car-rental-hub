import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api, supabase } from "@/lib/supabase";
import { Button } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

type Step = "phone" | "code" | "name";

export default function Login() {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [timer, setTimer] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [testMode, setTestMode] = useState(false);
  // Persian/Arabic-Indic digits are converted so a Farsi keyboard still works.
  const asciiPhone = phone.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const codeHint = t("Use code {code}", { code: "@@" }).split("@@");
  const national = asciiPhone.replace(/\D/g, "").replace(/^(00971|971|0)/, "");
  const full = `+971${national}`;
  const phoneOk = /^\+9715\d{8}$/.test(full);
  // Only warn once the number is clearly not a UAE mobile, not while the user is still typing.
  const phoneHint = national && (!national.startsWith("5") || national.length > 9) ? t("Enter a UAE mobile number, e.g. 50 123 4567.") : "";

  useEffect(() => {
    if (!timer) return;
    const id = setTimeout(() => setTimer(timer - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const sendCode = () => run(async () => {
    const r = await api<{ testMode: boolean }>("auth", { action: "send", phone: full });
    setTestMode(r.testMode); setStep("code"); setCode(""); setTimer(45);
  });

  const verify = (c: string, fullName?: string) => run(async () => {
    const r = await api<{ needName?: boolean; access_token?: string; refresh_token?: string }>("auth", { action: "verify", phone: full, code: c, name: fullName });
    if (r.needName) { setStep("name"); return; }
    await supabase.auth.setSession({ access_token: r.access_token!, refresh_token: r.refresh_token! });
  });

  return (
    <main className="relative min-h-full overflow-hidden bg-night text-white">
      {/* Desktop: the photo fills one half of the screen and the form sits in the other. */}
      <img src="/img/login-bg.webp" alt="" className="absolute inset-x-0 top-0 h-[70vh] w-full object-cover object-top lg:inset-y-0 lg:end-auto lg:start-0 lg:h-full lg:w-1/2 lg:object-center" />
      <div className="absolute inset-x-0 top-0 h-[70vh] bg-gradient-to-b from-black/30 via-transparent to-night lg:inset-y-0 lg:end-auto lg:start-0 lg:h-full lg:w-1/2 lg:bg-gradient-to-r lg:from-black/10 lg:to-night rtl:lg:bg-gradient-to-l" />
      <div className="pt-safe pb-safe relative mx-auto flex min-h-[100dvh] max-w-[480px] flex-col px-6 lg:ms-auto lg:me-0 lg:w-1/2 lg:max-w-none lg:px-24">
      <div className="flex h-16 items-center">
        {step !== "phone" ? (
          <button onClick={() => { setError(""); setStep(step === "name" ? "code" : "phone"); }} className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-white/10 backdrop-blur" aria-label={t("Back")}>
            <ArrowLeft className="h-5 w-5 rtl:-scale-x-100" />
          </button>
        ) : <img src="/logo.png" alt="Drivex" className="h-8" />}
      </div>
      <div className="flex-1 lg:h-[10vh] lg:flex-none" />

      {step === "phone" && (
        <Panel title={t("Welcome to Drivex")} sub={t("Enter your mobile number to sign in or create your account.")}>
          <label className="mb-2 block text-sm font-medium text-white/70">{t("Mobile number")}</label>
          <div dir="ltr" className="flex h-14 items-center rounded-xl border border-line bg-white px-4 text-ink focus-within:border-brand">
            <span className="me-3 shrink-0 whitespace-nowrap border-e border-line pe-3 font-semibold">🇦🇪 +971</span>
            <input dir="ltr" autoFocus inputMode="tel" placeholder="50 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && phoneOk && sendCode()}
              className="h-full flex-1 bg-transparent text-lg tracking-wide outline-none placeholder:text-ink-faint" />
          </div>
          <Err msg={error || phoneHint} />
          <Button size="lg" className="mt-6" disabled={!phoneOk || busy} onClick={sendCode}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t("Send code")}</Button>
          <p className="mt-4 text-center text-xs text-white/50">{t("By continuing you agree to our Terms and Privacy Policy.")}</p>
        </Panel>
      )}

      {step === "code" && (
        <Panel title={t("Enter the code")} sub={<>{t("We sent a 6-digit code by SMS to")} <b dir="ltr" className="text-white">{full}</b></>}>
          <CodeInput value={code} onChange={(v) => { setCode(v); if (v.length === 6) verify(v); }} />
          {testMode && <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn-text">{t("Test mode: SMS is not connected yet.")} {codeHint[0]}<b>123456</b>{codeHint[1]}</p>}
          <Err msg={error} />
          <Button size="lg" className="mt-6" disabled={code.length < 6 || busy} onClick={() => verify(code)}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t("Continue")}</Button>
          <button disabled={timer > 0 || busy} onClick={sendCode} className="mt-4 w-full text-center text-sm font-medium text-white disabled:text-white/40">
            {timer ? t("Resend code in {n}s", { n: timer }) : t("Resend code")}
          </button>
        </Panel>
      )}

      {step === "name" && (
        <Panel title={t("What's your name?")} sub={t("So we know how to greet you. You only do this once.")}>
          <input autoFocus placeholder={t("Full name")} value={name} onChange={(e) => setName(e.target.value)}
            className="h-14 w-full rounded-xl border border-line bg-white px-4 text-lg text-ink outline-none focus:border-brand" />
          <Err msg={error} />
          <Button size="lg" className="mt-6" disabled={name.trim().length < 2 || busy} onClick={() => verify(code, name.trim())}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t("Get started")}
          </Button>
        </Panel>
      )}
      </div>
    </main>
  );
}

const Err = ({ msg }: { msg: string }) => (msg ? <p className="mt-3 text-sm font-medium text-red-300">{msg}</p> : null);

const Panel = ({ title, sub, children }: { title: string; sub: React.ReactNode; children: React.ReactNode }) => (
  <section className="pb-10">
    <h1 className="text-[32px] font-bold leading-tight tracking-tight">{title}</h1>
    <p className="mb-7 mt-2 text-[15px] text-white/75">{sub}</p>
    {children}
  </section>
);

function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div dir="ltr" className="relative" onClick={() => ref.current?.focus()}>
      <input ref={ref} dir="ltr" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="absolute inset-0 opacity-0" aria-label={t("Verification code")} />
      <div className="grid grid-cols-6 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`grid h-14 place-items-center rounded-xl border bg-white text-2xl font-bold text-ink ${i === value.length ? "border-brand" : "border-line"}`}>
            {value[i] ?? ""}
          </div>
        ))}
      </div>
    </div>
  );
}
