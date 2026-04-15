"use client";

import { Quote, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";

const SLOTS = [0, 1, 2] as const;

export function Testimonials() {
  const t = useTranslations("landing.testimonials");

  return (
    <section
      id="testimonials"
      className="relative py-24 sm:py-32"
      style={{ paddingInlineStart: "24px", paddingInlineEnd: "24px" }}
    >
      <div className="relative max-w-[1200px] mx-auto">
        <div className="text-center mb-14">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-surface-1 text-xs text-muted-foreground mb-6">
            {t("badge")}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tighter mb-4">
            {t("title")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-[620px] mx-auto">
            {t("subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {SLOTS.map((i) => (
            <div
              key={i}
              className="relative rounded-2xl border border-dashed border-border bg-surface-1/50 p-7 flex flex-col min-h-[220px]"
            >
              <Quote size={24} className="text-primary/40 mb-4" />
              <p className="text-muted-foreground/80 text-[15px] leading-relaxed mb-auto">
                {t("placeholderQuote")}
              </p>
              <div className="mt-6 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-surface-2 border border-border" />
                <div>
                  <div className="h-3 w-20 rounded-full bg-surface-2" />
                  <div className="mt-1.5 h-2.5 w-28 rounded-full bg-surface-2/70" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <a
            href="#contact"
            className="inline-flex items-center gap-2 h-11 px-6 rounded-full border border-border bg-surface-1 text-sm font-medium text-foreground hover:border-primary/40 hover:bg-surface-2 transition-colors"
          >
            {t("earlyCustomerCta")}
            <ArrowRight size={16} className="rtl:rotate-180" />
          </a>
        </div>
      </div>
    </section>
  );
}
