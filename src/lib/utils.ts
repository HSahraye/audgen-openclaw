import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Compact relative-time formatter used across every dashboard list. Rules
 * (rounded to nearest unit, not floored — see utils.test.ts):
 *   < 1 minute  → "just now"
 *   < 60 minutes→ "Nm ago"
 *   < 24 hours  → "Nh ago"
 *   < 7 days    → "Nd ago"
 *   < 5 weeks   → "Nw ago"
 *   < 12 months → "Nmo ago"
 *   otherwise   → "Ny ago"
 *
 * Future timestamps clamp to "just now" so a clock skew doesn't render
 * negative numbers in the UI.
 */
export function formatRelativeTime(value: string | Date) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.round(days / 365);
  return `${years}y ago`;
}
