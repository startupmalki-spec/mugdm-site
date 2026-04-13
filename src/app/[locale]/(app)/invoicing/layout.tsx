/**
 * Invoicing layout (server component).
 *
 * Resolves the current user's business and queries ZATCA cert health, then
 * renders the bilingual `CertExpiryBanner` above all invoicing pages. The
 * banner itself returns null for the `healthy` and `missing` states so this
 * layout stays inert outside of warning windows.
 */

import { createClient } from '@/lib/supabase/server'
import { getActiveCertStatus } from '@/lib/zatca/cert-monitor'
import CertExpiryBanner from '@/components/invoicing/CertExpiryBanner'

export default async function InvoicingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  let status: Awaited<ReturnType<typeof getActiveCertStatus>> = {
    cert: null,
    daysUntilExpiry: null,
    status: 'missing',
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (business?.id) {
      status = await getActiveCertStatus(supabase, business.id as string)
    }
  }

  return (
    <div>
      <CertExpiryBanner
        status={status.status}
        daysUntilExpiry={status.daysUntilExpiry}
      />
      {children}
    </div>
  )
}
