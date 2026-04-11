import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil } from 'lucide-react';

export default function FAQ() {
  const [entries, setEntries] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ question: '', answer: '', category: '', is_active: true, sort_order: 0 });
  const { toast } = useToast();

  const load = async () => {
    const { data } = await supabase.from('faq_entries').select('*').order('sort_order');
    setEntries(data || []);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ question: '', answer: '', category: '', is_active: true, sort_order: 0 }); setDialogOpen(true); };
  const openEdit = (e: any) => { setEditing(e); setForm({ question: e.question, answer: e.answer, category: e.category || '', is_active: e.is_active, sort_order: e.sort_order }); setDialogOpen(true); };

  const save = async () => {
    if (!form.question || !form.answer) { toast({ title: 'Question and answer required', variant: 'destructive' }); return; }
    if (editing) {
      await supabase.from('faq_entries').update(form).eq('id', editing.id);
      toast({ title: 'FAQ updated' });
    } else {
      await supabase.from('faq_entries').insert(form);
      toast({ title: 'FAQ created' });
    }
    setDialogOpen(false);
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">FAQ Management</h1>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add FAQ</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead><TableHead>Category</TableHead><TableHead>Question</TableHead>
            <TableHead>Active</TableHead><TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map(e => (
            <TableRow key={e.id}>
              <TableCell>{e.sort_order}</TableCell>
              <TableCell className="text-sm">{e.category || '—'}</TableCell>
              <TableCell className="text-sm max-w-md">{e.question}</TableCell>
              <TableCell>{e.is_active ? '✓' : '—'}</TableCell>
              <TableCell><Button size="sm" variant="ghost" onClick={() => openEdit(e)}><Pencil className="h-3 w-3" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit FAQ' : 'New FAQ'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Category</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
            <div><Label>Question *</Label><Input value={form.question} onChange={e => setForm({ ...form, question: e.target.value })} /></div>
            <div><Label>Answer *</Label><Textarea value={form.answer} onChange={e => setForm({ ...form, answer: e.target.value })} rows={4} /></div>
            <div className="flex items-center gap-2"><Label>Active</Label><Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} /></div>
            <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>{editing ? 'Save' : 'Create'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
