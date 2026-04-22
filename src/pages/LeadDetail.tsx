import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { LEAD_STATUSES, CHATBOT_STAGES } from '@/lib/constants';
import { ArrowLeft } from 'lucide-react';
import { calculateDynamicProgress } from '@/lib/leadProgress';
import { cn } from '@/lib/utils';

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [lead, setLead] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [convState, setConvState] = useState<any>(null);
  const [reservations, setReservations] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);

  const load = async () => {
    if (!id) return;
    const [l, m, c, r, d] = await Promise.all([
      supabase.from('leads').select('*').eq('id', id).single(),
      supabase.from('messages').select('*').eq('lead_id', id).order('created_at', { ascending: false }).limit(20),
      supabase.from('conversation_states').select('*').eq('lead_id', id).maybeSingle(),
      supabase.from('reservations').select('*, vehicles(plate_number, make, model)').eq('lead_id', id),
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
    await supabase.from('leads').update(updates).eq('id', id);
    toast({ title: 'Lead updated' });
    load();
  };

  if (!lead) return <div className="p-8 text-muted-foreground">Loading…</div>;

  const { p } = calculateDynamicProgress({ conversation_states: convState, ...lead });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/leads')}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-semibold">{lead.full_name || lead.whatsapp_number}</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Customer Info</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><strong>WhatsApp:</strong> {lead.whatsapp_number}</p>
            <p><strong>Source:</strong> {lead.source || '—'}</p>
            <p><strong>First seen:</strong> {new Date(lead.first_seen_at).toLocaleString()}</p>
            <div className="flex items-center gap-2">
              <strong>Status:</strong>
              <Select value={lead.status} onValueChange={v => updateLead({ status: v })}>
                <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{LEAD_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <strong>Stage:</strong>
              <div className="flex items-center gap-3">
                <Select value={lead.current_stage} onValueChange={v => updateLead({ current_stage: v })}>
                  <SelectTrigger className="w-48 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{CHATBOT_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                {p >= 100 && (
                  <span className="text-emerald-600 font-extrabold text-xl animate-pulse tracking-tighter">
                    WAITING FOR CALL
                  </span>
                )}
              </div>
            </div>
            <Button size="sm" variant="destructive" onClick={() => updateLead({ status: 'handed_to_human', current_stage: 'human_handoff' })}>
              Mark Handoff
            </Button>
          </CardContent>
        </Card>

        {convState && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Conversation State</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><strong>Stage:</strong> {convState.current_stage}</p>
              <p><strong>Intent:</strong> {convState.last_intent || '—'}</p>
              <p><strong>Handoff:</strong> {convState.handoff_needed ? 'Yes' : 'No'}</p>
              {convState.ai_summary && <p><strong>Summary:</strong> {convState.ai_summary}</p>}
              {convState.collected_fields && <pre className="bg-muted p-2 rounded text-xs overflow-auto">{JSON.stringify(convState.collected_fields, null, 2)}</pre>}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={lead.notes || ''} onChange={e => setLead({ ...lead, notes: e.target.value })} rows={3} />
          <Button size="sm" className="mt-2" onClick={() => updateLead({ notes: lead.notes })}>Save Notes</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Recent Messages ({messages.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-80 overflow-y-auto">
          {messages.map(m => (
            <div key={m.id} className={`p-2 rounded text-sm ${m.direction === 'inbound' ? 'bg-muted' : 'bg-primary/10'}`}>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{m.direction}</span>
                <span>{new Date(m.created_at).toLocaleString()}</span>
              </div>
              {m.message_text}
            </div>
          ))}
          {messages.length === 0 && <p className="text-muted-foreground text-sm">No messages yet</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Reservations ({reservations.length})</CardTitle></CardHeader>
        <CardContent>
          {reservations.map(r => (
            <div key={r.id} className="flex justify-between items-center border-b py-2 text-sm">
              <div>
                <Badge variant="outline">{r.status}</Badge>
                <span className="ml-2">{(r.vehicles as any)?.plate_number} — {(r.vehicles as any)?.make} {(r.vehicles as any)?.model}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(r.start_datetime).toLocaleDateString()} – {new Date(r.end_datetime).toLocaleDateString()}
              </span>
            </div>
          ))}
          {reservations.length === 0 && <p className="text-muted-foreground text-sm">No reservations</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Documents ({documents.length})</CardTitle></CardHeader>
        <CardContent>
          {documents.map(d => (
            <div key={d.id} className="flex justify-between items-center border-b py-2 text-sm">
              <div>
                <Badge variant="outline">{d.document_type}</Badge>
                <span className="ml-2">{d.file_name}</span>
              </div>
              <Badge variant={d.verification_status === 'approved' ? 'default' : 'secondary'}>{d.verification_status}</Badge>
            </div>
          ))}
          {documents.length === 0 && <p className="text-muted-foreground text-sm">No documents</p>}
        </CardContent>
      </Card>
    </div>
  );
}
