import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api, supabase } from "@/lib/supabase";
import { Button, Logo } from "@/components/ui";

type Step = "phone" | "code" | "name";

export default function Login() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [timer, setTimer] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [testMode, setTestMode] = useState(false);
  const full = `+971${phone.replace(/\D/g, "").replace(/^(00971|971|0)/, "")}`;
  const phoneOk = /^\+9715\d{8}$/.test(full);

  useEffect(() => {
    if (!timer) return;
    const t = setTimeout(() => setTimer(timer - 1), 1000);
    return () => clearTimeout(t);
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
    <main className="pt-safe pb-safe mx-auto flex min-h-full max-w-[480px] flex-col px-6">
      <div className="flex h-16 items-center">
        {step !== "phone" ? (
          <button onClick={() => { setError(""); setStep(step === "name" ? "code" : "phone"); }} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : <Logo className="h-7" />}
      </div>

      {step === "phone" && (
        <Panel title="Welcome to Drivex" sub="Enter your mobile number to sign in or create your account.">
          <label className="mb-2 block text-sm font-medium text-ink-muted">Mobile number</label>
          <div className="flex h-14 items-center rounded-xl border border-line bg-white px-4 focus-within:border-brand">
            <span className="mr-3 border-r border-line pr-3 font-semibold">🇦🇪 +971</span>
            <input autoFocus inputMode="tel" placeholder="50 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && phoneOk && sendCode()}
              className="h-full flex-1 bg-transparent text-lg tracking-wide outline-none placeholder:text-ink-faint" />
          </div>
          <Err msg={error} />
          <Button size="lg" className="mt-6" disabled={!phoneOk || busy} onClick={sendCode}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send code"}</Button>
          <p className="mt-4 text-center text-xs text-ink-faint">By continuing you agree to our Terms and Privacy Policy.</p>
        </Panel>
      )}

      {step === "code" && (
        <Panel title="Enter the code" sub={<>We sent a 6-digit code by SMS to <b className="text-ink">{full}</b></>}>
          <CodeInput value={code} onChange={(v) => { setCode(v); if (v.length === 6) verify(v); }} />
          {testMode && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">Test mode: SMS is not connected yet. Use code <b>123456</b>.</p>}
          <Err msg={error} />
          <Button size="lg" className="mt-6" disabled={code.length < 6 || busy} onClick={() => verify(code)}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continue"}</Button>
          <button disabled={timer > 0 || busy} onClick={sendCode} className="mt-4 w-full text-center text-sm font-medium text-brand disabled:text-ink-faint">
            {timer ? `Resend code in ${timer}s` : "Resend code"}
          </button>
        </Panel>
      )}

      {step === "name" && (
        <Panel title="What's your name?" sub="So we know how to greet you. You only do this once.">
          <input autoFocus placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)}
            className="h-14 w-full rounded-xl border border-line bg-white px-4 text-lg outline-none focus:border-brand" />
          <Err msg={error} />
          <Button size="lg" className="mt-6" disabled={name.trim().length < 2 || busy} onClick={() => verify(code, name.trim())}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Get started"}
          </Button>
        </Panel>
      )}
    </main>
  );
}

const Err = ({ msg }: { msg: string }) => (msg ? <p className="mt-3 text-sm font-medium text-danger">{msg}</p> : null);

const Panel = ({ title, sub, children }: { title: string; sub: React.ReactNode; children: React.ReactNode }) => (
  <section className="pt-8">
    <h1 className="text-[30px] font-bold leading-tight tracking-tight">{title}</h1>
    <p className="mb-8 mt-2 text-[15px] text-ink-muted">{sub}</p>
    {children}
  </section>
);

function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative" onClick={() => ref.current?.focus()}>
      <input ref={ref} autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="absolute inset-0 opacity-0" aria-label="Verification code" />
      <div className="grid grid-cols-6 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`grid h-14 place-items-center rounded-xl border bg-white text-2xl font-bold ${i === value.length ? "border-brand" : "border-line"}`}>
            {value[i] ?? ""}
          </div>
        ))}
      </div>
    </div>
  );
}
