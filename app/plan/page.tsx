'use client'

import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { SignInPrompt } from '@/components/SignInPrompt'
import type { MealPlanEntry, Recipe, MealType } from '@/lib/types'
import { MEAL_TYPES, FEED_ME_MEALS, MEAL_EMOJI, LEFTOVER_NOTES_PREFIX, shuffle, getWeekDates } from '@/lib/plan-utils'

const STATUS_STYLES: Record<string, string> = {
  safe: 'text-green-600',
  moderate: 'text-amber-600',
  avoid: 'text-red-500',
  unknown: 'text-gray-400',
}

export default function PlanPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [weekOffset, setWeekOffset] = useState(0)
  const [plan, setPlan] = useState<MealPlanEntry[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [picking, setPicking] = useState<{ date: string; meal_type: MealType } | null>(null)
  const [viewing, setViewing] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [mutationError, setMutationError] = useState('')
  const [creatingShoppingList, setCreatingShoppingList] = useState(false)
  const [pushingCalendar, setPushingCalendar] = useState(false)
  const [calendarMessage, setCalendarMessage] = useState('')
  const [feedingMe, setFeedingMe] = useState(false)
  const [feedMeMessage, setFeedMeMessage] = useState('')

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

  async function pushToCalendar() {
    setPushingCalendar(true)
    setMutationError('')
    setCalendarMessage('')
    try {
      const res = await fetch('/api/plan/push-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      })
      const body = await res.json()
      if (!res.ok) {
        setMutationError(body.error ?? 'Failed to push to calendar — try again')
        return
      }
      const failed = body.errors?.length ?? 0
      setCalendarMessage(
        failed > 0
          ? `Pushed ${body.pushed} meal${body.pushed === 1 ? '' : 's'}, ${failed} failed`
          : `Pushed ${body.pushed} meal${body.pushed === 1 ? '' : 's'} to your calendar`
      )
    } catch {
      setMutationError('Failed to push to calendar — check your connection')
    } finally {
      setPushingCalendar(false)
    }
  }

  async function feedMe() {
    setFeedingMe(true)
    setMutationError('')
    setFeedMeMessage('')
    try {
      const pools: Record<MealType, Recipe[]> = {
        breakfast: shuffle(recipes.filter(r => r.tags.length === 0 || r.tags.includes('breakfast'))),
        lunch: shuffle(recipes.filter(r => r.tags.length === 0 || r.tags.includes('lunch'))),
        dinner: shuffle(recipes.filter(r => r.tags.length === 0 || r.tags.includes('dinner'))),
        snack: [],
      }
      const cursors: Record<MealType, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 }

      const assignments: { date: string; meal_type: MealType; recipe: Recipe }[] = []
      let skipped = 0
      for (const date of weekDates) {
        for (const meal of FEED_ME_MEALS) {
          if (planMap[`${date}:${meal}`]) continue
          const pool = pools[meal]
          if (pool.length === 0) {
            skipped++
            continue
          }
          assignments.push({ date, meal_type: meal, recipe: pool[cursors[meal] % pool.length] })
          cursors[meal]++
        }
      }

      if (assignments.length === 0) {
        setFeedMeMessage(
          skipped > 0
            ? 'No saved recipes tagged breakfast, lunch, or dinner — tag some on the Saved page first.'
            : 'Every slot this week already has a meal.'
        )
        return
      }

      const responses = await Promise.all(assignments.map(a =>
        fetch('/api/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan_date: a.date,
            meal_type: a.meal_type,
            recipe_id: a.recipe.id,
            recipe_title: a.recipe.title,
          }),
        })
      ))

      const newEntries: MealPlanEntry[] = await Promise.all(
        responses.filter(r => r.ok).map(r => r.json())
      )
      const failed = responses.length - newEntries.length

      setPlan(prev => {
        let next = prev
        for (const entry of newEntries) {
          const key = `${entry.plan_date}:${entry.meal_type}`
          next = [...next.filter(e => `${e.plan_date}:${e.meal_type}` !== key), entry]
        }
        return next
      })

      const parts = [`Filled ${newEntries.length} meal${newEntries.length === 1 ? '' : 's'}`]
      if (skipped > 0) parts.push(`${skipped} skipped — no tagged recipes`)
      if (failed > 0) parts.push(`${failed} failed`)
      setFeedMeMessage(parts.join(' · '))
    } catch {
      setMutationError('Failed to fill the plan — check your connection')
    } finally {
      setFeedingMe(false)
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
        <div className="space-y-2 mb-4">
          <button
            onClick={() => router.push('/plan/build')}
            className="w-full bg-purple-50 border border-purple-200 text-purple-700 rounded-xl py-2.5 text-sm font-medium hover:bg-purple-100 transition-colors"
          >
            🧭 Build my week
          </button>
          <button
            onClick={feedMe}
            disabled={feedingMe || recipes.length === 0}
            className="w-full bg-amber-50 border border-amber-200 text-amber-700 rounded-xl py-2.5 text-sm font-medium hover:bg-amber-100 disabled:opacity-50 transition-colors"
          >
            {feedingMe ? 'Filling your week...' : '🍽️ Feed me'}
          </button>
          {feedMeMessage && (
            <p className="text-xs text-gray-500 text-center">{feedMeMessage}</p>
          )}
          <button
            onClick={createShoppingList}
            disabled={creatingShoppingList}
            className="w-full bg-green-50 border border-green-200 text-green-700 rounded-xl py-2.5 text-sm font-medium hover:bg-green-100 disabled:opacity-50 transition-colors"
          >
            {creatingShoppingList ? 'Creating...' : '🛒 Create shopping list from this plan'}
          </button>
          <button
            onClick={pushToCalendar}
            disabled={pushingCalendar}
            className="w-full bg-blue-50 border border-blue-200 text-blue-700 rounded-xl py-2.5 text-sm font-medium hover:bg-blue-100 disabled:opacity-50 transition-colors"
          >
            {pushingCalendar ? 'Pushing...' : '📅 Push to Google Calendar'}
          </button>
          {calendarMessage && (
            <p className="text-xs text-gray-500 text-center">{calendarMessage}</p>
          )}
        </div>
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
                            {entry.notes?.startsWith(LEFTOVER_NOTES_PREFIX) && (
                              <span className="text-xs bg-blue-50 text-blue-600 rounded-full px-1.5 py-0.5 shrink-0">Leftover</span>
                            )}
                            <button
                              onClick={() => {
                                const r = recipes.find(r => r.id === entry.recipe_id)
                                if (r) setViewing(r)
                              }}
                              className="text-xs text-gray-700 text-right hover:text-green-700 hover:underline"
                            >
                              {entry.recipe_title}
                            </button>
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

      {viewing && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-end" onClick={() => setViewing(null)}>
          <div className="bg-white w-full max-w-2xl mx-auto rounded-t-2xl max-h-[85vh] overflow-y-auto pb-24" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-4 py-3 border-b border-gray-100 flex items-start justify-between">
              <div className="flex-1 min-w-0 pr-3">
                <p className="text-sm font-semibold text-gray-800">{viewing.title}</p>
                {viewing.fodmap_notes && (
                  <p className="text-xs text-gray-400 mt-0.5">{viewing.fodmap_notes}</p>
                )}
              </div>
              <button onClick={() => setViewing(null)} className="text-gray-400 hover:text-gray-600 p-1 shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-4 py-4 space-y-4">
              {(viewing.ingredients?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ingredients</p>
                  <ul className="space-y-1">
                    {viewing.ingredients.map((ing, i) => (
                      <li key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">
                          {[ing.amount, ing.unit, ing.name].filter(Boolean).join(' ')}
                        </span>
                        <span className={`text-xs font-medium ml-3 shrink-0 ${STATUS_STYLES[ing.fodmap_status] ?? STATUS_STYLES.unknown}`}>
                          {ing.fodmap_status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {viewing.instructions && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recipe</p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{viewing.instructions}</p>
                </div>
              )}
              {viewing.source_url && (
                <a
                  href={viewing.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-600 hover:underline"
                >
                  Original source ↗
                </a>
              )}
            </div>
          </div>
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
            ) : (() => {
              const filtered = recipes.filter(r => r.tags.length === 0 || r.tags.includes(picking.meal_type))
              return filtered.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No recipes tagged for {picking.meal_type}.</p>
              ) : (
                <ul className="divide-y divide-gray-50 pb-6">
                  {filtered.map(recipe => (
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
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
