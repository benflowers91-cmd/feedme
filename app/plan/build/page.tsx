'use client'

import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { SignInPrompt } from '@/components/SignInPrompt'
import type { MealPlanEntry, MealType, PantryItem, Recipe } from '@/lib/types'
import {
  MEAL_TYPES,
  MEAL_EMOJI,
  LEFTOVER_NOTES_PREFIX,
  getWeekDates,
  buildProposal,
  shortDayLabel,
  type ProposedSlot,
} from '@/lib/plan-utils'

type Step = 'pantry' | 'tags' | 'leftovers' | 'preview'

function StepHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      {onBack && (
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
          </svg>
        </button>
      )}
      <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
    </div>
  )
}

export default function BuildWeekPage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  const [step, setStep] = useState<Step>('pantry')
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState<MealPlanEntry[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([])

  const [selectedPantryNames, setSelectedPantryNames] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [extraNights, setExtraNights] = useState<Set<string>>(new Set())

  const [proposal, setProposal] = useState<ProposedSlot[]>([])
  const [buildingPreview, setBuildingPreview] = useState(false)
  const [swapping, setSwapping] = useState<{ date: string; meal_type: MealType } | null>(null)

  const [committing, setCommitting] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')
  const [committed, setCommitted] = useState(false)

  const weekDates = getWeekDates(0)
  const from = weekDates[0]
  const to = weekDates[6]

  useEffect(() => {
    if (!session) return
    Promise.all([
      fetch(`/api/plan?from=${from}&to=${to}`).then(r => r.json()),
      fetch('/api/recipes').then(r => r.json()),
      fetch('/api/pantry').then(r => r.json()),
    ]).then(([planData, recipesData, pantryData]) => {
      const pantry: PantryItem[] = Array.isArray(pantryData) ? pantryData : []
      setPlan(Array.isArray(planData) ? planData : [])
      setRecipes(Array.isArray(recipesData) ? recipesData : [])
      setPantryItems(pantry)
      setSelectedPantryNames(
        pantry.filter(i => i.fodmap_status === 'safe' || i.fodmap_status === 'moderate').map(i => i.name)
      )
      setLoading(false)
    })
  }, [session, from, to])

  const pantryOptions = pantryItems.filter(i => i.fodmap_status === 'safe' || i.fodmap_status === 'moderate')

  const tagOptions = [...new Set(recipes.flatMap(r => r.tags ?? []))]
    .filter(t => !MEAL_TYPES.includes(t as MealType))
    .sort()

  const planMap = Object.fromEntries(plan.map(entry => [`${entry.plan_date}:${entry.meal_type}`, entry]))

  function togglePantryName(name: string) {
    setSelectedPantryNames(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
  }

  function toggleTag(tag: string) {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  function toggleExtraNight(date: string) {
    setExtraNights(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  async function goToPreview() {
    setBuildingPreview(true)
    try {
      const freshPlan = await fetch(`/api/plan?from=${from}&to=${to}`).then(r => r.json())
      const freshPlanArr: MealPlanEntry[] = Array.isArray(freshPlan) ? freshPlan : []
      setPlan(freshPlanArr)
      const freshPlanMap = Object.fromEntries(freshPlanArr.map(e => [`${e.plan_date}:${e.meal_type}`, e]))
      const result = buildProposal({
        weekDates,
        recipes,
        planMap: freshPlanMap,
        selectedPantryNames,
        selectedTags,
        extraNights,
      })
      setProposal(result)
      setCommitMessage('')
      setCommitted(false)
      setStep('preview')
    } finally {
      setBuildingPreview(false)
    }
  }

  function toggleIncluded(index: number) {
    setProposal(prev => prev.map((slot, i) => i === index ? { ...slot, included: !slot.included } : slot))
  }

  function swapRecipe(recipe: Recipe) {
    if (!swapping) return
    const { date, meal_type } = swapping
    setProposal(prev => {
      let next = prev.map(slot =>
        slot.date === date && slot.meal_type === meal_type
          ? { ...slot, recipe, isLeftover: false, notes: null }
          : slot
      )
      if (meal_type === 'dinner') {
        const idx = weekDates.indexOf(date)
        const nextDate = idx >= 0 ? weekDates[idx + 1] : undefined
        if (nextDate) {
          next = next.map(slot =>
            slot.date === nextDate && slot.meal_type === 'lunch' && slot.isLeftover
              ? { ...slot, recipe, notes: `${LEFTOVER_NOTES_PREFIX} from ${shortDayLabel(date)} dinner` }
              : slot
          )
        }
      }
      return next
    })
    setSwapping(null)
  }

  async function commit() {
    setCommitting(true)
    setCommitMessage('')
    try {
      const freshPlan = await fetch(`/api/plan?from=${from}&to=${to}`).then(r => r.json())
      const freshPlanArr: MealPlanEntry[] = Array.isArray(freshPlan) ? freshPlan : []
      const freshKeys = new Set(freshPlanArr.map(e => `${e.plan_date}:${e.meal_type}`))

      const toCommit = proposal.filter(slot => slot.included && !freshKeys.has(`${slot.date}:${slot.meal_type}`))
      const skippedByRace = proposal.filter(slot => slot.included && freshKeys.has(`${slot.date}:${slot.meal_type}`)).length

      if (toCommit.length === 0) {
        setCommitMessage(
          skippedByRace > 0
            ? `${skippedByRace} slot${skippedByRace === 1 ? '' : 's'} filled elsewhere since you started — nothing left to save.`
            : 'Nothing selected to save.'
        )
        return
      }

      const responses = await Promise.all(toCommit.map(slot =>
        fetch('/api/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan_date: slot.date,
            meal_type: slot.meal_type,
            recipe_id: slot.recipe.id,
            recipe_title: slot.recipe.title,
            notes: slot.notes,
          }),
        })
      ))
      const okCount = responses.filter(r => r.ok).length
      const failed = responses.length - okCount

      const parts = [`Saved ${okCount} meal${okCount === 1 ? '' : 's'}`]
      if (skippedByRace > 0) parts.push(`${skippedByRace} filled elsewhere and skipped`)
      if (failed > 0) parts.push(`${failed} failed`)
      setCommitMessage(parts.join(' · '))
      setCommitted(true)
    } catch {
      setCommitMessage('Failed to save — check your connection')
    } finally {
      setCommitting(false)
    }
  }

  if (status === 'loading') return null
  if (!session) return <SignInPrompt />

  if (loading) {
    return <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
  }

  if (step === 'pantry') {
    return (
      <div>
        <StepHeader title="Use up pantry items" onBack={() => router.push('/plan')} />
        <p className="text-sm text-gray-500 mb-4">
          Pick what you&apos;d like this week&apos;s meals to use up. Leave everything checked to skip.
        </p>
        {pantryOptions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No safe/moderate pantry items yet — you can still continue.</p>
        ) : (
          <ul className="space-y-2 mb-4">
            {pantryOptions.map(item => (
              <li key={item.id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedPantryNames.includes(item.name)}
                  onChange={() => togglePantryName(item.name)}
                  className="accent-green-600"
                />
                <span className="text-sm font-medium text-gray-800 flex-1">{item.name}</span>
                {item.quantity && <span className="text-xs text-gray-400">{item.quantity}</span>}
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={() => setStep('tags')}
          className="w-full bg-green-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-green-700 transition-colors"
        >
          Continue
        </button>
      </div>
    )
  }

  if (step === 'tags') {
    return (
      <div>
        <StepHeader title="Cuisine & tags" onBack={() => setStep('pantry')} />
        <p className="text-sm text-gray-500 mb-4">
          Pick any cuisines or tags you&apos;re in the mood for this week. Leave blank for no preference.
        </p>
        {tagOptions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No tags on your saved recipes yet — you can still continue.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {tagOptions.map(tag => {
              const active = selectedTags.includes(tag)
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`text-xs rounded-full px-3 py-1.5 border capitalize transition-colors ${
                    active ? 'bg-green-600 border-green-600 text-white' : 'border-gray-200 text-gray-500 hover:border-gray-400'
                  }`}
                >
                  {tag}
                </button>
              )
            })}
          </div>
        )}
        <button
          onClick={() => setStep('leftovers')}
          className="w-full bg-green-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-green-700 transition-colors"
        >
          Continue
        </button>
      </div>
    )
  }

  if (step === 'leftovers') {
    return (
      <div>
        <StepHeader title="Leftover nights" onBack={() => setStep('tags')} />
        <p className="text-sm text-gray-500 mb-4">
          Mark nights you&apos;ll cook extra — that dinner becomes the next day&apos;s lunch.
        </p>
        <ul className="space-y-2 mb-4">
          {weekDates.map((date, i) => {
            const isLast = i === weekDates.length - 1
            const dinnerFilled = !!planMap[`${date}:dinner`]
            const disabled = isLast || dinnerFilled
            const label = shortDayLabel(date)
            return (
              <li
                key={date}
                className={`flex items-center justify-between bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 ${disabled ? 'opacity-50' : ''}`}
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{label}</p>
                  {isLast && <p className="text-xs text-gray-400">No next day this week</p>}
                  {!isLast && dinnerFilled && <p className="text-xs text-gray-400">Dinner already planned</p>}
                </div>
                <button
                  onClick={() => toggleExtraNight(date)}
                  disabled={disabled}
                  className={`text-xs rounded-full px-3 py-1.5 border transition-colors disabled:cursor-not-allowed ${
                    extraNights.has(date)
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-gray-200 text-gray-500 hover:border-gray-400'
                  }`}
                >
                  {extraNights.has(date) ? 'Cooking extra' : 'Cook extra'}
                </button>
              </li>
            )
          })}
        </ul>
        <button
          onClick={goToPreview}
          disabled={buildingPreview}
          className="w-full bg-green-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {buildingPreview ? 'Building your week...' : 'Build my week'}
        </button>
      </div>
    )
  }

  // step === 'preview'
  const includedCount = proposal.filter(s => s.included).length
  const leftoverCount = proposal.filter(s => s.included && s.isLeftover).length

  if (committed) {
    return (
      <div>
        <StepHeader title="Build my week" />
        <div className="bg-green-50 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm text-green-700 font-medium">{commitMessage}</p>
        </div>
        <button
          onClick={() => router.push('/plan')}
          className="w-full bg-green-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-green-700 transition-colors"
        >
          Done — view plan
        </button>
      </div>
    )
  }

  return (
    <div>
      <StepHeader title="Review your week" onBack={() => setStep('leftovers')} />
      {proposal.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-gray-400 mb-2">Every slot this week already has a meal, or there are no eligible saved recipes.</p>
          <button onClick={() => router.push('/plan')} className="text-xs text-blue-600 hover:underline">Back to plan</button>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">
            {includedCount} meal{includedCount === 1 ? '' : 's'} proposed · {leftoverCount} leftover lunch{leftoverCount === 1 ? '' : 'es'}
          </p>
          <div className="space-y-2 mb-4">
            {weekDates.map(date => {
              const rows = proposal
                .map((slot, index) => ({ slot, index }))
                .filter(({ slot }) => slot.date === date)
                .sort((a, b) => MEAL_TYPES.indexOf(a.slot.meal_type) - MEAL_TYPES.indexOf(b.slot.meal_type))
              if (rows.length === 0) return null
              return (
                <div key={date} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50">
                    <span className="text-xs font-semibold text-gray-500">{shortDayLabel(date)}</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {rows.map(({ slot, index }) => (
                      <div
                        key={`${slot.date}:${slot.meal_type}`}
                        className={`px-4 py-2.5 flex items-center justify-between gap-2 ${slot.included ? '' : 'opacity-40'}`}
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-xs text-gray-400">{MEAL_EMOJI[slot.meal_type]} {slot.meal_type}</span>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm text-gray-800 truncate">{slot.recipe.title}</p>
                            {slot.isLeftover && (
                              <span className="text-xs bg-blue-50 text-blue-600 rounded-full px-1.5 py-0.5 shrink-0">Leftover</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setSwapping({ date: slot.date, meal_type: slot.meal_type })}
                            className="text-xs text-green-600 hover:text-green-700 font-medium px-1.5"
                          >
                            Swap
                          </button>
                          <button
                            onClick={() => toggleIncluded(index)}
                            className="text-gray-300 hover:text-red-400 p-1"
                            aria-label={slot.included ? 'Remove' : 'Restore'}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18 6 6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          {commitMessage && <p className="text-xs text-gray-500 text-center mb-3">{commitMessage}</p>}
          <button
            onClick={commit}
            disabled={committing || includedCount === 0}
            className="w-full bg-green-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {committing ? 'Saving...' : `Save ${includedCount} meal${includedCount === 1 ? '' : 's'} to your plan`}
          </button>
        </>
      )}

      {swapping && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-end" onClick={() => setSwapping(null)}>
          <div className="bg-white w-full max-w-2xl mx-auto rounded-t-2xl max-h-[85vh] overflow-y-auto pb-24" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">Swap recipe</p>
              <p className="text-xs text-gray-400">
                {shortDayLabel(swapping.date)} · {MEAL_EMOJI[swapping.meal_type]} {swapping.meal_type}
              </p>
            </div>
            {(() => {
              const filtered = recipes.filter(r => r.tags.length === 0 || r.tags.includes(swapping.meal_type))
              return filtered.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No recipes tagged for {swapping.meal_type}.</p>
              ) : (
                <ul className="divide-y divide-gray-50 pb-6">
                  {filtered.map(recipe => (
                    <li key={recipe.id}>
                      <button
                        onClick={() => swapRecipe(recipe)}
                        className="w-full text-left px-4 py-3 hover:bg-green-50 transition-colors"
                      >
                        <p className="text-sm font-medium text-gray-800">{recipe.title}</p>
                        {recipe.fodmap_notes && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{recipe.fodmap_notes}</p>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
