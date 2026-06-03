import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { FODMAP_SYSTEM_PROMPT } from '@/lib/fodmap-prompt'

const anthropic = new Anthropic()

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { pantry_items, preferences } = await request.json()

  const userMessage = `Suggest 3 low-FODMAP recipes I can make using ingredients from my pantry.

PANTRY ITEMS: ${pantry_items?.length ? pantry_items.join(', ') : 'not specified — suggest recipes with common safe ingredients'}
${preferences ? `PREFERENCES: ${preferences}` : ''}

Return a JSON object with this exact structure:
{
  "recipes": [
    {
      "title": "string",
      "time_minutes": number,
      "servings": number,
      "ingredients": [
        { "name": "string", "amount": "string", "unit": "string", "fodmap_status": "safe|moderate|avoid|unknown" }
      ],
      "instructions": "string (numbered steps, newline-separated)",
      "fodmap_notes": "string (any substitutions or warnings)"
    }
  ]
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: [
        {
          type: 'text',
          text: FODMAP_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim()
    const parsed = JSON.parse(cleaned)
    return Response.json(parsed)
  } catch (err) {
    console.error('Claude suggest error:', err)
    return Response.json({ error: 'Failed to generate suggestions' }, { status: 500 })
  }
}
