"use client";

import { useTranslations } from "next-intl";

const FAQS = [0, 1, 2, 3, 4] as const;

export function PricingFaq() {
  const t = useTranslations("landing.pricingFaq");

  return (
    <section
      className="relative py-24"
      style={{ paddingInlineStart: "24px", paddingInlineEnd: "24px" }}
    >
      <div className="max-w-[760px] mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tighter text-center mb-12">
          {t("title")}
        </h2>
        <div className="flex flex-col gap-3">
          {FAQS.map((i) => (
            <details
              key={i}
              className="group rounded-2xl border border-border bg-surface-1 transition-colors hover:border-primary/30 open:border-primary/40"
            >
              <summary
                className="flex items-center justify-between cursor-pointer list-none py-5 font-medium text-foreground text-[15px]"
                style={{ paddingInlineStart: "24px", paddingInlineEnd: "24px" }}
              >
                <span>{t(`items.${i}.q`)}</span>
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
                {t(`items.${i}.a`)}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
