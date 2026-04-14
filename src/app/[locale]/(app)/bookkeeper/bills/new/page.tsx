import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Link } from '@/i18n/routing'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createClient } from '@/lib/supabase/server'
import AddBillForm from '@/components/bookkeeper/AddBillForm'

export const dynamic = 'force-dynamic'

const FEATURE_BILLS_ENABLED = process.env.NEXT_PUBLIC_FEATURE_BILLS === 'true'

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function NewBillPage({ params }: PageProps) {
  const { locale } = await params

  if (!FEATURE_BILLS_ENABLED) {
    notFound()
  }

  await requireAuth(locale)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) notFound()

  const { data: biz } = await supabase
    .from('businesses')
    .select('id')
    .eq('user_id', user.id)
    .single()

  const t = await getTranslations('bookkeeper.bills')

  if (!biz?.id) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
        <p className="mt-4 text-muted-foreground">{t('noBusiness')}</p>
        <Link
          href="/bookkeeper"
          className="mt-6 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {t('backToBookkeeper')}
        </Link>
      </div>
    )
  }

  return <AddBillForm businessId={biz.id} />
}
