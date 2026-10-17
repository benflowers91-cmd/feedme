// Recipe tags are stored as a flat string[]. This sorts them into display
// groups on the Saved page. Vocab matches what /api/recipes/tag produces.

export type TagGroup = 'meal' | 'course' | 'difficulty' | 'cuisine' | 'ingredient' | 'other'

export const TAG_GROUP_ORDER: TagGroup[] = ['meal', 'course', 'difficulty', 'cuisine', 'ingredient', 'other']

export const TAG_GROUP_LABELS: Record<TagGroup, string> = {
  meal: 'Meal',
  course: 'Course',
  difficulty: 'Difficulty',
  cuisine: 'Cuisine',
  ingredient: 'Ingredient',
  other: 'Other',
}

const MEAL_TAGS = ['breakfast', 'brunch', 'lunch', 'dinner', 'snack']

// Order matches how a meal is served. The auto-tagger picks from this list.
export const COURSE_TAGS = ['starter', 'main', 'side', 'dessert'] as const

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

// The auto-tagger's food_type field. Open-ended, so this covers the common answers
const INGREDIENT_TAGS = [
  'beans', 'beef', 'cheese', 'chicken', 'curry', 'duck', 'egg', 'eggs', 'fish',
  'grains', 'lamb', 'lentils', 'meat', 'noodles', 'pasta', 'pie', 'pork',
  'potato', 'poultry', 'rice', 'salad', 'salmon', 'sandwich', 'sausage', 'soup',
  'stew', 'tofu', 'turkey', 'vegan', 'vegetables', 'vegetarian',
]

export function tagGroup(tag: string): TagGroup {
  const t = tag.toLowerCase()
  if (MEAL_TAGS.includes(t)) return 'meal'
  if ((COURSE_TAGS as readonly string[]).includes(t)) return 'course'
  if (DIFFICULTY_TAGS.includes(t)) return 'difficulty'
  if (CUISINE_TAGS.includes(t)) return 'cuisine'
  if (INGREDIENT_TAGS.includes(t)) return 'ingredient'
  return 'other'
}

/** Buckets tags by group. Meal, course and difficulty keep their fixed order; the rest sort alphabetically. */
export function groupTags(tags: string[]): Record<TagGroup, string[]> {
  const groups: Record<TagGroup, string[]> = { meal: [], course: [], difficulty: [], cuisine: [], ingredient: [], other: [] }
  for (const tag of tags) groups[tagGroup(tag)].push(tag)
  const rank = (list: string[]) => (a: string, b: string) => list.indexOf(a) - list.indexOf(b)
  groups.meal.sort(rank(MEAL_TAGS))
  groups.course.sort(rank([...COURSE_TAGS]))
  groups.difficulty.sort(rank(DIFFICULTY_TAGS))
  groups.cuisine.sort()
  groups.ingredient.sort()
  groups.other.sort()
  return groups
}
