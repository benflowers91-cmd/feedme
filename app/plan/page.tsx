'use client'

import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { SignInPrompt } from '@/components/SignInPrompt'
import type { MealPlanEntry, Recipe, MealType } from '@/lib/types'

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
const MEAL_EMOJI: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍎',
}

function getWeekDates(offset = 0) {
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

export default function PlanPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [weekOffset, setWeekOffset] = useState(0)
  const [plan, setPlan] = useState<MealPlanEntry[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [picking, setPicking] = useState<{ date: string; meal_type: MealType } | null>(null)
  const [loading, setLoading] = useState(true)
  const [mutationError, setMutationError] = useState('')
  const [creatingShoppingList, setCreatingShoppingList] = useState(false)

  const weekDates = getWeekDates(weekOffset)
  const from = weekDates[0]
  const to = weekDates[6]

  useEffect(() => {
    if (!session) return
    Promise.all([
      fetch(`/api/plan?from=${from}&to=${to}`).then(r => r.json()),
      fetch('/api/recipes').then(r => r.json()),
    ]).then(([planData, recipesData]) => {
      setPlan(planData)
      setRecipes(recipesData)
      setLoading(false)
    })
  }, [session, from, to])

  const planMap = Object.fromEntries(
    plan.map(entry => [`${entry.plan_date}:${entry.meal_type}`, entry])
  )

  async function assignRecipe(recipe: Recipe) {
    if (!picking) return
    setMutationError('')
    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_date: picking.date,
          meal_type: picking.meal_type,
          recipe_id: recipe.id,
          recipe_title: recipe.title,
        }),
      })
      if (!res.ok) {
        setMutationError('Failed to add recipe — try again')
        return
      }
      const newEntry = await res.json()
      setPlan(prev => {
        const key = `${newEntry.plan_date}:${newEntry.meal_type}`
        return [...prev.filter(e => `${e.plan_date}:${e.meal_type}` !== key), newEntry]
      })
      setPicking(null)
    } catch {
      setMutationError('Failed to add recipe — check your connection')
    }
  }

  async function clearSlot(entry: MealPlanEntry) {
    setMutationError('')
    try {
      const res = await fetch(`/api/plan?id=${entry.id}`, { method: 'DELETE' })
      if (!res.ok) {
        setMutationError('Failed to clear slot — try again')
        return
      }
      setPlan(prev => prev.filter(e => e.id !== entry.id))
    } catch {
      setMutationError('Failed to clear slot — check your connection')
    }
  }

  async function createShoppingList() {
    setCreatingShoppingList(true)
    setMutationError('')
    try {
      const recipeIds = [...new Set(plan.map(e => e.recipe_id).filter(Boolean))] as string[]
      if (recipeIds.length > 0) {
        const plannedRecipes = recipes.filter(r => recipeIds.includes(r.id))
        const ingredientMap = new Map<string, string>()
        for (const recipe of plannedRecipes) {
          for (const ing of recipe.ingredients || []) {
            const key = ing.name.toLowerCase()
            if (!ingredientMap.has(key)) {
              const parts = [ing.amount, ing.unit, ing.name].filter(v => v != null && v !== '')
              ingredientMap.set(key, parts.join(' '))
            }
          }
        }
        if (ingredientMap.size > 0) {
          const res = await fetch('/api/shopping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Array.from(ingredientMap.values()).map(name => ({ name }))),
          })
          if (!res.ok) {
            setMutationError('Failed to create shopping list — try again')
            return
          }
        }
      }
      router.push('/shopping')
    } catch {
      setMutationError('Something went wrong — check your connection')
    } finally {
      setCreatingShoppingList(false)
    }
  }

  if (status === 'loading') return null
  if (!session) return <SignInPrompt />

  const today = new Date().toLocaleDateString('en-CA')

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-800">Meal plan</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekOffset(o => o - 1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="text-xs text-green-600 font-medium px-2 py-1 rounded-lg hover:bg-green-50"
          >
            This week
          </button>
          <button
            onClick={() => setWeekOffset(o => o + 1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      {mutationError && (
        <p className="text-xs text-red-500 mb-3">{mutationError}</p>
      )}

      {!loading && (
        <button
          onClick={createShoppingList}
          disabled={creatingShoppingList}
          className="w-full bg-green-50 border border-green-200 text-green-700 rounded-xl py-2.5 text-sm font-medium hover:bg-green-100 disabled:opacity-50 transition-colors mb-4"
        >
          {creatingShoppingList ? 'Creating...' : '🛒 Create shopping list from this plan'}
        </button>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
      ) : (
        <div className="space-y-2">
          {weekDates.map(date => {
            const d = new Date(date + 'T00:00:00')
            const dayName = d.toLocaleDateString('en-GB', { weekday: 'short' })
            const dayNum = d.getDate()
            const isToday = date === today
            return (
              <div key={date} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isToday ? 'border-green-200' : 'border-gray-100'}`}>
                <div className={`px-4 py-2 flex items-center gap-2 ${isToday ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <span className={`text-xs font-semibold ${isToday ? 'text-green-700' : 'text-gray-500'}`}>{dayName}</span>
                  <span className={`text-xs font-bold ${isToday ? 'text-green-700' : 'text-gray-700'}`}>{dayNum}</span>
                  {isToday && <span className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded-full">Today</span>}
                </div>
                <div className="divide-y divide-gray-50">
                  {MEAL_TYPES.map(meal => {
                    const entry = planMap[`${date}:${meal}`]
                    return (
                      <div key={meal} className="px-4 py-2 flex items-center justify-between">
                        <span className="text-xs text-gray-400 w-16">{MEAL_EMOJI[meal]} {meal}</span>
                        {entry ? (
                          <div className="flex items-center gap-2 flex-1 justify-end">
                            <span className="text-xs text-gray-700 text-right">{entry.recipe_title}</span>
                            <button onClick={() => clearSlot(entry)} className="text-gray-200 hover:text-red-400 shrink-0">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18 6 6 18M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setPicking({ date, meal_type: meal })}
                            className="text-xs text-green-600 hover:text-green-700 font-medium"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {picking && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-end" onClick={() => setPicking(null)}>
          <div className="bg-white w-full max-w-2xl mx-auto rounded-t-2xl max-h-[85vh] overflow-y-auto pb-24" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">Pick a recipe</p>
              <p className="text-xs text-gray-400">
                {picking.date} · {MEAL_EMOJI[picking.meal_type]} {picking.meal_type}
              </p>
            </div>
            {recipes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No saved recipes yet. Use Find or Adapt to save some first.</p>
            ) : (
              <ul className="divide-y divide-gray-50 pb-6">
                {recipes.map(recipe => (
                  <li key={recipe.id}>
                    <button
                      onClick={() => assignRecipe(recipe)}
                      className="w-full text-left px-4 py-3 hover:bg-green-50 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-800">{recipe.title}</p>
                      {recipe.fodmap_notes && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{recipe.fodmap_notes}</p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
