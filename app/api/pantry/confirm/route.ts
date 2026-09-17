import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'

/**
 * "I still have this" — bumps last_confirmed_at to now, which pushes the next
 * "do you still have this?" ask out by another STALE_AFTER_DAYS.
 *
 * A dedicated route rather than a generic PATCH so the client can't write an
 * arbitrary timestamp, and so reviewing several items is a single request.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let ids: unknown
  try {
    ids = (await request.json())?.ids
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!Array.isArray(ids) || ids.length === 0 || !ids.every(id => typeof id === 'string')) {
    return Response.json({ error: 'ids array is required' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('pantry_items')
    .update({ last_confirmed_at: now, updated_at: now })
    .in('id', ids)
    .eq('user_id', session.user.email)
    .select()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
