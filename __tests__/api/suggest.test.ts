import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerSession, mockCreate } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockCreate: vi.fn(),
}))

vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/fodmap-prompt', () => ({ FODMAP_SYSTEM_PROMPT: 'test-prompt' }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate }
  },
}))

import { POST } from '@/app/api/suggest/route'

const FAKE_SESSION = { user: { email: 'test@example.com', name: 'Test' } }

const MOCK_TOOL_RESPONSE = {
  content: [
    {
      type: 'tool_use',
      id: 'toolu_test',
      name: 'suggest_recipes',
      input: {
        recipes: [
          {
            title: 'Rice Bowl',
            time_minutes: 20,
            servings: 2,
            ingredients: [
              { name: 'rice', amount: '200g', fodmap_status: 'safe' },
              { name: 'soy sauce', amount: '1 tbsp', fodmap_status: 'safe' },
            ],
            instructions: '1. Cook rice.\n2. Season with soy sauce.',
            fodmap_notes: 'All ingredients are FODMAP-safe.',
          },
        ],
      },
    },
  ],
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/suggest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await POST(makeRequest({ pantry_items: ['rice'] }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns recipes on success with pantry items', async () => {
    mockGetServerSession.mockResolvedValue(FAKE_SESSION)
    mockCreate.mockResolvedValue(MOCK_TOOL_RESPONSE)

    const res = await POST(makeRequest({ pantry_items: ['rice', 'soy sauce'], preferences: 'quick' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recipes).toHaveLength(1)
    expect(body.recipes[0].title).toBe('Rice Bowl')
    expect(body.recipes[0].time_minutes).toBe(20)
  })

  it('returns recipes with empty pantry (falls back to common ingredients)', async () => {
    mockGetServerSession.mockResolvedValue(FAKE_SESSION)
    mockCreate.mockResolvedValue(MOCK_TOOL_RESPONSE)

    const res = await POST(makeRequest({ pantry_items: [] }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recipes).toHaveLength(1)
  })

  it('returns 500 when Claude returns no tool_use block', async () => {
    mockGetServerSession.mockResolvedValue(FAKE_SESSION)
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'Oops' }] })

    const res = await POST(makeRequest({ pantry_items: ['rice'] }))
    expect(res.status).toBe(500)
  })
})
