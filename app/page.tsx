'use client'

import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SignInPrompt } from '@/components/SignInPrompt'
import type { MealPlanEntry } from '@/lib/types'

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack']
const MEAL_LABELS: Record<string, string> = {
  breakfast: '🌅 Breakfast',
  lunch: '☀️ Lunch',
  dinner: '🌙 Dinner',
  snack: '🍎 Snack',
}

export default function HomePage() {
  const { data: session, status } = useSession()
  const [todayMeals, setTodayMeals] = useState<MealPlanEntry[]>([])

  const today = new Date().toLocaleDateString('en-CA')
  const dayName = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  useEffect(() => {
    if (!session) return
    fetch(`/api/plan?from=${today}&to=${today}`)
      .then(r => r.json())
      .then(setTodayMeals)
  }, [session, today])

  if (status === 'loading') return null
  if (!session) return <SignInPrompt />

  const mealsByType = Object.fromEntries(
    todayMeals.map(m => [m.meal_type, m])
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Hi, {session.user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-sm text-gray-500">{dayName}</p>
        </div>
        <button onClick={() => signOut()} className="text-xs text-gray-400 hover:text-gray-600">
          Sign out
        </button>
      </div>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Today&apos;s meals</h2>
        <div className="space-y-2">
          {MEAL_ORDER.map(type => {
            const meal = mealsByType[type]
            return (
              <Link
                key={type}
                href="/plan"
                className="flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100 hover:border-green-200 transition-colors"
              >
                <span className="text-sm text-gray-500">{MEAL_LABELS[type]}</span>
                {meal?.recipe_title ? (
                  <span className="text-sm font-medium text-gray-800 text-right max-w-[60%]">{meal.recipe_title}</span>
                ) : (
                  <span className="text-xs text-gray-300 italic">not planned</span>
                )}
              </Link>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/suggest" className="bg-green-50 border border-green-100 rounded-xl px-4 py-4 text-center hover:bg-green-100 transition-colors">
            <div className="text-2xl mb-1">💡</div>
            <p className="text-sm font-medium text-green-800">Get recipe ideas</p>
          </Link>
          <Link href="/adapt" className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-4 text-center hover:bg-amber-100 transition-colors">
            <div className="text-2xl mb-1">✨</div>
            <p className="text-sm font-medium text-amber-800">Adapt a recipe</p>
          </Link>
          <Link href="/pantry" className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-4 text-center hover:bg-blue-100 transition-colors">
            <div className="text-2xl mb-1">🧄</div>
            <p className="text-sm font-medium text-blue-800">Update pantry</p>
          </Link>
          <Link href="/shopping" className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-4 text-center hover:bg-purple-100 transition-colors">
            <div className="text-2xl mb-1">🛒</div>
            <p className="text-sm font-medium text-purple-800">Shopping list</p>
          </Link>
        </div>
      </section>
    </div>
  )
}
