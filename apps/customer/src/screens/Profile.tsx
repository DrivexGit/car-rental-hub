import { useNavigate } from "react-router-dom";
import { Bell, CreditCard, FileText, Globe, Headphones, LogOut, Pencil, Settings2, ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, ListGroup, ListRow, Logo, PageTitle, Screen } from "@/components/ui";
import { Link } from "react-router-dom";

export default function Profile() {
  const { user, signOut } = useStore();
  const nav = useNavigate();
  const initials = user!.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <Screen>
      <div className="flex items-center justify-between pb-4 pt-3">
        <Logo />
        <Link to="/support" className="inline-flex items-center gap-1.5 text-sm font-medium"><Headphones className="h-5 w-5" /> Support</Link>
      </div>
      <PageTitle title="My profile" />

      <Card className="mb-6 flex items-center gap-4 p-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-brand text-xl font-bold text-white">{initials}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{user!.name}</p>
          <p className="truncate text-sm text-ink-muted">{user!.email || user!.phone}</p>
        </div>
        <button onClick={() => nav("/profile/edit")} className="grid h-11 w-11 place-items-center rounded-full border border-line" aria-label="Edit profile"><Pencil className="h-5 w-5" /></button>
      </Card>

      <ListGroup title="Account">
        <ListRow icon={<CreditCard className="h-5 w-5" />} label="Payments" to="/profile/payments" />
        <ListRow icon={<ShieldCheck className="h-5 w-5" />} label="Security" to="/profile/security" />
        <ListRow icon={<FileText className="h-5 w-5" />} label="Documents" to="/profile/documents" />
      </ListGroup>
      <ListGroup title="Preferences & support">
        <ListRow icon={<Bell className="h-5 w-5" />} label="Notifications" to="/profile/notifications" />
        <ListRow icon={<Globe className="h-5 w-5" />} label="Change language" value="English" to="/profile/language" />
        <ListRow icon={<Headphones className="h-5 w-5" />} label="Support & legal" to="/profile/legal" />
        <ListRow icon={<Settings2 className="h-5 w-5" />} label="Other" to="/profile/other" />
      </ListGroup>
      <ListGroup>
        <ListRow danger icon={<LogOut className="h-5 w-5" />} label="Log out" onClick={() => { signOut(); nav("/"); }} />
      </ListGroup>
    </Screen>
  );
}
