import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateObligations } from '@/lib/compliance/rules-engine'
import type { Business } from '@/lib/supabase/types'

interface Owner {
  name: string
  nationality: string
  share: number
}

interface OnboardingPayload {
  name_ar: string
  name_en?: string
  cr_number: string
  activity_type?: string
  city?: string
  capital?: number
  cr_issuance_date?: string
  cr_expiry_date?: string
  owners?: Owner[]
  logo_url?: string
  stamp_url?: string
  contact_phone?: string
  contact_email?: string
  contact_address?: string
  cr_document_url?: string
}

// NOTE: Supabase typed client resolves .insert()/.update() params to `never`
// with this version of @supabase/ssr. Using `as any` at call boundaries is
// the standard workaround; the runtime payloads match the DB schema.

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body: OnboardingPayload = await request.json()

    if (!body.name_ar || !body.cr_number) {
      return NextResponse.json(
        { error: 'name_ar and cr_number are required' },
        { status: 400 }
      )
    }

    const crDigits = body.cr_number.replace(/\s/g, '')
    if (crDigits.length !== 10 || !/^\d+$/.test(crDigits)) {
      return NextResponse.json(
        { error: 'CR number must be exactly 10 digits' },
        { status: 400 }
      )
    }

    // NOTE: Supabase typed client resolves .insert()/.update() param to
    // `never` with this @supabase/ssr version. Cast through `any` at boundary.
    const { data: business, error: insertError } = await (supabase
      .from('businesses') as any)
      .insert({
        user_id: user.id,
        name_ar: body.name_ar,
        name_en: body.name_en ?? null,
        cr_number: crDigits,
        activity_type: body.activity_type ?? null,
        city: body.city ?? null,
        capital: body.capital ?? null,
        fiscal_year_end: null,
        cr_issuance_date: body.cr_issuance_date ?? null,
        cr_expiry_date: body.cr_expiry_date ?? null,
        owners: body.owners ?? null,
        logo_url: body.logo_url ?? null,
        stamp_url: body.stamp_url ?? null,
        contact_phone: body.contact_phone ?? null,
        contact_email: body.contact_email ?? user.email ?? null,
        contact_address: body.contact_address ?? null,
        letterhead_config: null,
        data_sharing_consent: false,
        profile_history: [],
      })
      .select()
      .single() as { data: Business | null; error: any }

    if (insertError || !business) {
      return NextResponse.json(
        { error: insertError?.message ?? 'Failed to create business' },
        { status: 500 }
      )
    }

    // Create the owner as the first team member
    const ownerName =
      body.owners?.[0]?.name || user.user_metadata?.full_name || user.email || ''

    await (supabase.from('team_members') as any).insert({
      business_id: business.id,
      name: ownerName,
      nationality: body.owners?.[0]?.nationality ?? 'Saudi',
      role: 'Owner',
      iqama_number: null,
      start_date: null,
      salary: null,
      status: 'ACTIVE',
      termination_date: null,
    })

    // Store CR document reference if provided
    if (body.cr_document_url) {
      await (supabase.from('documents') as any).insert({
        business_id: business.id,
        type: 'CR',
        name: 'Commercial Registration',
        file_url: body.cr_document_url,
        file_size: null,
        mime_type: null,
        expiry_date: null,
        is_current: true,
        extracted_data: null,
        ai_confidence: null,
        archived_at: null,
      })
    }

    // Auto-generate compliance obligations for the new business
    const obligationSeeds = generateObligations(business)
    if (obligationSeeds.length > 0) {
      await (supabase.from('obligations') as any).insert(obligationSeeds)
    }

    return NextResponse.json({ business }, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
