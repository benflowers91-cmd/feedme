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

Suggest 8 real, well-known recipe names — the kind of complete main-course dish that's actually published on recipe sites (e.g. "shakshuka", "kedgeree", "chana masala", "baked feta pasta", "nasi goreng") — where at least one of the pantry ingredients above plays a starring role. Use genuine dish names, not invented titles that string ingredients together as a description.
Bad (fake mashup title): "Tomato sauce pasta with cuttlefish ink and garlic"
Good (real dish, uses squid/cuttlefish ink from the pantry): "squid ink pasta"

It's fine — expected, even — if a dish needs other ingredients beyond the pantry; the user will build a shopping list for the rest, so don't force every idea to use only what's listed, and don't try to cram multiple pantry items into one invented combo. Avoid single-component ideas too (not "roasted cashews", not "sautéed greens") — these should be full meals. Vary the cuisine and meal type across the 8 — don't suggest near-duplicates.${excludeList.length > 0 ? `\n\nDon't repeat these already-suggested ideas: ${excludeList.join(', ')}` : ''}

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
