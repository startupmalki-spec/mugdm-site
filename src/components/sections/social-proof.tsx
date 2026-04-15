"use client";

import { useTranslations } from "next-intl";

const LOGOS = ["Wamda", "StartupScene", "Misk", "Monsha'at", "Wathq", "ZATCA"];

export function SocialProof() {
  const t = useTranslations("landing.socialProof");

  return (
    <section
      aria-labelledby="social-proof-heading"
      className="relative py-16"
      style={{ paddingInlineStart: "24px", paddingInlineEnd: "24px" }}
    >
      <div className="max-w-[1080px] mx-auto">
        <p
          id="social-proof-heading"
          className="text-center text-xs uppercase tracking-[0.18em] text-muted-foreground mb-8"
        >
          {t("caption")}
        </p>
        <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
          {LOGOS.map((name) => (
            <li
              key={name}
              className="text-base sm:text-lg font-medium text-muted-foreground/70 grayscale opacity-60 transition-all duration-300 hover:opacity-100 hover:text-foreground hover:grayscale-0"
              style={{ letterSpacing: "-0.01em" }}
            >
              {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
