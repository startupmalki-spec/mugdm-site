import type { Metadata } from 'next'
import { Calculator } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Navbar } from '@/components/sections/navbar'
import { Footer } from '@/components/sections/footer'
import { ProductPage } from '@/components/sections/product-page'

type Params = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'productPage.bookkeeping' })
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: {
      canonical: `https://mugdm.com/${locale}/bookkeeping`,
      languages: { ar: 'https://mugdm.com/ar/bookkeeping', en: 'https://mugdm.com/en/bookkeeping' },
    },
  }
}

export default function BookkeepingPage() {
  return (
    <>
      <Navbar />
      <main>
        <ProductPage namespace="productPage.bookkeeping" icon={Calculator} />
      </main>
      <Footer />
    </>
  )
}
