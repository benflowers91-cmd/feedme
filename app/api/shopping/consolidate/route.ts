import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

const CONSOLIDATE_TOOL: Anthropic.Tool = {
  name: 'consolidate_shopping_list',
  description: 'Return a consolidated shopping list, merging near-duplicate and related ingredients',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: { type: 'string' },
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

  const { items } = await request.json()
  if (!Array.isArray(items) || items.length === 0) {
    return Response.json({ error: 'items array is required' }, { status: 400 })
  }

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
    const result = toolBlock.input as { items: string[] }
    return Response.json({ items: result.items })
  } catch (err) {
    console.error('Claude consolidate error:', err)
    return Response.json({ error: 'Failed to consolidate — try again' }, { status: 500 })
  }
}
