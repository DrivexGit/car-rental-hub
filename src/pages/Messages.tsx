import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { channelMeta } from '@/lib/channels';

export default function Messages() {
  const [messages, setMessages] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [dirFilter, setDirFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      let q = supabase.from('messages').select('*, leads(whatsapp_number, full_name)').order('created_at', { ascending: false }).limit(100);
      if (dirFilter !== 'all') q = q.eq('direction', dirFilter);
      if (channelFilter !== 'all') q = q.eq('channel', channelFilter);
      const { data } = await q;
      setMessages(data || []);
    };
    load();
  }, [dirFilter, channelFilter]);

  const filtered = messages.filter(m =>
    m.message_text.toLowerCase().includes(search.toLowerCase()) ||
    (m.leads as any)?.whatsapp_number?.includes(search) ||
    ((m.leads as any)?.full_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Messages</h1>
      <div className="flex gap-3 mb-4">
        <Input placeholder="Search messages…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={dirFilter} onValueChange={setDirFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="inbound">Inbound</SelectItem>
            <SelectItem value="outbound">Outbound</SelectItem>
          </SelectContent>
        </Select>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="telegram">Telegram</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lead</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead>Direction</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>Intent</TableHead>
            <TableHead>Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map(m => (
            <TableRow key={m.id} className="cursor-pointer" onClick={() => navigate(`/leads/${m.lead_id}`)}>
              <TableCell className="text-sm">{(m.leads as any)?.full_name || (m.leads as any)?.whatsapp_number}</TableCell>
              <TableCell className="text-xs">{channelMeta(m.channel).label}</TableCell>
              <TableCell className="text-xs">{m.direction}</TableCell>
              <TableCell className="max-w-md truncate text-sm">{m.message_text}</TableCell>
              <TableCell className="text-xs">{m.detected_intent || '—'}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
