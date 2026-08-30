import type { MealPlanEntry, MealType, Recipe } from './types'

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
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

// Pantry names and ingredient names rarely agree on number ("onion" vs "2 onions"),
// so match either form. Only the final word varies, which is what the suffix rules target.
export function wordForms(name: string): string[] {
  const forms = new Set([name])
  const lower = name.toLowerCase()
  if (/(?:s|x|z|ch|sh)$/.test(lower)) forms.add(`${name}es`)
  else if (/[^aeiou]y$/.test(lower)) forms.add(`${name.slice(0, -1)}ies`)
  else if (/[^aeiou]o$/.test(lower)) {
    forms.add(`${name}es`) // tomato → tomatoes
    forms.add(`${name}s`) // avocado → avocados
  } else forms.add(`${name}s`)
  if (/[^aeiou]ies$/.test(lower)) forms.add(`${name.slice(0, -3)}y`)
  else if (/(?:ches|shes|xes|zes|sses|[^aeiou]oes)$/.test(lower)) forms.add(name.slice(0, -2))
  else if (/[^s]s$/.test(lower)) forms.add(name.slice(0, -1))
  return [...forms]
}

export function matchesHaystack(name: string, hay: string): boolean {
  const alternation = wordForms(name).map(escapeRegex).join('|')
  return new RegExp(`\\b(?:${alternation})\\b`, 'i').test(hay)
}

export function shortDayLabel(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' })
}

export function eligibleFor(recipes: Recipe[], meal: MealType): Recipe[] {
  return recipes.filter(r => r.tags.length === 0 || r.tags.includes(meal))
}

export function pantryMatchesFor(recipe: Recipe, pantryNames: string[]): string[] {
  const ingredientNames = (recipe.ingredients ?? []).map(i => i.name)
  return pantryNames.filter(name =>
    ingredientNames.some(ing => matchesHaystack(name, ing))
  )
}

export function scoreRecipe(recipe: Recipe, pantryNames: string[], tags: string[]): number {
  const pantryHits = pantryMatchesFor(recipe, pantryNames).length
  const tagHits = tags.filter(t => recipe.tags.includes(t)).length
  return pantryHits * 2 + tagHits
}

// Picks the best-scoring recipe the week has not used yet. Once the top-scoring
// recipes are spent it drops to the next tier down rather than repeating one, and
// returns null when nothing distinct is left — a blank slot beats a duplicate meal.
function selectForSlot(
  candidates: Recipe[],
  pantryNames: string[],
  tags: string[],
  used: Set<string>
): Recipe | null {
  const available = candidates.filter(r => !used.has(r.id))
  if (available.length === 0) return null
  const scored = available.map(r => ({ r, score: scoreRecipe(r, pantryNames, tags) }))
  const maxScore = Math.max(...scored.map(s => s.score))
  const topTier = scored.filter(s => s.score === maxScore).map(s => s.r)
  const pick = shuffle(topTier)[0]
  used.add(pick.id)
  return pick
}

export interface ProposedSlot {
  date: string
  meal_type: MealType
  recipe: Recipe
  isLeftover: boolean
  pantryMatches: string[]
  notes: string | null
  included: boolean
}

export interface UnfilledSlot {
  date: string
  meal_type: MealType
}

export interface Proposal {
  slots: ProposedSlot[]
  unfilled: UnfilledSlot[]
  poolSizes: Record<MealType, number>
}

export interface BuildProposalArgs {
  weekDates: string[]
  recipes: Recipe[]
  planMap: Record<string, MealPlanEntry>
  selectedPantryNames: string[]
  selectedTags: string[]
  extraNights: Set<string>
}

export function buildProposal(args: BuildProposalArgs): Proposal {
  const { weekDates, recipes, planMap, selectedPantryNames, selectedTags, extraNights } = args
  const slots: ProposedSlot[] = []
  const unfilled: UnfilledSlot[] = []

  // One set for the whole week, not one per meal type: a recipe tagged both lunch
  // and dinner should still only show up once. Seeded with what is already saved
  // so re-running the builder never duplicates a meal already in the plan.
  const used = new Set<string>(
    Object.values(planMap).map(entry => entry.recipe_id).filter((id): id is string => !!id)
  )

  function propose(date: string, meal: MealType): Recipe | null {
    const picked = selectForSlot(eligibleFor(recipes, meal), selectedPantryNames, selectedTags, used)
    if (!picked) {
      unfilled.push({ date, meal_type: meal })
      return null
    }
    slots.push({
      date,
      meal_type: meal,
      recipe: picked,
      isLeftover: false,
      pantryMatches: pantryMatchesFor(picked, selectedPantryNames),
      notes: null,
      included: true,
    })
    return picked
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
    const picked = propose(date, 'dinner')
    if (picked) dinnerRecipeByDate.set(date, picked)
  }

  // Pass 2: leftover chaining — cook-extra dinner becomes next day's lunch, no wraparound past Sunday.
  // This is the one sanctioned repeat: same recipe, flagged as a leftover.
  const leftoverLunchDates = new Set<string>()
  for (let i = 0; i < weekDates.length - 1; i++) {
    const date = weekDates[i]
    if (!extraNights.has(date)) continue
    const nextDate = weekDates[i + 1]
    if (planMap[`${nextDate}:lunch`]) continue
    const dinnerRecipe = dinnerRecipeByDate.get(date)
    if (!dinnerRecipe) continue
    slots.push({
      date: nextDate,
      meal_type: 'lunch',
      recipe: dinnerRecipe,
      isLeftover: true,
      pantryMatches: pantryMatchesFor(dinnerRecipe, selectedPantryNames),
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
      propose(date, meal)
    }
  }

  const poolSizes = {
    breakfast: eligibleFor(recipes, 'breakfast').length,
    lunch: eligibleFor(recipes, 'lunch').length,
    dinner: eligibleFor(recipes, 'dinner').length,
    snack: eligibleFor(recipes, 'snack').length,
  }

  return { slots, unfilled, poolSizes }
}
