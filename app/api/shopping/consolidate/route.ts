import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

const CONSOLIDATE_TOOL: Anthropic.Tool = {
  name: 'consolidate_shopping_list',
  description: 'Return a consolidated shopping list, merging near-duplicate and related ingredients. For each item, optionally note if the user likely already has it based on their pantry.',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'The consolidated item name' },
            pantry_note: {
              type: 'string',
              description: 'Set to "you may have this" if the item matches something in the pantry. Omit entirely otherwise.',
            },
          },
          required: ['name'],
        },
        description: 'The consolidated list of shopping items',
      },
    },
    required: ['items'],
  },
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let items: string[]
  try {
    const body = await request.json()
    items = body?.items
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!Array.isArray(items) || items.length === 0) {
    return Response.json({ error: 'items array is required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: pantryData } = await supabase
    .from('pantry_items')
    .select('name')
    .eq('user_id', session.user.email)

  const pantryItems = pantryData ?? []
  const pantrySection = pantryItems.length > 0
    ? `\nPANTRY (items the user already has at home):\n${pantryItems.map(p => `- ${p.name}`).join('\n')}\n`
    : ''

  const itemList = items.map((name: string) => `- ${name}`).join('\n')

  const userMessage = `Consolidate this shopping list by merging near-duplicates and similar ingredients into single clear entries.

Rules:
- Merge items that refer to the same ingredient (e.g. "cherry tomatoes", "vine tomatoes", "plum tomatoes" → "tomatoes (mixed, ~20)").
- Combine quantities where possible (e.g. "2 chicken breasts" + "1 chicken breast" → "3 chicken breasts").
- If items are clearly different ingredients, keep them separate.
- Use plain, readable text (no units jargon). Keep it concise.
- Return only the consolidated items — no extra explanation.
- Preserve FODMAP-safe substitutions: never consolidate a safe ingredient into a high-FODMAP one.
- Use UK English spelling and ingredient names throughout: aubergine (not eggplant), courgette (not zucchini), coriander (not cilantro), spring onion (not scallion), prawns (not shrimp), rocket (not arugula), plain flour (not all-purpose flour), pepper (not bell pepper), chips (not fries), biscuits (not cookies).
- Convert US measurements to metric: 1 cup liquid → 240ml, 1 cup flour → 120g, 1 cup sugar → 200g, 1 cup rice → 185g, 1 oz → 28g, 1 lb → 450g. Keep tbsp and tsp as-is (used in UK). Use g and ml throughout.
- If an item matches or closely matches something in the PANTRY, set pantry_note to "you may have this". Never remove an item because of a pantry match — the user decides whether to buy more.
${pantrySection}
SHOPPING LIST:
${itemList}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      tools: [CONSOLIDATE_TOOL],
      tool_choice: { type: 'tool', name: 'consolidate_shopping_list' },
      messages: [{ role: 'user', content: userMessage }],
    })

    const toolBlock = response.content.find(b => b.type === 'tool_use')
    if (!toolBlock || toolBlock.type !== 'tool_use') {
      return Response.json({ error: 'Unexpected response — try again' }, { status: 500 })
    }
    const result = toolBlock.input as { items: Array<{ name: string; pantry_note?: string }> }
    if (!Array.isArray(result.items)) {
      return Response.json({ error: 'Unexpected response format — try again' }, { status: 500 })
    }
    return Response.json({ items: result.items })
  } catch (err) {
    console.error('Claude consolidate error:', err)
    return Response.json({ error: 'Failed to consolidate — try again' }, { status: 500 })
  }
}
