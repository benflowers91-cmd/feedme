import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { FODMAP_SYSTEM_PROMPT } from '@/lib/fodmap-prompt'

const anthropic = new Anthropic()

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json(
      { error: `Could not read multipart form data — request may be malformed (${msg})` },
      { status: 400 }
    )
  }

  if (!file) {
    return Response.json({ error: "Form field 'image' is missing from the request" }, { status: 400 })
  }

  if (file.size > MAX_FILE_BYTES) {
    return Response.json(
      { error: `Image too large — maximum size is 10 MB. File received: ${(file.size / 1e6).toFixed(1)} MB` },
      { status: 413 }
    )
  }

  // Some mobile browsers send an empty file.type for camera captures — fall back to jpeg
  const rawType = file.type || 'image/jpeg'
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!validTypes.includes(rawType)) {
    return Response.json(
      { error: `Unsupported image type "${rawType}" — use JPEG, PNG, GIF, or WebP` },
      { status: 400 }
    )
  }
  const mediaType = rawType as Anthropic.Base64ImageSource['media_type']

  let base64: string
  try {
    const buffer = await file.arrayBuffer()
    base64 = Buffer.from(buffer).toString('base64')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Pantry analyze — buffer read error:', err)
    return Response.json({ error: `Failed to read image data — ${msg}` }, { status: 500 })
  }

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
      const types = response.content.map(b => b.type).join(', ') || 'empty'
      console.error('Pantry analyze — no tool_use block. Content types:', types)
      return Response.json(
        { error: `Claude returned no tool_use block — response content types: ${types}` },
        { status: 500 }
      )
    }

    const input = toolBlock.input as { items?: unknown }
    if (!Array.isArray(input.items)) {
      console.error('Pantry analyze — malformed items in tool response:', JSON.stringify(input))
      return Response.json(
        { error: `Claude response missing 'items' array — raw response: ${JSON.stringify(input)}` },
        { status: 500 }
      )
    }

    return Response.json(input)
  } catch (err: unknown) {
    console.error('Pantry analyze — Claude API error:', err)
    const anthropicErr = err as { status?: number; message?: string }
    const status = anthropicErr.status ?? 'unknown'
    const message = anthropicErr.message ?? String(err)
    return Response.json(
      { error: `Claude API error (${status}): ${message}` },
      { status: 500 }
    )
  }
}
