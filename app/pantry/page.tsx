'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { SignInPrompt } from '@/components/SignInPrompt'
import type { PantryItem, FodmapStatus } from '@/lib/types'

const STATUS_STYLES: Record<FodmapStatus, string> = {
  safe: 'bg-green-100 text-green-700',
  moderate: 'bg-amber-100 text-amber-700',
  avoid: 'bg-red-100 text-red-600',
  unknown: 'bg-gray-100 text-gray-500',
}

export default function PantryPage() {
  const { data: session, status } = useSession()
  const [items, setItems] = useState<PantryItem[]>([])
  const [search, setSearch] = useState('')
  const [name, setName] = useState('')
  const [fodmapStatus, setFodmapStatus] = useState<FodmapStatus>('safe')
  const [quantity, setQuantity] = useState('')
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    fetch('/api/pantry')
      .then(r => r.json())
      .then(data => { setItems(data); setLoading(false) })
  }, [session])

  async function addItem(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setAdding(true)
    const res = await fetch('/api/pantry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), fodmap_status: fodmapStatus, quantity: quantity || null }),
    })
    const newItem = await res.json()
    setItems(prev => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)))
    setName('')
    setQuantity('')
    setFodmapStatus('safe')
    setAdding(false)
  }

  async function deleteItem(id: string) {
    await fetch(`/api/pantry?id=${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
  }

  if (status === 'loading') return null
  if (!session) return <SignInPrompt />

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-4">Pantry</h1>

      <input
        type="text"
        placeholder="Search ingredients..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-green-300"
      />

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          {search ? 'No ingredients match your search.' : 'Your pantry is empty — add some ingredients below.'}
        </p>
      ) : (
        <ul className="space-y-2 mb-6">
          {filtered.map(item => (
            <li key={item.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
              <div>
                <span className="text-sm font-medium text-gray-800">{item.name}</span>
                {item.quantity && <span className="text-xs text-gray-400 ml-1.5">{item.quantity}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[item.fodmap_status as FodmapStatus]}`}>
                  {item.fodmap_status}
                </span>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors p-1"
                  aria-label="Remove"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">Add ingredient</h2>
        <form onSubmit={addItem} className="space-y-3">
          <input
            type="text"
            placeholder="Ingredient name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
          />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Quantity (optional)"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
            />
            <select
              value={fodmapStatus}
              onChange={e => setFodmapStatus(e.target.value as FodmapStatus)}
              className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
            >
              <option value="safe">Safe</option>
              <option value="moderate">Moderate</option>
              <option value="avoid">Avoid</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={adding || !name.trim()}
            className="w-full bg-green-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {adding ? 'Adding...' : 'Add to pantry'}
          </button>
        </form>
      </div>
    </div>
  )
}
