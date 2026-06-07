'use client'

import { useSession } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SignInPrompt } from '@/components/SignInPrompt'
import type { RecipeSearchResult } from '@/app/api/search/route'

export default function FindPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<RecipeSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searched, setSearched] = useState(false)

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

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-1">Find a recipe</h1>
      <p className="text-sm text-gray-500 mb-4">Search real recipes from trusted sites — then fetch and adapt for FODMAP</p>

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
