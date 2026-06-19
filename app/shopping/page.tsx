'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { SignInPrompt } from '@/components/SignInPrompt'
import type { ShoppingItem, MealPlanEntry, Recipe } from '@/lib/types'

export default function ShoppingPage() {
  const { data: session, status } = useSession()
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [newItem, setNewItem] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [consolidating, setConsolidating] = useState(false)
  const [clearingAll, setClearingAll] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')
  const [mutationError, setMutationError] = useState('')
  const [pantryNotes, setPantryNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!session) return
    fetch('/api/shopping')
      .then(r => r.json())
      .then(data => { setItems(data); setLoading(false) })
  }, [session])

  async function addItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newItem.trim()) return
    setMutationError('')
    try {
      const res = await fetch('/api/shopping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newItem.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        setMutationError(data.error ?? 'Failed to add item — try again')
        return
      }
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        setItems(prev => [data[0], ...prev])
        setNewItem('')
      }
    } catch {
      setMutationError('Failed to add item — check your connection')
    }
  }

  async function toggleItem(item: ShoppingItem) {
    setMutationError('')
    try {
      const res = await fetch(`/api/shopping?id=${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_checked: !item.is_checked }),
      })
      if (!res.ok) {
        setMutationError('Failed to update item — try again')
        return
      }
      const updated = await res.json()
      setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
    } catch {
      setMutationError('Failed to update item — check your connection')
    }
  }

  async function deleteItem(id: string) {
    setMutationError('')
    try {
      const res = await fetch(`/api/shopping?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        setMutationError('Failed to remove item — try again')
        return
      }
      setItems(prev => prev.filter(i => i.id !== id))
    } catch {
      setMutationError('Failed to remove item — check your connection')
    }
  }

  async function clearChecked() {
    setMutationError('')
    try {
      const res = await fetch('/api/shopping?checked=true', { method: 'DELETE' })
      if (!res.ok) {
        setMutationError('Failed to clear done items — try again')
        return
      }
      setItems(prev => prev.filter(i => !i.is_checked))
    } catch {
      setMutationError('Failed to clear done items — check your connection')
    }
  }

  async function clearAll() {
    if (!confirm('Clear the entire shopping list?')) return
    setClearingAll(true)
    setMutationError('')
    try {
      const res = await fetch('/api/shopping?all=true', { method: 'DELETE' })
      if (!res.ok) {
        setMutationError('Failed to clear list — try again')
        return
      }
      setItems([])
      setPantryNotes({})
    } catch {
      setMutationError('Failed to clear list — check your connection')
    } finally {
      setClearingAll(false)
    }
  }

  async function generateFromPlan() {
    setGenerating(true)
    setMutationError('')
    const day = new Date().getDay()
    const monday = new Date()
    monday.setDate(new Date().getDate() - ((day + 6) % 7))
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)

    const from = monday.toLocaleDateString('en-CA')
    const to = sunday.toLocaleDateString('en-CA')

    try {
      const planRes = await fetch(`/api/plan?from=${from}&to=${to}`)
      if (!planRes.ok) {
        setMutationError('Failed to load plan — try again')
        return
      }
      const planEntries: MealPlanEntry[] = await planRes.json()

      const recipeIds = [...new Set(planEntries.map(e => e.recipe_id).filter(Boolean))] as string[]
      if (recipeIds.length === 0) {
        setGenerating(false)
        return
      }

      const recipesRes = await fetch('/api/recipes')
      if (!recipesRes.ok) {
        setMutationError('Failed to load recipes — try again')
        return
      }
      const allRecipes: Recipe[] = await recipesRes.json()
      const plannedRecipes = allRecipes.filter(r => recipeIds.includes(r.id))

      const ingredientMap: Map<string, string> = new Map()
      for (const recipe of plannedRecipes) {
        for (const ing of recipe.ingredients || []) {
          const key = ing.name.toLowerCase()
          if (!ingredientMap.has(key)) {
            const parts = [ing.amount, ing.unit, ing.name].filter(v => v != null && v !== '')
            ingredientMap.set(key, parts.join(' '))
          }
        }
      }

      if (ingredientMap.size === 0) {
        setGenerating(false)
        return
      }

      const newItems = Array.from(ingredientMap.values()).map(name => ({ name }))
      const res = await fetch('/api/shopping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItems),
      })
      if (!res.ok) {
        setMutationError('Failed to add items to shopping list — try again')
        return
      }
      const data = await res.json()
      setItems(prev => [...data, ...prev])
    } catch {
      setMutationError('Something went wrong — check your connection')
    } finally {
      setGenerating(false)
    }
  }

  function formatListForExport(): string {
    const lines = items.filter(i => !i.is_checked).map(i => `- ${i.name}`)
    return 'Shopping list\n\n' + lines.join('\n')
  }

  async function handleExport() {
    const text = formatListForExport()
    if (navigator.share) {
      await navigator.share({ title: 'Shopping list', text })
    } else {
      await navigator.clipboard.writeText(text)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2000)
    }
  }

  function tescoSearchUrl(itemName: string): string {
    let s = itemName.trim()
    let prev = ''
    while (prev !== s) {
      prev = s
      s = s
        .replace(/^\d+\/\d+\s*/i, '')
        .replace(/^\d+(\.\d+)?\s*/i, '')
        .replace(/^(tablespoons?|teaspoons?|kilograms?|grams?|millilitres?|milliliters?|centilitres?|centiliters?|litres?|liters?|ounces?|pounds?|cups?|cloves?|cans?|tins?|bunches?|heads?|sticks?|sprigs?|rashers?|slices?|pieces?|handfuls?|pinch(?:es)?|sachets?|portions?|tbsps?|tsps?|kg|ml|cl|oz|lbs?|g|l)\s*/i, '')
        .replace(/^(x|×)\s*/i, '')
        .replace(/^of\s*/i, '')
        .replace(/^an?\s*/i, '')
        .replace(/^\(.*?\)\s*/i, '')
        .trim()
    }
    return `https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(s)}`
  }

  async function consolidateList() {
    const uncheckedNames = items.filter(i => !i.is_checked).map(i => i.name)
    if (uncheckedNames.length < 2) return
    setConsolidating(true)
    setMutationError('')
    try {
      const res = await fetch('/api/shopping/consolidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: uncheckedNames }),
      })
      if (!res.ok) {
        const data = await res.json()
        setMutationError(data.error ?? 'Failed to consolidate — try again')
        return
      }
      const { items: consolidated }: { items: { name: string; pantry_note?: string }[] } = await res.json()

      // Build pantry notes map keyed by normalised name
      const notes: Record<string, string> = {}
      for (const item of consolidated) {
        if (item.pantry_note) notes[item.name.toLowerCase()] = item.pantry_note
      }

      // Delete all unchecked items then re-add the consolidated ones
      const uncheckedIds = items.filter(i => !i.is_checked).map(i => i.id)
      await Promise.all(uncheckedIds.map(id =>
        fetch(`/api/shopping?id=${id}`, { method: 'DELETE' })
      ))

      const addRes = await fetch('/api/shopping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(consolidated.map(i => ({ name: i.name }))),
      })
      if (!addRes.ok) {
        setMutationError('Failed to save consolidated list — refresh and try again')
        return
      }
      const newItems = await addRes.json()
      setItems(prev => [...newItems, ...prev.filter(i => i.is_checked)])
      setPantryNotes(notes)
    } catch {
      setMutationError('Something went wrong — check your connection')
    } finally {
      setConsolidating(false)
    }
  }

  if (status === 'loading') return null
  if (!session) return <SignInPrompt />

  const unchecked = items.filter(i => !i.is_checked)
  const checked = items.filter(i => i.is_checked)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-800">Shopping list</h1>
        <div className="flex items-center gap-3">
          {unchecked.length > 0 && (
            <button onClick={handleExport} className="text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors">
              {copyState === 'copied' ? 'Copied!' : 'Export'}
            </button>
          )}
          {checked.length > 0 && (
            <button onClick={clearChecked} className="text-xs text-gray-400 hover:text-gray-600 font-medium">
              Clear done
            </button>
          )}
          {items.length > 0 && (
            <button
              onClick={clearAll}
              disabled={clearingAll}
              className="text-xs text-red-400 hover:text-red-600 font-medium disabled:opacity-50"
            >
              {clearingAll ? 'Clearing...' : 'Clear all'}
            </button>
          )}
        </div>
      </div>

      {mutationError && (
        <p className="text-xs text-red-500 mb-3">{mutationError}</p>
      )}

      <button
        onClick={generateFromPlan}
        disabled={generating}
        className="w-full bg-green-50 border border-green-200 text-green-700 rounded-xl py-2.5 text-sm font-medium hover:bg-green-100 disabled:opacity-50 transition-colors mb-2"
      >
        {generating ? 'Generating...' : '📅 Generate from this week\'s plan'}
      </button>

      {unchecked.length >= 2 && (
        <button
          onClick={consolidateList}
          disabled={consolidating}
          className="w-full bg-purple-50 border border-purple-200 text-purple-700 rounded-xl py-2.5 text-sm font-medium hover:bg-purple-100 disabled:opacity-50 transition-colors mb-4"
        >
          {consolidating ? 'Consolidating...' : '✨ Consolidate list'}
        </button>
      )}

      <form onSubmit={addItem} className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Add item..."
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
        />
        <button
          type="submit"
          disabled={!newItem.trim()}
          className="bg-green-600 text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Your shopping list is empty.</p>
      ) : (
        <div className="space-y-1.5">
          {unchecked.map(item => {
            const pantryNote = pantryNotes[item.name.toLowerCase()]
            return (
              <div key={item.id} className={`flex items-center gap-3 bg-white rounded-xl px-4 py-3 border shadow-sm ${pantryNote ? 'border-amber-200' : 'border-gray-100'}`}>
                <button
                  onClick={() => toggleItem(item)}
                  className="w-5 h-5 rounded-full border-2 border-gray-300 hover:border-green-500 shrink-0 flex items-center justify-center transition-colors"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-800">{item.name}</span>
                  {pantryNote && (
                    <span className="ml-2 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5 whitespace-nowrap">
                      {pantryNote}
                    </span>
                  )}
                </div>
                {item.quantity && <span className="text-xs text-gray-400">{item.quantity}</span>}
                <a
                  href={tescoSearchUrl(item.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-gray-300 hover:text-blue-500 shrink-0 font-medium transition-colors"
                >
                  Tesco
                </a>
                <button onClick={() => deleteItem(item.id)} className="text-gray-200 hover:text-red-400 shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )
          })}

          {checked.length > 0 && (
            <>
              <p className="text-xs text-gray-400 pt-2 pb-1 px-1">Done</p>
              {checked.map(item => (
                <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <button
                    onClick={() => toggleItem(item)}
                    className="w-5 h-5 rounded-full bg-green-500 border-2 border-green-500 shrink-0 flex items-center justify-center"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="w-3 h-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <span className="text-sm text-gray-400 line-through flex-1">{item.name}</span>
                  <button onClick={() => deleteItem(item.id)} className="text-gray-200 hover:text-red-400 shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
