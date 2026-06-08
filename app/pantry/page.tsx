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
    } catch {
      setMutationError('Failed to remove item — check your connection')
    }
  }

  async function handlePhotoSelected(file: File) {
    setAnalyzing(true)
    setScanError('')
    setSuggested([])
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch('/api/pantry/analyze', { method: 'POST', body: formData })
      if (!res.ok) {
        const data = await res.json()
        setScanError(data.error ?? 'Failed to analyse photo — try again')
        return
      }
      const data = await res.json()
      const rawItems: Array<{ name: string; quantity?: string; fodmap_status: FodmapStatus }> = data.items ?? []
      setSuggested(rawItems.map(item => ({
        name: item.name,
        quantity: item.quantity ?? '',
        fodmap_status: item.fodmap_status,
        selected: true,
      })))
    } catch {
      setScanError('Failed to analyse photo — check your connection')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleAddSuggested() {
    const toAdd = suggested.filter(i => i.selected && i.name.trim())
    if (toAdd.length === 0) return
    setAddingBulk(true)
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
      setShowScan(false)
      setSuggested([])
      setScanError('')
    } catch {
      setScanError('Failed to add items — check your connection')
    } finally {
      setAddingBulk(false)
    }
  }

  function updateSuggested(index: number, patch: Partial<SuggestedItem>) {
    setSuggested(prev => prev.map((item, i) => i === index ? { ...item, ...patch } : item))
  }

  function openScan() {
    setShowScan(true)
    setSuggested([])
    setScanError('')
    setAnalyzing(false)
  }

  function closeScan() {
    setShowScan(false)
    setSuggested([])
    setScanError('')
    setAnalyzing(false)
  }

  if (status === 'loading') return null
  if (!session) return <SignInPrompt />

  if (showScan) {
    const selectedCount = suggested.filter(i => i.selected).length

    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={closeScan} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-semibold text-gray-800">Scan pantry</h1>
        </div>

        {!analyzing && suggested.length === 0 && (
          <>
            <p className="text-sm text-gray-500 mb-6">
              Take or choose a photo of your pantry or fridge and Claude will identify the ingredients.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 flex flex-col items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-5 shadow-sm hover:border-green-300 hover:bg-green-50 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7 text-green-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Take photo</span>
              </button>

              <button
                onClick={() => galleryInputRef.current?.click()}
                className="flex-1 flex flex-col items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-5 shadow-sm hover:border-green-300 hover:bg-green-50 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7 text-green-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Choose from gallery</span>
              </button>
            </div>

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

            {scanError && <p className="text-xs text-red-500 mt-4">{scanError}</p>}
          </>
        )}

        {analyzing && (
          <div className="flex flex-col items-center gap-3 py-16 text-gray-400">
            <svg className="w-8 h-8 animate-spin text-green-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <p className="text-sm">Analysing photo…</p>
          </div>
        )}

        {!analyzing && suggested.length > 0 && (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Review and edit the items Claude found. Uncheck anything you don&apos;t want to add.
            </p>

            <ul className="space-y-2 mb-6">
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

            {scanError && <p className="text-xs text-red-500 mb-3">{scanError}</p>}

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
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-800">Pantry</h1>
        <button
          onClick={openScan}
          className="flex items-center gap-1.5 text-sm font-medium text-green-600 hover:text-green-700 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
          </svg>
          Scan photo
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Your pantry is empty — add some ingredients below.</p>
      ) : (
        <ul className="space-y-2 mb-6">
          {items.map(item => (
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
          {mutationError && <p className="text-xs text-red-500">{mutationError}</p>}
        </form>
      </div>
    </div>
  )
}
