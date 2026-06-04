import { describe, it, expect } from 'vitest'
import { extractRecipeFromHtml, findRecipeInLd, extractFromRecipeNode } from '@/lib/scrape-utils'

const SIMPLE_RECIPE_LD = {
  '@type': 'Recipe',
  name: 'Lemon Rice',
  recipeIngredient: ['200g rice', '1 lemon, juiced', '1 tbsp olive oil'],
  recipeInstructions: [
    { '@type': 'HowToStep', text: 'Cook rice according to packet instructions.' },
    { '@type': 'HowToStep', text: 'Stir in lemon juice and olive oil.' },
  ],
}

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
