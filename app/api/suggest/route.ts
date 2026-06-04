import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { FODMAP_SYSTEM_PROMPT } from '@/lib/fodmap-prompt'

const anthropic = new Anthropic()

const SUGGEST_TOOL: Anthropic.Tool = {
  name: 'suggest_recipes',
  description: 'Return FODMAP-safe recipe suggestions based on pantry items',
  input_schema: {
    type: 'object',
    properties: {
      recipes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            time_minutes: { type: 'number' },
            servings: { type: 'number' },
            ingredients: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  amount: { type: 'string' },
                  unit: { type: 'string' },
                  fodmap_status: { type: 'string', enum: ['safe', 'moderate', 'avoid', 'unknown'] },
                },
                required: ['name', 'fodmap_status'],
              },
            },
            instructions: { type: 'string' },
            fodmap_notes: { type: 'string' },
          },
          required: ['title', 'time_minutes', 'servings', 'ingredients', 'instructions', 'fodmap_notes'],
        },
      },
    },
    required: ['recipes'],
  },
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { pantry_items, preferences } = await request.json()

  const userMessage = `Suggest 3 complete, low-FODMAP recipes I can make.

${pantry_items?.length ? `PANTRY ITEMS (use these where possible): ${pantry_items.join(', ')}` : 'Suggest recipes using common FODMAP-safe ingredients.'}
${preferences ? `PREFERENCES: ${preferences}` : ''}

All recipes must be fully FODMAP-safe — no high-FODMAP ingredients. Include complete ingredients with amounts and step-by-step instructions.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      tools: [SUGGEST_TOOL],
      tool_choice: { type: 'tool', name: 'suggest_recipes' },
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
    console.error('Claude suggest error:', err)
    return Response.json({ error: 'Failed to generate suggestions — please try again' }, { status: 500 })
  }
}
