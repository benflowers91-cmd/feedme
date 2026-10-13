// Recipe tags are stored as a flat string[]. This sorts them into display
// groups on the Saved page. Vocab matches what /api/recipes/tag produces.

export type TagGroup = 'meal' | 'difficulty' | 'cuisine' | 'other'

export const TAG_GROUP_ORDER: TagGroup[] = ['meal', 'difficulty', 'cuisine', 'other']

export const TAG_GROUP_LABELS: Record<TagGroup, string> = {
  meal: 'Meal',
  difficulty: 'Difficulty',
  cuisine: 'Cuisine',
  other: 'Other',
}

const MEAL_TAGS = ['breakfast', 'brunch', 'lunch', 'dinner', 'snack', 'dessert']

// Listed easiest first so chips render in a sensible order
const DIFFICULTY_TAGS = ['quick', 'easy', 'casual', 'moderate', 'involved', 'complex']

const CUISINE_TAGS = [
  'african', 'american', 'asian', 'british', 'cajun', 'caribbean', 'chinese',
  'creole', 'cuban', 'english', 'french', 'fusion', 'german', 'greek',
  'hungarian', 'indian', 'irish', 'italian', 'japanese', 'korean', 'lebanese',
  'malaysian', 'mediterranean', 'mexican', 'middle eastern', 'moroccan',
  'north african', 'persian', 'portuguese', 'scandinavian', 'scottish',
  'spanish', 'tex-mex', 'thai', 'turkish', 'vietnamese', 'welsh',
]

export function tagGroup(tag: string): TagGroup {
  const t = tag.toLowerCase()
  if (MEAL_TAGS.includes(t)) return 'meal'
  if (DIFFICULTY_TAGS.includes(t)) return 'difficulty'
  if (CUISINE_TAGS.includes(t)) return 'cuisine'
  return 'other'
}

/** Buckets tags by group. Meal and difficulty keep their fixed order; the rest sort alphabetically. */
export function groupTags(tags: string[]): Record<TagGroup, string[]> {
  const groups: Record<TagGroup, string[]> = { meal: [], difficulty: [], cuisine: [], other: [] }
  for (const tag of tags) groups[tagGroup(tag)].push(tag)
  const rank = (list: string[]) => (a: string, b: string) => list.indexOf(a) - list.indexOf(b)
  groups.meal.sort(rank(MEAL_TAGS))
  groups.difficulty.sort(rank(DIFFICULTY_TAGS))
  groups.cuisine.sort()
  groups.other.sort()
  return groups
}
