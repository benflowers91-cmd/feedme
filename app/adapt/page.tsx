'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { SignInPrompt } from '@/components/SignInPrompt'
import type { RecipeIngredient, SubstitutionOption } from '@/lib/types'

const STATUS_STYLES: Record<string, string> = {
  safe: 'text-green-600',
  moderate: 'text-amber-600',
  avoid: 'text-red-500',
  unknown: 'text-gray-400',
}

const STATUS_ICON: Record<string, string> = {
  safe: '✓',
  moderate: '⚠',
  avoid: '✕',
  unknown: '?',
}

interface AnalysedIngredient extends RecipeIngredient {
  substitution_options: SubstitutionOption[]
}

interface AnalysedRecipe {
  title: string
  ingredients: AnalysedIngredient[]
  instructions: string
  fodmap_notes: string
}

function AdaptPageInner() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()

  const [urlInput, setUrlInput] = useState('')
  const [recipeText, setRecipeText] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [step, setStep] = useState<'input' | 'analyse'>('input')
  const [result, setResult] = useState<AnalysedRecipe | null>(null)
  const [selections, setSelections] = useState<Record<number, number | 'keep'>>({})
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [analysing, setAnalysing] = useState(false)
  const [analyseError, setAnalyseError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const url = searchParams.get('url')
    if (url) setUrlInput(url)
  }, [searchParams])

  async function fetchRecipe() {
    if (!urlInput.trim()) return
    setFetching(true)
    setFetchError('')
    const res = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlInput.trim() }),
    })
    const data = await res.json()
    setFetching(false)
    if (data.error) {
      setFetchError(data.error)
    } else {
      setRecipeText(data.recipe_text)
      setSourceUrl(urlInput.trim())
    }
  }

  async function analyseRecipe() {
    if (!recipeText.trim()) return
    setAnalysing(true)
    setAnalyseError('')
    if (!urlInput.trim()) setSourceUrl('')
    const res = await fetch('/api/adapt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe_text: recipeText }),
    })
    const data = await res.json()
    setAnalysing(false)
    if (data.error) {
      setAnalyseError(data.error)
    } else {
      setResult(data)
      const defaults: Record<number, number | 'keep'> = {}
      data.ingredients.forEach((ing: AnalysedIngredient, i: number) => {
        if (ing.substitution_options?.length > 0 && (ing.fodmap_status === 'avoid' || ing.fodmap_status === 'moderate')) {
          defaults[i] = 0
        } else {
          defaults[i] = 'keep'
        }
      })
      setSelections(defaults)
      setStep('analyse')
    }
  }

  async function saveRecipe() {
    if (!result) return
    setSaving(true)
    const finalIngredients = result.ingredients.map((ing, i) => {
      const sel = selections[i]
      if (sel === 'keep' || sel === undefined || !ing.substitution_options?.length) {
        return { name: ing.name, amount: ing.amount, unit: ing.unit, fodmap_status: ing.fodmap_status }
      }
      const opt = ing.substitution_options[sel as number]
      return { name: opt.substitute, amount: null, unit: null, fodmap_status: 'safe' as const }
    })
    await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: result.title,
        ingredients: finalIngredients,
        instructions: result.instructions,
        fodmap_notes: result.fodmap_notes,
        source_url: sourceUrl || null,
      }),
    })
    setSaved(true)
    setSaving(false)
  }

  if (status === 'loading') return null
  if (!session) return <SignInPrompt />

  if (step === 'analyse' && result) {
    const problematic = result.ingredients.filter(
      i => i.fodmap_status === 'avoid' || i.fodmap_status === 'moderate'
    )

    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => { setStep('input'); setSaved(false) }}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-800 truncate">{result.title}</h1>
        </div>

        {problematic.length === 0 ? (
          <div className="bg-green-50 rounded-xl px-4 py-3 mb-4">
            <p className="text-sm text-green-700 font-medium">This recipe looks FODMAP safe!</p>
            <p className="text-xs text-green-600 mt-0.5">No high-FODMAP ingredients detected.</p>
          </div>
        ) : (
          <div className="bg-amber-50 rounded-xl px-4 py-3 mb-4">
            <p className="text-sm text-amber-800 font-medium">
              {problematic.length} ingredient{problematic.length > 1 ? 's' : ''} to review
            </p>
            <p className="text-xs text-amber-600 mt-0.5">Select your preferred substitution for each, or keep original.</p>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50 mb-4">
          {result.ingredients.map((ing, i) => {
            const hasOptions = ing.substitution_options?.length > 0
            const isProblematic = ing.fodmap_status === 'avoid' || ing.fodmap_status === 'moderate'
            const sel = selections[i]

            return (
              <div key={i} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs font-bold shrink-0 ${STATUS_STYLES[ing.fodmap_status] || STATUS_STYLES.unknown}`}>
                      {STATUS_ICON[ing.fodmap_status] || '?'}
                    </span>
                    <span className="text-sm text-gray-800">
                      {[ing.amount, ing.unit, ing.name].filter(Boolean).join(' ')}
                    </span>
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide shrink-0 ${STATUS_STYLES[ing.fodmap_status] || STATUS_STYLES.unknown}`}>
                    {ing.fodmap_status}
                  </span>
                </div>

                {isProblematic && hasOptions && (
                  <div className="flex flex-wrap gap-1.5 mt-2 pl-5">
                    <button
                      onClick={() => setSelections(s => ({ ...s, [i]: 'keep' }))}
                      className={`text-xs rounded-full px-3 py-1 border transition-colors ${
                        sel === 'keep'
                          ? 'bg-gray-600 border-gray-600 text-white'
                          : 'border-gray-200 text-gray-500 hover:border-gray-400'
                      }`}
                    >
                      Keep original
                    </button>
                    {ing.substitution_options.map((opt, j) => (
                      <button
                        key={j}
                        onClick={() => setSelections(s => ({ ...s, [i]: j }))}
                        title={opt.reason}
                        className={`text-xs rounded-full px-3 py-1 border transition-colors ${
                          sel === j
                            ? 'bg-green-600 border-green-600 text-white'
                            : 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
                        }`}
                      >
                        {opt.substitute}
                      </button>
                    ))}
                  </div>
                )}

                {isProblematic && hasOptions && sel !== 'keep' && typeof sel === 'number' && (
                  <p className="text-xs text-gray-400 mt-1.5 pl-5 italic">
                    {ing.substitution_options[sel]?.reason}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Method</p>
          <p className="text-sm text-gray-700 whitespace-pre-line">{result.instructions}</p>
        </div>

        <button
          onClick={saveRecipe}
          disabled={saving || saved}
          className={`w-full py-3 rounded-xl text-sm font-medium transition-colors ${
            saved
              ? 'bg-green-100 text-green-700'
              : 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50'
          }`}
        >
          {saved ? '✓ Saved to your recipes' : saving ? 'Saving...' : 'Save adapted recipe'}
        </button>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-1">Adapt a recipe</h1>
      <p className="text-sm text-gray-500 mb-4">Fetch from a URL or paste text — then pick your FODMAP substitutions</p>

      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Fetch from URL</p>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://bbcgoodfood.com/recipes/..."
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchRecipe()}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
          />
          <button
            onClick={fetchRecipe}
            disabled={fetching || !urlInput.trim()}
            className="bg-gray-700 text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 shrink-0"
          >
            {fetching ? '...' : 'Fetch'}
          </button>
        </div>
        {fetchError && <p className="text-xs text-red-500 mt-1.5">{fetchError}</p>}
        {sourceUrl && !fetchError && (
          <p className="text-xs text-green-600 mt-1.5">✓ Recipe fetched — review below and click Analyse</p>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 border-t border-gray-100" />
        <span className="text-xs text-gray-400">or paste recipe text</span>
        <div className="flex-1 border-t border-gray-100" />
      </div>

      <textarea
        value={recipeText}
        onChange={e => setRecipeText(e.target.value)}
        placeholder="Paste your recipe here — ingredients and method..."
        rows={8}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-300 mb-3"
      />

      <button
        onClick={analyseRecipe}
        disabled={analysing || !recipeText.trim()}
        className="w-full bg-green-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {analysing ? '✨ Analysing recipe...' : '✨ Analyse for FODMAP'}
      </button>

      {analyseError && <p className="text-sm text-red-500 mt-3">{analyseError}</p>}
    </div>
  )
}

export default function AdaptPage() {
  return (
    <Suspense fallback={null}>
      <AdaptPageInner />
    </Suspense>
  )
}
