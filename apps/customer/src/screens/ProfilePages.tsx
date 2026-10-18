import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BellRing, Camera, CheckCircle2, ChevronRight, FileText, IdCard, Loader2, Smartphone, Upload } from "lucide-react";
import { enablePush, pushSupported } from "@/lib/push";
import { api, supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import { REQUIRED_DOCUMENTS } from "@/data/documents";
import { day, formatPhone, money } from "@/lib/format";
import { BackBar, Button, Card, Dirham, Empty, Face, ListGroup, ListRow, Screen, Sheet } from "@/components/ui";
import { compressSquare } from "@/lib/image";
import { PayInvoiceSheet } from "@/screens/PaySheet";
import { InvoiceDownload } from "@/components/InvoiceDownload";
import { whatsappLink } from "@/config";
import type { Invoice } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { LangSelect } from "@/components/LangSelect";

export function EditProfile() {
  const { t } = useI18n();
  const { user, updateUser } = useStore();
  const nav = useNavigate();
  const [name, setName] = useState(user!.name);
  const [email, setEmail] = useState(user!.email || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Screen tabs={false}>
      <BackBar title={t("Edit profile")} />
      <PhotoPicker />
      <Field label={t("Full name")} value={name} onChange={setName} />
      <Field label={t("Email")} value={email} onChange={setEmail} type="email" ltr />
      <Field label={t("Mobile number")} value={formatPhone(user!.phone)} disabled ltr />
      {error && <p className="mb-2 text-sm font-medium text-danger">{error}</p>}
      <Button size="lg" className="mt-4" disabled={name.trim().length < 2 || busy || !/^\S+@\S+\.\S+$/.test(email.trim())}
        onClick={async () => { setBusy(true); setError(""); try { await updateUser({ name: name.trim(), email: email.trim() }); nav(-1); } catch (e) { setError((e as Error).message); setBusy(false); } }}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t("Save")}
      </Button>
    </Screen>
  );
}

/** Tap the photo to pick one; it is cropped square and shrunk on the phone before upload. */
function PhotoPicker() {
  const { t } = useI18n();
  const { user, setAvatar } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(""); try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  return (
    <div className="mb-6 flex flex-col items-center">
      <button type="button" onClick={() => input.current?.click()} disabled={busy} aria-label={t("Change profile photo")} className="relative rounded-full disabled:opacity-60">
        <Face size={96} />
        <span className="absolute bottom-0 end-0 grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-brand text-white">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        </span>
      </button>
      <input ref={input} type="file" accept="image/*" hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) run(async () => setAvatar(await compressSquare(f))); }} />
      {user?.avatarUrl && <button type="button" disabled={busy} onClick={() => run(() => setAvatar(null))} className="mt-3 text-sm font-medium text-ink-muted underline">{t("Remove photo")}</button>}
      {error && <p className="mt-2 text-center text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}

const Field = ({ label, value, onChange, type = "text", disabled, ltr }: { label: string; value: string; onChange?: (v: string) => void; type?: string; disabled?: boolean; ltr?: boolean }) => (
  <label className="mb-4 block">
    <span className="mb-1.5 block text-sm text-ink-muted">{label}</span>
    <input type={type} value={value} disabled={disabled} dir={ltr ? "ltr" : undefined} onChange={(e) => onChange?.(e.target.value)}
      className="h-14 w-full rounded-xl border border-line bg-white px-4 text-[16px] outline-none focus:border-brand disabled:bg-bg disabled:text-ink-muted" />
  </label>
);

export function Payments() {
  const { t } = useI18n();
  const { invoices, fines } = useStore();
  const [paying, setPaying] = useState<Invoice | null>(null);
  return (
    <Screen tabs={false}>
      <BackBar title={t("Payments")} />
      {invoices.length ? (
        <Card className="divide-y divide-line">
          {invoices.map((i) => (
            <div key={i.id} className="flex min-h-[64px] items-center gap-3 px-4 py-3">
              <FileText className="h-5 w-5 text-ink-muted" />
              <div className="flex-1"><p className="font-medium">{i.number}</p><p className="text-xs text-ink-muted">{day(i.paidAt || i.issued)}</p></div>
              <InvoiceDownload invoice={i} />
              <div className="text-end">
                <p className="font-bold"><Dirham /> {money(i.amount)}</p>
                {i.status === "paid" ? <span className="inline-flex items-center gap-1 text-xs text-brand"><CheckCircle2 className="h-3.5 w-3.5" /> {t("Paid")}</span>
                  : <button onClick={() => setPaying(i)} className="text-xs font-semibold text-danger underline">{t("Pay now")}</button>}
              </div>
            </div>
          ))}
        </Card>
      ) : <Empty icon={<FileText />} title={t("No payments yet")} />}
      {!!fines.length && (
        <>
          <h2 className="mb-2 mt-6 font-semibold">{t("Salik & fines")}</h2>
          <Card className="divide-y divide-line">
            {fines.map((f) => (
              <div key={f.id} className="flex min-h-[56px] items-center gap-3 px-4 py-3">
                <div className="flex-1"><p className="font-medium">{f.title ? t(f.title) : t(f.type === "traffic" ? "Fine" : "Salik")}</p><p className="text-xs text-ink-muted">{f.place ? `${f.place} · ` : ""}{day(f.date)}</p></div>
                <p className="font-semibold"><Dirham /> {money(f.amount)}</p>
              </div>
            ))}
          </Card>
        </>
      )}
      {paying && <PayInvoiceSheet invoice={paying} open onClose={() => setPaying(null)} />}
    </Screen>
  );
}

const DOC_TYPES = [...REQUIRED_DOCUMENTS.map((d) => [d.id, d.label] as const), ["visa", "Visa page (tourists)"] as const] as const;

/** Uploads to the private customer-documents bucket ("<uid>/...") and registers the file for staff review. */
export function Documents() {
  const { t } = useI18n();
  const { user, documents, refresh } = useStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const upload = async (type: string, file: File) => {
    if (file.size > 10 * 1024 * 1024) { setError(t("File is too large (max 10 MB).")); return; }
    setBusy(type); setError("");
    const path = `${user!.id}/${type}-${Date.now()}.${file.name.split(".").pop()?.toLowerCase() || "jpg"}`;
    const up = await supabase.storage.from("customer-documents").upload(path, file, { contentType: file.type });
    if (up.error) { setError(up.error.message); setBusy(null); return; }
    const { data: me } = await supabase.from("customers").select("lead_id, tenant_id").eq("id", user!.id).single();
    const { data: row, error: e } = await supabase.from("customer_documents").insert({
      lead_id: me!.lead_id, tenant_id: me!.tenant_id, document_type: type, storage_bucket: "customer-documents", storage_path: path,
      file_name: file.name, mime_type: file.type, file_size: file.size, uploaded_by: "customer", verification_status: "pending",
    }).select("id").single();
    if (e) setError(e.message);
    // The AI check reads the picture and rejects it at once if it is unreadable, the wrong document or expired
    if (row) {
      const check = await api<{ status: string; reason?: string }>("doc-check", { documentId: row.id }).catch(() => null);
      if (check?.status === "rejected" && check.reason) setError(check.reason);
    }
    await refresh(); setBusy(null);
  };

  // Viewing an approved document needs a code sent to the phone (see api/doc-view.ts). The unlock lasts five minutes and is kept
  // in memory only, so it is gone when the page is closed. Uploading is never gated.
  const [unlock, setUnlock] = useState<{ token: string; expiresAt: number } | null>(null);
  const [viewing, setViewing] = useState<{ id: string; name: string } | null>(null);
  const [code, setCode] = useState("");
  const [viewBusy, setViewBusy] = useState(false);
  const [viewError, setViewError] = useState("");
  const openDocument = async (documentId: string, token: string) => {
    const win = window.open("", "_blank"); // opened first, so the browser does not block it after the wait
    try {
      const out = await api<{ url: string }>("doc-view", { action: "view", documentId, unlock: token });
      if (win) win.location.href = out.url; else window.open(out.url, "_blank");
      setViewing(null); setCode("");
    } catch (e) {
      win?.close();
      throw e;
    }
  };
  const view = async (d: { id: string; name: string }) => {
    setViewError(""); setCode(""); setViewBusy(true);
    try {
      if (unlock && unlock.expiresAt > Date.now()) { await openDocument(d.id, unlock.token); return; }
      setUnlock(null); setViewing(d);
      await api("doc-view", { action: "send" });
    } catch (e: any) {
      setUnlock(null); setViewError(t(e.message));
    } finally { setViewBusy(false); }
  };
  const checkCode = async () => {
    if (!viewing) return;
    setViewBusy(true); setViewError("");
    try {
      const u = await api<{ token: string; expiresAt: number }>("doc-view", { action: "unlock", code });
      setUnlock(u);
      await openDocument(viewing.id, u.token);
    } catch (e: any) {
      setViewError(t(e.message));
    } finally { setViewBusy(false); }
  };

  return (
    <Screen tabs={false}>
      <BackBar title={t("Documents")} />
      <p className="mb-4 text-ink-muted">{t("Upload once. We need these before your first pickup.")}</p>
      <Card className="divide-y divide-line">
        {DOC_TYPES.map(([id, label]) => {
          const doc = documents.find((d) => d.type === id);
          return (
            <div key={id} className="flex min-h-[64px] items-center gap-3 px-4 py-3">
              <label className="flex flex-1 cursor-pointer items-center gap-3">
                <IdCard className="h-5 w-5" />
                <span className="flex-1"><span className="block font-medium">{t(label)}</span>
                  <span className="text-xs text-ink-muted">{doc ? `${doc.fileName} · ${doc.status === "approved" ? t("Approved") : doc.status === "rejected" ? t("Rejected — upload again") : t("In review")}` : t("Photo or PDF")}</span></span>
                {busy === id ? <Loader2 className="h-5 w-5 animate-spin text-brand" /> : doc && doc.status !== "rejected" ? <CheckCircle2 className="h-6 w-6 text-brand" /> : <Upload className="h-5 w-5 text-brand" />}
                <input type="file" accept="image/*,application/pdf" className="hidden" disabled={!!busy} onChange={(e) => e.target.files?.[0] && upload(id, e.target.files[0])} />
              </label>
              {doc?.status === "approved" && (
                <button type="button" onClick={() => view({ id: doc.id, name: t(label) })} disabled={viewBusy} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-sm font-medium text-brand disabled:opacity-60">{t("View")}</button>
              )}
            </div>
          );
        })}
      </Card>
      <Sheet open={!!viewing} onClose={() => { setViewing(null); setCode(""); setViewError(""); }} title={viewing?.name ?? t("Documents")}>
        <p className="mb-3 text-sm text-ink-muted">{t("We sent a code to your WhatsApp. Enter it to open this document.")}</p>
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder={t("Enter the code")} className="h-12 w-full rounded-xl border border-line bg-white px-4 text-center text-xl tracking-[0.4em]" />
        {viewError && <p role="alert" className="mt-3 text-sm font-medium text-danger">{viewError}</p>}
        <Button onClick={checkCode} disabled={viewBusy || code.length !== 6} className="mt-4 w-full">{viewBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : t("Open document")}</Button>
      </Sheet>
      {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
    </Screen>
  );
}

export function Security() {
  const { t } = useI18n();
  const { user } = useStore();
  return (
    <Screen tabs={false}>
      <BackBar title={t("Security")} />
      <ListGroup>
        <ListRow icon={<Smartphone className="h-5 w-5" />} label={t("Sign-in number")} value={<span dir="ltr">{formatPhone(user!.phone)}</span>} />
      </ListGroup>
      <p className="px-1 text-sm text-ink-muted">{t("You sign in with a one-time code sent to this number. To change it, contact support.")}</p>
    </Screen>
  );
}

export function Notifications() {
  const { t } = useI18n();
  const { user, updateUser } = useStore();
  const [on, setOnState] = useState(user!.notify);
  const [perm, setPerm] = useState<string>(() => (pushSupported() ? Notification.permission : "unsupported"));
  const setOn = (n: typeof on) => { setOnState(n); updateUser({ notify: n }).catch(() => setOnState(user!.notify)); };
  const rows: [keyof typeof on, string][] = [["bookings", "Booking reminders"], ["invoices", "Invoices, Salik & fines"], ["offers", "Offers & benefits"]];
  return (
    <Screen tabs={false}>
      <BackBar title={t("Notifications")} />
      <Card className="mb-5 flex items-center gap-3 p-4">
        <BellRing className="h-6 w-6 text-brand" />
        <div className="flex-1">
          <p className="font-semibold">{t("Alerts on this phone")}</p>
          <p className="text-xs text-ink-muted">{perm === "granted" ? t("On") : perm === "denied" ? t("Blocked — allow notifications for Drivex in your phone settings") : perm === "unsupported" ? t("Install the app to get alerts (iPhone: Add to Home Screen)") : t("Off")}</p>
        </div>
        {perm === "default" && <Button size="sm" onClick={async () => setPerm(await enablePush())}>{t("Turn on")}</Button>}
      </Card>
      <Card className="divide-y divide-line">
        {rows.map(([k, label]) => (
          <button key={k} onClick={() => setOn({ ...on, [k]: !on[k] })} className="flex h-16 w-full items-center justify-between px-4 text-start">
            <span className="font-medium">{t(label)}</span>
            <span className={`flex h-7 w-12 items-center rounded-full p-0.5 transition ${on[k] ? "bg-brand" : "bg-line"}`}><span className={`h-6 w-6 rounded-full bg-white shadow transition ${on[k] ? "translate-x-5 rtl:-translate-x-5" : ""}`} /></span>
          </button>
        ))}
      </Card>
    </Screen>
  );
}

export function Language() {
  const { t } = useI18n();
  return (
    <Screen tabs={false}>
      <BackBar title={t("Language")} />
      <Card className="p-4">
        <LangSelect block />
      </Card>
    </Screen>
  );
}

export function Legal() {
  const { t } = useI18n();
  return (
    <Screen tabs={false}>
      <BackBar title={t("Support & legal")} />
      <ListGroup>
        <ListRow label={t("Chat with Drivex AI")} to="/support" />
        <ListRow label={t("WhatsApp us")} onClick={() => window.open(whatsappLink())} />
        <ListRow label={t("Terms & conditions")} to="/terms" />
        <ListRow label={t("Privacy policy")} to="/privacy" />
        <ListRow label={t("Delete my account")} to="/delete-account" />
      </ListGroup>
    </Screen>
  );
}

export function Other() {
  const { t } = useI18n();
  return (
    <Screen tabs={false}>
      <BackBar title={t("Other")} />
      <ListGroup>
        <ListRow label={t("App version")} value="1.0.0" />
        <ListRow label={t("Install app")} value={<ChevronRight className="hidden" />} onClick={() => alert(t("Tap Share → Add to Home Screen (iPhone) or the browser menu → Install app (Android)."))} />
      </ListGroup>
    </Screen>
  );
}
