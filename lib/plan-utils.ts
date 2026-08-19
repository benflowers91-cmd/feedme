import type { MealPlanEntry, MealType, Recipe } from './types'

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
export const FEED_ME_MEALS: MealType[] = ['breakfast', 'lunch', 'dinner']
export const MEAL_EMOJI: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍎',
}

export const LEFTOVER_NOTES_PREFIX = '[leftover]'

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function getWeekDates(offset = 0): string[] {
  const today = new Date()
  const day = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((day + 6) % 7) + offset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toLocaleDateString('en-CA')
  })
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function matchesHaystack(name: string, hay: string): boolean {
  return new RegExp(`\\b${escapeRegex(name)}\\b`, 'i').test(hay)
}

export function shortDayLabel(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' })
}

export function eligibleFor(recipes: Recipe[], meal: MealType): Recipe[] {
  return recipes.filter(r => r.tags.length === 0 || r.tags.includes(meal))
}

export function scoreRecipe(recipe: Recipe, pantryNames: string[], tags: string[]): number {
  const ingredientNames = (recipe.ingredients ?? []).map(i => i.name)
  const pantryHits = pantryNames.filter(name =>
    ingredientNames.some(ing => matchesHaystack(name, ing))
  ).length
  const tagHits = tags.filter(t => recipe.tags.includes(t)).length
  return pantryHits * 2 + tagHits
}

function selectForSlot(
  candidates: Recipe[],
  pantryNames: string[],
  tags: string[],
  used: Set<string>
): Recipe | null {
  if (candidates.length === 0) return null
  const scored = candidates.map(r => ({ r, score: scoreRecipe(r, pantryNames, tags) }))
  const maxScore = Math.max(...scored.map(s => s.score))
  const topTier = scored.filter(s => s.score === maxScore).map(s => s.r)
  const unused = topTier.filter(r => !used.has(r.id))
  const pool = unused.length > 0 ? unused : topTier
  const pick = shuffle(pool)[0]
  used.add(pick.id)
  return pick
}

export interface ProposedSlot {
  date: string
  meal_type: MealType
  recipe: Recipe
  isLeftover: boolean
  notes: string | null
  included: boolean
}

export interface BuildProposalArgs {
  weekDates: string[]
  recipes: Recipe[]
  planMap: Record<string, MealPlanEntry>
  selectedPantryNames: string[]
  selectedTags: string[]
  extraNights: Set<string>
}

export function buildProposal(args: BuildProposalArgs): ProposedSlot[] {
  const { weekDates, recipes, planMap, selectedPantryNames, selectedTags, extraNights } = args
  const proposal: ProposedSlot[] = []
  const usedByMeal: Record<MealType, Set<string>> = {
    breakfast: new Set(),
    lunch: new Set(),
    dinner: new Set(),
    snack: new Set(),
  }

  // Pass 1: dinners (needed first so leftover lunches can reference them)
  const dinnerRecipeByDate = new Map<string, Recipe>()
  for (const date of weekDates) {
    const existing = planMap[`${date}:dinner`]
    if (existing) {
      const existingRecipe = existing.recipe_id ? recipes.find(r => r.id === existing.recipe_id) : undefined
      if (existingRecipe) dinnerRecipeByDate.set(date, existingRecipe)
      continue
    }
    const picked = selectForSlot(eligibleFor(recipes, 'dinner'), selectedPantryNames, selectedTags, usedByMeal.dinner)
    if (!picked) continue
    dinnerRecipeByDate.set(date, picked)
    proposal.push({ date, meal_type: 'dinner', recipe: picked, isLeftover: false, notes: null, included: true })
  }

  // Pass 2: leftover chaining — cook-extra dinner becomes next day's lunch, no wraparound past Sunday
  const leftoverLunchDates = new Set<string>()
  for (let i = 0; i < weekDates.length - 1; i++) {
    const date = weekDates[i]
    if (!extraNights.has(date)) continue
    const nextDate = weekDates[i + 1]
    if (planMap[`${nextDate}:lunch`]) continue
    const dinnerRecipe = dinnerRecipeByDate.get(date)
    if (!dinnerRecipe) continue
    proposal.push({
      date: nextDate,
      meal_type: 'lunch',
      recipe: dinnerRecipe,
      isLeftover: true,
      notes: `${LEFTOVER_NOTES_PREFIX} from ${shortDayLabel(date)} dinner`,
      included: true,
    })
    leftoverLunchDates.add(nextDate)
  }

  // Pass 3: everything else (breakfast, lunch) not already filled or leftover-claimed
  for (const date of weekDates) {
    for (const meal of ['breakfast', 'lunch'] as MealType[]) {
      if (planMap[`${date}:${meal}`]) continue
      if (meal === 'lunch' && leftoverLunchDates.has(date)) continue
      const picked = selectForSlot(eligibleFor(recipes, meal), selectedPantryNames, selectedTags, usedByMeal[meal])
      if (!picked) continue
      proposal.push({ date, meal_type: meal, recipe: picked, isLeftover: false, notes: null, included: true })
    }
  }

  return proposal
}
