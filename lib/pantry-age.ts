import type { PantryItem } from '@/lib/types'

/** How long a pantry item goes unconfirmed before we ask "do you still have this?" */
export const STALE_AFTER_DAYS = 14

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Whole days elapsed since an ISO timestamp. Negative timestamps (future dates) clamp to 0. */
export function daysSince(iso: string, now: Date = new Date()): number {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 0
  return Math.max(0, Math.floor((now.getTime() - then) / MS_PER_DAY))
}

/**
 * An item is stale once it has gone STALE_AFTER_DAYS without being confirmed.
 * Confirming it sets last_confirmed_at to now, which is what pushes the next ask
 * out by another two weeks.
 */
export function isStale(item: Pick<PantryItem, 'last_confirmed_at'>, now: Date = new Date()): boolean {
  return daysSince(item.last_confirmed_at, now) >= STALE_AFTER_DAYS
}

/** Short human age for a pantry row, e.g. "today", "3 days", "2 weeks", "1 month". */
export function formatAge(iso: string, now: Date = new Date()): string {
  const days = daysSince(iso, now)
  if (days === 0) return 'today'
  if (days === 1) return '1 day'
  if (days < 14) return `${days} days`

  const months = Math.floor(days / 30)
  if (months >= 1) return months === 1 ? '1 month' : `${months} months`

  const weeks = Math.floor(days / 7)
  return `${weeks} weeks`
}
