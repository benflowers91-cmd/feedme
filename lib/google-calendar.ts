import type { MealPlanEntry } from '@/lib/types'

const TIMEZONE = 'Europe/London'
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

export const MEAL_TIMES: Record<string, [string, string]> = {
  breakfast: ['09:00', '09:30'],
  lunch: ['12:30', '13:00'],
  dinner: ['18:00', '18:30'],
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) throw new Error('Failed to refresh Google access token')
  const data = await res.json()
  return {
    access_token: data.access_token as string,
    expires_at: Math.floor(Date.now() / 1000) + (data.expires_in as number),
  }
}

export function buildEventPayload(entry: MealPlanEntry) {
  const [startTime, endTime] = MEAL_TIMES[entry.meal_type]
  return {
    summary: `${entry.meal_type[0].toUpperCase()}${entry.meal_type.slice(1)}: ${entry.recipe_title ?? 'Meal planned'}`,
    description: 'Planned in FeedMe',
    start: { dateTime: `${entry.plan_date}T${startTime}:00`, timeZone: TIMEZONE },
    end: { dateTime: `${entry.plan_date}T${endTime}:00`, timeZone: TIMEZONE },
  }
}

export async function upsertCalendarEvent(accessToken: string, entry: MealPlanEntry): Promise<string> {
  const payload = buildEventPayload(entry)
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }

  if (entry.calendar_event_id) {
    const patchRes = await fetch(`${CALENDAR_API}/${entry.calendar_event_id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    })
    if (patchRes.ok) {
      const data = await patchRes.json()
      return data.id as string
    }
    if (patchRes.status !== 404) {
      throw new Error(`Google Calendar update failed (${patchRes.status})`)
    }
    // Event was deleted on the Google Calendar side — fall through to create a new one.
  }

  const postRes = await fetch(CALENDAR_API, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  if (!postRes.ok) {
    throw new Error(`Google Calendar create failed (${postRes.status})`)
  }
  const data = await postRes.json()
  return data.id as string
}
