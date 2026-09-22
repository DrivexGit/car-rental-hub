import { MessageCircle, Send, MessageSquare } from 'lucide-react';

// Channel names as n8n writes them into leads.primary_channel / messages.channel
export const CHANNELS = {
  whatsapp: { label: 'WhatsApp', icon: MessageCircle, className: 'bg-emerald-50 text-emerald-500' },
  telegram: { label: 'Telegram', icon: Send, className: 'bg-sky-50 text-sky-500' },
} as const;

export const channelMeta = (channel?: string | null) =>
  CHANNELS[channel as keyof typeof CHANNELS] ??
  { label: channel || 'Unknown', icon: MessageSquare, className: 'bg-slate-100 text-slate-500' };

// Telegram leads have no phone number, so fall back to the channel handle.
export const leadContact = (lead: any) =>
  lead.whatsapp_number || lead.display_name ||
  (lead.lead_channels || []).find((c: any) => c.is_primary)?.username || null;

export const leadChatLink = (lead: any) =>
  lead.whatsapp_number ? `https://wa.me/${lead.whatsapp_number.replace(/[^0-9]/g, '')}` : null;
