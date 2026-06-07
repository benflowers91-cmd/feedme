export const TRUSTED_RECIPE_DOMAINS = [
  'bbcgoodfood.com',
  'mob.co.uk',
  'ottolenghi.co.uk',
  'seriouseats.com',
  'bonappetit.com',
  'theguardian.com',
  'deliciousmagazine.co.uk',
  'jamieoliver.com',
  'nigella.com',
  'allrecipes.com',
  'food.com',
  'simplyrecipes.com',
  'cookinglight.com',
  'epicurious.com',
  'themodernproper.com',
  'halfbakedharvest.com',
  'minimalistbaker.com',
  'skinnytaste.com',
  'recipetineats.com',
  'budgetbytes.com',
]

export const BLOCKED_RECIPE_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'instagram.com',
  'tiktok.com',
  'pinterest.com',
  'twitter.com',
  'x.com',
  'facebook.com',
  'reddit.com',
]

export function classifyUrl(url: string): 'trusted' | 'blocked' | 'unknown' {
  let hostname: string
  try {
    hostname = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'unknown'
  }
  if (BLOCKED_RECIPE_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))) return 'blocked'
  if (TRUSTED_RECIPE_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))) return 'trusted'
  return 'unknown'
}

type LdObject = Record<string, unknown>

export function extractRecipeFromHtml(html: string): { title: string; recipe_text: string } | null {
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

export function findRecipeInLd(data: unknown): { title: string; recipe_text: string } | null {
  if (!data || typeof data !== 'object') return null
  const obj = data as LdObject

  const type = obj['@type']
  const isRecipe = type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))
  if (isRecipe) return extractFromRecipeNode(obj)

  const graph = obj['@graph']
  if (Array.isArray(graph)) {
    for (const node of graph) {
      const result = findRecipeInLd(node)
      if (result) return result
    }
  }

  return null
}

export function extractFromRecipeNode(recipe: LdObject): { title: string; recipe_text: string } | null {
  const title = typeof recipe['name'] === 'string' ? recipe['name'] : null
  if (!title) return null

  const rawIngredients = recipe['recipeIngredient']
  const ingredientLines: string[] = []
  if (Array.isArray(rawIngredients)) {
    for (const ing of rawIngredients) {
      if (typeof ing === 'string') ingredientLines.push(ing)
    }
  }

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
