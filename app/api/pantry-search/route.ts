import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { TRUSTED_RECIPE_DOMAINS } from '@/lib/scrape-utils'
import type { RecipeSearchResult } from '@/app/api/search/route'

const anthropic = new Anthropic()

async function tavilySearch(query: string, apiKey: string): Promise<RecipeSearchResult[]> {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: `${query} recipe`,
        search_depth: 'basic',
        max_results: 6,
        include_answer: false,
        include_raw_content: false,
        include_domains: TRUSTED_RECIPE_DOMAINS,
      }),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.results ?? []).map((r: { title: string; url: string; content: string }) => ({
      title: r.title,
      url: r.url,
      snippet: r.content ? r.content.slice(0, 180) : '',
      source: new URL(r.url).hostname.replace(/^www\./, ''),
    }))
  } catch {
    return []
  }
}

export interface PantrySearchResponse {
  results: RecipeSearchResult[]
  queries: string[]
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { items } = await request.json()
  if (!Array.isArray(items) || items.length === 0) {
    return Response.json({ error: 'items required' }, { status: 400 })
  }

  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'Search not configured' }, { status: 503 })
  }

  let queries: string[] = []

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `Pantry ingredients: ${items.join(', ')}

Suggest 2 short recipe search terms that could realistically be made using some of these ingredients. Examples: "butter bean stew", "cashew stir fry", "five spice pork". Respond with only a JSON array of 2 strings.`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const match = text.match(/\[[\s\S]*\]/)
    if (match) queries = JSON.parse(match[0])
  } catch {
    // fallback handled below
  }

  if (!Array.isArray(queries) || queries.length === 0) {
    queries = [items[0]]
  }

  const resultBatches = await Promise.all(queries.map(q => tavilySearch(q, apiKey)))

  const seen = new Set<string>()
  const combined: RecipeSearchResult[] = []
  for (const batch of resultBatches) {
    for (const r of batch) {
      if (!seen.has(r.url)) {
        seen.add(r.url)
        combined.push(r)
      }
    }
  }

  return Response.json({ results: combined, queries } satisfies PantrySearchResponse)
}
