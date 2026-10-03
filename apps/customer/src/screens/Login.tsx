import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button, Logo } from "@/components/ui";

type Step = "phone" | "code" | "name";

// ponytail: OTP is simulated (any 6 digits). Wire to Supabase phone OTP once an SMS provider is chosen.
export default function Login() {
  const { signIn, knownPhones } = useStore();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [timer, setTimer] = useState(0);
  const full = `+971${phone.replace(/\D/g, "").replace(/^0/, "")}`;
  const phoneOk = /^\+9715\d{8}$/.test(full);

  useEffect(() => {
    if (!timer) return;
    const t = setTimeout(() => setTimer(timer - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  const sendCode = () => { setStep("code"); setCode(""); setTimer(45); };
  const verify = (c: string) => {
    if (c.length < 6) return;
    if (knownPhones[full]) signIn(full); // returning customer: straight in
    else setStep("name");
  };

  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-full max-w-[480px] flex-col px-6">
      <div className="flex h-16 items-center">
        {step !== "phone" ? (
          <button onClick={() => setStep(step === "name" ? "code" : "phone")} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white" aria-label="Back">
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
              className="h-full flex-1 bg-transparent text-lg tracking-wide outline-none placeholder:text-ink-faint" />
          </div>
          <Button size="lg" className="mt-6" disabled={!phoneOk} onClick={sendCode}>Send code</Button>
          <p className="mt-4 text-center text-xs text-ink-faint">By continuing you agree to our Terms and Privacy Policy.</p>
        </Panel>
      )}

      {step === "code" && (
        <Panel title="Enter the code" sub={<>We sent a 6-digit code by SMS to <b className="text-ink">{full}</b></>}>
          <CodeInput value={code} onChange={(v) => { setCode(v); verify(v); }} />
          <Button size="lg" className="mt-6" disabled={code.length < 6} onClick={() => verify(code)}>Continue</Button>
          <button disabled={timer > 0} onClick={sendCode} className="mt-4 w-full text-center text-sm font-medium text-brand disabled:text-ink-faint">
            {timer ? `Resend code in ${timer}s` : "Resend code"}
          </button>
        </Panel>
      )}

      {step === "name" && (
        <Panel title="What's your name?" sub="So we know how to greet you. You only do this once.">
          <input autoFocus placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)}
            className="h-14 w-full rounded-xl border border-line bg-white px-4 text-lg outline-none focus:border-brand" />
          <Button size="lg" className="mt-6" disabled={name.trim().length < 2} onClick={() => signIn(full, name.trim())}>Get started</Button>
        </Panel>
      )}
    </main>
  );
}

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
