'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useRef, useState } from 'react'
import { SignInPrompt } from '@/components/SignInPrompt'
import type { PantryItem, FodmapStatus } from '@/lib/types'

const STATUS_STYLES: Record<FodmapStatus, string> = {
  safe: 'bg-green-100 text-green-700',
  moderate: 'bg-amber-100 text-amber-700',
  avoid: 'bg-red-100 text-red-600',
  unknown: 'bg-gray-100 text-gray-500',
}

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

interface SuggestedItem {
  name: string
  quantity: string
  fodmap_status: FodmapStatus
  selected: boolean
}

export default function PantryPage() {
  const { data: session, status } = useSession()
  const [items, setItems] = useState<PantryItem[]>([])
  const [name, setName] = useState('')
  const [fodmapStatus, setFodmapStatus] = useState<FodmapStatus>('safe')
  const [quantity, setQuantity] = useState('')
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(true)
  const [mutationError, setMutationError] = useState('')

  // Scan state
  const [showScan, setShowScan] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [scanError, setScanError] = useState('')
  const [suggested, setSuggested] = useState<SuggestedItem[]>([])
  const [addingBulk, setAddingBulk] = useState(false)
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set())

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

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
    setMutationError('')
    try {
      const res = await fetch('/api/pantry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), fodmap_status: fodmapStatus, quantity: quantity || null }),
      })
      if (!res.ok) {
        const data = await res.json()
        setMutationError(data.error ?? 'Failed to add item — try again')
        return
      }
      const newItem = await res.json()
      setItems(prev => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)))
      setName('')
      setQuantity('')
      setFodmapStatus('safe')
    } catch {
      setMutationError('Failed to add item — check your connection')
    } finally {
      setAdding(false)
    }
  }

  async function deleteItem(id: string) {
    setMutationError('')
    try {
      const res = await fetch(`/api/pantry?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        setMutationError('Failed to remove item — try again')
        return
      }
      setItems(prev => prev.filter(i => i.id !== id))
      setNewlyAddedIds(prev => { const next = new Set(prev); next.delete(id); return next })
    } catch {
      setMutationError('Failed to remove item — check your connection')
    }
  }

  async function handlePhotoSelected(file: File) {
    // Client-side size guard before sending anything
    if (file.size > MAX_FILE_BYTES) {
      setScanError(`Image is too large (${(file.size / 1e6).toFixed(1)} MB) — please use a photo under 10 MB`)
      return
    }

    setAnalyzing(true)
    setScanError('')
    setSuggested([])

    let data: { items?: unknown; error?: string }
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch('/api/pantry/analyze', { method: 'POST', body: formData })

      try {
        data = await res.json()
      } catch {
        // Server returned a non-JSON body — typically a proxy/platform size-limit rejection
        setScanError(
          res.status === 413
            ? 'Image is too large for the server — please try a smaller or compressed photo'
            : `Server error (${res.status}) — please try again`
        )
        return
      }

      if (!res.ok) {
        setScanError(data.error ?? `Server error ${res.status} — please try again`)
        return
      }
    } catch (err: unknown) {
      // Only reaches here when fetch itself throws (no response at all)
      const msg = err instanceof Error ? err.message : String(err)
      setScanError(`Network error — could not reach the server: ${msg}`)
      return
    } finally {
      setAnalyzing(false)
    }

    if (!Array.isArray(data.items)) {
      setScanError(`Unexpected response from server — ${JSON.stringify(data)}`)
      return
    }

    const rawItems = data.items as Array<{ name: string; quantity?: string; fodmap_status: FodmapStatus }>
    if (rawItems.length === 0) {
      setScanError("Claude couldn't identify any food items in this photo — try a clearer or closer shot")
      return
    }

    setSuggested(rawItems.map(item => ({
      name: item.name,
      quantity: item.quantity ?? '',
      fodmap_status: item.fodmap_status,
      selected: true,
    })))
  }

  async function handleAddSuggested() {
    const toAdd = suggested.filter(i => i.selected && i.name.trim())
    if (toAdd.length === 0) return
    setAddingBulk(true)
    setScanError('')
    try {
      const results = await Promise.all(
        toAdd.map(item =>
          fetch('/api/pantry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: item.name.trim(),
              fodmap_status: item.fodmap_status,
              quantity: item.quantity || null,
            }),
          }).then(r => r.ok ? r.json() : null)
        )
      )
      const newItems = results.filter(Boolean) as PantryItem[]
      setItems(prev => [...prev, ...newItems].sort((a, b) => a.name.localeCompare(b.name)))

      // Mark newly added items so they're highlighted in the list
      const ids = new Set(newItems.map(i => i.id))
      setNewlyAddedIds(ids)
      setTimeout(() => setNewlyAddedIds(new Set()), 8000)

      setShowScan(false)
      setSuggested([])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setScanError(`Failed to add items — ${msg}`)
    } finally {
      setAddingBulk(false)
    }
  }

  function updateSuggested(index: number, patch: Partial<SuggestedItem>) {
    setSuggested(prev => prev.map((item, i) => i === index ? { ...item, ...patch } : item))
  }

  function toggleScan() {
    if (showScan) {
      setShowScan(false)
      setSuggested([])
      setScanError('')
      setAnalyzing(false)
    } else {
      setShowScan(true)
    }
  }

  if (status === 'loading') return null
  if (!session) return <SignInPrompt />

  const selectedCount = suggested.filter(i => i.selected).length

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-4">Pantry</h1>

      {/* Add ingredient form */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">Add ingredient</h2>
        <form onSubmit={addItem} className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ingredient name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
            />
            <button
              type="button"
              onClick={toggleScan}
              title="Scan photo"
              className={`flex items-center justify-center w-10 h-10 rounded-lg border transition-colors ${showScan ? 'bg-green-600 border-green-600 text-white' : 'border-gray-200 text-gray-400 hover:text-green-600 hover:border-green-300'}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
              </svg>
            </button>
          </div>
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
          {mutationError && <p className="text-xs text-red-500">{mutationError}</p>}
        </form>
      </div>

      {/* Photo scan section */}
      {showScan && (
        <div className="mb-6">
          {!analyzing && suggested.length === 0 && (
            <>
              <p className="text-sm text-gray-500 mb-3">
                Take or choose a photo of your pantry or fridge — Claude will identify the ingredients.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-4 shadow-sm hover:border-green-300 hover:bg-green-50 transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5 text-green-600 shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Take photo</span>
                </button>
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-4 shadow-sm hover:border-green-300 hover:bg-green-50 transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5 text-green-600 shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Choose from gallery</span>
                </button>
              </div>
              {scanError && (
                <div className="mt-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-600 font-mono break-all">{scanError}</p>
                </div>
              )}
            </>
          )}

          {analyzing && (
            <div className="flex items-center gap-3 py-6 text-gray-400">
              <svg className="w-5 h-5 animate-spin text-green-500 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <p className="text-sm">Analysing photo…</p>
            </div>
          )}

          {!analyzing && suggested.length > 0 && (
            <>
              <p className="text-sm text-gray-500 mb-3">
                Review and edit what Claude found. Uncheck anything you don&apos;t want to add.
              </p>
              <ul className="space-y-2 mb-4">
                {suggested.map((item, i) => (
                  <li key={i} className={`bg-white rounded-xl border px-4 py-3 shadow-sm transition-opacity ${item.selected ? 'border-gray-100' : 'border-gray-100 opacity-50'}`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={e => updateSuggested(i, { selected: e.target.checked })}
                        className="mt-1 accent-green-600"
                      />
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={e => updateSuggested(i, { name: e.target.value })}
                          className="w-full text-sm font-medium text-gray-800 border-b border-transparent hover:border-gray-200 focus:border-green-300 focus:outline-none bg-transparent pb-0.5"
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={item.quantity}
                            onChange={e => updateSuggested(i, { quantity: e.target.value })}
                            placeholder="Quantity (optional)"
                            className="flex-1 text-xs text-gray-500 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-300"
                          />
                          <select
                            value={item.fodmap_status}
                            onChange={e => updateSuggested(i, { fodmap_status: e.target.value as FodmapStatus })}
                            className={`text-xs px-2 py-1.5 rounded-lg border border-gray-200 font-medium focus:outline-none focus:ring-2 focus:ring-green-300 bg-white ${STATUS_STYLES[item.fodmap_status]}`}
                          >
                            <option value="safe">Safe</option>
                            <option value="moderate">Moderate</option>
                            <option value="avoid">Avoid</option>
                            <option value="unknown">Unknown</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {scanError && (
                <div className="mb-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-600 font-mono break-all">{scanError}</p>
                </div>
              )}
              <button
                onClick={handleAddSuggested}
                disabled={addingBulk || selectedCount === 0}
                className="w-full bg-green-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {addingBulk ? 'Adding…' : `Add ${selectedCount} item${selectedCount === 1 ? '' : 's'} to pantry`}
              </button>
            </>
          )}
        </div>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoSelected(f) }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoSelected(f) }}
      />

      {/* Items list */}
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Your pantry is empty — add some ingredients above.</p>
      ) : (
        <ul className="space-y-2">
          {items.map(item => {
            const isNew = newlyAddedIds.has(item.id)
            return (
              <li
                key={item.id}
                className={`flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm border transition-colors ${isNew ? 'border-l-4 border-l-green-400 border-green-100' : 'border-gray-100'}`}
              >
                <div>
                  <span className="text-sm font-medium text-gray-800">{item.name}</span>
                  {item.quantity && <span className="text-xs text-gray-400 ml-1.5">{item.quantity}</span>}
                  {isNew && <span className="text-xs bg-green-100 text-green-600 rounded px-1.5 py-0.5 ml-2 font-medium">New</span>}
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
            )
          })}
        </ul>
      )}
    </div>
  )
}
