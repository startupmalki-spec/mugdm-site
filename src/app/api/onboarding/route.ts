import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateObligations } from '@/lib/compliance/rules-engine'
import { generateObligationsFromCR, toObligationSeeds } from '@/lib/compliance/obligation-generator'
import type { CRData } from '@/lib/compliance/obligation-generator'
import type { Business, Database } from '@/lib/supabase/types'

type Tables = Database['public']['Tables']

/**
 * Workaround for Supabase typed client resolving .insert()/.update() params
 * to `never` with this @supabase/ssr version. Provides a minimal query
 * builder interface typed to the actual table schema.
 */
interface TypedTableBuilder<TInsert, TRow> {
  insert(values: TInsert | TInsert[]): {
    select(): { single(): PromiseLike<{ data: TRow | null; error: { message: string } | null }> }
  } & PromiseLike<{ error: { message: string } | null }>
  select(columns: string): {
    eq(column: string, value: string): {
      maybeSingle(): PromiseLike<{ data: Pick<TRow, 'id' extends keyof TRow ? 'id' : never> | null }>
      eq(column: string, value: string): {
        maybeSingle(): PromiseLike<{ data: Pick<TRow, 'id' extends keyof TRow ? 'id' : never> | null }>
      }
    }
  }
}

type BusinessTableBuilder = TypedTableBuilder<Tables['businesses']['Insert'], Business>
type TeamMemberTableBuilder = TypedTableBuilder<Tables['team_members']['Insert'], Tables['team_members']['Row']>
type DocumentTableBuilder = TypedTableBuilder<Tables['documents']['Insert'], Tables['documents']['Row']>
type ObligationTableBuilder = TypedTableBuilder<Tables['obligations']['Insert'], Tables['obligations']['Row']>

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
// with this version of @supabase/ssr. We cast through `unknown` at call
// boundaries; the runtime payloads match the DB schema.

export async function POST(request: Request) {
  let userId: string | undefined
  let businessId: string | undefined

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
    userId = user.id

    const body: OnboardingPayload = await request.json()

    if (!body.name_ar || !body.cr_number) {
      return NextResponse.json(
        { error: 'name_ar and cr_number are required' },
        { status: 400 }
      )
    }

    // Prevent duplicate business creation (double-submit, network retry)
    const { data: existingBusiness } = await (supabase
      .from('businesses') as unknown as BusinessTableBuilder)
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingBusiness) {
      return NextResponse.json(
        { error: 'Business already exists', businessId: existingBusiness.id },
        { status: 409 }
      )
    }

    const crDigits = body.cr_number.replace(/\s/g, '')
    if (crDigits.length !== 10 || !/^\d+$/.test(crDigits)) {
      return NextResponse.json(
        { error: 'CR number must be exactly 10 digits' },
        { status: 400 }
      )
    }

    const { data: business, error: insertError } = await (supabase
      .from('businesses') as unknown as BusinessTableBuilder)
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
        owners: (body.owners as Record<string, unknown>[] | undefined) ?? null,
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
      .single()

    if (insertError || !business) {
      return NextResponse.json(
        { error: insertError?.message ?? 'Failed to create business' },
        { status: 500 }
      )
    }
    businessId = business.id

    // Create the owner as the first team member
    const ownerName =
      body.owners?.[0]?.name || user.user_metadata?.full_name || user.email || ''

    const { error: teamError } = await (supabase.from('team_members') as unknown as TeamMemberTableBuilder).insert({
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

    if (teamError) {
      console.error('[API] onboarding failed:', { userId, businessId: business.id, step: 'team_member_insert', error: teamError.message })
    }

    // Store CR document reference if provided
    if (body.cr_document_url) {
      const { error: docError } = await (supabase.from('documents') as unknown as DocumentTableBuilder).insert({
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

      if (docError) {
        console.error('[API] onboarding failed:', { userId, businessId: business.id, step: 'document_insert', error: docError.message })
      }
    }

    // Auto-generate compliance obligations from CR data (covers all base
    // obligations plus business-type-specific ones like food safety, etc.)
    const crData: CRData = {
      crNumber: business.cr_number,
      businessName: business.name_ar,
      activityType: business.activity_type,
      expiryDate: business.cr_expiry_date,
      city: business.city,
    }
    const generated = generateObligationsFromCR(crData)
    const obligationSeeds = toObligationSeeds(business.id, generated)

    // Fall back to the basic generator if CR-based generation returned nothing
    // (e.g. missing CR expiry date could reduce output)
    const seeds = obligationSeeds.length > 0 ? obligationSeeds : generateObligations(business)

    if (seeds.length > 0) {
      await (supabase.from('obligations') as unknown as ObligationTableBuilder).insert(seeds)
    }

    return NextResponse.json({ business }, { status: 201 })
  } catch (error) {
    console.error('[API] onboarding failed:', {
      userId,
      businessId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
