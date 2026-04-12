import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Car, Users, Calendar, FileText, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalVehicles: 0, availableVehicles: 0, bookedVehicles: 0,
    totalLeads: 0, inProgressLeads: 0, openReservations: 0, pendingDocs: 0
  });

  useEffect(() => {
    const load = async () => {
      const [vehicles, leads, reservations, docs] = await Promise.all([
        supabase.from('vehicles').select('status'),
        supabase.from('leads').select('status'),
        supabase.from('reservations').select('status'),
        supabase.from('customer_documents').select('verification_status'),
      ]);
      const v = vehicles.data || [];
      const l = leads.data || [];
      const r = reservations.data || [];
      const d = docs.data || [];
      setStats({
        totalVehicles: v.length,
        availableVehicles: v.filter(x => x.status === 'available').length,
        bookedVehicles: v.filter(x => x.status !== 'available').length,
        totalLeads: l.length,
        inProgressLeads: l.filter(x => x.status === 'in_progress').length,
        openReservations: r.filter(x => ['draft','pending','confirmed'].includes(x.status)).length,
        pendingDocs: d.filter(x => x.verification_status === 'pending').length,
      });
    };
    load();
  }, []);

  const cards = [
    { label: 'Total Fleet', value: stats.totalVehicles, icon: Car, color: 'from-blue-500/10 to-blue-600/5', iconColor: 'text-blue-600', borderColor: 'border-blue-200' },
    { label: 'Available', value: stats.availableVehicles, icon: CheckCircle2, color: 'from-emerald-500/10 to-emerald-600/5', iconColor: 'text-emerald-600', borderColor: 'border-emerald-200' },
    { label: 'Booked / Busy', value: stats.bookedVehicles, icon: AlertCircle, color: 'from-amber-500/10 to-amber-600/5', iconColor: 'text-amber-600', borderColor: 'border-amber-200' },
    { label: 'Total Leads', value: stats.totalLeads, icon: Users, color: 'from-violet-500/10 to-violet-600/5', iconColor: 'text-violet-600', borderColor: 'border-violet-200' },
    { label: 'In Progress', value: stats.inProgressLeads, icon: TrendingUp, color: 'from-cyan-500/10 to-cyan-600/5', iconColor: 'text-cyan-600', borderColor: 'border-cyan-200' },
    { label: 'Open Reservations', value: stats.openReservations, icon: Calendar, color: 'from-indigo-500/10 to-indigo-600/5', iconColor: 'text-indigo-600', borderColor: 'border-indigo-200' },
    { label: 'Pending Docs', value: stats.pendingDocs, icon: FileText, color: 'from-rose-500/10 to-rose-600/5', iconColor: 'text-rose-600', borderColor: 'border-rose-200' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Dashboard</h1>
      <p className="text-sm text-muted-foreground mb-6">Overview of your fleet and operations</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(c => (
          <Card key={c.label} className={`border ${c.borderColor} bg-gradient-to-br ${c.color} shadow-sm hover:shadow-md transition-shadow`}>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{c.label}</span>
                <div className={`p-2 rounded-lg bg-background/60 ${c.iconColor}`}>
                  <c.icon className="h-4 w-4" />
                </div>
              </div>
              <div className="text-3xl font-bold tracking-tight">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
