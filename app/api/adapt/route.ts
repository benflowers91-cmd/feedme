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

  const { recipe_text } = await request.json()
  if (!recipe_text?.trim()) {
    return Response.json({ error: 'recipe_text is required' }, { status: 400 })
  }

  const userMessage = `Adapt the following recipe to be low-FODMAP safe. Identify high-FODMAP ingredients and provide clear substitutions.

ORIGINAL RECIPE:
${recipe_text}

Return a JSON object with this exact structure:
{
  "title": "string",
  "ingredients": [
    { "name": "string", "amount": "string", "unit": "string", "fodmap_status": "safe|moderate|avoid|unknown" }
  ],
  "instructions": "string (numbered steps, newline-separated)",
  "substitutions": [
    { "original": "string", "substitute": "string", "reason": "string" }
  ],
  "fodmap_notes": "string (overall safety assessment and any remaining caveats)"
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
    const parsed = JSON.parse(text)
    return Response.json(parsed)
  } catch {
    return Response.json({ error: 'Failed to adapt recipe' }, { status: 500 })
  }
}
