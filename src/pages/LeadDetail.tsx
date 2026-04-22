import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { LEAD_STATUSES, CHATBOT_STAGES } from '@/lib/constants';
import { 
  ArrowLeft, MessageCircle, Calendar, Car, Clock, MapPin, 
  User, Phone, Languages, Paperclip, ChevronRight, 
  ExternalLink, CheckCircle2, AlertCircle, Sparkles,
  MoreVertical, Send, Info, History, FileText
} from 'lucide-react';
import { calculateDynamicProgress } from '@/lib/leadProgress';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [lead, setLead] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [convState, setConvState] = useState<any>(null);
  const [reservations, setReservations] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('chat');

  const load = async () => {
    if (!id) return;
    const [l, m, c, r, d] = await Promise.all([
      supabase.from('leads').select('*').eq('id', id).single(),
      supabase.from('messages').select('*').eq('lead_id', id).order('created_at', { ascending: true }),
      supabase.from('conversation_states').select('*').eq('lead_id', id).maybeSingle(),
      supabase.from('reservations').select('*, vehicles(plate_number, make, model, image_url)').eq('lead_id', id),
      supabase.from('customer_documents').select('*').eq('lead_id', id),
    ]);
    setLead(l.data);
    setMessages(m.data || []);
    setConvState(c.data);
    setReservations(r.data || []);
    setDocuments(d.data || []);
  };

  useEffect(() => { load(); }, [id]);

  const updateLead = async (updates: any) => {
    const { error } = await supabase.from('leads').update(updates).eq('id', id);
    if (error) {
      toast({ title: 'Update failed', variant: 'destructive' });
      return;
    }
    toast({ title: 'Lead updated successfully' });
    load();
  };

  if (!lead) return (
    <div className="flex h-[400px] items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-2">
        <div className="h-12 w-12 bg-muted rounded-full"></div>
        <div className="h-4 w-32 bg-muted rounded"></div>
      </div>
    </div>
  );

  const { p, c } = calculateDynamicProgress({ conversation_states: convState, ...lead });

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'L';
  };

  const getBookingFields = () => {
    if (!convState?.collected_fields) return [];
    const fields = typeof convState.collected_fields === 'string' 
      ? JSON.parse(convState.collected_fields) 
      : convState.collected_fields;
    
    const flattened: any = {};
    if (fields.user) Object.entries(fields.user).forEach(([k, v]) => { if (v) flattened[k] = v; });
    if (fields.booking) Object.entries(fields.booking).forEach(([k, v]) => { if (v) flattened[k] = v; });
    Object.entries(fields).forEach(([k, v]) => {
      if (k !== 'user' && k !== 'booking' && v && typeof v !== 'object') flattened[k] = v;
    });

    return Object.entries(flattened).filter(([_, v]) => v !== null && v !== '' && v !== false);
  };

  const getIcon = (key: string) => {
    switch (key) {
      case 'car': return <Car className="h-4 w-4" />;
      case 'date': return <Calendar className="h-4 w-4" />;
      case 'duration': return <Clock className="h-4 w-4" />;
      case 'pickup_location':
      case 'dropoff_location': return <MapPin className="h-4 w-4" />;
      case 'name': return <User className="h-4 w-4" />;
      case 'phone': return <Phone className="h-4 w-4" />;
      case 'language': return <Languages className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-12">
      {/* Back Button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/leads')} className="hover:bg-muted">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>

      {/* Header Section */}
      <div className="bg-card rounded-2xl border shadow-sm overflow-hidden flex flex-col md:flex-row items-center gap-6 p-6">
        <div className="relative">
          <Avatar className="h-24 w-24 border-4 border-muted shadow-xl">
            <AvatarImage src="" />
            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-3xl font-bold">
              {getInitials(lead.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className={cn(
            "absolute -bottom-1 -right-1 h-6 w-6 rounded-full border-2 border-box flex items-center justify-center",
            lead.status === 'new' ? "bg-blue-500" : "bg-emerald-500"
          )}>
            <div className="h-2 w-2 rounded-full bg-white animate-ping"></div>
          </div>
        </div>

        <div className="flex-1 space-y-1 text-center md:text-left">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight">{lead.full_name || 'Anonymous Lead'}</h1>
            <Badge variant="secondary" className="w-fit mx-auto md:mx-0 bg-violet-50 text-violet-700 border-violet-100 px-3 capitalize">
              {lead.source || 'Direct Channel'}
            </Badge>
          </div>
          <div className="flex flex-wrap justify-center md:justify-start items-center gap-4 text-sm text-muted-foreground font-medium">
            <a href={`https://wa.me/${lead.whatsapp_number}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-emerald-600 transition-colors">
              <MessageCircle className="h-4 w-4" />
              {lead.whatsapp_number}
              <ExternalLink className="h-3 w-3" />
            </a>
            <span className="flex items-center gap-1.5 border-l pl-4">
              <History className="h-4 w-4" />
              First seen {new Date(lead.first_seen_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="w-full md:w-64 space-y-3 p-4 bg-muted/40 rounded-xl border border-muted-foreground/10">
          <div className="flex justify-between items-end mb-1">
            <span className="text-[10px] font-black uppercase text-muted-foreground">Lead Quality</span>
            <span className="text-sm font-black text-foreground">{p}%</span>
          </div>
          <Progress value={p} className="h-3" indicatorClassName={cn(c)} />
          <div className="text-[10px] text-center text-muted-foreground font-bold italic">
            {p < 50 ? "Low Data Collection" : p < 90 ? "Strong Interest" : "Ready for Handoff"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          {/* Status Controls */}
          <Card className="border-none shadow-md shadow-violet-100 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-violet-500 to-indigo-500"></div>
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-500" />
                Pipeline Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black text-muted-foreground px-1">Global Status</label>
                <Select value={lead.status} onValueChange={v => updateLead({ status: v })}>
                  <SelectTrigger className="w-full bg-muted/30 border-muted font-bold text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map(s => <SelectItem key={s} value={s} className="font-bold">{s.replace(/_/g, ' ').toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] uppercase font-black text-muted-foreground">Current Stage</label>
                  {p >= 100 && <Badge className="bg-emerald-500 animate-pulse text-[8px] h-4">PRIORITY</Badge>}
                </div>
                <div className="flex flex-col gap-3">
                  <Select value={lead.current_stage} onValueChange={v => updateLead({ current_stage: v })}>
                    <SelectTrigger className="w-full bg-muted/30 border-muted font-bold text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHATBOT_STAGES.map(s => <SelectItem key={s} value={s} className="font-bold">{s.replace(/_/g, ' ').toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  
                  {p >= 100 && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center animate-pulse">
                      <span className="text-emerald-700 font-extrabold text-lg tracking-tighter block leading-none">WAITING FOR CALL</span>
                      <span className="text-[10px] text-emerald-600/70 font-bold uppercase mt-1.5 block">Customer is ready to book</span>
                    </div>
                  )}
                </div>
              </div>
              
              <Button 
                variant="destructive" 
                className="w-full font-black text-xs h-11 tracking-widest shadow-lg shadow-rose-100"
                onClick={() => updateLead({ status: 'handed_to_human', current_stage: 'human_handoff' })}
              >
                MARK HUMAN HANDOFF
              </Button>
            </CardContent>
          </Card>

          {/* Booking Summary Card */}
          <Card className="border-none shadow-md overflow-hidden">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Car className="h-4 w-4" />
                Robot Collected Info
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {getBookingFields().length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {getBookingFields().map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/10 hover:bg-muted/20 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-white border border-muted shadow-sm text-muted-foreground group-hover:text-primary transition-colors">
                          {getIcon(k)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black uppercase text-muted-foreground leading-none">{k.replace(/_/g, ' ')}</span>
                          <span className="text-xs font-bold mt-1 text-foreground">{String(v)}</span>
                        </div>
                      </div>
                      {k === 'confirmed' && v === true && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground opacity-50 grayscale">
                  <Info className="h-8 w-8 mb-2" />
                  <p className="text-[10px] font-bold uppercase">No data collected yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Area */}
        <div className="lg:col-span-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full grid grid-cols-4 h-14 p-1.5 bg-muted/50 rounded-xl border border-muted mb-6">
              <TabsTrigger value="chat" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-tight">
                <MessageCircle className="h-4 w-4 mr-2" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="documents" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-tight">
                <Paperclip className="h-4 w-4 mr-2" />
                Docs
              </TabsTrigger>
              <TabsTrigger value="reservations" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-tight">
                <Calendar className="h-4 w-4 mr-2" />
                Bookings
              </TabsTrigger>
              <TabsTrigger value="notes" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-tight">
                <FileText className="h-4 w-4 mr-2" />
                Notes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="mt-0 outline-none">
              <Card className="border-none shadow-md rounded-2xl overflow-hidden min-h-[500px] flex flex-col">
                <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-black">Conversation History</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase">AI Chatbot log</CardDescription>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px] border-muted-foreground/20">{messages.length}</Badge>
                </CardHeader>
                <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
                  <ScrollArea className="h-[450px] p-6">
                    <div className="space-y-6">
                      {messages.map((m, idx) => {
                        const date = new Date(m.created_at);
                        const isToday = new Date().toDateString() === date.toDateString();
                        
                        return (
                          <div key={m.id} className={cn(
                            "flex w-full",
                            m.direction === 'inbound' ? "justify-start" : "justify-end"
                          )}>
                            <div className={cn(
                              "max-w-[85%] sm:max-w-[70%]",
                              m.direction === 'inbound' ? "items-start" : "items-end flex flex-col text-right"
                            )}>
                              <div className={cn(
                                "flex items-center gap-2 mb-1.5 px-2",
                                m.direction === 'inbound' ? "" : "flex-row-reverse"
                              )}>
                                <span className="text-[10px] font-black uppercase text-muted-foreground/80">
                                  {m.direction === 'inbound' ? (lead.full_name || 'Lead') : 'Robot'}
                                </span>
                                <span className="text-[9px] font-bold text-muted-foreground/40">
                                  {isToday ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div className={cn(
                                "p-4 rounded-2xl text-[13px] font-medium leading-relaxed shadow-sm",
                                m.direction === 'inbound' 
                                  ? "bg-muted text-foreground rounded-tl-none border border-muted" 
                                  : "bg-indigo-600 text-white rounded-tr-none shadow-indigo-100"
                              )}>
                                {m.message_text}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 opacity-20">
                          <MessageCircle className="h-12 w-12 mb-4" />
                          <p className="text-sm font-black uppercase tracking-widest">No activity</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                  
                  <div className="p-4 bg-muted/20 border-t flex gap-2">
                    <Textarea placeholder="Automation active. Type here to take over..." className="min-h-[44px] h-11 resize-none bg-card border-none shadow-inner text-xs py-3" disabled />
                    <Button size="icon" className="h-11 w-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-md" disabled>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="mt-0 outline-none">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {documents.map(d => (
                  <Card key={d.id} className="group overflow-hidden border-none shadow-md hover:shadow-lg transition-all">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-muted/50 border flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          <Paperclip className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase text-muted-foreground leading-none">{d.document_type.replace(/_/g, ' ')}</span>
                          <span className="text-sm font-black mt-1 line-clamp-1">{d.file_name}</span>
                        </div>
                      </div>
                      <Badge className={cn(
                        "text-[9px] font-black uppercase py-0 px-2 h-5 shrink-0",
                        d.verification_status === 'approved' ? "bg-emerald-500 hover:bg-emerald-600" : 
                        d.verification_status === 'rejected' ? "bg-rose-500 hover:bg-rose-600" : "bg-orange-500 text-white"
                      )}>
                        {d.verification_status || 'Pending'}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
                {documents.length === 0 && (
                  <div className="col-span-full py-20 flex flex-col items-center justify-center bg-card border-2 border-dashed rounded-2xl opacity-40">
                    <Paperclip className="h-12 w-12 mb-4" />
                    <p className="text-sm font-black uppercase">No files</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="reservations" className="mt-0 outline-none">
              <div className="space-y-4">
                {reservations.map(r => (
                  <Card key={r.id} className="overflow-hidden border-none shadow-md group">
                    <CardContent className="p-0 flex flex-col sm:flex-row">
                      <div className="w-full sm:w-48 h-32 bg-muted relative overflow-hidden shrink-0">
                        {(r.vehicles as any)?.image_url ? (
                          <img src={(r.vehicles as any).image_url} alt="Vehicle" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                            <Car className="h-10 w-10" />
                          </div>
                        )}
                        <Badge className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-[9px] uppercase border-none">
                          {r.status}
                        </Badge>
                      </div>
                      <div className="flex-1 p-5 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start">
                            <h3 className="font-extrabold text-xl leading-tight">{(r.vehicles as any)?.make} {(r.vehicles as any)?.model}</h3>
                          </div>
                          <div className="flex items-center gap-4 mt-3 text-xs font-bold text-muted-foreground">
                            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {new Date(r.start_datetime).toLocaleDateString()}</span>
                            <ChevronRight className="h-3 w-3 opacity-30" />
                            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {new Date(r.end_datetime).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {reservations.length === 0 && (
                  <div className="py-20 flex flex-col items-center justify-center bg-card border-2 border-dashed rounded-2xl opacity-40">
                    <Calendar className="h-12 w-12 mb-4" />
                    <p className="text-sm font-black uppercase">Zero History</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="notes" className="mt-0 outline-none">
              <Card className="border-none shadow-md overflow-hidden">
                <CardHeader className="bg-muted/30 border-b">
                  <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-violet-600">
                    <FileText className="h-4 w-4" />
                    Internal CRM Notes
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <Textarea 
                    value={lead.notes || ''} 
                    onChange={e => setLead({ ...lead, notes: e.target.value })} 
                    className="min-h-[250px] border-muted bg-muted/10 font-medium text-sm leading-relaxed focus-visible:ring-violet-500"
                    placeholder="Enter private notes about this lead..."
                  />
                  <div className="flex justify-end">
                    <Button 
                      className="bg-indigo-600 hover:bg-indigo-700 font-black px-10 shadow-lg shadow-indigo-100" 
                      onClick={() => updateLead({ notes: lead.notes })}
                    >
                      SAVE NOTES
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
