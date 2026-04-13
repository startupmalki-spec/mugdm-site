"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Reveal, StaggerContainer, StaggerItem, TiltCard, FloatingElements, FloatingShaddas, ParticleNetwork } from "@/lib/animations";
import { Link } from "@/i18n/routing";
import { PRICE_IDS } from "@/lib/stripe/price-ids";

const TIER_KEYS = ["free", "pro", "biz"] as const;
const TIER_CONFIG = {
  free: { monthlyPrice: 0, yearlyPrice: 0, href: "/signup", highlighted: false, featureCount: 5 },
  pro: { monthlyPrice: 99, yearlyPrice: 990, href: "/signup?plan=pro", highlighted: true, featureCount: 8 },
  biz: { monthlyPrice: 299, yearlyPrice: 2990, href: "#contact", highlighted: false, featureCount: 6 },
} as const;

async function handleCheckout(priceId: string, locale: string) {
  try {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    }
  } catch {
    window.location.href = `/${locale}/signup?plan=pro`;
  }
}

export function Pricing() {
  const t = useTranslations("landing.pricing");
  const locale = useLocale();
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="relative py-24 sm:py-32">
      <ParticleNetwork className="z-[0]" density={30000} opacity={0.1} lineOpacity={0.04} speed={0.15} />
      <FloatingElements />
      <FloatingShaddas count={4} />
      <div className="shadda-pattern" />
      <div className="relative z-[1] max-w-[1280px] mx-auto px-6">
        {/* Header */}
        <Reveal className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-surface-1 text-xs text-muted-foreground mb-6">
            {t("badge")}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tighter mb-4">
            {t("title")} <span className="text-gradient">{t("titleGradient")}</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
            {t("subtitle")}
          </p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-3 bg-surface-1 border border-border rounded-full p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                !annual
                  ? "bg-primary text-primary-foreground shadow-[0_2px_10px_rgba(30,64,175,0.3)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("monthly")}
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                annual
                  ? "bg-primary text-primary-foreground shadow-[0_2px_10px_rgba(30,64,175,0.3)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("annual")}
              <span className="ml-1.5 text-xs opacity-80">{t("annualSave")}</span>
            </button>
          </div>
        </Reveal>

        {/* Tiers */}
        <StaggerContainer stagger={0.12} className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-[1080px] mx-auto items-stretch">
          {TIER_KEYS.map((key) => {
            const cfg = TIER_CONFIG[key];
            const name = t(`${key}Name`);
            const desc = t(`${key}Desc`);
            const cta = t(`${key}Cta`);
            const badge = key === "pro" ? t("proBadge") : null;
            const trialNote = key === "pro" ? t("proTrial") : null;
            const features = Array.from({ length: cfg.featureCount }, (_, i) => t(`${key}F${i + 1}`));

            return (
              <StaggerItem key={key} className="flex">
                <TiltCard
                  tiltAmount={4}
                  className={`group relative flex flex-col w-full p-8 rounded-2xl border transition-all duration-400 ${
                    cfg.highlighted
                      ? "border-primary bg-card shadow-[0_8px_40px_rgba(30,64,175,0.15)] scale-[1.02] md:scale-105 z-10"
                      : "border-border bg-card hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5"
                  }`}
                >
                  {badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-[0_4px_15px_rgba(30,64,175,0.3)]">
                        {badge}
                      </span>
                    </div>
                  )}

                  <div
                    className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
                    style={{
                      background: "radial-gradient(ellipse at var(--glow-x, 50%) var(--glow-y, 50%), rgba(30,64,175,0.08) 0%, transparent 60%)",
                    }}
                  />

                  <div className="relative flex flex-col h-full">
                    <h3 className="text-lg font-semibold tracking-tight mb-1">{name}</h3>
                    <p className="text-sm text-muted-foreground mb-5">{desc}</p>

                    <div className="mb-6">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold tracking-tight">
                          {cfg.monthlyPrice === 0
                            ? t("free")
                            : `SAR ${annual ? cfg.yearlyPrice.toLocaleString() : cfg.monthlyPrice}`}
                        </span>
                        {cfg.monthlyPrice > 0 && (
                          <span className="text-sm text-muted-foreground">
                            /{annual ? t("year") : t("mo")}
                          </span>
                        )}
                      </div>
                      {annual && cfg.monthlyPrice > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          SAR {Math.round(cfg.yearlyPrice / 12)}/{t("mo")} {t("billedAnnually")}
                        </p>
                      )}
                    </div>

                    <ul className="space-y-3 mb-8 flex-1">
                      {features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5 text-sm">
                          <Check size={16} className={`mt-0.5 shrink-0 ${cfg.highlighted ? "text-primary" : "text-muted-foreground"}`} />
                          <span className="text-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div>
                      {key === "pro" ? (
                        <button
                          type="button"
                          onClick={() => handleCheckout(annual ? PRICE_IDS.PRO_ANNUAL : PRICE_IDS.PRO_MONTHLY, locale)}
                          className="inline-flex items-center justify-center w-full h-11 rounded-lg text-sm font-medium transition-all duration-200 bg-primary text-primary-foreground shadow-[0_4px_15px_rgba(30,64,175,0.25)] hover:bg-[#1E3A8A] hover:shadow-[0_6px_25px_rgba(30,64,175,0.4)] hover:-translate-y-px active:scale-[0.98]"
                        >
                          {cta}
                        </button>
                      ) : cfg.href.startsWith('#') ? (
                        <a
                          href={cfg.href}
                          className="inline-flex items-center justify-center w-full h-11 rounded-lg text-sm font-medium transition-all duration-200 border border-border bg-surface-1 text-foreground hover:border-primary/30 hover:bg-primary/5 hover:-translate-y-px active:scale-[0.98]"
                        >
                          {cta}
                        </a>
                      ) : (
                        <Link
                          href={cfg.href}
                          className="inline-flex items-center justify-center w-full h-11 rounded-lg text-sm font-medium transition-all duration-200 border border-border bg-surface-1 text-foreground hover:border-primary/30 hover:bg-primary/5 hover:-translate-y-px active:scale-[0.98]"
                        >
                          {cta}
                        </Link>
                      )}
                      {trialNote && (
                        <p className="text-xs text-muted-foreground text-center mt-2">{trialNote}</p>
                      )}
                    </div>
                  </div>
                </TiltCard>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </div>
    </section>
  );
}
