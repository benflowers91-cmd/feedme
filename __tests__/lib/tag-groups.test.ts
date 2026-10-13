import { describe, it, expect } from 'vitest'
import { tagGroup, groupTags } from '@/lib/tag-groups'

describe('tagGroup', () => {
  it('classifies the auto-tagger vocab', () => {
    expect(tagGroup('dinner')).toBe('meal')
    expect(tagGroup('quick')).toBe('difficulty')
    expect(tagGroup('involved')).toBe('difficulty')
    expect(tagGroup('middle eastern')).toBe('cuisine')
    expect(tagGroup('pasta')).toBe('other')
  })

  it('is case-insensitive', () => {
    expect(tagGroup('Mexican')).toBe('cuisine')
  })

  it('puts unknown manual tags in other', () => {
    expect(tagGroup('batch cook')).toBe('other')
  })
})

describe('groupTags', () => {
  it('buckets and orders tags', () => {
    expect(groupTags(['thai', 'involved', 'meat', 'dinner', 'quick', 'breakfast', 'british'])).toEqual({
      meal: ['breakfast', 'dinner'],
      difficulty: ['quick', 'involved'],
      cuisine: ['british', 'thai'],
      other: ['meat'],
    })
  })
})
