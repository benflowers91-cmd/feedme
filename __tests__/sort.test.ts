import { describe, it, expect } from 'vitest'
import { compareNames, sortByName } from '@/lib/sort'

describe('sortByName', () => {
  it('sorts alphabetically ignoring case', () => {
    const items = [{ name: 'carrots' }, { name: 'Apples' }, { name: 'bananas' }, { name: 'Zucchini' }]
    expect(sortByName(items).map(i => i.name)).toEqual(['Apples', 'bananas', 'carrots', 'Zucchini'])
  })

  it('does not mutate the input', () => {
    const items = [{ name: 'b' }, { name: 'a' }]
    sortByName(items)
    expect(items[0].name).toBe('b')
  })

  it('treats case-only differences as equal', () => {
    expect(compareNames('rice', 'Rice')).toBe(0)
  })
})
