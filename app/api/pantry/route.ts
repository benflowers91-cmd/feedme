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
    .from('pantry_items')
    .select('*')
    .eq('user_id', session.user.email)
    .order('name')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) return Response.json({ error: 'Missing name' }, { status: 400 })

  const supabase = createServerClient()
  const now = new Date().toISOString()

  // Adding something already in the pantry refreshes it rather than duplicating it —
  // a repeat buy is evidence you still have it. Matched in JS rather than with ilike:
  // ilike would treat % and _ in a name ("0% fat yoghurt") as wildcards and hit the
  // wrong row. A personal pantry is small enough that fetching it is free.
  const { data: candidates, error: lookupError } = await supabase
    .from('pantry_items')
    .select('*')
    .eq('user_id', session.user.email)

  if (lookupError) return Response.json({ error: lookupError.message }, { status: 500 })

  const target = name.toLowerCase()
  const existing = (candidates ?? []).find(item => item.name.trim().toLowerCase() === target)

  if (existing) {
    // Deliberately does NOT take source_shopping_item_id: only a row this tick
    // actually created may be undone by un-ticking. Stamping it here would let an
    // un-tick delete an item that was hand-added or scanned in long before.
    const patch: Record<string, unknown> = { last_confirmed_at: now, updated_at: now }
    if (body.quantity) patch.quantity = body.quantity

    const { data, error } = await supabase
      .from('pantry_items')
      .update(patch)
      .eq('id', existing.id)
      .eq('user_id', session.user.email)
      .select()
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json(data)
  }

  const { data, error } = await supabase
    .from('pantry_items')
    .insert({
      name,
      fodmap_status: body.fodmap_status ?? 'unknown',
      quantity: body.quantity ?? null,
      source_shopping_item_id: body.source_shopping_item_id ?? null,
      user_id: session.user.email,
      added_at: now,
      last_confirmed_at: now,
      updated_at: now,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const sourceShoppingItemId = searchParams.get('source_shopping_item_id')

  const supabase = createServerClient()

  // Un-ticking a shopping item undoes the pantry row it created — and only that
  // row. Hand-added and photo-scanned items have no source id, so they're safe.
  if (sourceShoppingItemId) {
    const { error } = await supabase
      .from('pantry_items')
      .delete()
      .eq('source_shopping_item_id', sourceShoppingItemId)
      .eq('user_id', session.user.email)

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return new Response(null, { status: 204 })
  }

  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabase
    .from('pantry_items')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.email)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
