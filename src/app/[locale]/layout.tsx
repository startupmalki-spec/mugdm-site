import type { Metadata } from 'next'
import { Inter, IBM_Plex_Sans_Arabic } from 'next/font/google'
import Script from 'next/script'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { DemoModeBadge } from '@/components/DemoModeBadge'
import '../globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const arabicFont = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-arabic',
  display: 'swap',
})

const BASE_URL = 'https://mugdm.com'
const OG_IMAGE_URL = `${BASE_URL}/brand/og-image.png`

const LOCALE_META = {
  ar: {
    title: 'Mugdm — منصة إدارة المنشآت الصغيرة | مُقدِم',
    description: 'المنصة المتكاملة لإدارة المستندات والالتزامات والشؤون المالية للمنشآت الصغيرة في السعودية.',
    ogTitle: 'Mugdm — منصة إدارة المنشآت الصغيرة',
    ogDescription: 'نظّم مستنداتك والتزاماتك وشؤونك المالية في مكان واحد.',
    keywords: ['إدارة المنشآت', 'السجل التجاري', 'المنشآت الصغيرة', 'السعودية', 'مُقدِم'],
  },
  en: {
    title: 'Mugdm — Small Business Management Platform',
    description: 'The all-in-one platform for managing documents, compliance, and finances for small businesses in Saudi Arabia.',
    ogTitle: 'Mugdm — Small Business Management Platform',
    ogDescription: 'Manage your documents, compliance, and finances in one place.',
    keywords: ['micro-enterprise', 'Saudi Arabia', 'business management', 'compliance', 'document management'],
  },
} as const

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const meta = LOCALE_META[locale as keyof typeof LOCALE_META] ?? LOCALE_META.en
  const localeUrl = `${BASE_URL}/${locale}`

  return {
    manifest: '/manifest.json',
    title: { default: meta.title, template: '%s | Mugdm' },
    description: meta.description,
    keywords: [...meta.keywords],
    alternates: { canonical: localeUrl, languages: { ar: `${BASE_URL}/ar`, en: `${BASE_URL}/en` } },
    openGraph: {
      title: meta.ogTitle, description: meta.ogDescription, url: localeUrl,
      siteName: 'Mugdm', type: 'website', locale: locale === 'ar' ? 'ar_SA' : 'en_US',
      images: [{ url: OG_IMAGE_URL, width: 1200, height: 630, alt: meta.ogTitle }],
    },
    twitter: {
      card: 'summary_large_image', site: '@mugdm_app', title: meta.ogTitle,
      description: meta.ogDescription, creator: '@mmalki27', images: [OG_IMAGE_URL],
    },
  }
}

function JsonLd({ locale }: { locale: string }) {
  const meta = LOCALE_META[locale as keyof typeof LOCALE_META] ?? LOCALE_META.en
  const structuredData = [
    { '@context': 'https://schema.org', '@type': 'Organization', name: 'Mugdm', url: BASE_URL, logo: `${BASE_URL}/brand/logo.png`, description: meta.description, sameAs: ['https://x.com/mugdm_app'] },
    { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Mugdm', url: BASE_URL, inLanguage: locale === 'ar' ? 'ar-SA' : 'en-US', description: meta.description },
  ]
  return <>{structuredData.map((data, index) => <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />)}</>
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
    <html lang={locale} dir={isRtl ? 'rtl' : 'ltr'} className="dark" suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme — reads localStorage before paint */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem('mugdm-theme');if(t==='light'){document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark')}}catch(e){}})()`}
        </Script>
        <JsonLd locale={locale} />
        <meta name="theme-color" content="#0F172A" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/brand/8.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js')})}`,
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${arabicFont.variable} min-h-screen bg-background text-foreground antialiased ${
          isRtl ? 'font-[var(--font-arabic)]' : 'font-[var(--font-inter)]'
        }`}
      >
        <NextIntlClientProvider messages={messages}>
          {/* <DemoModeBadge /> — hidden for investor pitch; toggle back on for internal demos */}
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
