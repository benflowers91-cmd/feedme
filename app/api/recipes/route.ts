import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('user_id', session.user.email)
    .eq('is_saved', true)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('recipes')
    .insert({ ...body, user_id: session.user.email, is_saved: true })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const body = await request.json()
  const update: Record<string, unknown> = {}
  if ('is_favourite' in body) {
    if (typeof body.is_favourite !== 'boolean') {
      return Response.json({ error: 'is_favourite must be a boolean' }, { status: 400 })
    }
    update.is_favourite = body.is_favourite
  }
  if ('tags' in body) {
    if (!Array.isArray(body.tags) || !body.tags.every((t: unknown) => typeof t === 'string')) {
      return Response.json({ error: 'tags must be an array of strings' }, { status: 400 })
    }
    update.tags = body.tags
  }
  if (Object.keys(update).length === 0) {
    return Response.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('recipes')
    .update(update)
    .eq('id', id)
    .eq('user_id', session.user.email)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const supabase = createServerClient()
  const { error } = await supabase
    .from('recipes')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.email)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
