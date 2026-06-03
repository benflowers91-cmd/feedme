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
  const [clearingAll, setClearingAll] = useState(false)

  useEffect(() => {
    if (!session) return
    fetch('/api/shopping')
      .then(r => r.json())
      .then(data => { setItems(data); setLoading(false) })
  }, [session])

  async function addItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newItem.trim()) return
    const res = await fetch('/api/shopping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newItem.trim() }),
    })
    const data = await res.json()
    setItems(prev => [data[0], ...prev])
    setNewItem('')
  }

  async function toggleItem(item: ShoppingItem) {
    const res = await fetch(`/api/shopping?id=${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_checked: !item.is_checked }),
    })
    const updated = await res.json()
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
  }

  async function deleteItem(id: string) {
    await fetch(`/api/shopping?id=${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function clearChecked() {
    await fetch('/api/shopping?checked=true', { method: 'DELETE' })
    setItems(prev => prev.filter(i => !i.is_checked))
  }

  async function clearAll() {
    setClearingAll(true)
    await fetch('/api/shopping?all=true', { method: 'DELETE' })
    setItems([])
    setClearingAll(false)
  }

  async function generateFromPlan() {
    setGenerating(true)
    const day = new Date().getDay()
    const monday = new Date()
    monday.setDate(new Date().getDate() - ((day + 6) % 7))
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)

    const from = monday.toISOString().split('T')[0]
    const to = sunday.toISOString().split('T')[0]

    const planRes = await fetch(`/api/plan?from=${from}&to=${to}`)
    const planEntries: MealPlanEntry[] = await planRes.json()

    const recipeIds = [...new Set(planEntries.map(e => e.recipe_id).filter(Boolean))] as string[]
    if (recipeIds.length === 0) {
      setGenerating(false)
      return
    }

    const recipesRes = await fetch('/api/recipes')
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
    const data = await res.json()
    setItems(prev => [...data, ...prev])
    setGenerating(false)
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

      <button
        onClick={generateFromPlan}
        disabled={generating}
        className="w-full bg-green-50 border border-green-200 text-green-700 rounded-xl py-2.5 text-sm font-medium hover:bg-green-100 disabled:opacity-50 transition-colors mb-4"
      >
        {generating ? 'Generating...' : '📅 Generate from this week\'s plan'}
      </button>

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
          {unchecked.map(item => (
            <div key={item.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm">
              <button
                onClick={() => toggleItem(item)}
                className="w-5 h-5 rounded-full border-2 border-gray-300 hover:border-green-500 shrink-0 flex items-center justify-center transition-colors"
              />
              <span className="text-sm text-gray-800 flex-1">{item.name}</span>
              {item.quantity && <span className="text-xs text-gray-400">{item.quantity}</span>}
              <button onClick={() => deleteItem(item.id)} className="text-gray-200 hover:text-red-400 shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

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
