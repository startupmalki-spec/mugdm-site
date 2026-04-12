'use client'

import Image from 'next/image'
import { useLocale } from 'next-intl'
import { Link } from '@/i18n/routing'

const COPY = {
  ar: {
    heading: 'الصفحة غير موجودة',
    description: 'عذرًا، لم نتمكن من العثور على الصفحة التي تبحث عنها.',
    cta: 'العودة للرئيسية',
  },
  en: {
    heading: 'Page not found',
    description: 'Sorry, we could not find the page you are looking for.',
    cta: 'Back to home',
  },
} as const

export default function NotFound() {
  const locale = useLocale()
  const copy = COPY[locale as keyof typeof COPY] ?? COPY.en

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4 text-center">
      <Image
        src="/brand/8.png"
        alt="Mugdm logo"
        width={96}
        height={96}
        priority
      />

      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-bold text-foreground">404</h1>
        <h2 className="text-xl font-semibold text-foreground">{copy.heading}</h2>
        <p className="max-w-md text-muted-foreground">{copy.description}</p>
      </div>

      <Link
        href="/"
        className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {copy.cta}
      </Link>
    </main>
  )
}
