/**
 * Shopping item names follow the contract set by the consolidate prompt
 * (`app/api/shopping/consolidate/route.ts`): ingredient name first, amount
 * after a comma — "chicken thighs, 400g", "olive oil, 3 tbsp", "garlic".
 *
 * Hand-typed items don't always obey it, hence the leading-quantity stripper.
 */

/**
 * Strip any leading quantity/unit from an item name so it can be used as a
 * search term. Consolidation stores amounts after the first comma, so
 * everything from the comma onwards goes too.
 */
export function stripLeadingQuantity(itemName: string): string {
  let s = itemName.split(',')[0].trim()
  let prev = ''
  while (prev !== s) {
    prev = s
    s = s
      .replace(/^\d+\/\d+\s*/i, '')
      .replace(/^\d+(\.\d+)?\s*/i, '')
      .replace(/^(tablespoons?|teaspoons?|kilograms?|grams?|millilitres?|milliliters?|centilitres?|centiliters?|litres?|liters?|ounces?|pounds?|cups?|cloves?|cans?|tins?|bunches?|heads?|sticks?|sprigs?|rashers?|slices?|pieces?|handfuls?|pinch(?:es)?|sachets?|portions?|tbsps?|tsps?)\s*/i, '')
      // Short units require whitespace or end-of-string after them to avoid eating ingredient names (e.g. "garlic", "lemons")
      .replace(/^(kg|ml|cl|oz|lbs?|g|l)(?=\s|$)\s*/i, '')
      .replace(/^(x|×)(?=\s|$)\s*/i, '')
      .replace(/^of(?=\s|$)\s*/i, '')
      .replace(/^an?(?=\s|$)\s*/i, '')
      .replace(/^\(.*?\)\s*/i, '')
      .trim()
  }
  return s
}

export function tescoSearchUrl(itemName: string): string {
  return `https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(stripLeadingQuantity(itemName))}`
}

/**
 * Split a shopping item name into the pantry's name/quantity pair using the
 * comma convention. Anything after the first comma is the amount.
 */
export function splitNameAndQuantity(itemName: string): { name: string; quantity: string | null } {
  const commaAt = itemName.indexOf(',')
  if (commaAt === -1) {
    return { name: itemName.trim(), quantity: null }
  }
  const name = itemName.slice(0, commaAt).trim()
  const quantity = itemName.slice(commaAt + 1).trim()
  return { name, quantity: quantity || null }
}
