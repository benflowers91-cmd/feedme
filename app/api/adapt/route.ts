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

  const userMessage = `Analyse the following recipe for FODMAP safety. For each ingredient, assess its FODMAP status and provide substitution options for any problematic ingredients.

ORIGINAL RECIPE:
${recipe_text}

Return a JSON object with this exact structure — no markdown, no code fences, just raw JSON:
{
  "title": "string",
  "ingredients": [
    {
      "name": "string",
      "amount": "string or null",
      "unit": "string or null",
      "fodmap_status": "safe|moderate|avoid|unknown",
      "substitution_options": [
        { "substitute": "string (include quantity if relevant, e.g. '2 tbsp garlic-infused oil')", "reason": "string" }
      ]
    }
  ],
  "instructions": "string (numbered steps, newline-separated)",
  "fodmap_notes": "string (overall safety summary and any remaining caveats)"
}

Rules:
- Every ingredient MUST have a "substitution_options" key. Use an empty array [] for safe/unknown ingredients.
- For avoid ingredients: provide 1-3 concrete, specific substitutes with clear quantities where possible.
- For moderate ingredients: provide 1-2 substitutes or note safe portion sizes.
- Keep the original recipe title unless the adaptation changes the dish significantly.
- Instructions should reflect the original method (substitutions are applied by the user).`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
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
    console.error('Claude adapt error:', err)
    return Response.json({ error: 'Failed to adapt recipe' }, { status: 500 })
  }
}
