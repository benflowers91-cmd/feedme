import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const TRUSTED_SITES = [
  'bbcgoodfood.com',
  'mobkitchen.co.uk',
  'ottolenghi.co.uk',
  'deliciousmagazine.co.uk',
  'olivemagazine.com',
  'seriouseats.com',
  'theguardian.com/food',
  'jamieoliver.com',
  'nigella.com',
]

export interface RecipeSearchResult {
  title: string
  url: string
  snippet: string
  source: string
  thumbnail?: string
}

function sourceName(url: string): string {
  try {
    const host = new URL(url).hostname.replace('www.', '')
    const map: Record<string, string> = {
      'bbcgoodfood.com': 'BBC Good Food',
      'mobkitchen.co.uk': 'MOB Kitchen',
      'ottolenghi.co.uk': 'Ottolenghi',
      'deliciousmagazine.co.uk': 'delicious.',
      'olivemagazine.com': 'Olive',
      'seriouseats.com': 'Serious Eats',
      'theguardian.com': 'The Guardian',
      'jamieoliver.com': 'Jamie Oliver',
      'nigella.com': 'Nigella',
    }
    return map[host] ?? host
  } catch {
    return url
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.GOOGLE_SEARCH_API_KEY
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID
  if (!apiKey || !cx) {
    return Response.json({ error: 'Recipe search is not configured yet' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const ingredients = searchParams.get('ingredients')?.trim()

  const query = ingredients
    ? `${ingredients} recipe`
    : 'low fodmap recipe'

  const googleUrl = new URL('https://www.googleapis.com/customsearch/v1')
  googleUrl.searchParams.set('key', apiKey)
  googleUrl.searchParams.set('cx', cx)
  googleUrl.searchParams.set('q', query)
  googleUrl.searchParams.set('num', '8')
  googleUrl.searchParams.set('safe', 'active')

  try {
    const res = await fetch(googleUrl.toString())

    if (res.status === 429) {
      return Response.json({ error: 'Daily search limit reached — try again tomorrow' }, { status: 429 })
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      console.error('Google Search error:', res.status, body)
      return Response.json({ error: 'Recipe search failed' }, { status: 500 })
    }

    const data = await res.json()
    const items: RecipeSearchResult[] = (data.items ?? []).map((item: {
      title: string
      link: string
      snippet: string
      pagemap?: { cse_thumbnail?: { src: string }[] }
    }) => ({
      title: item.title.replace(/\s*[-|].*$/, '').trim(),
      url: item.link,
      snippet: item.snippet,
      source: sourceName(item.link),
      thumbnail: item.pagemap?.cse_thumbnail?.[0]?.src,
    }))

    return Response.json(items)
  } catch (err) {
    console.error('Recipe search error:', err)
    return Response.json({ error: 'Recipe search failed' }, { status: 500 })
  }
}
