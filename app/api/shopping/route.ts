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
    .from('shopping_items')
    .select('*')
    .eq('user_id', session.user.email)
    .order('is_checked')
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

  // bulk insert (array) or single item
  const items = Array.isArray(body)
    ? body.map((item: object) => ({ ...item, user_id: session.user!.email }))
    : [{ ...body, user_id: session.user.email }]

  const { data, error } = await supabase
    .from('shopping_items')
    .insert(items)
    .select()

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
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('shopping_items')
    .update(body)
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
  const checked = searchParams.get('checked')
  const all = searchParams.get('all')

  const supabase = createServerClient()

  if (all === 'true') {
    const { error } = await supabase
      .from('shopping_items')
      .delete()
      .eq('user_id', session.user.email)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return new Response(null, { status: 204 })
  }

  if (checked === 'true') {
    const { error } = await supabase
      .from('shopping_items')
      .delete()
      .eq('user_id', session.user.email)
      .eq('is_checked', true)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return new Response(null, { status: 204 })
  }

  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabase
    .from('shopping_items')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.email)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
