import type { Session } from 'next-auth'

/**
 * FeedMe is one shared household. HOUSEHOLD_EMAILS lists everyone allowed to
 * sign in, owner first. All data is keyed on the owner's email, so every member
 * reads and writes the same pantry, recipes, plan and shopping list, and the
 * rows that existed before the household was added don't need migrating.
 *
 * Read at call time, not module load, so tests can change it.
 */
function householdEmails(): string[] {
  return (process.env.HOUSEHOLD_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isHouseholdMember(email: string | null | undefined): boolean {
  if (!email) return false
  return householdEmails().includes(email.trim().toLowerCase())
}

/**
 * The id every row is stored under, or null if the session isn't a household
 * member. Fails closed: with HOUSEHOLD_EMAILS unset, nobody gets in.
 */
export function getHouseholdId(session: Session | null): string | null {
  const email = session?.user?.email
  if (!isHouseholdMember(email)) return null
  return householdEmails()[0]
}
