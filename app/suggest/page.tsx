'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SignInPrompt } from '@/components/SignInPrompt'
import type { PantryItem } from '@/lib/types'
import type { RecipeSearchResult } from '@/app/api/recipes/search/route'

export default function FindPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([])
  const [results, setResults] = useState<RecipeSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!session) return
    fetch('/api/pantry')
      .then(r => r.json())
      .then((items: PantryItem[]) => {
        setPantryItems(items)
        const usable = items.filter(i => i.fodmap_status !== 'avoid').map(i => i.name)
        if (usable.length > 0) {
          searchByIngredients(usable.join(','))
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  async function searchByIngredients(ingredients: string) {
    setLoading(true)
    setError('')
    setResults([])
    const res = await fetch(`/api/recipes/search?ingredients=${encodeURIComponent(ingredients)}`)
    const data = await res.json()
    if (data.error) setError(data.error)
    else setResults(data)
    setLoading(false)
    setSearched(true)
  }

  async function handleSearch() {
    const q = query.trim()
    setLoading(true)
    setError('')
    setResults([])
    const params = q ? `?ingredients=${encodeURIComponent(q)}` : ''
    const res = await fetch(`/api/recipes/search${params}`)
    const data = await res.json()
    if (data.error) setError(data.error)
    else setResults(data)
    setLoading(false)
    setSearched(true)
  }

  function handleFetchAndAdapt(url: string) {
    router.push('/adapt?url=' + encodeURIComponent(url))
  }

  if (status === 'loading') return null
  if (!session) return <SignInPrompt />

  const usablePantry = pantryItems.filter(i => i.fodmap_status !== 'avoid')

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-1">Find recipes</h1>
      <p className="text-sm text-gray-500 mb-4">Real recipes from trusted sites based on your pantry</p>

      {usablePantry.length > 0 ? (
        <div className="bg-green-50 rounded-xl px-4 py-3 mb-4">
          <p className="text-xs font-semibold text-green-700 mb-1">Searching with:</p>
          <p className="text-xs text-green-600 leading-relaxed">
            {usablePantry.map(i => i.name).join(', ')}
          </p>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 border border-gray-100">
          <p className="text-xs text-gray-500">Add ingredients to your <a href="/pantry" className="text-green-600 font-medium hover:underline">Pantry</a> to get personalised recipe suggestions, or search below.</p>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Search by ingredient or dish name..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="bg-green-600 text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          Search
        </button>
      </div>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 h-24 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && searched && results.length === 0 && !error && (
        <p className="text-sm text-gray-400 text-center py-8">No recipes found — try a different search.</p>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-3">
          {results.map((result, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex gap-3 p-3">
              {result.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={result.thumbnail}
                  alt=""
                  className="w-16 h-16 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-green-50 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6 text-green-300">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 leading-tight line-clamp-2">{result.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{result.source}</p>
                <div className="flex gap-2 mt-2">
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50"
                  >
                    View ↗
                  </a>
                  <button
                    onClick={() => handleFetchAndAdapt(result.url)}
                    className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1 hover:bg-green-100 font-medium"
                  >
                    Fetch &amp; Adapt
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
