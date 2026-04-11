import type { Metadata } from 'next'
import { Inter, Noto_Sans_Arabic } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import '../globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  variable: '--font-noto-arabic',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Mugdm — منصة إدارة المنشآت الصغيرة | مُقدِم',
    template: '%s | Mugdm',
  },
  description:
    'المنصة المتكاملة لإدارة المستندات والالتزامات والشؤون المالية للمنشآت الصغيرة في السعودية. The all-in-one platform for Saudi micro-enterprise management.',
  keywords: [
    'إدارة المنشآت',
    'السجل التجاري',
    'المنشآت الصغيرة',
    'السعودية',
    'micro-enterprise',
    'Saudi Arabia',
    'business management',
    'compliance',
    'document management',
  ],
  openGraph: {
    title: 'Mugdm — منصة إدارة المنشآت الصغيرة',
    description:
      'نظّم مستنداتك والتزاماتك وشؤونك المالية في مكان واحد.',
    url: 'https://mugdm.com',
    siteName: 'Mugdm',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mugdm — منصة إدارة المنشآت الصغيرة',
    description:
      'نظّم مستنداتك والتزاماتك وشؤونك المالية في مكان واحد.',
    creator: '@mmalki27',
  },
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const isRtl = locale === 'ar'
  const messages = await getMessages()

  return (
    <html lang={locale} dir={isRtl ? 'rtl' : 'ltr'} className="dark">
      <body
        className={`${inter.variable} ${notoSansArabic.variable} min-h-screen bg-background text-foreground antialiased ${
          isRtl ? 'font-[var(--font-noto-arabic)]' : 'font-[var(--font-inter)]'
        }`}
      >
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
