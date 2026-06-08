import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { FODMAP_SYSTEM_PROMPT } from '@/lib/fodmap-prompt'

const anthropic = new Anthropic()

const ANALYZE_TOOL: Anthropic.Tool = {
  name: 'identify_pantry_items',
  description: 'Return a structured list of food ingredients and pantry items identified in the image',
  input_schema: {
    type: 'object' as const,
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Ingredient or food item name' },
            quantity: { type: 'string', description: 'Visible quantity or amount, if discernible' },
            fodmap_status: {
              type: 'string',
              enum: ['safe', 'moderate', 'avoid', 'unknown'],
              description: 'FODMAP safety classification for this item',
            },
          },
          required: ['name', 'fodmap_status'],
        },
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

  let file: File | null = null
  try {
    const formData = await request.formData()
    file = formData.get('image') as File | null
  } catch {
    return Response.json({ error: 'Invalid request — expected multipart/form-data' }, { status: 400 })
  }

  if (!file) {
    return Response.json({ error: 'No image provided' }, { status: 400 })
  }

  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  const mediaType = file.type as Anthropic.Base64ImageSource['media_type']
  if (!validTypes.includes(file.type)) {
    return Response.json({ error: 'Unsupported image type — use JPEG, PNG, GIF, or WebP' }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      tools: [ANALYZE_TOOL],
      tool_choice: { type: 'tool', name: 'identify_pantry_items' },
      system: [
        {
          type: 'text',
          text: FODMAP_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: 'Identify all visible food ingredients and pantry items in this image. For each item, estimate any visible quantity (e.g. "1 can", "500g", "2 heads") and classify its FODMAP status based on the guidelines in your system prompt.',
            },
          ],
        },
      ],
    })

    const toolBlock = response.content.find(b => b.type === 'tool_use')
    if (!toolBlock || toolBlock.type !== 'tool_use') {
      return Response.json({ error: 'Unexpected response from Claude' }, { status: 500 })
    }
    return Response.json(toolBlock.input)
  } catch (err) {
    console.error('Claude pantry analyze error:', err)
    return Response.json({ error: 'Failed to analyse image — please try again' }, { status: 500 })
  }
}
