import { describe, it, expect } from 'vitest'
import { scoreRecipe, buildProposal, LEFTOVER_NOTES_PREFIX } from '@/lib/plan-utils'
import type { MealPlanEntry, MealType, Recipe } from '@/lib/types'

let nextId = 1
function makeRecipe(overrides: Partial<Recipe> & { title: string; tags?: string[] }): Recipe {
  return {
    id: `recipe-${nextId++}`,
    user_id: 'ben@example.com',
    ingredients: overrides.ingredients ?? [],
    instructions: '',
    source_url: null,
    fodmap_notes: '',
    is_saved: true,
    is_favourite: false,
    tags: overrides.tags ?? [],
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function makePlanEntry(date: string, meal: MealType, recipeId: string | null = null): MealPlanEntry {
  return {
    id: `entry-${date}-${meal}`,
    user_id: 'ben@example.com',
    plan_date: date,
    meal_type: meal,
    recipe_id: recipeId,
    recipe_title: recipeId ? 'Existing meal' : null,
    notes: null,
    calendar_event_id: null,
  }
}

function ingredient(name: string) {
  return { name, amount: null, unit: null, fodmap_status: 'safe' as const }
}

describe('scoreRecipe', () => {
  it('scores pantry-ingredient matches higher than tag matches', () => {
    const withPantry = makeRecipe({ title: 'Uses onion', ingredients: [ingredient('onion')], tags: ['dinner'] })
    const withTag = makeRecipe({ title: 'Italian', ingredients: [], tags: ['dinner', 'italian'] })
    expect(scoreRecipe(withPantry, ['onion'], [])).toBeGreaterThan(scoreRecipe(withTag, ['onion'], []))
    expect(scoreRecipe(withTag, [], ['italian'])).toBeGreaterThan(0)
  })

  it('scores zero when nothing matches', () => {
    const r = makeRecipe({ title: 'Plain', ingredients: [ingredient('rice')], tags: ['dinner'] })
    expect(scoreRecipe(r, ['onion'], ['italian'])).toBe(0)
  })
})

describe('buildProposal', () => {
  const weekDates = ['2024-01-01', '2024-01-02'] // Mon, Tue for test purposes

  function fillNonDinnerSlots(dates: string[]): Record<string, MealPlanEntry> {
    const planMap: Record<string, MealPlanEntry> = {}
    for (const date of dates) {
      planMap[`${date}:breakfast`] = makePlanEntry(date, 'breakfast', 'existing')
      planMap[`${date}:lunch`] = makePlanEntry(date, 'lunch', 'existing')
    }
    return planMap
  }

  it('prefers the pantry-matching recipe for an empty slot', () => {
    const matching = makeRecipe({ title: 'Onion soup', ingredients: [ingredient('onion')], tags: ['dinner'] })
    const nonMatching = makeRecipe({ title: 'Plain pasta', ingredients: [ingredient('pasta')], tags: ['dinner'] })
    const proposal = buildProposal({
      weekDates: ['2024-01-01'],
      recipes: [matching, nonMatching],
      planMap: fillNonDinnerSlots(['2024-01-01']),
      selectedPantryNames: ['onion'],
      selectedTags: [],
      extraNights: new Set(),
    })
    const dinner = proposal.find(s => s.meal_type === 'dinner')
    expect(dinner?.recipe.id).toBe(matching.id)
  })

  it('prefers the tag-matching recipe for an empty slot', () => {
    const matching = makeRecipe({ title: 'Curry night', ingredients: [], tags: ['dinner', 'indian'] })
    const nonMatching = makeRecipe({ title: 'Plain dinner', ingredients: [], tags: ['dinner'] })
    const proposal = buildProposal({
      weekDates: ['2024-01-01'],
      recipes: [matching, nonMatching],
      planMap: fillNonDinnerSlots(['2024-01-01']),
      selectedPantryNames: [],
      selectedTags: ['indian'],
      extraNights: new Set(),
    })
    const dinner = proposal.find(s => s.meal_type === 'dinner')
    expect(dinner?.recipe.id).toBe(matching.id)
  })

  it('never proposes a slot that is already filled', () => {
    const recipe = makeRecipe({ title: 'Anything', tags: [] })
    const planMap = fillNonDinnerSlots(weekDates)
    planMap['2024-01-01:dinner'] = makePlanEntry('2024-01-01', 'dinner', 'existing')
    const proposal = buildProposal({
      weekDates,
      recipes: [recipe],
      planMap,
      selectedPantryNames: [],
      selectedTags: [],
      extraNights: new Set(),
    })
    expect(proposal.some(s => s.date === '2024-01-01' && s.meal_type === 'dinner')).toBe(false)
    expect(proposal.some(s => s.date === '2024-01-01' && s.meal_type === 'breakfast')).toBe(false)
    expect(proposal.some(s => s.date === '2024-01-01' && s.meal_type === 'lunch')).toBe(false)
  })

  it('chains a cook-extra dinner into the next day empty lunch slot', () => {
    const dinnerRecipe = makeRecipe({ title: 'Big Stew', tags: ['dinner'] })
    const planMap: Record<string, MealPlanEntry> = {
      '2024-01-01:breakfast': makePlanEntry('2024-01-01', 'breakfast', 'existing'),
      '2024-01-02:breakfast': makePlanEntry('2024-01-02', 'breakfast', 'existing'),
    }
    const proposal = buildProposal({
      weekDates,
      recipes: [dinnerRecipe],
      planMap,
      selectedPantryNames: [],
      selectedTags: [],
      extraNights: new Set(['2024-01-01']),
    })
    const leftoverLunch = proposal.find(s => s.date === '2024-01-02' && s.meal_type === 'lunch')
    expect(leftoverLunch).toBeDefined()
    expect(leftoverLunch?.isLeftover).toBe(true)
    expect(leftoverLunch?.recipe.id).toBe(dinnerRecipe.id)
    expect(leftoverLunch?.notes).toContain(LEFTOVER_NOTES_PREFIX)
  })

  it('does not wrap leftover chaining from the last date to a following week', () => {
    const dinnerRecipe = makeRecipe({ title: 'Big Stew', tags: ['dinner'] })
    const planMap: Record<string, MealPlanEntry> = {
      '2024-01-01:breakfast': makePlanEntry('2024-01-01', 'breakfast', 'existing'),
      '2024-01-01:lunch': makePlanEntry('2024-01-01', 'lunch', 'existing'),
      '2024-01-02:breakfast': makePlanEntry('2024-01-02', 'breakfast', 'existing'),
      '2024-01-02:lunch': makePlanEntry('2024-01-02', 'lunch', 'existing'),
    }
    const proposal = buildProposal({
      weekDates,
      recipes: [dinnerRecipe],
      planMap,
      selectedPantryNames: [],
      selectedTags: [],
      extraNights: new Set(['2024-01-02']), // last date in the week — no next day to chain into
    })
    expect(proposal.some(s => s.isLeftover)).toBe(false)
  })

  it('skips leftover chaining when next day lunch is already filled', () => {
    const dinnerRecipe = makeRecipe({ title: 'Big Stew', tags: ['dinner'] })
    const planMap: Record<string, MealPlanEntry> = {
      '2024-01-01:breakfast': makePlanEntry('2024-01-01', 'breakfast', 'existing'),
      '2024-01-02:breakfast': makePlanEntry('2024-01-02', 'breakfast', 'existing'),
      '2024-01-02:lunch': makePlanEntry('2024-01-02', 'lunch', 'existing'),
    }
    const proposal = buildProposal({
      weekDates,
      recipes: [dinnerRecipe],
      planMap,
      selectedPantryNames: [],
      selectedTags: [],
      extraNights: new Set(['2024-01-01']),
    })
    expect(proposal.some(s => s.date === '2024-01-02' && s.meal_type === 'lunch')).toBe(false)
  })

  it('still picks a recipe when every candidate scores zero', () => {
    const recipe = makeRecipe({ title: 'Whatever', ingredients: [ingredient('rice')], tags: ['dinner'] })
    const proposal = buildProposal({
      weekDates: ['2024-01-01'],
      recipes: [recipe],
      planMap: fillNonDinnerSlots(['2024-01-01']),
      selectedPantryNames: ['onion'], // does not match anything
      selectedTags: ['mexican'], // does not match anything
      extraNights: new Set(),
    })
    const dinner = proposal.find(s => s.meal_type === 'dinner')
    expect(dinner?.recipe.id).toBe(recipe.id)
  })
})
