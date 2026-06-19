'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SignInPrompt } from '@/components/SignInPrompt'
import type { RecipeSearchResult } from '@/app/api/search/route'
import type { PantryItem } from '@/lib/types'

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchesHaystack(name: string, hay: string): boolean {
  return new RegExp(`\\b${escapeRegex(name)}\\b`, 'i').test(hay)
}

export default function FindPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<RecipeSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searched, setSearched] = useState(false)
  const [sortByPantry, setSortByPantry] = useState(false)

  const [pantryItems, setPantryItems] = useState<PantryItem[]>([])
  const [pantryLoading, setPantryLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    fetch('/api/pantry')
      .then(r => r.ok ? r.json() : [])
      .then(data => setPantryItems(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setPantryLoading(false))
  }, [session])

  function pantryMatchCount(result: RecipeSearchResult): number {
    const hay = `${result.title} ${result.snippet ?? ''}`
    return pantryItems.filter(item => matchesHaystack(item.name, hay)).length
  }

  function matchingPantryItems(result: RecipeSearchResult): string[] {
    const hay = `${result.title} ${result.snippet ?? ''}`
    return pantryItems.filter(item => matchesHaystack(item.name, hay)).map(item => item.name)
  }

  function appendIngredient(name: string) {
    setSearchQuery(prev => {
      const lower = prev.toLowerCase().split(/\s+/)
      if (lower.includes(name.toLowerCase())) return prev
      return prev.trim() ? `${prev.trim()} ${name}` : name
    })
  }

  async function handleWebSearch() {
    const q = searchQuery.trim()
    if (!q) return
    setSearchLoading(true)
    setSearchError('')
    setSearchResults([])
    setSortByPantry(false)
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

  const pillItems = pantryItems.filter(i => i.fodmap_status === 'safe' || i.fodmap_status === 'moderate')

  const displayResults = sortByPantry
    ? [...searchResults].sort((a, b) => pantryMatchCount(b) - pantryMatchCount(a))
    : searchResults

  if (status === 'loading') return null
  if (!session) return <SignInPrompt />

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-1">Find a recipe</h1>
      <p className="text-sm text-gray-500 mb-4">Search real recipes from trusted sites — then fetch and adapt for FODMAP</p>

      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Pasta carbonara, Thai green curry..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleWebSearch()}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 pr-8"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSearchResults([]); setSearchError(''); setSearched(false) }}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              ×
            </button>
          )}
        </div>
        <button
          onClick={handleWebSearch}
          disabled={searchLoading || !searchQuery.trim()}
          className="bg-gray-700 text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 shrink-0"
        >
          {searchLoading ? '...' : 'Search'}
        </button>
      </div>

      {pantryLoading ? (
        <div className="flex gap-2 overflow-x-auto pb-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-7 w-20 bg-gray-100 rounded-full animate-pulse shrink-0" />
          ))}
        </div>
      ) : pillItems.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-3">
          {pillItems.map(item => {
            const active = searchQuery.toLowerCase().split(/\s+/).includes(item.name.toLowerCase())
            return (
              <button
                key={item.id}
                onClick={() => appendIngredient(item.name)}
                className={`text-xs px-3 py-1 rounded-full border shrink-0 transition-colors ${
                  active
                    ? 'bg-green-100 border-green-300 text-green-700 font-medium'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {active ? '✓ ' : ''}{item.name}
              </button>
            )
          })}
        </div>
      ) : null}

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
        <>
          {pillItems.length > 0 && (
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setSortByPantry(v => !v)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  sortByPantry
                    ? 'bg-green-100 border-green-300 text-green-700 font-medium'
                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                Sort by pantry match
              </button>
            </div>
          )}

          <div className="space-y-2">
            {displayResults.map((result, i) => {
              const count = pillItems.length > 0 ? pantryMatchCount(result) : 0
              const matches = pillItems.length > 0 ? matchingPantryItems(result) : []
              return (
                <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-gray-800 leading-snug">{result.title}</p>
                    {count > 0 && (
                      <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 shrink-0 whitespace-nowrap">
                        {count} pantry
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{result.source}</p>
                  {result.snippet && (
                    <p className="text-xs text-gray-500 leading-relaxed mb-2 line-clamp-2">{result.snippet}</p>
                  )}
                  {matches.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {matches.map(name => (
                        <span key={name} className="text-xs bg-green-50 text-green-700 rounded-md px-1.5 py-0.5">
                          {name}
                        </span>
                      ))}
                    </div>
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
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
