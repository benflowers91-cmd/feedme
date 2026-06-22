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

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

export default function SavedPage() {
  const { data: session, status } = useSession()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [toggling, setToggling] = useState<string | null>(null)
  const [planModal, setPlanModal] = useState<{ recipe: Recipe; date: string; mealType: MealType; error?: string } | null>(null)
  const [addingToPlan, setAddingToPlan] = useState(false)
  const [planAdded, setPlanAdded] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'favourites'>('all')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [newTagInputs, setNewTagInputs] = useState<Record<string, string>>({})
  const [savingTags, setSavingTags] = useState<string | null>(null)
  const [autoTagging, setAutoTagging] = useState(false)
  const [autoTagResult, setAutoTagResult] = useState<number | null>(null)

  useEffect(() => {
    if (!session) return
    fetch('/api/recipes')
      .then(r => r.json())
      .then(data => { setRecipes(data); setLoading(false) })
  }, [session])

  async function toggleFavourite(recipe: Recipe) {
    if (toggling) return
    const newValue = !recipe.is_favourite
    setToggling(recipe.id)
    setRecipes(prev => prev.map(r => r.id === recipe.id ? { ...r, is_favourite: newValue } : r))
    try {
      const res = await fetch(`/api/recipes?id=${recipe.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favourite: newValue }),
      })
      if (!res.ok) {
        setRecipes(prev => prev.map(r => r.id === recipe.id ? { ...r, is_favourite: recipe.is_favourite } : r))
      }
    } catch {
      setRecipes(prev => prev.map(r => r.id === recipe.id ? { ...r, is_favourite: recipe.is_favourite } : r))
    } finally {
      setToggling(null)
    }
  }

  async function updateTags(recipe: Recipe, newTags: string[]) {
    setSavingTags(recipe.id)
    setRecipes(prev => prev.map(r => r.id === recipe.id ? { ...r, tags: newTags } : r))
    try {
      await fetch(`/api/recipes?id=${recipe.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTags }),
      })
    } catch {
      setRecipes(prev => prev.map(r => r.id === recipe.id ? { ...r, tags: recipe.tags } : r))
    } finally {
      setSavingTags(null)
    }
  }

  function addTag(recipe: Recipe) {
    const raw = (newTagInputs[recipe.id] ?? '').trim().toLowerCase()
    if (!raw || (recipe.tags ?? []).includes(raw)) return
    const newTags = [...(recipe.tags ?? []), raw]
    setNewTagInputs(prev => ({ ...prev, [recipe.id]: '' }))
    updateTags(recipe, newTags)
  }

  function removeTag(recipe: Recipe, tag: string) {
    const newTags = (recipe.tags ?? []).filter(t => t !== tag)
    updateTags(recipe, newTags)
    if (tagFilter === tag) setTagFilter(null)
  }

  async function autoTagAll() {
    setAutoTagging(true)
    setAutoTagResult(null)
    try {
      const res = await fetch('/api/recipes/tag', { method: 'POST' })
      if (!res.ok) return
      const { results } = await res.json()
      if (results?.length > 0) {
        setRecipes(prev => prev.map(r => {
          const updated = results.find((u: { id: string; tags: string[] }) => u.id === r.id)
          return updated ? { ...r, tags: updated.tags } : r
        }))
      }
      setAutoTagResult(results?.length ?? 0)
    } finally {
      setAutoTagging(false)
    }
  }

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

  const allTags = [...new Set(recipes.flatMap(r => r.tags ?? []))].sort()
  const favouriteCount = recipes.filter(r => r.is_favourite).length

  const displayedRecipes = recipes
    .filter(r => filter === 'favourites' ? r.is_favourite : true)
    .filter(r => tagFilter ? (r.tags ?? []).includes(tagFilter) : true)
    .sort((a, b) => {
      if (filter !== 'favourites') {
        if (a.is_favourite !== b.is_favourite) return a.is_favourite ? -1 : 1
      }
      return 0
    })

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-4">Saved recipes</h1>

      {recipes.length > 0 && (
        <div className="mb-4 space-y-2">
          {/* Favourites / All filter + Auto-tag */}
          <div className="flex gap-2 flex-wrap items-center">
            <button
              onClick={() => setFilter('all')}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                filter === 'all'
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              All ({recipes.length})
            </button>
            <button
              onClick={() => setFilter('favourites')}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 ${
                filter === 'favourites'
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              <HeartIcon filled={filter === 'favourites'} />
              Favourites ({favouriteCount})
            </button>
            <button
              onClick={autoTagAll}
              disabled={autoTagging}
              className="ml-auto text-xs font-medium px-3 py-1.5 rounded-full border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 transition-colors"
            >
              {autoTagging ? 'Tagging...' : 'Auto-tag all'}
            </button>
            {autoTagResult !== null && !autoTagging && (
              <span className="text-xs text-gray-400">
                {autoTagResult === 0 ? 'All tagged' : `${autoTagResult} tagged`}
              </span>
            )}
          </div>

          {/* Tag filters */}
          {allTags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors capitalize ${
                    tagFilter === tag
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
      ) : displayedRecipes.length === 0 && filter === 'favourites' ? (
        <div className="text-center py-12">
          <p className="text-sm text-gray-400 mb-1">No favourites yet.</p>
          <p className="text-xs text-gray-400">Tap the heart on recipes you&apos;ve tried and loved.</p>
        </div>
      ) : displayedRecipes.length === 0 && tagFilter ? (
        <div className="text-center py-12">
          <p className="text-sm text-gray-400 mb-1">No recipes tagged &ldquo;{tagFilter}&rdquo;.</p>
          <button onClick={() => setTagFilter(null)} className="text-xs text-blue-600 hover:underline">Clear filter</button>
        </div>
      ) : displayedRecipes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-gray-400 mb-2">No saved recipes yet.</p>
          <p className="text-xs text-gray-400">Adapt a recipe to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedRecipes.map(recipe => {
            const isExpanded = expandedId === recipe.id
            const tags = recipe.tags ?? []
            return (
              <div key={recipe.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  className="w-full px-4 py-3 flex items-start justify-between text-left gap-3"
                  onClick={() => setExpandedId(isExpanded ? null : recipe.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      {recipe.is_favourite && (
                        <span className="text-pink-500 shrink-0">
                          <HeartIcon filled />
                        </span>
                      )}
                      <p className="text-sm font-semibold text-gray-800 truncate">{recipe.title}</p>
                    </div>
                    {recipe.fodmap_notes && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{recipe.fodmap_notes}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
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
                      {tags.map(tag => (
                        <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 capitalize">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                    <button
                      onClick={e => { e.stopPropagation(); toggleFavourite(recipe) }}
                      className={`p-1.5 rounded-lg transition-colors ${
                        recipe.is_favourite
                          ? 'text-pink-500 hover:text-pink-600'
                          : 'text-gray-300 hover:text-pink-400'
                      }`}
                      aria-label={recipe.is_favourite ? 'Remove from favourites' : 'Add to favourites'}
                    >
                      <HeartIcon filled={recipe.is_favourite} />
                    </button>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-50 px-4 pb-4 space-y-4 pt-3">
                    {/* Tags management */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tags</p>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {tags.map(tag => (
                          <span key={tag} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100 capitalize">
                            {tag}
                            <button
                              onClick={() => removeTag(recipe, tag)}
                              disabled={savingTags === recipe.id}
                              className="hover:text-blue-800 ml-0.5 leading-none"
                              aria-label={`Remove tag ${tag}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        {tags.length === 0 && (
                          <span className="text-xs text-gray-400">No tags yet</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Add tag..."
                          value={newTagInputs[recipe.id] ?? ''}
                          onChange={e => setNewTagInputs(prev => ({ ...prev, [recipe.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && addTag(recipe)}
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                        <button
                          onClick={() => addTag(recipe)}
                          disabled={!(newTagInputs[recipe.id] ?? '').trim() || savingTags === recipe.id}
                          className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                    </div>

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
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Original recipe</p>
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
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-end" onClick={() => setPlanModal(null)}>
          <div
            className="bg-white w-full max-w-2xl mx-auto rounded-t-2xl p-5 pb-24"
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
