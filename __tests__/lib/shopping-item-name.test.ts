import { describe, it, expect } from 'vitest'
import { splitNameAndQuantity, stripLeadingQuantity, tescoSearchUrl } from '@/lib/shopping-item-name'

describe('splitNameAndQuantity', () => {
  it('splits the consolidate format on the first comma', () => {
    expect(splitNameAndQuantity('chicken thighs, 400g')).toEqual({ name: 'chicken thighs', quantity: '400g' })
    expect(splitNameAndQuantity('olive oil, 3 tbsp')).toEqual({ name: 'olive oil', quantity: '3 tbsp' })
  })

  it('returns a null quantity when there is no comma', () => {
    expect(splitNameAndQuantity('garlic')).toEqual({ name: 'garlic', quantity: null })
  })

  it('keeps everything after the first comma as the quantity', () => {
    expect(splitNameAndQuantity('tomatoes, 250g, ripe')).toEqual({ name: 'tomatoes', quantity: '250g, ripe' })
  })

  it('trims surrounding whitespace and treats an empty amount as null', () => {
    expect(splitNameAndQuantity('  eggs  ')).toEqual({ name: 'eggs', quantity: null })
    expect(splitNameAndQuantity('eggs, ')).toEqual({ name: 'eggs', quantity: null })
  })
})

describe('stripLeadingQuantity', () => {
  it('strips leading amounts and units', () => {
    expect(stripLeadingQuantity('400g chicken thighs')).toBe('chicken thighs')
    expect(stripLeadingQuantity('3 tbsp olive oil')).toBe('olive oil')
    expect(stripLeadingQuantity('2 cloves of garlic')).toBe('garlic')
    expect(stripLeadingQuantity('1/2 lemon')).toBe('lemon')
  })

  it('leaves ingredient names that merely start with a unit letter alone', () => {
    expect(stripLeadingQuantity('garlic')).toBe('garlic')
    expect(stripLeadingQuantity('lemons')).toBe('lemons')
    expect(stripLeadingQuantity('gnocchi')).toBe('gnocchi')
  })

  it('drops the consolidated amount after the comma', () => {
    expect(stripLeadingQuantity('cherry tomatoes, 250g')).toBe('cherry tomatoes')
  })
})

describe('tescoSearchUrl', () => {
  it('searches for the bare ingredient name', () => {
    expect(tescoSearchUrl('cherry tomatoes, 250g'))
      .toBe('https://www.tesco.com/groceries/en-GB/search?query=cherry%20tomatoes')
  })
})
