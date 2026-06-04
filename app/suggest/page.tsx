'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SignInPrompt } from '@/components/SignInPrompt'
import type { PantryItem } from '@/lib/types'
import type { RecipeSearchResult } from '@/app/api/search/route'

interface SuggestedIngredient {
  name: string
  amount?: string
  unit?: string
  fodmap_status: string
}

interface SuggestedRecipe {
  title: string
  time_minutes: number
  servings: number
  ingredients: SuggestedIngredient[]
  instructions: string
  fodmap_notes: string
}

export default function FindPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [pantryItems, setPantryItems] = useState<PantryItem[]>([])

  // AI suggestions
  const [suggestions, setSuggestions] = useState<SuggestedRecipe[]>([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestError, setSuggestError] = useState('')
  const [preferences, setPreferences] = useState('')
  const [savedIndexes, setSavedIndexes] = useState<Set<number>>(new Set())
  const [savingIndex, setSavingIndex] = useState<number | null>(null)

  // Web search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<RecipeSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    if (!session) return
    fetch('/api/pantry')
      .then(r => r.json())
      .then((items: PantryItem[]) => {
        setPantryItems(items)
        const usable = items.filter(i => i.fodmap_status !== 'avoid').map(i => i.name)
        getSuggestions(usable, '')
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  async function getSuggestions(pantry: string[], prefs: string) {
    setSuggestLoading(true)
    setSuggestError('')
    setSuggestions([])
    setSavedIndexes(new Set())
    const res = await fetch('/api/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pantry_items: pantry, preferences: prefs }),
    })
    const data = await res.json()
    setSuggestLoading(false)
    if (data.error) {
      setSuggestError(data.error)
    } else {
      setSuggestions(data.recipes ?? [])
    }
  }

  async function handleRefresh() {
    const usable = pantryItems.filter(i => i.fodmap_status !== 'avoid').map(i => i.name)
    getSuggestions(usable, preferences.trim())
  }

  async function saveRecipe(recipe: SuggestedRecipe, index: number) {
    setSavingIndex(index)
    const res = await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: recipe.title,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        fodmap_notes: recipe.fodmap_notes,
        source_url: null,
      }),
    })
    setSavingIndex(null)
    if (res.ok) {
      setSavedIndexes(prev => new Set(prev).add(index))
    }
  }

  async function handleWebSearch() {
    const q = searchQuery.trim()
    if (!q) return
    setSearchLoading(true)
    setSearchError('')
    setSearchResults([])
    setSearched(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (data.error) {
        setSearchError(data.error)
      } else {
        setSearchResults(data)
      }
    } catch {
      setSearchError('Search failed — check your connection')
    } finally {
      setSearchLoading(false)
    }
  }

  if (status === 'loading') return null
  if (!session) return <SignInPrompt />

  const usablePantry = pantryItems.filter(i => i.fodmap_status !== 'avoid')

  return (
    <div>
      {/* ── AI suggestions ── */}
      <h1 className="text-xl font-semibold text-gray-800 mb-1">Recipe ideas</h1>
      <p className="text-sm text-gray-500 mb-4">Claude suggests safe recipes based on your pantry</p>

      {usablePantry.length > 0 ? (
        <div className="bg-green-50 rounded-xl px-4 py-3 mb-4">
          <p className="text-xs font-semibold text-green-700 mb-1">Suggesting from:</p>
          <p className="text-xs text-green-600 leading-relaxed">
            {usablePantry.map(i => i.name).join(', ')}
          </p>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 border border-gray-100">
          <p className="text-xs text-gray-500">Add ingredients to your <a href="/pantry" className="text-green-600 font-medium hover:underline">Pantry</a> to get personalised suggestions.</p>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Quick and easy, Italian, vegetarian..."
          value={preferences}
          onChange={e => setPreferences(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleRefresh()}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
        />
        <button
          onClick={handleRefresh}
          disabled={suggestLoading}
          className="bg-green-600 text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-green-700 disabled:opacity-50 shrink-0"
        >
          {suggestLoading ? '...' : 'Refresh'}
        </button>
      </div>

      {suggestError && <p className="text-sm text-red-500 mb-4">{suggestError}</p>}

      {suggestLoading && (
        <div className="space-y-3 mb-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 h-28 animate-pulse" />
          ))}
        </div>
      )}

      {!suggestLoading && suggestions.length > 0 && (
        <div className="space-y-3 mb-6">
          {suggestions.map((recipe, i) => {
            const isSaved = savedIndexes.has(i)
            const isSaving = savingIndex === i
            const topIngredients = recipe.ingredients.slice(0, 5).map(ing => ing.name).join(', ')
            const more = recipe.ingredients.length > 5 ? ` +${recipe.ingredients.length - 5} more` : ''

            return (
              <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold text-gray-800 leading-snug">{recipe.title}</p>
                  <span className="text-xs text-gray-400 shrink-0">{recipe.time_minutes}m · {recipe.servings} srv</span>
                </div>
                <p className="text-xs text-gray-400 mb-3 leading-relaxed">{topIngredients}{more}</p>
                {recipe.fodmap_notes && (
                  <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5 mb-3">{recipe.fodmap_notes}</p>
                )}
                <button
                  onClick={() => saveRecipe(recipe, i)}
                  disabled={isSaved || isSaving}
                  className={`w-full py-2 rounded-xl text-xs font-medium transition-colors ${
                    isSaved
                      ? 'bg-green-100 text-green-700'
                      : 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50'
                  }`}
                >
                  {isSaved ? '✓ Saved to your recipes' : isSaving ? 'Saving...' : 'Save recipe'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Web search ── */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 border-t border-gray-100" />
        <span className="text-xs text-gray-400 shrink-0">or search real recipes</span>
        <div className="flex-1 border-t border-gray-100" />
      </div>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Pasta carbonara, Thai green curry..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleWebSearch()}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
        />
        <button
          onClick={handleWebSearch}
          disabled={searchLoading || !searchQuery.trim()}
          className="bg-gray-700 text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 shrink-0"
        >
          {searchLoading ? '...' : 'Search'}
        </button>
      </div>

      {searchError && <p className="text-sm text-red-500 mb-4">{searchError}</p>}

      {searchLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 h-20 animate-pulse" />
          ))}
        </div>
      )}

      {!searchLoading && searched && searchResults.length === 0 && !searchError && (
        <p className="text-sm text-gray-400 text-center py-6">No results — try a different search.</p>
      )}

      {!searchLoading && searchResults.length > 0 && (
        <div className="space-y-2">
          {searchResults.map((result, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-sm font-semibold text-gray-800 leading-snug mb-0.5">{result.title}</p>
              <p className="text-xs text-gray-400 mb-2">{result.source}</p>
              {result.snippet && (
                <p className="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-2">{result.snippet}</p>
              )}
              <div className="flex gap-2">
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
                >
                  View ↗
                </a>
                <button
                  onClick={() => router.push('/adapt?url=' + encodeURIComponent(result.url))}
                  className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 hover:bg-green-100 font-medium"
                >
                  Fetch &amp; Adapt
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
