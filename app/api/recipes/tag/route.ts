import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

const TAG_TOOL: Anthropic.Tool = {
  name: 'tag_recipe',
  description: 'Return meal_type, cuisine, and effort tags for a recipe',
  input_schema: {
    type: 'object',
    properties: {
      meal_type: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
      cuisine: { type: 'string', description: 'Cuisine style e.g. italian, mexican, asian, british' },
      effort: { type: 'string', enum: ['quick', 'moderate', 'involved'] },
    },
    required: ['meal_type', 'cuisine', 'effort'],
  },
}

async function tagRecipe(
  title: string,
  ingredientNames: string[],
): Promise<{ meal_type: string; cuisine: string; effort: string } | null> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      tools: [TAG_TOOL],
      tool_choice: { type: 'tool', name: 'tag_recipe' },
      messages: [{
        role: 'user',
        content: `Tag this recipe.\nTitle: ${title}\nIngredients: ${ingredientNames.slice(0, 8).join(', ')}`,
      }],
    })
    const toolBlock = response.content.find(b => b.type === 'tool_use')
    if (!toolBlock || toolBlock.type !== 'tool_use') return null
    return toolBlock.input as { meal_type: string; cuisine: string; effort: string }
  } catch {
    return null
  }
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userEmail = session.user!.email!
  const supabase = createServerClient()

  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id, title, ingredients, tags')
    .eq('user_id', userEmail)
    .eq('is_saved', true)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const untagged = (recipes ?? []).filter(r => !r.tags || r.tags.length === 0)

  if (untagged.length === 0) {
    return Response.json({ tagged: 0, results: [] })
  }

  const results = await Promise.all(
    untagged.map(async (recipe) => {
      const ingredientNames = (recipe.ingredients ?? []).map((i: { name: string }) => i.name)
      const tagData = await tagRecipe(recipe.title, ingredientNames)
      if (!tagData) return null

      const tags = [tagData.meal_type, tagData.cuisine.toLowerCase(), tagData.effort].filter(Boolean)

      const { error: updateError } = await supabase
        .from('recipes')
        .update({ tags })
        .eq('id', recipe.id)
        .eq('user_id', userEmail)

      if (updateError) return null
      return { id: recipe.id, tags }
    }),
  )

  const tagged = results.filter((r): r is { id: string; tags: string[] } => r !== null)
  return Response.json({ tagged: tagged.length, results: tagged })
}
