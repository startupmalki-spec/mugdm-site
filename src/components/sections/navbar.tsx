"use client";

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";

const NAV_KEYS = [
  { key: "features", href: "#features" },
  { key: "howItWorks", href: "#how-it-works" },
  { key: "whyMugdm", href: "#why" },
  { key: "contact", href: "#contact" },
] as const;

export function Navbar() {
  const t = useTranslations("landing.nav");
  const locale = useLocale();
  const pathname = usePathname();
  const otherLocale = locale === "ar" ? "en" : "ar";
  const otherLocaleLabel = locale === "ar" ? "English" : "العربية";
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "glass border-b border-border/50 shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-[1280px] mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center group">
          {/* Use the neutral wordmark everywhere — no purple brand variant.
              If this isn't the right file, swap 'logo-wordmark.png' for one
              of: 1-transparent / 7-transparent / 8-transparent / 9.png in
              /public/brand/. */}
          <Image
            src="/brand/logo-wordmark.jpg"
            alt="Mugdm"
            width={140}
            height={40}
            className="h-10 w-auto transition-transform duration-300 group-hover:scale-105"
            priority
          />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_KEYS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 relative after:content-[''] after:absolute after:-bottom-1 after:left-0 after:w-0 after:h-[2px] after:bg-primary after:transition-all after:duration-300 after:rounded-sm hover:after:w-full"
            >
              {t(link.key)}
            </a>
          ))}
          <Link
            href={pathname}
            locale={otherLocale}
            aria-label={locale === "ar" ? "Switch to English" : "التبديل إلى العربية"}
            className="inline-flex items-center justify-center h-9 px-4 rounded-full border border-border bg-surface-1/60 text-xs font-medium text-muted-foreground transition-all duration-200 hover:text-foreground hover:border-primary/40 hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {otherLocaleLabel}
          </Link>
          <Link
            href={isLoggedIn ? "/dashboard" : "/signup"}
            className="inline-flex items-center justify-center gap-2 h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium transition-all duration-200 shadow-[0_4px_15px_rgba(30,64,175,0.25)] hover:bg-[#1E3A8A] hover:shadow-[0_6px_25px_rgba(30,64,175,0.4)] hover:-translate-y-px active:scale-[0.98]"
          >
            {isLoggedIn ? t("dashboard") : t("getStarted")}
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden glass border-t border-border/50">
          <div className="px-6 py-4 flex flex-col gap-4">
            {NAV_KEYS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {t(link.key)}
              </a>
            ))}
            <Link
              href={pathname}
              locale={otherLocale}
              onClick={() => setMobileOpen(false)}
              className="inline-flex items-center justify-center h-9 px-4 rounded-full border border-border bg-surface-1/60 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40"
            >
              {otherLocaleLabel}
            </Link>
            <Link
              href={isLoggedIn ? "/dashboard" : "/signup"}
              className="inline-flex items-center justify-center h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium mt-2"
              onClick={() => setMobileOpen(false)}
            >
              {isLoggedIn ? t("dashboard") : t("getStarted")}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
