import { describe, it, expect } from 'vitest'
import { extractRecipeFromHtml, findRecipeInLd, extractFromRecipeNode, classifyUrl } from '@/lib/scrape-utils'

const SIMPLE_RECIPE_LD = {
  '@type': 'Recipe',
  name: 'Lemon Rice',
  recipeIngredient: ['200g rice', '1 lemon, juiced', '1 tbsp olive oil'],
  recipeInstructions: [
    { '@type': 'HowToStep', text: 'Cook rice according to packet instructions.' },
    { '@type': 'HowToStep', text: 'Stir in lemon juice and olive oil.' },
  ],
}

describe('classifyUrl', () => {
  it('returns blocked for social and video platforms', () => {
    expect(classifyUrl('https://www.youtube.com/watch?v=abc')).toBe('blocked')
    expect(classifyUrl('https://youtu.be/abc')).toBe('blocked')
    expect(classifyUrl('https://www.instagram.com/p/abc')).toBe('blocked')
    expect(classifyUrl('https://www.tiktok.com/@user/video/123')).toBe('blocked')
    expect(classifyUrl('https://www.pinterest.com/pin/123')).toBe('blocked')
    expect(classifyUrl('https://twitter.com/user/status/123')).toBe('blocked')
    expect(classifyUrl('https://x.com/user/status/123')).toBe('blocked')
    expect(classifyUrl('https://www.facebook.com/video/123')).toBe('blocked')
    expect(classifyUrl('https://www.reddit.com/r/recipes/comments/abc')).toBe('blocked')
  })

  it('returns trusted for known recipe sites', () => {
    expect(classifyUrl('https://www.bbcgoodfood.com/recipes/lemon-cake')).toBe('trusted')
    expect(classifyUrl('https://mob.co.uk/recipes/pasta')).toBe('trusted')
    expect(classifyUrl('https://ottolenghi.co.uk/recipes/chicken')).toBe('trusted')
    expect(classifyUrl('https://www.seriouseats.com/recipes/rice')).toBe('trusted')
    expect(classifyUrl('https://www.bonappetit.com/recipe/pasta')).toBe('trusted')
    expect(classifyUrl('https://www.jamieoliver.com/recipes/pasta')).toBe('trusted')
    expect(classifyUrl('https://www.allrecipes.com/recipe/123')).toBe('trusted')
    expect(classifyUrl('https://www.simplyrecipes.com/recipes/pasta')).toBe('trusted')
    expect(classifyUrl('https://www.epicurious.com/recipes/pasta')).toBe('trusted')
    expect(classifyUrl('https://www.minimalistbaker.com/easy-pasta')).toBe('trusted')
    expect(classifyUrl('https://www.recipetineats.com/pasta')).toBe('trusted')
  })

  it('strips www. prefix before matching', () => {
    expect(classifyUrl('https://bbcgoodfood.com/recipes/cake')).toBe('trusted')
    expect(classifyUrl('https://youtube.com/watch?v=abc')).toBe('blocked')
  })

  it('returns unknown for unrecognised sites', () => {
    expect(classifyUrl('https://example.com/recipe')).toBe('unknown')
    expect(classifyUrl('https://nytcooking.com/recipe')).toBe('unknown')
    expect(classifyUrl('https://myrandomblog.net/pasta')).toBe('unknown')
  })

  it('returns unknown for invalid or non-http URLs', () => {
    expect(classifyUrl('not-a-url')).toBe('unknown')
    expect(classifyUrl('')).toBe('unknown')
  })
})

describe('extractFromRecipeNode', () => {
  it('extracts title, ingredients, and array instructions', () => {
    const result = extractFromRecipeNode(SIMPLE_RECIPE_LD)
    expect(result).not.toBeNull()
    expect(result!.title).toBe('Lemon Rice')
    expect(result!.recipe_text).toContain('200g rice')
    expect(result!.recipe_text).toContain('Cook rice according to packet instructions.')
    expect(result!.recipe_text).toContain('2. Stir in lemon juice')
  })

  it('handles string instructions', () => {
    const result = extractFromRecipeNode({
      '@type': 'Recipe',
      name: 'Simple Soup',
      recipeIngredient: ['500ml stock'],
      recipeInstructions: 'Heat stock in a pan and serve.',
    })
    expect(result!.recipe_text).toContain('Heat stock in a pan')
  })

  it('handles instructions with description instead of text', () => {
    const result = extractFromRecipeNode({
      '@type': 'Recipe',
      name: 'Pasta',
      recipeIngredient: ['200g pasta'],
      recipeInstructions: [{ description: 'Boil pasta for 10 minutes.' }],
    })
    expect(result!.recipe_text).toContain('Boil pasta')
  })

  it('returns null when name is missing', () => {
    expect(extractFromRecipeNode({ '@type': 'Recipe', recipeIngredient: ['salt'] })).toBeNull()
  })

  it('returns null when both ingredients and instructions are empty', () => {
    expect(extractFromRecipeNode({ '@type': 'Recipe', name: 'Empty' })).toBeNull()
  })
})

describe('findRecipeInLd', () => {
  it('finds a top-level Recipe node', () => {
    const result = findRecipeInLd(SIMPLE_RECIPE_LD)
    expect(result!.title).toBe('Lemon Rice')
  })

  it('finds a Recipe nested inside @graph', () => {
    const result = findRecipeInLd({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', name: 'Some Page' },
        SIMPLE_RECIPE_LD,
      ],
    })
    expect(result!.title).toBe('Lemon Rice')
  })

  it('handles @type as an array', () => {
    const result = findRecipeInLd({ ...SIMPLE_RECIPE_LD, '@type': ['Recipe', 'Thing'] })
    expect(result!.title).toBe('Lemon Rice')
  })

  it('returns null for non-Recipe nodes', () => {
    expect(findRecipeInLd({ '@type': 'WebPage', name: 'Page' })).toBeNull()
  })

  it('returns null for non-objects', () => {
    expect(findRecipeInLd(null)).toBeNull()
    expect(findRecipeInLd('string')).toBeNull()
    expect(findRecipeInLd(42)).toBeNull()
  })
})

describe('extractRecipeFromHtml', () => {
  it('extracts a recipe from valid JSON-LD in a script tag', () => {
    const html = `
      <html><head>
        <script type="application/ld+json">${JSON.stringify(SIMPLE_RECIPE_LD)}</script>
      </head><body></body></html>
    `
    const result = extractRecipeFromHtml(html)
    expect(result!.title).toBe('Lemon Rice')
    expect(result!.recipe_text).toContain('200g rice')
  })

  it('finds a recipe inside @graph in the page', () => {
    const ld = { '@context': 'https://schema.org', '@graph': [SIMPLE_RECIPE_LD] }
    const html = `<script type="application/ld+json">${JSON.stringify(ld)}</script>`
    const result = extractRecipeFromHtml(html)
    expect(result!.title).toBe('Lemon Rice')
  })

  it('skips malformed JSON-LD and returns null', () => {
    const html = `<script type="application/ld+json">{ this is not json }</script>`
    expect(extractRecipeFromHtml(html)).toBeNull()
  })

  it('returns null when no JSON-LD is present', () => {
    expect(extractRecipeFromHtml('<html><body>No recipe here</body></html>')).toBeNull()
  })

  it('returns null when JSON-LD is present but is not a Recipe', () => {
    const html = `<script type="application/ld+json">{"@type":"WebPage","name":"Blog"}</script>`
    expect(extractRecipeFromHtml(html)).toBeNull()
  })
})
