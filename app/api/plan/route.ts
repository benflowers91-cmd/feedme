import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const supabase = createServerClient()
  let query = supabase
    .from('meal_plan')
    .select('*')
    .eq('user_id', session.user.email)
    .order('plan_date')
    .order('meal_type')

  if (from) query = query.gte('plan_date', from)
  if (to) query = query.lte('plan_date', to)

  const { data, error } = await query
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

  // upsert: replace if same date + meal_type exists
  const { data, error } = await supabase
    .from('meal_plan')
    .upsert(
      { ...body, user_id: session.user.email },
      { onConflict: 'user_id,plan_date,meal_type' }
    )
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
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const supabase = createServerClient()
  const { error } = await supabase
    .from('meal_plan')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.email)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
