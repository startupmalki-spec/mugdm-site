import type { Metadata } from 'next'
import { Users } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Navbar } from '@/components/sections/navbar'
import { Footer } from '@/components/sections/footer'
import { ProductPage } from '@/components/sections/product-page'

type Params = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'productPage.payroll' })
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: {
      canonical: `https://mugdm.com/${locale}/payroll`,
      languages: { ar: 'https://mugdm.com/ar/payroll', en: 'https://mugdm.com/en/payroll' },
    },
  }
}

export default function PayrollPage() {
  return (
    <>
      <Navbar />
      <main>
        <ProductPage namespace="productPage.payroll" icon={Users} />
      </main>
      <Footer />
    </>
  )
}
