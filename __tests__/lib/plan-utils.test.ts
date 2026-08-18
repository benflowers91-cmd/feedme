import { describe, it, expect } from 'vitest'
import { shuffle, getWeekDates, escapeRegex, matchesHaystack } from '@/lib/plan-utils'

describe('shuffle', () => {
  it('preserves array length and contents', () => {
    const input = [1, 2, 3, 4, 5]
    const result = shuffle(input)
    expect(result).toHaveLength(input.length)
    expect([...result].sort()).toEqual([...input].sort())
  })

  it('does not mutate the original array', () => {
    const input = [1, 2, 3]
    shuffle(input)
    expect(input).toEqual([1, 2, 3])
  })
})

describe('getWeekDates', () => {
  it('returns 7 consecutive YYYY-MM-DD dates starting on a Monday', () => {
    const dates = getWeekDates(0)
    expect(dates).toHaveLength(7)
    for (const d of dates) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
    const monday = new Date(dates[0] + 'T00:00:00')
    expect(monday.getDay()).toBe(1)
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1] + 'T00:00:00')
      const cur = new Date(dates[i] + 'T00:00:00')
      expect(cur.getTime() - prev.getTime()).toBe(24 * 60 * 60 * 1000)
    }
  })

  it('offsets by whole weeks', () => {
    const thisWeek = getWeekDates(0)
    const nextWeek = getWeekDates(1)
    const diff = new Date(nextWeek[0] + 'T00:00:00').getTime() - new Date(thisWeek[0] + 'T00:00:00').getTime()
    expect(diff).toBe(7 * 24 * 60 * 60 * 1000)
  })
})

describe('escapeRegex / matchesHaystack', () => {
  it('matches a plain word boundary case-insensitively', () => {
    expect(matchesHaystack('onion', 'Red Onion Soup')).toBe(true)
    expect(matchesHaystack('onion', 'Red Onions Soup')).toBe(false)
    expect(matchesHaystack('carrot', 'Red Onion Soup')).toBe(false)
  })

  it('treats regex-special characters in the name literally', () => {
    expect(() => matchesHaystack('C+ cheese', 'A block of C+ cheese')).not.toThrow()
    expect(matchesHaystack('C+ cheese', 'A block of C+ cheese')).toBe(true)
    expect(matchesHaystack('mac & cheese', 'I love mac & cheese tonight')).toBe(true)
  })

  it('escapeRegex neutralises metacharacters', () => {
    const escaped = escapeRegex('a.b*c')
    expect(new RegExp(escaped).test('a.b*c')).toBe(true)
    expect(new RegExp(escaped).test('axbyc')).toBe(false)
  })
})
