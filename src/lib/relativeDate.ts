import { formatDistanceToNowStrict, isToday, isYesterday, format } from "date-fns";
import { nb } from "date-fns/locale";

export function relativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "I dag";
  if (isYesterday(date)) return "I går";
  const diff = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 7) return `${diff}d siden`;
  if (diff < 14) return "1 uke siden";
  if (diff < 30) return `${Math.floor(diff / 7)} uker siden`;
  if (diff < 60) return "1 mnd siden";
  if (diff < 365) return `${Math.floor(diff / 30)} mnd siden`;
  return `${Math.floor(diff / 365)}å siden`;
}

export function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Nå";
  if (diffMin < 60) return `${diffMin}m siden`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}t siden`;
  if (isYesterday(date)) return "I går";
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d siden`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}u siden`;
  return format(date, "d. MMM", { locale: nb });
}

export function fullDate(dateStr: string): string {
  return format(new Date(dateStr), "d. MMMM yyyy", { locale: nb });
}
