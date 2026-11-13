/** Alphabetical, ignoring case and accents. Use for every user-facing list of names. */
export function compareNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' })
}

export function sortByName<T extends { name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => compareNames(a.name, b.name))
}
