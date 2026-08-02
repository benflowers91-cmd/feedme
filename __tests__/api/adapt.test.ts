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

import { POST } from '@/app/api/adapt/route'

const FAKE_SESSION = { user: { email: 'test@example.com', name: 'Test' } }

const MOCK_TOOL_RESPONSE = {
  content: [
    {
      type: 'tool_use',
      id: 'toolu_test',
      name: 'analyse_recipe',
      input: {
        title: 'Test Pasta',
        ingredients: [
          { name: 'rice pasta', amount: '200g', unit: null, fodmap_status: 'safe', substitution_options: [] },
          { name: 'garlic', amount: '2 cloves', unit: null, fodmap_status: 'avoid', substitution_options: [
            { substitute: '1 tbsp garlic-infused oil', reason: 'All the flavour, none of the fructans' },
          ]},
        ],
        instructions: '1. Cook pasta.\n2. Add oil.',
        fodmap_notes: 'Safe when garlic is substituted.',
      },
    },
  ],
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/adapt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/adapt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await POST(makeRequest({ recipe_text: 'some recipe' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 400 when recipe_text is missing', async () => {
    mockGetServerSession.mockResolvedValue(FAKE_SESSION)
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/required/)
  })

  it('returns 400 when recipe_text is empty string', async () => {
    mockGetServerSession.mockResolvedValue(FAKE_SESSION)
    const res = await POST(makeRequest({ recipe_text: '   ' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when recipe_text exceeds 8000 chars', async () => {
    mockGetServerSession.mockResolvedValue(FAKE_SESSION)
    const res = await POST(makeRequest({ recipe_text: 'x'.repeat(8001) }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/too long/)
  })

  it('returns the tool_use input on success', async () => {
    mockGetServerSession.mockResolvedValue(FAKE_SESSION)
    mockCreate.mockResolvedValue(MOCK_TOOL_RESPONSE)

    const res = await POST(makeRequest({ recipe_text: 'Pasta with garlic. Cook pasta, add garlic.' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.title).toBe('Test Pasta')
    expect(body.ingredients).toHaveLength(2)
    expect(body.ingredients[1].substitution_options).toHaveLength(1)
  })

  it('returns 500 when Claude returns no tool_use block', async () => {
    mockGetServerSession.mockResolvedValue(FAKE_SESSION)
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'Unexpected text response' }] })

    const res = await POST(makeRequest({ recipe_text: 'Some recipe' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/Unexpected/)
  })

  it('returns 500 with a trim-recipe message when generation is cut off by max_tokens', async () => {
    mockGetServerSession.mockResolvedValue(FAKE_SESSION)
    mockCreate.mockResolvedValue({
      stop_reason: 'max_tokens',
      content: [{ type: 'tool_use', id: 'toolu_test', name: 'analyse_recipe', input: { title: 'Big Recipe' } }],
    })

    const res = await POST(makeRequest({ recipe_text: 'A recipe with many ingredients' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/too many ingredients/)
  })

  it('returns 500 when the tool input is missing ingredients for a non-truncation reason', async () => {
    mockGetServerSession.mockResolvedValue(FAKE_SESSION)
    mockCreate.mockResolvedValue({
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', id: 'toolu_test', name: 'analyse_recipe', input: { title: 'Odd Recipe' } }],
    })

    const res = await POST(makeRequest({ recipe_text: 'Some recipe' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/incomplete analysis/)
  })
})
