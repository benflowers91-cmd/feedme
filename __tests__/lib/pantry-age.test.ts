import { describe, it, expect } from 'vitest'
import { daysSince, isStale, formatAge, STALE_AFTER_DAYS } from '@/lib/pantry-age'

const NOW = new Date('2026-09-17T12:00:00Z')

/** An ISO timestamp exactly `days` before NOW. */
function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

describe('daysSince', () => {
  it('counts whole days elapsed', () => {
    expect(daysSince(daysAgo(0), NOW)).toBe(0)
    expect(daysSince(daysAgo(1), NOW)).toBe(1)
    expect(daysSince(daysAgo(30), NOW)).toBe(30)
  })

  it('clamps future timestamps to zero', () => {
    const tomorrow = new Date(NOW.getTime() + 24 * 60 * 60 * 1000).toISOString()
    expect(daysSince(tomorrow, NOW)).toBe(0)
  })

  it('returns zero for an unparseable timestamp', () => {
    expect(daysSince('not-a-date', NOW)).toBe(0)
  })
})

describe('isStale', () => {
  it('is not stale the day before the threshold', () => {
    expect(isStale({ last_confirmed_at: daysAgo(STALE_AFTER_DAYS - 1) }, NOW)).toBe(false)
  })

  it('is stale on the threshold day', () => {
    expect(isStale({ last_confirmed_at: daysAgo(STALE_AFTER_DAYS) }, NOW)).toBe(true)
  })

  it('stays stale well past the threshold', () => {
    expect(isStale({ last_confirmed_at: daysAgo(60) }, NOW)).toBe(true)
  })

  it('clears once confirmed, delaying the next ask by another two weeks', () => {
    const item = { last_confirmed_at: daysAgo(20) }
    expect(isStale(item, NOW)).toBe(true)

    // "I still have this" sets last_confirmed_at to now
    const confirmed = { last_confirmed_at: NOW.toISOString() }
    expect(isStale(confirmed, NOW)).toBe(false)

    // ...and it stays quiet right up to the next threshold
    const almost = new Date(NOW.getTime() + (STALE_AFTER_DAYS - 1) * 24 * 60 * 60 * 1000)
    expect(isStale(confirmed, almost)).toBe(false)

    const due = new Date(NOW.getTime() + STALE_AFTER_DAYS * 24 * 60 * 60 * 1000)
    expect(isStale(confirmed, due)).toBe(true)
  })
})

describe('formatAge', () => {
  it('reads naturally across the ranges', () => {
    expect(formatAge(daysAgo(0), NOW)).toBe('today')
    expect(formatAge(daysAgo(1), NOW)).toBe('1 day')
    expect(formatAge(daysAgo(3), NOW)).toBe('3 days')
    expect(formatAge(daysAgo(13), NOW)).toBe('13 days')
    expect(formatAge(daysAgo(14), NOW)).toBe('2 weeks')
    expect(formatAge(daysAgo(21), NOW)).toBe('3 weeks')
    expect(formatAge(daysAgo(30), NOW)).toBe('1 month')
    expect(formatAge(daysAgo(90), NOW)).toBe('3 months')
  })
})
