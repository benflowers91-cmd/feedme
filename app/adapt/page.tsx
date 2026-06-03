'use client'

import { useSession } from 'next-auth/react'
import { useState } from 'react'
import { SignInPrompt } from '@/components/SignInPrompt'
import type { RecipeIngredient } from '@/lib/types'

const STATUS_STYLES: Record<string, string> = {
  safe: 'text-green-600',
  moderate: 'text-amber-600',
  avoid: 'text-red-500',
  unknown: 'text-gray-400',
}

interface AdaptedRecipe {
  title: string
  ingredients: RecipeIngredient[]
  instructions: string
  substitutions: { original: string; substitute: string; reason: string }[]
  fodmap_notes: string
}

export default function AdaptPage() {
  const { data: session, status } = useSession()
  const [recipeText, setRecipeText] = useState('')
  const [result, setResult] = useState<AdaptedRecipe | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function adapt() {
    setLoading(true)
    setError('')
    setResult(null)
    setSaved(false)
    const res = await fetch('/api/adapt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe_text: recipeText }),
    })
    const data = await res.json()
    if (data.error) {
      setError(data.error)
    } else {
      setResult(data)
    }
    setLoading(false)
  }

  async function saveRecipe() {
    if (!result) return
    setSaving(true)
    await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: result.title,
        ingredients: result.ingredients,
        instructions: result.instructions,
        fodmap_notes: result.fodmap_notes,
      }),
    })
    setSaved(true)
    setSaving(false)
  }

  if (status === 'loading') return null
  if (!session) return <SignInPrompt />

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-1">Adapt a recipe</h1>
      <p className="text-sm text-gray-500 mb-4">Paste any recipe and Claude will make it low-FODMAP safe</p>

      <textarea
        value={recipeText}
        onChange={e => setRecipeText(e.target.value)}
        placeholder="Paste your recipe here — ingredients and method..."
        rows={8}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-300 mb-3"
      />

      <button
        onClick={adapt}
        disabled={loading || !recipeText.trim()}
        className="w-full bg-green-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors mb-4"
      >
        {loading ? '✨ Adapting recipe...' : '✨ Adapt for FODMAP'}
      </button>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      {result && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h2 className="text-base font-semibold text-gray-800 mb-4">{result.title}</h2>

            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ingredients</p>
              <ul className="space-y-1.5">
                {result.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{ing.amount} {ing.unit} {ing.name}</span>
                    <span className={`text-xs font-medium ${STATUS_STYLES[ing.fodmap_status] || STATUS_STYLES.unknown}`}>
                      {ing.fodmap_status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Method</p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{result.instructions}</p>
            </div>

            {result.substitutions.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Substitutions made</p>
                <ul className="space-y-2">
                  {result.substitutions.map((sub, i) => (
                    <li key={i} className="bg-amber-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-amber-800">
                        <span className="line-through text-red-400">{sub.original}</span>
                        {' → '}
                        <span className="font-medium">{sub.substitute}</span>
                      </p>
                      <p className="text-xs text-amber-600 mt-0.5">{sub.reason}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.fodmap_notes && (
              <div className="bg-green-50 rounded-lg px-3 py-2 mb-4">
                <p className="text-xs text-green-700">{result.fodmap_notes}</p>
              </div>
            )}

            <button
              onClick={saveRecipe}
              disabled={saving || saved}
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
                saved
                  ? 'bg-green-100 text-green-700'
                  : 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50'
              }`}
            >
              {saved ? '✓ Saved to recipes' : saving ? 'Saving...' : 'Save adapted recipe'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
