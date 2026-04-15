"use client";

import { useTranslations } from "next-intl";

const STATS = ["portals", "hours", "ledger"] as const;

export function Stats() {
  const t = useTranslations("landing.stats");

  return (
    <section
      aria-labelledby="stats-heading"
      className="relative py-24 sm:py-32"
      style={{ paddingInlineStart: "24px", paddingInlineEnd: "24px" }}
    >
      <div className="max-w-[1200px] mx-auto">
        <h2 id="stats-heading" className="sr-only">
          {t("srHeading")}
        </h2>
        <p className="text-center text-xs sm:text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground mb-14 sm:mb-20">
          {t("eyebrow")}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-14 sm:gap-10 text-center">
          {STATS.map((key) => (
            <div key={key} className="flex flex-col items-center px-2">
              <span
                className="text-gradient text-[clamp(56px,8vw,88px)] font-extrabold leading-[1] tracking-[-0.035em]"
                style={{ backgroundSize: "200% 200%" }}
              >
                {t(`${key}.value`)}
              </span>
              <span className="mt-5 text-base sm:text-lg font-medium max-w-[280px]">
                {t(`${key}.label`)}
              </span>
              <span className="mt-2 text-xs sm:text-sm text-muted-foreground max-w-[300px] leading-relaxed">
                {t(`${key}.subtext`)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
