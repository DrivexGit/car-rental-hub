export const aed = (n: number | string | null | undefined) =>
  n == null || n === '' ? '—' : `AED ${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
export const fdate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fdatetime = (d?: string | null) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const ago = (d: string) => {
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : fdate(d);
};
