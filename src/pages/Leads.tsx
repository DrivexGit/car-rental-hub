import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LEAD_STATUSES, CHATBOT_STAGES } from '@/lib/constants';
import { 
  MessageSquare, Calendar, Milestone, MessageCircle, Send, 
  Car, Clock, MapPin, User, Phone, Languages 
} from 'lucide-react';

const calculateDynamicProgress = (lead: any) => {
  const state = lead.conversation_states;
  const rawFields = Array.isArray(state) ? state[0]?.collected_fields : state?.collected_fields;
  let fields: any = {};
  
  try {
    fields = typeof rawFields === 'string' ? JSON.parse(rawFields) : (rawFields || {});
  } catch (e) {
    fields = {};
  }

  let p = 0;
  
  // 1. Car (18%)
  if (fields.car) p += 18;
  
  // 2. Date (12%)
  if (fields.date) p += 12;
  
  // 3. Duration (8%)
  if (fields.duration) p += 8;
  
  // 4. Pickup Location (12%)
  if (fields.pickup_location) p += 12;
  
  // 5. Dropoff Location (8%)
  if (fields.dropoff_location) p += 8;
  
  // 6. Name (10%)
  if (lead.full_name || fields.name) p += 10;
  
  // 7. Phone (10%)
  if (lead.whatsapp_number || fields.phone) p += 10;
  
  // 8. License Upload (10%)
  // Associated with stages after collect_documents_info
  const licenseStages = ['reservation_draft_ready', 'reservation_confirmed', 'human_handoff', 'closed'];
  if (licenseStages.includes(lead.current_stage)) p += 10;
  
  // 9. Confirmation (12%)
  const confirmationStages = ['reservation_confirmed', 'human_handoff', 'closed'];
  if (confirmationStages.includes(lead.current_stage)) p += 12;

  // Determine color based on progress
  let c = 'bg-slate-400';
  if (p > 90) c = 'bg-emerald-500';
  else if (p > 70) c = 'bg-green-500';
  else if (p > 50) c = 'bg-blue-500';
  else if (p > 30) c = 'bg-indigo-500';
  else if (p > 10) c = 'bg-slate-500';

  return { p: Math.min(p, 100), c };
};

export default function Leads() {
  const [leads, setLeads] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      let q = supabase
        .from('leads')
        .select(`
          *,
          messages(message_text, created_at),
          conversation_states(collected_fields)
        `)
        .order('updated_at', { ascending: false });
      
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      if (stageFilter !== 'all') q = q.eq('current_stage', stageFilter);
      
      const { data } = await q;
      
      // Post-process to get the single latest message for each lead
      // This is more reliable than complex Supabase join limits for large lists
      const processed = (data || []).map(l => {
        const sortedMsgs = (l.messages || []).sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        return {
          ...l,
          latest_msg: sortedMsgs[0] || null,
          message_count: l.messages?.length || 0
        };
      });
      
      setLeads(processed);
    };
    load();
  }, [statusFilter, stageFilter]);

  const filtered = leads.filter(l =>
    (l.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.whatsapp_number || '').includes(search)
  );

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatRelativeTime = (date: string | null) => {
    if (!date) return '—';
    const now = new Date();
    const then = new Date(date);
    const diffInMs = now.getTime() - then.getTime();
    const diffInMins = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMins < 1) return 'Just now';
    if (diffInMins < 60) return `${diffInMins} mins ago`;
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    if (diffInDays <= 3) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    
    return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads & CRM</h1>
          <p className="text-muted-foreground">Manage your incoming leads and track their conversion progress.</p>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap items-center bg-muted/40 p-4 rounded-lg border">
        <div className="flex-1 min-w-[200px]">
          <Input 
            placeholder="Search leads..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {LEAD_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Stage" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {CHATBOT_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 border-b">
              <TableHead className="py-3 px-6 text-xs uppercase tracking-wider font-semibold text-muted-foreground">Lead & Channel</TableHead>
              <TableHead className="py-3 px-6 text-xs uppercase tracking-wider font-semibold text-muted-foreground text-center w-[120px]">Messages</TableHead>
              <TableHead className="py-3 px-6 text-xs uppercase tracking-wider font-semibold text-muted-foreground w-[150px]">Path</TableHead>
              <TableHead className="py-3 px-6 text-xs uppercase tracking-wider font-semibold text-muted-foreground">Collected Data</TableHead>
              <TableHead className="py-3 px-6 text-xs uppercase tracking-wider font-semibold text-muted-foreground text-center">Status</TableHead>
              <TableHead className="py-3 px-6 text-xs uppercase tracking-wider font-semibold text-muted-foreground">First Msg</TableHead>
              <TableHead className="py-3 px-6 text-xs uppercase tracking-wider font-semibold text-muted-foreground text-right">Last Msg</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(l => {
              const { p, c } = calculateDynamicProgress(l);
              const messageCount = l.messages?.[0]?.count || 0;
              
              return (
                <TableRow 
                  key={l.id} 
                  className="group cursor-pointer hover:bg-muted/20 transition-all border-b last:border-0" 
                  onClick={() => navigate(`/leads/${l.id}`)}
                >
                  <TableCell className="py-4 px-6">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "mt-1 p-1.5 rounded-full",
                        l.primary_channel === 'telegram' ? "bg-sky-50 text-sky-500" : "bg-emerald-50 text-emerald-500"
                      )}>
                        {l.primary_channel === 'telegram' ? <Send className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
                      </div>
                      <div className="flex flex-col space-y-0.5">
                        <span className="font-bold text-base group-hover:text-primary transition-colors leading-tight">
                          {l.full_name || 'Anonymous Lead'}
                        </span>
                        <span className="text-[10px] font-medium text-muted-foreground tracking-tight">
                          {l.whatsapp_number || 'No contact info'}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell className="py-4 px-6 text-center">
                    <Badge variant="secondary" className="font-mono font-bold text-xs px-2 py-0">
                      {l.message_count}
                    </Badge>
                  </TableCell>

                  <TableCell className="py-4 px-6">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-end">
                        <span className="text-[9px] font-bold uppercase text-muted-foreground leading-none truncate max-w-[120px]">
                          {l.current_stage.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[9px] font-black leading-none">{p}%</span>
                      </div>
                      <Progress value={p} className="h-1" indicatorClassName={cn(c, "opacity-90")} />
                    </div>
                  </TableCell>

                  <TableCell className="py-4 px-6">
                    <div className="flex flex-wrap gap-1 max-w-[250px]">
                      {(() => {
                        try {
                          const state = l.conversation_states;
                          const rawFields = Array.isArray(state) ? state[0]?.collected_fields : state?.collected_fields;
                          if (!rawFields) return <span className="text-[10px] text-muted-foreground italic">No data</span>;
                          
                          const fields = typeof rawFields === 'string' ? JSON.parse(rawFields) : rawFields;
                          const entries = Object.entries(fields).filter(([_, v]) => v !== null && v !== '');
                          
                          if (entries.length === 0) return <span className="text-[10px] text-muted-foreground italic">No data</span>;
                          
                          const getIcon = (key: string) => {
                            switch (key) {
                              case 'car': return <Car className="h-3 w-3" />;
                              case 'date': return <Calendar className="h-3 w-3" />;
                              case 'duration': return <Clock className="h-3 w-3" />;
                              case 'pickup_location':
                              case 'dropoff_location': return <MapPin className="h-3 w-3" />;
                              case 'name': return <User className="h-3 w-3" />;
                              case 'phone': return <Phone className="h-3 w-3" />;
                              case 'language': return <Languages className="h-3 w-3" />;
                              default: return null;
                            }
                          };

                          return entries.map(([k, v]) => (
                            <Badge key={k} variant="outline" className="text-[11px] font-semibold px-2 py-0.5 bg-muted/30 border-muted-foreground/20 text-foreground flex items-center gap-1.5 h-6">
                              {getIcon(k)}
                              <span>{String(v)}</span>
                            </Badge>
                          ));
                        } catch (e) {
                          return <span className="text-[10px] text-rose-500 italic">Error parsing</span>;
                        }
                      })()}
                    </div>
                  </TableCell>

                  <TableCell className="py-4 px-6 text-center">
                    <Badge variant="outline" className={cn(
                      "text-[9px] font-bold uppercase tracking-widest px-2 py-0 border-2",
                      l.status === 'new' ? "border-primary/20 text-primary bg-primary/5" : 
                      l.status === 'closed' ? "border-muted text-muted-foreground" : 
                      "border-orange-200 text-orange-700 bg-orange-50"
                    )}>
                      {l.status.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>

                  <TableCell className="py-4 px-6">
                    <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                      {formatDate(l.first_seen_at)}
                    </span>
                  </TableCell>

                  <TableCell className="py-4 px-6 text-right">
                    <span className="text-[11px] font-bold text-foreground whitespace-nowrap">
                      {formatRelativeTime(l.last_message_at || l.latest_msg?.created_at)}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-32 text-center">
                  <div className="flex flex-col items-center justify-center space-y-3 grayscale opacity-40">
                    <MessageSquare className="h-12 w-12" />
                    <p className="text-sm font-semibold italic">Zero leads available for current filters</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
