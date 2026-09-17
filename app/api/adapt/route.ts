import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { FODMAP_SYSTEM_PROMPT } from '@/lib/fodmap-prompt'

export const maxDuration = 60

const anthropic = new Anthropic()

const ANALYSE_TOOL: Anthropic.Tool = {
  name: 'analyse_recipe',
  description: 'Return a structured FODMAP analysis of the recipe',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            amount: { type: 'string' },
            unit: { type: 'string' },
            fodmap_status: { type: 'string', enum: ['safe', 'moderate', 'avoid', 'unknown'] },
            substitution_options: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  substitute: { type: 'string' },
                  reason: { type: 'string' },
                },
                required: ['substitute', 'reason'],
              },
            },
          },
          required: ['name', 'fodmap_status', 'substitution_options'],
        },
      },
      fodmap_notes: { type: 'string' },
    },
    required: ['title', 'ingredients', 'fodmap_notes'],
  },
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { recipe_text, dietary_requirements } = await request.json()
  if (!recipe_text?.trim()) {
    return Response.json({ error: 'recipe_text is required' }, { status: 400 })
  }
  if (recipe_text.length > 8000) {
    return Response.json({ error: 'Recipe is too long — try trimming it to just the ingredients and method' }, { status: 400 })
  }

  const dietaryNote = Array.isArray(dietary_requirements) && dietary_requirements.length > 0
    ? `\nADDITIONAL DIETARY REQUIREMENTS (treat as hard constraints — never suggest ingredients that violate these):\n${dietary_requirements.map((r: string) => `- ${r}`).join('\n')}\n`
    : ''

  const userMessage = `Analyse the following recipe for FODMAP safety. For each ingredient, assess its FODMAP status and provide substitution options for any problematic ingredients.
${dietaryNote}
Rules:
- Every ingredient MUST have a substitution_options array. Use an empty array for safe/unknown ingredients.
- For avoid ingredients: provide 1–3 concrete, specific substitutes with quantities where possible.
- For moderate ingredients: provide 1–2 substitutes or note safe portion sizes.
- Keep the original recipe title unless the adaptation changes the dish significantly.

ORIGINAL RECIPE:
${recipe_text}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      tools: [ANALYSE_TOOL],
      tool_choice: { type: 'tool', name: 'analyse_recipe' },
      system: [
        {
          type: 'text',
          text: FODMAP_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    })

    const toolBlock = response.content.find(b => b.type === 'tool_use')
    if (!toolBlock || toolBlock.type !== 'tool_use') {
      return Response.json({ error: 'Unexpected response from Claude' }, { status: 500 })
    }
    return Response.json(toolBlock.input)
  } catch (err) {
    console.error('Claude adapt error:', err)
    return Response.json({ error: 'Failed to adapt recipe — please try again' }, { status: 500 })
  }
}
