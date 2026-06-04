'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { SignInPrompt } from '@/components/SignInPrompt'
import type { Recipe, MealType } from '@/lib/types'

const STATUS_STYLES: Record<string, string> = {
  safe: 'text-green-600',
  moderate: 'text-amber-600',
  avoid: 'text-red-500',
  unknown: 'text-gray-400',
}

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

export default function SavedPage() {
  const { data: session, status } = useSession()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [planModal, setPlanModal] = useState<{ recipe: Recipe; date: string; mealType: MealType; error?: string } | null>(null)
  const [addingToPlan, setAddingToPlan] = useState(false)
  const [planAdded, setPlanAdded] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    fetch('/api/recipes')
      .then(r => r.json())
      .then(data => { setRecipes(data); setLoading(false) })
  }, [session])

  async function deleteRecipe(id: string) {
    setDeleting(id)
    setDeleteError('')
    try {
      const res = await fetch(`/api/recipes?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        setDeleteError('Failed to delete recipe — try again')
        return
      }
      setRecipes(prev => prev.filter(r => r.id !== id))
      if (expandedId === id) setExpandedId(null)
    } catch {
      setDeleteError('Failed to delete recipe — check your connection')
    } finally {
      setDeleting(null)
    }
  }

  async function addToPlan() {
    if (!planModal) return
    setAddingToPlan(true)
    const res = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_date: planModal.date,
        meal_type: planModal.mealType,
        recipe_id: planModal.recipe.id,
        recipe_title: planModal.recipe.title,
      }),
    })
    setAddingToPlan(false)
    if (res.ok) {
      setPlanAdded(planModal.recipe.id)
      setPlanModal(null)
      setTimeout(() => setPlanAdded(null), 2500)
    } else {
      setPlanModal(m => m ? { ...m, error: 'Failed to add — try again' } : null)
    }
  }

  function openPlanModal(recipe: Recipe) {
    const now = new Date()
    const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0]
    setPlanModal({ recipe, date: today, mealType: 'dinner' })
  }

  if (status === 'loading') return null
  if (!session) return <SignInPrompt />

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-4">Saved recipes</h1>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
      ) : recipes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-gray-400 mb-2">No saved recipes yet.</p>
          <p className="text-xs text-gray-400">Adapt a recipe to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recipes.map(recipe => {
            const isExpanded = expandedId === recipe.id
            return (
              <div key={recipe.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  className="w-full px-4 py-3 flex items-start justify-between text-left gap-3"
                  onClick={() => setExpandedId(isExpanded ? null : recipe.id)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{recipe.title}</p>
                    {recipe.fodmap_notes && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{recipe.fodmap_notes}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-400">
                        {recipe.ingredients?.length ?? 0} ingredients
                      </span>
                      {recipe.source_url && (
                        <a
                          href={recipe.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-xs text-green-600 hover:underline"
                        >
                          source ↗
                        </a>
                      )}
                    </div>
                  </div>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    className={`w-4 h-4 text-gray-400 shrink-0 transition-transform mt-0.5 ${isExpanded ? 'rotate-180' : ''}`}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-50 px-4 pb-4 space-y-4 pt-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ingredients</p>
                      <ul className="space-y-1">
                        {(recipe.ingredients ?? []).map((ing, i) => (
                          <li key={i} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">
                              {[ing.amount, ing.unit, ing.name].filter(Boolean).join(' ')}
                            </span>
                            <span className={`text-xs font-medium ${STATUS_STYLES[ing.fodmap_status] || STATUS_STYLES.unknown}`}>
                              {ing.fodmap_status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {recipe.instructions && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Method</p>
                        <p className="text-sm text-gray-700 whitespace-pre-line">{recipe.instructions}</p>
                      </div>
                    )}

                    {deleteError && deleting === null && expandedId === recipe.id && (
                      <p className="text-xs text-red-500">{deleteError}</p>
                    )}
                    <div className="flex gap-2 pt-1">
                      {planAdded === recipe.id ? (
                        <span className="flex-1 text-center text-xs text-green-600 py-2 font-medium">✓ Added to plan</span>
                      ) : (
                        <button
                          onClick={() => openPlanModal(recipe)}
                          className="flex-1 bg-green-600 text-white rounded-lg py-2 text-xs font-medium hover:bg-green-700 transition-colors"
                        >
                          Add to plan
                        </button>
                      )}
                      <button
                        onClick={() => deleteRecipe(recipe.id)}
                        disabled={deleting === recipe.id}
                        className="border border-red-100 text-red-400 rounded-lg px-3 py-2 text-xs hover:bg-red-50 disabled:opacity-50 transition-colors"
                      >
                        {deleting === recipe.id ? '...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add to plan modal */}
      {planModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end" onClick={() => setPlanModal(null)}>
          <div
            className="bg-white w-full max-w-2xl mx-auto rounded-t-2xl p-5"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-gray-800 mb-1">Add to plan</p>
            <p className="text-xs text-gray-400 mb-4 truncate">{planModal.recipe.title}</p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Date</label>
                <input
                  type="date"
                  value={planModal.date}
                  onChange={e => setPlanModal(m => m ? { ...m, date: e.target.value } : null)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Meal</label>
                <div className="grid grid-cols-4 gap-2">
                  {MEAL_TYPES.map(meal => (
                    <button
                      key={meal}
                      onClick={() => setPlanModal(m => m ? { ...m, mealType: meal } : null)}
                      className={`py-2 rounded-lg text-xs font-medium capitalize transition-colors ${
                        planModal.mealType === meal
                          ? 'bg-green-600 text-white'
                          : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {meal}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {planModal.error && (
              <p className="text-xs text-red-500 mb-3">{planModal.error}</p>
            )}

            <button
              onClick={addToPlan}
              disabled={addingToPlan}
              className="w-full bg-green-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {addingToPlan ? 'Adding...' : 'Add to plan'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
