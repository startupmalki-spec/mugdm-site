'use client'

import { useState, useCallback } from 'react'
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
  Settings,
  Menu,
  X,
  Globe,
  LogOut,
} from 'lucide-react'

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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('nav')
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const isRtl = locale === 'ar'

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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
    <div className="flex min-h-screen bg-surface-0">
      {/* Desktop Sidebar */}
      <aside
        className="fixed inset-y-0 z-30 hidden w-[280px] flex-col border-border bg-surface-1 lg:flex ltr:left-0 ltr:border-r rtl:right-0 rtl:border-l"
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Image
              src="/brand/7-transparent.png"
              alt=""
              width={500}
              height={500}
              className="h-8 w-8 brightness-0 invert"
              priority
            />
            <span className="text-lg font-bold tracking-tight text-foreground">Mugdm</span>
          </Link>
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
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Image
              src="/brand/7-transparent.png"
              alt=""
              width={500}
              height={500}
              className="h-7 w-7 brightness-0 invert"
            />
            <span className="text-lg font-bold tracking-tight text-foreground">Mugdm</span>
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

          {/* Business Name Placeholder */}
          <div className="hidden items-center gap-2 lg:flex">
            <div className="h-8 w-8 rounded-full bg-surface-3" />
            <span className="text-sm font-medium text-muted-foreground">
              --
            </span>
          </div>

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
              src="/brand/logo-shadda.png"
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
    </div>
  )
}
