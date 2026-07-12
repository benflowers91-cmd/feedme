import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export interface PantryIdeasResponse {
  queries: string[]
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { items, exclude } = await request.json()
  if (!Array.isArray(items) || items.length === 0) {
    return Response.json({ error: 'items required' }, { status: 400 })
  }

  const excludeList = Array.isArray(exclude) ? exclude.filter((e): e is string => typeof e === 'string') : []

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Pantry ingredients: ${items.join(', ')}

Suggest 8 short search terms for complete main-course meals — not side dishes, not single-ingredient preps (e.g. not "roasted cashews" or "sautéed greens") — that could realistically be made using several of these ingredients together. You can assume basic staples are on hand even if not listed (oil, salt, pepper, garlic, rice, pasta, stock) so ideas can be full dishes rather than sparse component pairings. Vary the cuisine and meal type across the 8 — don't suggest near-duplicates (e.g. three different stir fries). Good examples: "butter bean and chorizo stew", "cashew chicken stir fry", "five spice pork noodles".${excludeList.length > 0 ? `\n\nDon't repeat these already-suggested ideas: ${excludeList.join(', ')}` : ''}

Respond with only a JSON array of 8 strings, nothing else.`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const match = text.match(/\[[\s\S]*\]/)
    const queries = match ? JSON.parse(match[0]) : []

    if (!Array.isArray(queries) || queries.length === 0) {
      return Response.json({ error: 'Could not generate ideas — try again' }, { status: 502 })
    }

    return Response.json({ queries } satisfies PantryIdeasResponse)
  } catch (err) {
    console.error('Pantry ideas error:', err)
    return Response.json({ error: 'Could not generate ideas — try again' }, { status: 502 })
  }
}
