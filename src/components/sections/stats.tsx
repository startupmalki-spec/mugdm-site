"use client";

import { useTranslations } from "next-intl";

const STATS = ["portals", "hours", "setup"] as const;

export function Stats() {
  const t = useTranslations("landing.stats");

  return (
    <section
      aria-labelledby="stats-heading"
      className="relative py-20 sm:py-24"
      style={{ paddingInlineStart: "24px", paddingInlineEnd: "24px" }}
    >
      <div className="max-w-[1080px] mx-auto">
        <h2 id="stats-heading" className="sr-only">
          {t("srHeading")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-4 text-center">
          {STATS.map((key) => (
            <div key={key} className="flex flex-col items-center">
              <span
                className="text-gradient text-[clamp(48px,7vw,72px)] font-extrabold leading-[1] tracking-[-0.03em]"
                style={{ backgroundSize: "200% 200%" }}
              >
                {t(`${key}.value`)}
              </span>
              <span className="mt-3 text-sm sm:text-base text-muted-foreground max-w-[220px]">
                {t(`${key}.label`)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
