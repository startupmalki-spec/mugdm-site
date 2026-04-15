import type { Metadata } from 'next'
import { Navbar } from '@/components/sections/navbar'
import { Pricing } from '@/components/sections/pricing'
import { Footer } from '@/components/sections/footer'
import { PricingFaq } from '@/components/sections/pricing-faq'
import { getTranslations } from 'next-intl/server'

type Params = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'landing.pricingPage' })
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: {
      canonical: `https://mugdm.com/${locale}/pricing`,
      languages: { ar: 'https://mugdm.com/ar/pricing', en: 'https://mugdm.com/en/pricing' },
    },
  }
}

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        <Pricing />
        <PricingFaq />
      </main>
      <Footer />
    </>
  )
}
