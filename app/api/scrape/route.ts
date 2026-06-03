import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

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

function extractRecipeFromHtml(html: string): { title: string; recipe_text: string } | null {
  // Find all JSON-LD script blocks
  const scriptPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null

  while ((match = scriptPattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1])
      const recipe = findRecipeInLd(data)
      if (recipe) return recipe
    } catch {
      // malformed JSON-LD, skip
    }
  }

  return null
}

type LdObject = Record<string, unknown>

function findRecipeInLd(data: unknown): { title: string; recipe_text: string } | null {
  if (!data || typeof data !== 'object') return null
  const obj = data as LdObject

  // Check if this object itself is a Recipe
  const type = obj['@type']
  const isRecipe = type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))
  if (isRecipe) return extractFromRecipeNode(obj)

  // Check @graph array
  const graph = obj['@graph']
  if (Array.isArray(graph)) {
    for (const node of graph) {
      const result = findRecipeInLd(node)
      if (result) return result
    }
  }

  return null
}

function extractFromRecipeNode(recipe: LdObject): { title: string; recipe_text: string } | null {
  const title = typeof recipe['name'] === 'string' ? recipe['name'] : null
  if (!title) return null

  // Ingredients
  const rawIngredients = recipe['recipeIngredient']
  const ingredientLines: string[] = []
  if (Array.isArray(rawIngredients)) {
    for (const ing of rawIngredients) {
      if (typeof ing === 'string') ingredientLines.push(ing)
    }
  }

  // Instructions
  const rawInstructions = recipe['recipeInstructions']
  const instructionLines: string[] = []
  if (typeof rawInstructions === 'string') {
    instructionLines.push(rawInstructions)
  } else if (Array.isArray(rawInstructions)) {
    rawInstructions.forEach((step, i) => {
      if (typeof step === 'string') {
        instructionLines.push(`${i + 1}. ${step}`)
      } else if (step && typeof step === 'object') {
        const s = step as LdObject
        const text = s['text'] ?? s['description']
        if (typeof text === 'string') instructionLines.push(`${i + 1}. ${text}`)
      }
    })
  }

  if (ingredientLines.length === 0 && instructionLines.length === 0) return null

  const parts: string[] = [`Recipe: ${title}`, '']
  if (ingredientLines.length > 0) {
    parts.push('Ingredients:', ...ingredientLines, '')
  }
  if (instructionLines.length > 0) {
    parts.push('Method:', ...instructionLines)
  }

  return { title, recipe_text: parts.join('\n') }
}
