'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { Link, useRouter } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  Building2,
  Users,
  FolderArchive,
  CalendarDays,
  Calculator,
  MessageSquare,
  CreditCard,
  Settings,
  Menu,
  X,
  Globe,
  LogOut,
  ChevronDown,
  Check,
} from 'lucide-react'
import FloatingAssistant from '@/components/chat/FloatingAssistant'
import { BusinessProvider, useBusiness } from '@/lib/business-context'
import { initPostHog, identifyUser } from '@/lib/analytics/posthog'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'

interface NavItem {
  href: string
  labelKey: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { href: '/profile', labelKey: 'profile', icon: Building2 },
  { href: '/team', labelKey: 'team', icon: Users },
  { href: '/vault', labelKey: 'vault', icon: FolderArchive },
  { href: '/calendar', labelKey: 'calendar', icon: CalendarDays },
  { href: '/bookkeeper', labelKey: 'bookkeeper', icon: Calculator },
  { href: '/chat', labelKey: 'chat', icon: MessageSquare },
  { href: '/billing', labelKey: 'billing', icon: CreditCard },
  { href: '/settings', labelKey: 'settings', icon: Settings },
]

function isActiveRoute(pathname: string, href: string, locale: string): boolean {
  const localePrefix = `/${locale}`
  const normalizedPathname = pathname.replace(localePrefix, '') || '/'

  if (href === '/') {
    return normalizedPathname === '/'
  }

  return normalizedPathname === href || normalizedPathname.startsWith(href + '/')
}

function HeaderBusinessName() {
  const locale = useLocale()
  const { currentBusiness } = useBusiness()

  const displayName = currentBusiness
    ? (locale === 'ar' ? currentBusiness.name_ar : (currentBusiness.name_en || currentBusiness.name_ar))
    : null

  return (
    <div className="hidden items-center gap-2 lg:flex">
      <div className="h-8 w-8 rounded-full bg-surface-3 flex items-center justify-center text-xs font-bold text-primary">
        {displayName ? displayName.charAt(0) : ''}
      </div>
      <span className="text-sm font-medium text-muted-foreground">
        {displayName ?? '--'}
      </span>
    </div>
  )
}

function BusinessSwitcher() {
  const t = useTranslations('nav')
  const locale = useLocale()
  const { businesses, currentBusiness, switchBusiness } = useBusiness()
  const [isOpen, setIsOpen] = useState(false)

  if (businesses.length <= 1) {
    // Show current business name (no dropdown)
    const displayName = currentBusiness
      ? (locale === 'ar' ? currentBusiness.name_ar : (currentBusiness.name_en || currentBusiness.name_ar))
      : null

    if (!displayName) return null

    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
          {displayName.charAt(0)}
        </div>
        <span className="truncate text-sm font-medium text-foreground">{displayName}</span>
      </div>
    )
  }

  const displayName = currentBusiness
    ? (locale === 'ar' ? currentBusiness.name_ar : (currentBusiness.name_en || currentBusiness.name_ar))
    : t('selectBusiness')

  return (
    <div className="relative px-3 py-2">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-start transition-colors hover:bg-surface-3"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
          {displayName.charAt(0)}
        </div>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {displayName}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute start-3 end-3 z-50 mt-1 rounded-xl border border-border bg-card p-1 shadow-xl">
            {businesses.map((biz) => {
              const name = locale === 'ar' ? biz.name_ar : (biz.name_en || biz.name_ar)
              const isSelected = biz.id === currentBusiness?.id
              return (
                <button
                  key={biz.id}
                  type="button"
                  onClick={() => {
                    switchBusiness(biz.id)
                    setIsOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-2"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
                    {name.charAt(0)}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-start">{name}</span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('nav')
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const isRtl = locale === 'ar'

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isMobileMenuOpen])

  // Initialize PostHog analytics
  useEffect(() => {
    initPostHog()
    // Identify logged-in user
    const supabase = createSupabaseClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        identifyUser(user.id, { email: user.email })
      }
    })
  }, [])

  const handleToggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev)
  }, [])

  const handleCloseMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false)
  }, [])

  const handleSwitchLocale = useCallback(() => {
    const nextLocale = locale === 'ar' ? 'en' : 'ar'
    router.replace(pathname, { locale: nextLocale })
  }, [locale, pathname, router])

  const handleLogout = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }, [router])

  return (
    <BusinessProvider>
    <div className="flex min-h-screen bg-surface-0">
      {/* Desktop Sidebar */}
      <aside
        className="fixed inset-y-0 z-30 hidden w-[280px] flex-col border-border bg-surface-1 lg:flex ltr:left-0 ltr:border-r rtl:right-0 rtl:border-l"
      >
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-border px-5">
          <Link href="/" className="flex items-center">
            <Image
              src="/brand/1-transparent.png"
              alt="Mugdm"
              width={140}
              height={40}
              className="hidden h-10 w-auto dark:block"
              priority
            />
            <Image
              src="/brand/2-transparent.png"
              alt="Mugdm"
              width={140}
              height={40}
              className="h-10 w-auto dark:hidden"
              priority
            />
          </Link>
        </div>

        {/* Business Switcher */}
        <div className="border-b border-border">
          <BusinessSwitcher />
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = isActiveRoute(pathname, item.href, locale)
              const Icon = item.icon

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{t(item.labelKey)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Sidebar Footer */}
        <div className="border-t border-border p-3 space-y-1">
          <button
            type="button"
            onClick={handleSwitchLocale}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <Globe className="h-5 w-5 shrink-0" />
            <span>{locale === 'ar' ? 'English' : 'العربية'}</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span>{t('logout')}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={handleCloseMobileMenu}
          aria-hidden="true"
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`fixed inset-y-0 z-50 w-[280px] flex-col border-border bg-surface-1 transition-transform duration-300 lg:hidden ltr:left-0 ltr:border-r rtl:right-0 rtl:border-l ${
          isMobileMenuOpen
            ? 'translate-x-0'
            : isRtl
              ? 'translate-x-full'
              : '-translate-x-full'
        }`}
      >
        {/* Mobile Logo + Close */}
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <Link href="/" className="flex items-center">
            <Image
              src="/brand/1-transparent.png"
              alt="Mugdm"
              width={120}
              height={36}
              className="hidden h-9 w-auto dark:block"
            />
            <Image
              src="/brand/2-transparent.png"
              alt="Mugdm"
              width={120}
              height={36}
              className="h-9 w-auto dark:hidden"
            />
          </Link>
          <button
            type="button"
            onClick={handleCloseMobileMenu}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mobile Business Switcher */}
        <div className="border-b border-border">
          <BusinessSwitcher />
        </div>

        {/* Mobile Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Mobile navigation">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = isActiveRoute(pathname, item.href, locale)
              const Icon = item.icon

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={handleCloseMobileMenu}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{t(item.labelKey)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Mobile Footer */}
        <div className="border-t border-border p-3 space-y-1">
          <button
            type="button"
            onClick={handleSwitchLocale}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <Globe className="h-5 w-5 shrink-0" />
            <span>{locale === 'ar' ? 'English' : 'العربية'}</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span>{t('logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col lg:ltr:ml-[280px] lg:rtl:mr-[280px]">
        {/* Top Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-surface-1/80 px-4 backdrop-blur-md lg:px-8">
          {/* Mobile Hamburger */}
          <button
            type="button"
            onClick={handleToggleMobileMenu}
            className="rounded-lg p-2 text-muted-foreground hover:bg-surface-2 hover:text-foreground lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Business Name */}
          <HeaderBusinessName />

          {/* Header Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSwitchLocale}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground lg:hidden"
            >
              {locale === 'ar' ? 'EN' : 'ع'}
            </button>

            <div className="h-8 w-8 rounded-full bg-primary/20" aria-label="User menu" />
          </div>
        </header>

        {/* Page Content */}
        <main className="relative flex-1 px-4 py-6 lg:px-8 lg:py-8">
          {/* Shadda watermark */}
          <div
            className="pointer-events-none fixed bottom-[-60px] opacity-[0.04] ltr:right-[-40px] rtl:left-[-40px]"
            style={{ zIndex: 0 }}
          >
            <Image
              src="/brand/7-transparent.png"
              alt=""
              width={320}
              height={320}
              className="h-[320px] w-[320px] object-contain brightness-200"
              aria-hidden="true"
            />
          </div>
          <div className="relative z-[1]">
            {children}
          </div>
        </main>
      </div>

      <FloatingAssistant />
    </div>
    </BusinessProvider>
  )
}
