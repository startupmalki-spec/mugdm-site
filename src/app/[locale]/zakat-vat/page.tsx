import type { Metadata } from 'next'
import { Receipt } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Navbar } from '@/components/sections/navbar'
import { Footer } from '@/components/sections/footer'
import { ProductPage } from '@/components/sections/product-page'

type Params = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'productPage.zakatVat' })
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: {
      canonical: `https://mugdm.com/${locale}/zakat-vat`,
      languages: { ar: 'https://mugdm.com/ar/zakat-vat', en: 'https://mugdm.com/en/zakat-vat' },
    },
  }
}

export default function ZakatVatPage() {
  return (
    <>
      <Navbar />
      <main>
        <ProductPage namespace="productPage.zakatVat" icon={Receipt} />
      </main>
      <Footer />
    </>
  )
}
