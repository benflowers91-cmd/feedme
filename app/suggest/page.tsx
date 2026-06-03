'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { SignInPrompt } from '@/components/SignInPrompt'
import type { PantryItem, RecipeIngredient } from '@/lib/types'

const STATUS_STYLES: Record<string, string> = {
  safe: 'text-green-600',
  moderate: 'text-amber-600',
  avoid: 'text-red-500',
  unknown: 'text-gray-400',
}

interface SuggestedRecipe {
  title: string
  time_minutes: number
  servings: number
  ingredients: RecipeIngredient[]
  instructions: string
  fodmap_notes: string
}

export default function SuggestPage() {
  const { data: session, status } = useSession()
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([])
  const [preferences, setPreferences] = useState('')
  const [recipes, setRecipes] = useState<SuggestedRecipe[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<Record<number, boolean>>({})
  const [saved, setSaved] = useState<Record<number, boolean>>({})
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    if (!session) return
    fetch('/api/pantry').then(r => r.json()).then(setPantryItems)
  }, [session])

  async function generate() {
    setLoading(true)
    setError('')
    setRecipes([])
    setExpanded(null)
    const pantryNames = pantryItems.filter(i => i.fodmap_status !== 'avoid').map(i => i.name)
    const res = await fetch('/api/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pantry_items: pantryNames, preferences }),
    })
    const data = await res.json()
    if (data.error) {
      setError(data.error)
    } else {
      setRecipes(data.recipes || [])
      setExpanded(0)
    }
    setLoading(false)
  }

  async function saveRecipe(recipe: SuggestedRecipe, index: number) {
    setSaving(prev => ({ ...prev, [index]: true }))
    await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: recipe.title,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        fodmap_notes: recipe.fodmap_notes,
      }),
    })
    setSaved(prev => ({ ...prev, [index]: true }))
    setSaving(prev => ({ ...prev, [index]: false }))
  }

  if (status === 'loading') return null
  if (!session) return <SignInPrompt />

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-1">Recipe ideas</h1>
      <p className="text-sm text-gray-500 mb-4">Claude suggests recipes based on your pantry</p>

      {pantryItems.filter(i => i.fodmap_status !== 'avoid').length > 0 && (
        <div className="bg-green-50 rounded-xl px-4 py-3 mb-4">
          <p className="text-xs font-semibold text-green-700 mb-1">Using from your pantry:</p>
          <p className="text-xs text-green-600">
            {pantryItems.filter(i => i.fodmap_status !== 'avoid').map(i => i.name).join(', ')}
          </p>
        </div>
      )}

      <div className="space-y-3 mb-4">
        <input
          type="text"
          placeholder="Any preferences? (e.g. quick, warming, Asian flavours)"
          value={preferences}
          onChange={e => setPreferences(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
        />
        <button
          onClick={generate}
          disabled={loading}
          className="w-full bg-green-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {loading ? '✨ Generating ideas...' : '✨ Suggest recipes'}
        </button>
      </div>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      {recipes.length > 0 && (
        <div className="space-y-3">
          {recipes.map((recipe, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                className="w-full px-4 py-3 flex items-center justify-between text-left"
                onClick={() => setExpanded(expanded === i ? null : i)}
              >
                <div>
                  <p className="text-sm font-semibold text-gray-800">{recipe.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{recipe.time_minutes} min · {recipe.servings} servings</p>
                </div>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className={`w-4 h-4 text-gray-400 transition-transform ${expanded === i ? 'rotate-180' : ''}`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {expanded === i && (
                <div className="px-4 pb-4 space-y-4 border-t border-gray-50">
                  <div className="pt-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ingredients</p>
                    <ul className="space-y-1">
                      {recipe.ingredients.map((ing, j) => (
                        <li key={j} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">{ing.amount} {ing.unit} {ing.name}</span>
                          <span className={`text-xs font-medium ${STATUS_STYLES[ing.fodmap_status] || STATUS_STYLES.unknown}`}>
                            {ing.fodmap_status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Method</p>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{recipe.instructions}</p>
                  </div>

                  {recipe.fodmap_notes && (
                    <div className="bg-amber-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-amber-700">{recipe.fodmap_notes}</p>
                    </div>
                  )}

                  <button
                    onClick={() => saveRecipe(recipe, i)}
                    disabled={saving[i] || saved[i]}
                    className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                      saved[i]
                        ? 'bg-green-100 text-green-700'
                        : 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50'
                    }`}
                  >
                    {saved[i] ? '✓ Saved' : saving[i] ? 'Saving...' : 'Save recipe'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
