import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNOK(n: number): string {
  return Math.round(n).toLocaleString("nb-NO");
}

export function getInitials(navn: string): string {
  const parts = navn.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatMonths(months: number): string {
  if (months < 12) return `${months} mnd`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m === 0 ? `${y} år` : `${y} år ${m} mnd`;
}
