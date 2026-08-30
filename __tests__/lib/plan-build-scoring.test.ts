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
    const { slots } = buildProposal({
      weekDates: ['2024-01-01'],
      recipes: [matching, nonMatching],
      planMap: fillNonDinnerSlots(['2024-01-01']),
      selectedPantryNames: ['onion'],
      selectedTags: [],
      extraNights: new Set(),
    })
    const dinner = slots.find(s => s.meal_type === 'dinner')
    expect(dinner?.recipe.id).toBe(matching.id)
  })

  it('prefers the tag-matching recipe for an empty slot', () => {
    const matching = makeRecipe({ title: 'Curry night', ingredients: [], tags: ['dinner', 'indian'] })
    const nonMatching = makeRecipe({ title: 'Plain dinner', ingredients: [], tags: ['dinner'] })
    const { slots } = buildProposal({
      weekDates: ['2024-01-01'],
      recipes: [matching, nonMatching],
      planMap: fillNonDinnerSlots(['2024-01-01']),
      selectedPantryNames: [],
      selectedTags: ['indian'],
      extraNights: new Set(),
    })
    const dinner = slots.find(s => s.meal_type === 'dinner')
    expect(dinner?.recipe.id).toBe(matching.id)
  })

  it('never proposes a slot that is already filled', () => {
    const recipe = makeRecipe({ title: 'Anything', tags: [] })
    const planMap = fillNonDinnerSlots(weekDates)
    planMap['2024-01-01:dinner'] = makePlanEntry('2024-01-01', 'dinner', 'existing')
    const { slots } = buildProposal({
      weekDates,
      recipes: [recipe],
      planMap,
      selectedPantryNames: [],
      selectedTags: [],
      extraNights: new Set(),
    })
    expect(slots.some(s => s.date === '2024-01-01' && s.meal_type === 'dinner')).toBe(false)
    expect(slots.some(s => s.date === '2024-01-01' && s.meal_type === 'breakfast')).toBe(false)
    expect(slots.some(s => s.date === '2024-01-01' && s.meal_type === 'lunch')).toBe(false)
  })

  it('chains a cook-extra dinner into the next day empty lunch slot', () => {
    const dinnerRecipe = makeRecipe({ title: 'Big Stew', tags: ['dinner'] })
    const planMap: Record<string, MealPlanEntry> = {
      '2024-01-01:breakfast': makePlanEntry('2024-01-01', 'breakfast', 'existing'),
      '2024-01-02:breakfast': makePlanEntry('2024-01-02', 'breakfast', 'existing'),
    }
    const { slots } = buildProposal({
      weekDates,
      recipes: [dinnerRecipe],
      planMap,
      selectedPantryNames: [],
      selectedTags: [],
      extraNights: new Set(['2024-01-01']),
    })
    const leftoverLunch = slots.find(s => s.date === '2024-01-02' && s.meal_type === 'lunch')
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
    const { slots } = buildProposal({
      weekDates,
      recipes: [dinnerRecipe],
      planMap,
      selectedPantryNames: [],
      selectedTags: [],
      extraNights: new Set(['2024-01-02']), // last date in the week — no next day to chain into
    })
    expect(slots.some(s => s.isLeftover)).toBe(false)
  })

  it('skips leftover chaining when next day lunch is already filled', () => {
    const dinnerRecipe = makeRecipe({ title: 'Big Stew', tags: ['dinner'] })
    const planMap: Record<string, MealPlanEntry> = {
      '2024-01-01:breakfast': makePlanEntry('2024-01-01', 'breakfast', 'existing'),
      '2024-01-02:breakfast': makePlanEntry('2024-01-02', 'breakfast', 'existing'),
      '2024-01-02:lunch': makePlanEntry('2024-01-02', 'lunch', 'existing'),
    }
    const { slots } = buildProposal({
      weekDates,
      recipes: [dinnerRecipe],
      planMap,
      selectedPantryNames: [],
      selectedTags: [],
      extraNights: new Set(['2024-01-01']),
    })
    expect(slots.some(s => s.date === '2024-01-02' && s.meal_type === 'lunch')).toBe(false)
  })

  it('still picks a recipe when every candidate scores zero', () => {
    const recipe = makeRecipe({ title: 'Whatever', ingredients: [ingredient('rice')], tags: ['dinner'] })
    const { slots } = buildProposal({
      weekDates: ['2024-01-01'],
      recipes: [recipe],
      planMap: fillNonDinnerSlots(['2024-01-01']),
      selectedPantryNames: ['onion'], // does not match anything
      selectedTags: ['mexican'], // does not match anything
      extraNights: new Set(),
    })
    const dinner = slots.find(s => s.meal_type === 'dinner')
    expect(dinner?.recipe.id).toBe(recipe.id)
  })

  it('never repeats a recipe across the week, even across meal types', () => {
    const weekOfSeven = ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05', '2024-01-06', '2024-01-07']
    // every recipe is eligible for every meal, so only the used-set stops repeats
    const recipes = Array.from({ length: 30 }, (_, i) => makeRecipe({ title: `Recipe ${i}`, tags: [] }))
    const { slots } = buildProposal({
      weekDates: weekOfSeven,
      recipes,
      planMap: {},
      selectedPantryNames: [],
      selectedTags: [],
      extraNights: new Set(),
    })
    const ids = slots.map(s => s.recipe.id)
    expect(ids).toHaveLength(21)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('drops to lower-scoring recipes once the top tier is used up', () => {
    // regression: the top tier used to be re-picked forever, so one recipe filled
    // several lunches in a single week
    const weekOfSeven = ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05', '2024-01-06', '2024-01-07']
    const topTier = Array.from({ length: 4 }, (_, i) =>
      makeRecipe({ title: `Pantry lunch ${i}`, ingredients: [ingredient('rice')], tags: ['lunch'] })
    )
    const rest = Array.from({ length: 6 }, (_, i) => makeRecipe({ title: `Plain lunch ${i}`, tags: ['lunch'] }))
    const planMap: Record<string, MealPlanEntry> = {}
    for (const date of weekOfSeven) {
      planMap[`${date}:breakfast`] = makePlanEntry(date, 'breakfast', 'existing')
      planMap[`${date}:dinner`] = makePlanEntry(date, 'dinner', 'existing')
    }
    const { slots, unfilled } = buildProposal({
      weekDates: weekOfSeven,
      recipes: [...topTier, ...rest],
      planMap,
      selectedPantryNames: ['rice'],
      selectedTags: [],
      extraNights: new Set(),
    })
    const lunches = slots.filter(s => s.meal_type === 'lunch')
    expect(lunches).toHaveLength(7)
    expect(new Set(lunches.map(s => s.recipe.id)).size).toBe(7)
    expect(unfilled).toHaveLength(0)
  })

  it('leaves a slot unfilled rather than repeating when the pool runs dry', () => {
    const weekOfThree = ['2024-01-01', '2024-01-02', '2024-01-03']
    const planMap: Record<string, MealPlanEntry> = {}
    for (const date of weekOfThree) {
      planMap[`${date}:lunch`] = makePlanEntry(date, 'lunch', 'existing')
      planMap[`${date}:dinner`] = makePlanEntry(date, 'dinner', 'existing')
    }
    const { slots, unfilled, poolSizes } = buildProposal({
      weekDates: weekOfThree,
      recipes: [makeRecipe({ title: 'Only breakfast', tags: ['breakfast'] })],
      planMap,
      selectedPantryNames: [],
      selectedTags: [],
      extraNights: new Set(),
    })
    expect(slots).toHaveLength(1)
    expect(unfilled).toEqual([
      { date: '2024-01-02', meal_type: 'breakfast' },
      { date: '2024-01-03', meal_type: 'breakfast' },
    ])
    expect(poolSizes.breakfast).toBe(1)
  })

  it('does not propose a recipe already saved elsewhere in the week', () => {
    const alreadyPlanned = makeRecipe({ title: 'Already planned', tags: ['dinner'] })
    const other = makeRecipe({ title: 'Something else', tags: ['dinner'] })
    const planMap: Record<string, MealPlanEntry> = {
      '2024-01-01:dinner': makePlanEntry('2024-01-01', 'dinner', alreadyPlanned.id),
    }
    for (const date of weekDates) {
      planMap[`${date}:breakfast`] = makePlanEntry(date, 'breakfast', 'existing')
      planMap[`${date}:lunch`] = makePlanEntry(date, 'lunch', 'existing')
    }
    const { slots } = buildProposal({
      weekDates,
      recipes: [alreadyPlanned, other],
      planMap,
      selectedPantryNames: [],
      selectedTags: [],
      extraNights: new Set(),
    })
    const dinner = slots.find(s => s.date === '2024-01-02' && s.meal_type === 'dinner')
    expect(dinner?.recipe.id).toBe(other.id)
  })

  it('reports the pantry items each proposed meal matched', () => {
    const recipe = makeRecipe({
      title: 'Onion and rice bowl',
      ingredients: [ingredient('onions'), ingredient('rice'), ingredient('soy sauce')],
      tags: ['dinner'],
    })
    const { slots } = buildProposal({
      weekDates: ['2024-01-01'],
      recipes: [recipe],
      planMap: fillNonDinnerSlots(['2024-01-01']),
      selectedPantryNames: ['onion', 'rice', 'butter'],
      selectedTags: [],
      extraNights: new Set(),
    })
    expect(slots.find(s => s.meal_type === 'dinner')?.pantryMatches).toEqual(['onion', 'rice'])
  })
})
