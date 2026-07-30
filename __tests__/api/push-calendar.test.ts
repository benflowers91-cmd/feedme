import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerSession, mockGetToken } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockGetToken: vi.fn(),
}))

vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))
vi.mock('next-auth/jwt', () => ({ getToken: mockGetToken }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

function makeSelectBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.in = vi.fn(chain)
  builder.gte = vi.fn(chain)
  builder.lte = vi.fn(chain)
  builder.then = (resolve: (v: typeof result) => void) => resolve(result)
  return builder
}

const mockUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null })
let selectResult: { data: unknown; error: unknown } = { data: [], error: null }
const mockFrom = vi.fn(() => ({
  ...makeSelectBuilder(selectResult),
  update: vi.fn(() => ({ eq: mockUpdateEq })),
}))

vi.mock('@/lib/supabase', () => ({
  createServerClient: () => ({ from: mockFrom }),
}))

import { POST } from '@/app/api/plan/push-calendar/route'

const FAKE_SESSION = { user: { email: 'test@example.com', name: 'Test' } }
const VALID_TOKEN = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/plan/push-calendar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function entry(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'entry-1',
    user_id: 'test@example.com',
    plan_date: '2026-08-03',
    meal_type: 'breakfast',
    recipe_id: 'r1',
    recipe_title: 'Oats',
    notes: null,
    calendar_event_id: null,
    ...overrides,
  }
}

describe('POST /api/plan/push-calendar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateEq.mockResolvedValue({ data: null, error: null })
    selectResult = { data: [], error: null }
    global.fetch = vi.fn()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await POST(makeRequest({ from: '2026-08-03', to: '2026-08-09' }) as any)
    expect(res.status).toBe(401)
  })

  it('returns 400 when there is no Google refresh token', async () => {
    mockGetServerSession.mockResolvedValue(FAKE_SESSION)
    mockGetToken.mockResolvedValue({ access_token: 'at' })
    const res = await POST(makeRequest({ from: '2026-08-03', to: '2026-08-09' }) as any)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/sign out/i)
  })

  it('queries only breakfast/lunch/dinner and skips slots with no recipe', async () => {
    mockGetServerSession.mockResolvedValue(FAKE_SESSION)
    mockGetToken.mockResolvedValue(VALID_TOKEN)
    selectResult = {
      data: [entry(), entry({ id: 'entry-2', recipe_title: null })],
      error: null,
    }
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'evt-1' }),
    })

    const res = await POST(makeRequest({ from: '2026-08-03', to: '2026-08-09' }) as any)
    const body = await res.json()

    expect(body.pushed).toBe(1)
    expect(body.skipped).toBe(1)

    const builderCall = mockFrom.mock.results[0].value
    expect(builderCall.in).toHaveBeenCalledWith('meal_type', ['breakfast', 'lunch', 'dinner'])
  })

  it('builds the correct time/timezone payload per meal type and POSTs a new event', async () => {
    mockGetServerSession.mockResolvedValue(FAKE_SESSION)
    mockGetToken.mockResolvedValue(VALID_TOKEN)
    selectResult = { data: [entry({ meal_type: 'lunch' })], error: null }
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'evt-1' }) })

    await POST(makeRequest({ from: '2026-08-03', to: '2026-08-09' }) as any)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://www.googleapis.com/calendar/v3/calendars/primary/events')
    expect(init.method).toBe('POST')
    const payload = JSON.parse(init.body)
    expect(payload.start).toEqual({ dateTime: '2026-08-03T12:30:00', timeZone: 'Europe/London' })
    expect(payload.end).toEqual({ dateTime: '2026-08-03T13:00:00', timeZone: 'Europe/London' })
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'entry-1')
  })

  it('PATCHes the existing event when calendar_event_id is already set', async () => {
    mockGetServerSession.mockResolvedValue(FAKE_SESSION)
    mockGetToken.mockResolvedValue(VALID_TOKEN)
    selectResult = { data: [entry({ calendar_event_id: 'evt-existing' })], error: null }
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'evt-existing' }) })

    await POST(makeRequest({ from: '2026-08-03', to: '2026-08-09' }) as any)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://www.googleapis.com/calendar/v3/calendars/primary/events/evt-existing')
    expect(init.method).toBe('PATCH')
  })

  it('isolates a per-row Calendar failure so other rows still push', async () => {
    mockGetServerSession.mockResolvedValue(FAKE_SESSION)
    mockGetToken.mockResolvedValue(VALID_TOKEN)
    selectResult = {
      data: [entry({ id: 'bad', recipe_title: 'Bad Meal' }), entry({ id: 'good', meal_type: 'dinner' })],
      error: null,
    }
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 'evt-2' }) })

    const res = await POST(makeRequest({ from: '2026-08-03', to: '2026-08-09' }) as any)
    const body = await res.json()

    expect(body.pushed).toBe(1)
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0].title).toBe('Bad Meal')
  })
})
