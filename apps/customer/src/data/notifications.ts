// Where a notification takes the customer: the page it links to, scrolled to the part it is about.
// Shared by the inbox (src/screens/Inbox.tsx) and the push alerts (api/push-hook.ts), so a tap lands on the same place.
// No imports: the server loads this file too.

export function noteLink(type: string, link?: string | null): string {
  const to = link || "/";
  if (!/^\/bookings\/[^/#?]+$/.test(to)) return to;
  return type === "fine" ? `${to}#fines` : type === "invoice" ? `${to}#invoice` : to;
}
