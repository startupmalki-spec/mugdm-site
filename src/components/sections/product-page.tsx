"use client";

import { LucideIcon, Check, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

type Props = {
  namespace: string;
  icon: LucideIcon;
  stepCount?: number;
  benefitCount?: number;
  faqCount?: number;
};

export function ProductPage({
  namespace,
  icon: Icon,
  stepCount = 4,
  benefitCount = 4,
  faqCount = 4,
}: Props) {
  const t = useTranslations(namespace);

  return (
    <>
      {/* Hero */}
      <section
        className="relative pt-32 pb-16 sm:pt-40 sm:pb-20"
        style={{ paddingInlineStart: "24px", paddingInlineEnd: "24px" }}
      >
        <div className="max-w-[920px] mx-auto text-center">
          <div className="inline-flex items-center gap-2 h-9 px-3 rounded-full border border-border bg-surface-1 text-xs text-muted-foreground mb-6">
            <Icon size={14} className="text-primary" />
            {t("hero.eyebrow")}
          </div>
          <h1 className="text-[clamp(36px,5vw,60px)] font-extrabold tracking-[-0.03em] leading-[1.08] mb-6">
            {t("hero.title")}
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-[680px] mx-auto mb-8 leading-relaxed">
            {t("hero.description")}
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 h-12 px-7 rounded-xl bg-primary text-primary-foreground text-base font-medium shadow-[0_6px_20px_rgba(30,64,175,0.25)] hover:-translate-y-0.5 transition-all"
            >
              {t("hero.primaryCta")}
              <ArrowRight size={18} className="rtl:rotate-180" />
            </Link>
            <Link
              href="/#contact"
              className="inline-flex items-center justify-center h-12 px-7 rounded-xl border border-border bg-surface-1 text-base font-medium hover:border-primary/40 hover:bg-surface-2 transition-colors"
            >
              {t("hero.secondaryCta")}
            </Link>
          </div>
        </div>
      </section>

      {/* Warm band — how it works + screenshots + benefits */}
      <div data-theme-section="warm">
        {/* How it works */}
        <section
          className="relative py-20 sm:py-28"
          style={{ paddingInlineStart: "24px", paddingInlineEnd: "24px" }}
        >
          <div className="max-w-[1100px] mx-auto">
            <div className="text-center mb-14">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-surface-1 text-xs text-muted-foreground mb-5">
                {t("how.eyebrow")}
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tighter">
                {t("how.title")}
              </h2>
            </div>
            <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: stepCount }, (_, i) => (
                <li
                  key={i}
                  className="relative rounded-2xl border border-border bg-card p-6 flex flex-col"
                >
                  <span className="text-xs uppercase tracking-[0.18em] text-primary mb-3">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-lg font-semibold tracking-tight mb-2">
                    {t(`how.steps.${i}.title`)}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t(`how.steps.${i}.description`)}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Screenshot placeholder */}
        <section
          className="relative pb-20"
          style={{ paddingInlineStart: "24px", paddingInlineEnd: "24px" }}
        >
          <div className="max-w-[1100px] mx-auto">
            <div className="relative aspect-[16/9] rounded-2xl border border-border bg-gradient-to-br from-surface-1 to-surface-2 overflow-hidden shadow-[0_24px_60px_rgba(30,64,175,0.15)]">
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(30,64,175,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(30,64,175,0.08) 1px, transparent 1px)",
                  backgroundSize: "28px 28px",
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-center px-6">
                  <Icon size={48} className="text-primary/40" />
                  <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
                    {t("screenshotPlaceholder")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section
          className="relative pb-24"
          style={{ paddingInlineStart: "24px", paddingInlineEnd: "24px" }}
        >
          <div className="max-w-[900px] mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tighter mb-3">
                {t("benefits.title")}
              </h2>
              <p className="text-muted-foreground text-lg">{t("benefits.subtitle")}</p>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: benefitCount }, (_, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card p-5"
                >
                  <span
                    className="shrink-0 w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center mt-0.5"
                    style={{ marginInlineEnd: "4px" }}
                  >
                    <Check size={14} className="text-primary" strokeWidth={3} />
                  </span>
                  <div>
                    <h3 className="font-semibold text-[15px] tracking-tight mb-1">
                      {t(`benefits.items.${i}.title`)}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t(`benefits.items.${i}.description`)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      {/* FAQ — back to dark */}
      <section
        className="relative py-20 sm:py-24"
        style={{ paddingInlineStart: "24px", paddingInlineEnd: "24px" }}
      >
        <div className="max-w-[760px] mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tighter text-center mb-10">
            {t("faq.title")}
          </h2>
          <div className="flex flex-col gap-3">
            {Array.from({ length: faqCount }, (_, i) => (
              <details
                key={i}
                className="group rounded-2xl border border-border bg-surface-1 hover:border-primary/30 open:border-primary/40 transition-colors"
              >
                <summary
                  className="flex items-center justify-between cursor-pointer list-none py-5 font-medium text-foreground text-[15px]"
                  style={{ paddingInlineStart: "24px", paddingInlineEnd: "24px" }}
                >
                  <span>{t(`faq.items.${i}.q`)}</span>
                  <span
                    className="text-muted-foreground transition-transform duration-200 group-open:rotate-45"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <div
                  className="pb-5 text-muted-foreground text-[14px] leading-relaxed"
                  style={{ paddingInlineStart: "24px", paddingInlineEnd: "24px" }}
                >
                  {t(`faq.items.${i}.a`)}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA — dark */}
      <section
        className="relative py-24 sm:py-28"
        style={{ paddingInlineStart: "24px", paddingInlineEnd: "24px" }}
      >
        <div className="max-w-[760px] mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tighter mb-4">
            {t("cta.title")}
          </h2>
          <p className="text-muted-foreground text-lg mb-8">{t("cta.description")}</p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 h-12 px-8 rounded-xl bg-primary text-primary-foreground text-base font-medium shadow-[0_6px_20px_rgba(30,64,175,0.25)] hover:-translate-y-0.5 transition-all"
          >
            {t("cta.button")}
            <ArrowRight size={18} className="rtl:rotate-180" />
          </Link>
        </div>
      </section>
    </>
  );
}
