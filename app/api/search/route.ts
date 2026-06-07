import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { TRUSTED_RECIPE_DOMAINS } from '@/lib/scrape-utils'

export interface RecipeSearchResult {
  title: string
  url: string
  snippet: string
  source: string
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim()
  if (!query) {
    return Response.json({ error: 'q is required' }, { status: 400 })
  }

  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'Search not configured' }, { status: 503 })
  }

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: `${query} recipe`,
        search_depth: 'basic',
        max_results: 8,
        include_answer: false,
        include_raw_content: false,
        include_domains: TRUSTED_RECIPE_DOMAINS,
      }),
    })

    if (res.status === 401) {
      console.error('Tavily: 401 — check TAVILY_API_KEY')
      return Response.json({ error: 'Search not configured' }, { status: 503 })
    }
    if (res.status === 429) {
      return Response.json({ error: 'Search rate limit reached — try again in a moment' }, { status: 429 })
    }
    if (!res.ok) {
      return Response.json({ error: 'Search failed — try again' }, { status: 502 })
    }

    const data = await res.json()
    const results: RecipeSearchResult[] = (data.results ?? []).map((r: {
      title: string
      url: string
      content: string
    }) => ({
      title: r.title,
      url: r.url,
      snippet: r.content ? r.content.slice(0, 180) : '',
      source: new URL(r.url).hostname.replace(/^www\./, ''),
    }))

    return Response.json(results)
  } catch (err) {
    console.error('Tavily search error:', err)
    return Response.json({ error: 'Search failed — try again' }, { status: 502 })
  }
}
