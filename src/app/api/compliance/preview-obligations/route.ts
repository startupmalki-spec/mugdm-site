import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import {
  generateObligationsWithApplicability,
  type CRData,
} from '@/lib/compliance/obligation-generator'

interface PreviewPayload {
  cr_number?: string
  business_name?: string
  activity_type?: string | null
  cr_expiry_date?: string | null
  city?: string | null
  main_activity_code?: string | null
  sub_activities?: string[]
  has_physical_location?: boolean | null
  annual_revenue?: number | null
  capital?: number | null
}

/**
 * POST /api/compliance/preview-obligations
 *
 * Auth-gated preview endpoint. Takes CR data from the request body and
 * returns the list of obligations (with applicability labels) the user
 * should see in the onboarding review step. Does NOT persist.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as PreviewPayload

    const crData: CRData = {
      crNumber: body.cr_number ?? '',
      businessName: body.business_name ?? '',
      activityType: body.activity_type ?? null,
      expiryDate: body.cr_expiry_date ?? null,
      city: body.city ?? null,
      isicCode: body.main_activity_code ?? null,
      subActivityCodes: body.sub_activities ?? [],
      hasPhysicalLocation:
        body.has_physical_location === undefined
          ? null
          : body.has_physical_location,
      annualRevenue:
        body.annual_revenue ?? body.capital ?? null,
    }

    const obligations = generateObligationsWithApplicability(crData)

    return NextResponse.json({
      obligations: obligations.map((o) => ({
        type: o.type,
        name: o.name,
        applicability: o.applicability ?? 'REQUIRED',
        reason: o.reason ?? null,
        frequency: o.frequency,
        next_due_date: o.next_due_date,
      })),
    })
  } catch (error) {
    console.error('[API] preview-obligations failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
