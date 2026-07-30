import { getServerSession } from 'next-auth'
import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { refreshGoogleAccessToken, upsertCalendarEvent, MEAL_TIMES } from '@/lib/google-calendar'
import type { MealPlanEntry } from '@/lib/types'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = await getToken({ req: request })
  let accessToken = token?.access_token as string | undefined
  const refreshToken = token?.refresh_token as string | undefined
  const expiresAt = token?.expires_at as number | undefined

  if (!accessToken || !refreshToken) {
    return Response.json(
      { error: 'No Google Calendar access — sign out and back in to grant calendar access.' },
      { status: 400 }
    )
  }

  if (expiresAt && Date.now() / 1000 >= expiresAt) {
    try {
      const refreshed = await refreshGoogleAccessToken(refreshToken)
      accessToken = refreshed.access_token
    } catch {
      return Response.json(
        { error: 'Google session expired — sign out and back in to reconnect your calendar.' },
        { status: 400 }
      )
    }
  }

  const { from, to } = await request.json()
  if (!from || !to) {
    return Response.json({ error: 'Missing from/to date range' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: entries, error } = await supabase
    .from('meal_plan')
    .select('*')
    .eq('user_id', session.user.email)
    .in('meal_type', Object.keys(MEAL_TIMES))
    .gte('plan_date', from)
    .lte('plan_date', to)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const toPush = ((entries ?? []) as MealPlanEntry[]).filter(e => e.recipe_title)

  let pushed = 0
  const errors: { title: string; message: string }[] = []

  for (const entry of toPush) {
    try {
      const eventId = await upsertCalendarEvent(accessToken, entry)
      if (eventId !== entry.calendar_event_id) {
        await supabase.from('meal_plan').update({ calendar_event_id: eventId }).eq('id', entry.id)
      }
      pushed++
    } catch (err) {
      errors.push({
        title: entry.recipe_title ?? entry.meal_type,
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  return Response.json({
    pushed,
    skipped: (entries?.length ?? 0) - toPush.length,
    errors,
  })
}
