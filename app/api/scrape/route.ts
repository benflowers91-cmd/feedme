import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { extractRecipeFromHtml } from '@/lib/scrape-utils'

const MAX_BYTES = 2 * 1024 * 1024 // 2MB

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { url } = await request.json()
  if (!url?.trim()) {
    return Response.json({ error: 'url is required' }, { status: 400 })
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol')
    }
  } catch {
    return Response.json({ error: 'Invalid URL' }, { status: 400 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const res = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FeedMe/1.0; +https://feedme-gules.vercel.app)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    clearTimeout(timeout)

    if (!res.ok) {
      return Response.json({ error: "Couldn't fetch that URL — try pasting the recipe text instead" }, { status: 422 })
    }

    const contentLength = res.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > MAX_BYTES) {
      return Response.json({ error: "Page too large — try pasting the recipe text instead" }, { status: 422 })
    }

    const html = await res.text()
    if (html.length > MAX_BYTES) {
      return Response.json({ error: "Page too large — try pasting the recipe text instead" }, { status: 422 })
    }

    const recipe = extractRecipeFromHtml(html)
    if (!recipe) {
      return Response.json(
        { error: "Couldn't extract a recipe from this URL — try pasting the recipe text instead" },
        { status: 422 }
      )
    }

    return Response.json(recipe)
  } catch (err) {
    clearTimeout(timeout)
    const message = err instanceof Error && err.name === 'AbortError'
      ? 'Request timed out — try pasting the recipe text instead'
      : "Couldn't reach that URL — try pasting the recipe text instead"
    return Response.json({ error: message }, { status: 422 })
  }
}

