export type FodmapStatus = 'safe' | 'moderate' | 'avoid' | 'unknown'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface PantryItem {
  id: string
  user_id: string
  name: string
  fodmap_status: FodmapStatus
  quantity: string | null
  updated_at: string
}

export interface SubstitutionOption {
  substitute: string
  reason: string
}

export interface RecipeIngredient {
  name: string
  amount: string | null
  unit: string | null
  fodmap_status: FodmapStatus
  substitution_options?: SubstitutionOption[]
}

export interface Recipe {
  id: string
  user_id: string
  title: string
  ingredients: RecipeIngredient[]
  instructions: string
  source_url: string | null
  fodmap_notes: string
  is_saved: boolean
  is_favourite: boolean
  tags: string[]
  created_at: string
}

export interface MealPlanEntry {
  id: string
  user_id: string
  plan_date: string
  meal_type: MealType
  recipe_id: string | null
  recipe_title: string | null
  notes: string | null
  calendar_event_id: string | null
}

export interface ShoppingItem {
  id: string
  user_id: string
  name: string
  quantity: string | null
  is_checked: boolean
  source_recipe_id: string | null
  created_at: string
}
