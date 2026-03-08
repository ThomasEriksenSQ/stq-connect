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
  if (diff < 730) return `${Math.floor(diff / 30)} mnd siden`;
  return `${Math.floor(diff / 365)} år siden`;
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
  if (diffDays < 730) return `${Math.floor(diffDays / 30)} mnd siden`;
  return format(date, "d. MMM yyyy", { locale: nb });
}

/** Ultra-compact for dashboard feed: "3t", "1d", "2u", "3 mnd" */
export function relativeTimeShort(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "nå";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}t`;
  if (isYesterday(date)) return "i går";
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}u`;
  if (diffDays < 730) return `${Math.floor(diffDays / 30)} mnd`;
  return `${Math.floor(diffDays / 365)} år`;
}

export function fullDate(dateStr: string): string {
  return format(new Date(dateStr), "d. MMMM yyyy", { locale: nb });
}

/** Future-aware relative date: "Nå" if today/past, "om 2 uker" if future, "—" if null */
export function relativeFutureDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return "Nå";
  if (diff === 1) return "i morgen";
  if (diff < 7) return `om ${diff} dager`;
  if (diff < 14) return "om 1 uke";
  if (diff < 30) return `om ${Math.floor(diff / 7)} uker`;
  if (diff < 60) return "om 1 mnd";
  if (diff < 365) return `om ${Math.floor(diff / 30)} mnd`;
  return `om ${Math.floor(diff / 365)} år`;
}
