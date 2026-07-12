import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

const anthropic = new Anthropic()

const CONSOLIDATE_TOOL: Anthropic.Tool = {
  name: 'consolidate_shopping_list',
  description: 'Return a consolidated shopping list, merging near-duplicate and related ingredients, and leaving out anything the user confidently already has enough of in their pantry.',
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
              description: 'Set to "you may have this" if the item plausibly but not confidently matches something in the pantry (e.g. pantry quantity might not be enough). Omit if there is no pantry connection, or if the item was confident enough to leave off the list entirely (see removed_from_pantry).',
            },
          },
          required: ['name'],
        },
        description: 'The consolidated shopping list. Do not include items the user already has enough of in their pantry — list those separately in removed_from_pantry instead.',
      },
      removed_from_pantry: {
        type: 'array',
        items: { type: 'string' },
        description: 'Names of ingredients left off the shopping list entirely because the pantry clearly already has enough of them. Only include confident, close matches — when unsure, keep the item on the list with a pantry_note instead.',
      },
    },
    required: ['items', 'removed_from_pantry'],
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
    .select('name, quantity')
    .eq('user_id', session.user.email)

  const pantryItems = pantryData ?? []
  const pantrySection = pantryItems.length > 0
    ? `\nPANTRY (items the user already has at home; quantity is a rough estimate, not always tracked):\n${pantryItems.map(p => `- ${p.name}${p.quantity ? ` (${p.quantity})` : ''}`).join('\n')}\n`
    : ''

  const itemList = items.map((name: string) => `- ${name}`).join('\n')

  const userMessage = `Consolidate this shopping list by merging near-duplicates and similar ingredients into single clear entries.

Rules:
- Merge items that refer to the same ingredient (e.g. "cherry tomatoes", "vine tomatoes", "plum tomatoes" → "tomatoes").
- Combine quantities where possible (e.g. "2 chicken breasts" + "1 chicken breast" → "3 chicken breasts").
- If items are clearly different ingredients, keep them separate.
- Use plain, readable text (no units jargon). Keep it concise.
- Return only the consolidated items — no extra explanation.
- Preserve FODMAP-safe substitutions: never consolidate a safe ingredient into a high-FODMAP one.
- Use UK English spelling and ingredient names throughout: aubergine (not eggplant), courgette (not zucchini), coriander (not cilantro), spring onion (not scallion), prawns (not shrimp), rocket (not arugula), plain flour (not all-purpose flour), pepper (not bell pepper), chips (not fries), biscuits (not cookies).
- Convert US measurements to metric: 1 cup liquid → 240ml, 1 cup flour → 120g, 1 cup sugar → 200g, 1 cup rice → 185g, 1 oz → 28g, 1 lb → 450g. Keep tbsp and tsp as-is (used in UK). Use g and ml throughout.
- If an item clearly matches an ingredient already in the PANTRY and the pantry is likely to have enough of it, leave it off the shopping list entirely and put its consolidated name in removed_from_pantry instead. Be conservative: only do this for confident, close matches (e.g. pantry has "garlic" and the list needs "garlic" → remove). If the match is uncertain or the pantry quantity looks like it might not be enough for what's needed (e.g. pantry has "1 onion" but the list needs "3 onions"), keep the item on the list and set pantry_note to "you may have this" instead of removing it.
- CRITICAL — item name format: always write the ingredient name first with no leading quantity or unit. If there is a quantity or amount, append it after a comma. Examples: "chicken thighs, 400g" · "olive oil, 3 tbsp" · "cherry tomatoes, 250g" · "eggs, 4" · "garlic". Never start a name with a number or unit (e.g. do NOT write "400g chicken thighs" or "3 tbsp olive oil").
${pantrySection}
SHOPPING LIST:
${itemList}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      tools: [CONSOLIDATE_TOOL],
      tool_choice: { type: 'tool', name: 'consolidate_shopping_list' },
      messages: [{ role: 'user', content: userMessage }],
    })

    if (response.stop_reason === 'max_tokens') {
      return Response.json({ error: 'Shopping list is too long to consolidate — try removing some items first' }, { status: 422 })
    }

    const toolBlock = response.content.find(b => b.type === 'tool_use')
    if (!toolBlock || toolBlock.type !== 'tool_use') {
      return Response.json({ error: 'Unexpected response — try again' }, { status: 500 })
    }
    const result = toolBlock.input as { items: Array<{ name: string; pantry_note?: string }>; removed_from_pantry?: string[] }
    if (!Array.isArray(result.items)) {
      return Response.json({ error: 'Unexpected response format — try again' }, { status: 500 })
    }
    const removedFromPantry = Array.isArray(result.removed_from_pantry) ? result.removed_from_pantry : []
    return Response.json({ items: result.items, removed_from_pantry: removedFromPantry })
  } catch (err) {
    console.error('Claude consolidate error:', err)
    return Response.json({ error: 'Failed to consolidate — try again' }, { status: 500 })
  }
}
