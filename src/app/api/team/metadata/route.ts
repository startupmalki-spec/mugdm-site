import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// NOTE: team_member_metadata table is not yet in the generated Supabase types.
// Cast .from() through `as never` at boundary until types are regenerated.

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const memberId = searchParams.get('member_id')
  if (!memberId) return NextResponse.json({ error: 'member_id required' }, { status: 400 })

  const { data, error } = await (supabase
    .from('team_member_metadata' as never)
    .select('*')
    .eq('team_member_id', memberId)
    .order('created_at', { ascending: false }) as unknown as Promise<{ data: unknown[] | null; error: { message: string } | null }>)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ metadata: data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { team_member_id, business_id, metadata_type, data: metaData } = body

  if (!team_member_id || !business_id || !metadata_type || !metaData) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const validTypes = ['salary_change', 'leave_record', 'document']
  if (!validTypes.includes(metadata_type)) {
    return NextResponse.json({ error: 'Invalid metadata_type' }, { status: 400 })
  }

  // Verify business ownership
  const { data: biz } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', business_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!biz) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const { data: inserted, error } = await (supabase
    .from('team_member_metadata' as never)
    .insert({ team_member_id, business_id, metadata_type, data: metaData } as never)
    .select()
    .single() as unknown as Promise<{ data: unknown | null; error: { message: string } | null }>)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ metadata: inserted }, { status: 201 })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await (supabase
    .from('team_member_metadata' as never)
    .delete()
    .eq('id', id) as unknown as Promise<{ error: { message: string } | null }>)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
