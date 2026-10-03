import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronRight, FileText, IdCard, Smartphone, Upload } from "lucide-react";
import { useStore } from "@/lib/store";
import { day, money } from "@/lib/format";
import { BackBar, Button, Card, Dirham, Empty, ListGroup, ListRow, Screen } from "@/components/ui";
import { PayInvoiceSheet } from "@/screens/PaySheet";
import { whatsappLink } from "@/config";
import type { Invoice } from "@/lib/store";

export function EditProfile() {
  const { user, updateUser } = useStore();
  const nav = useNavigate();
  const [name, setName] = useState(user!.name);
  const [email, setEmail] = useState(user!.email || "");
  return (
    <Screen tabs={false}>
      <BackBar title="Edit profile" />
      <Field label="Full name" value={name} onChange={setName} />
      <Field label="Email (optional)" value={email} onChange={setEmail} type="email" />
      <Field label="Mobile number" value={user!.phone} disabled />
      <Button size="lg" className="mt-4" disabled={name.trim().length < 2} onClick={() => { updateUser({ name: name.trim(), email: email.trim() || undefined }); nav(-1); }}>Save</Button>
    </Screen>
  );
}

const Field = ({ label, value, onChange, type = "text", disabled }: { label: string; value: string; onChange?: (v: string) => void; type?: string; disabled?: boolean }) => (
  <label className="mb-4 block">
    <span className="mb-1.5 block text-sm text-ink-muted">{label}</span>
    <input type={type} value={value} disabled={disabled} onChange={(e) => onChange?.(e.target.value)}
      className="h-14 w-full rounded-xl border border-line bg-white px-4 text-[16px] outline-none focus:border-brand disabled:bg-bg disabled:text-ink-muted" />
  </label>
);

export function Payments() {
  const { invoices } = useStore();
  const [paying, setPaying] = useState<Invoice | null>(null);
  return (
    <Screen tabs={false}>
      <BackBar title="Payments" />
      {invoices.length ? (
        <Card className="divide-y divide-line">
          {invoices.map((i) => (
            <div key={i.id} className="flex min-h-[64px] items-center gap-3 px-4 py-3">
              <FileText className="h-5 w-5 text-ink-muted" />
              <div className="flex-1"><p className="font-medium">{i.id}</p><p className="text-xs text-ink-muted">{day(i.paidAt || i.issued)}</p></div>
              <div className="text-right">
                <p className="font-bold"><Dirham /> {money(i.amount)}</p>
                {i.status === "paid" ? <span className="inline-flex items-center gap-1 text-xs text-brand"><CheckCircle2 className="h-3.5 w-3.5" /> Paid</span>
                  : <button onClick={() => setPaying(i)} className="text-xs font-semibold text-danger underline">Pay now</button>}
              </div>
            </div>
          ))}
        </Card>
      ) : <Empty icon={<FileText />} title="No payments yet" />}
      {paying && <PayInvoiceSheet invoice={paying} open onClose={() => setPaying(null)} />}
    </Screen>
  );
}

// ponytail: upload is UI-only until a customer documents bucket + table exist (TASKS §2).
export function Documents() {
  const [done, setDone] = useState<Record<string, string>>({});
  const docs = [["emirates_id", "Emirates ID or passport"], ["licence", "Driving licence"], ["visa", "Visa page (tourists)"]];
  return (
    <Screen tabs={false}>
      <BackBar title="Documents" />
      <p className="mb-4 text-ink-muted">Upload once. We need these before your first pickup.</p>
      <Card className="divide-y divide-line">
        {docs.map(([id, label]) => (
          <label key={id} className="flex min-h-[64px] cursor-pointer items-center gap-3 px-4 py-3">
            <IdCard className="h-5 w-5" />
            <span className="flex-1"><span className="block font-medium">{label}</span><span className="text-xs text-ink-muted">{done[id] || "Photo or PDF"}</span></span>
            {done[id] ? <CheckCircle2 className="h-6 w-6 text-brand" /> : <Upload className="h-5 w-5 text-brand" />}
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && setDone({ ...done, [id]: e.target.files[0].name })} />
          </label>
        ))}
      </Card>
    </Screen>
  );
}

export function Security() {
  const { user } = useStore();
  return (
    <Screen tabs={false}>
      <BackBar title="Security" />
      <ListGroup>
        <ListRow icon={<Smartphone className="h-5 w-5" />} label="Sign-in number" value={user!.phone} />
      </ListGroup>
      <p className="px-1 text-sm text-ink-muted">You sign in with a one-time code sent to this number. To change it, contact support.</p>
    </Screen>
  );
}

export function Notifications() {
  const [on, setOn] = useState({ bookings: true, invoices: true, offers: false });
  const rows: [keyof typeof on, string][] = [["bookings", "Booking reminders"], ["invoices", "Invoices & payments"], ["offers", "Offers & benefits"]];
  return (
    <Screen tabs={false}>
      <BackBar title="Notifications" />
      <Card className="divide-y divide-line">
        {rows.map(([k, label]) => (
          <button key={k} onClick={() => setOn({ ...on, [k]: !on[k] })} className="flex h-16 w-full items-center justify-between px-4 text-left">
            <span className="font-medium">{label}</span>
            <span className={`flex h-7 w-12 items-center rounded-full p-0.5 transition ${on[k] ? "bg-brand" : "bg-line"}`}><span className={`h-6 w-6 rounded-full bg-white shadow transition ${on[k] ? "translate-x-5" : ""}`} /></span>
          </button>
        ))}
      </Card>
    </Screen>
  );
}

// ponytail: only English UI exists; Arabic needs translations + RTL pass.
export function Language() {
  return (
    <Screen tabs={false}>
      <BackBar title="Language" />
      <Card className="divide-y divide-line">
        <div className="flex h-16 items-center justify-between px-4"><span className="font-medium">English</span><CheckCircle2 className="h-5 w-5 text-brand" /></div>
        <div className="flex h-16 items-center justify-between px-4 text-ink-faint"><span className="font-medium">العربية</span><span className="text-xs">Coming soon</span></div>
      </Card>
    </Screen>
  );
}

export function Legal() {
  return (
    <Screen tabs={false}>
      <BackBar title="Support & legal" />
      <ListGroup>
        <ListRow label="Chat with Drivex AI" to="/support" />
        <ListRow label="WhatsApp us" onClick={() => window.open(whatsappLink())} />
        <ListRow label="Terms & conditions" onClick={() => window.open("https://drivex.ae")} />
        <ListRow label="Privacy policy" onClick={() => window.open("https://drivex.ae")} />
      </ListGroup>
    </Screen>
  );
}

export function Other() {
  return (
    <Screen tabs={false}>
      <BackBar title="Other" />
      <ListGroup>
        <ListRow label="App version" value="0.1.0" />
        <ListRow label="Install app" value={<ChevronRight className="hidden" />} onClick={() => alert("Tap Share → Add to Home Screen (iPhone) or the browser menu → Install app (Android).")} />
      </ListGroup>
    </Screen>
  );
}
