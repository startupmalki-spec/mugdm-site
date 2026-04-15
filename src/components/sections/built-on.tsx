"use client";

import { useTranslations } from "next-intl";

const INTEGRATIONS = ["Wathq", "ZATCA", "Mudad", "GOSI", "MOHR"];

export function BuiltOn() {
  const t = useTranslations("landing.builtOn");

  return (
    <section
      aria-labelledby="built-on-heading"
      className="relative py-12"
      style={{ paddingInlineStart: "24px", paddingInlineEnd: "24px" }}
    >
      <div className="max-w-[960px] mx-auto flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10">
        <span
          id="built-on-heading"
          className="text-xs uppercase tracking-[0.18em] text-muted-foreground shrink-0"
        >
          {t("label")}
        </span>
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {INTEGRATIONS.map((name) => (
            <li
              key={name}
              className="text-sm sm:text-base font-medium text-muted-foreground/70 grayscale opacity-60 transition-all duration-300 hover:opacity-100 hover:text-foreground hover:grayscale-0"
            >
              {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
