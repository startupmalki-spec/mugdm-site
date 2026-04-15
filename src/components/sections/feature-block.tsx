"use client";

import { Check, ArrowRight, LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  namespace: string;
  icon: LucideIcon;
  reverse?: boolean;
  bulletCount?: number;
  href?: string;
};

export function FeatureBlock({ namespace, icon: Icon, reverse = false, bulletCount = 3, href }: Props) {
  const t = useTranslations(namespace);
  const bullets = Array.from({ length: bulletCount }, (_, i) => t(`bullets.${i}`));

  return (
    <section
      className="relative py-20 sm:py-28"
      style={{ paddingInlineStart: "24px", paddingInlineEnd: "24px" }}
    >
      <div
        className={`max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center ${
          reverse ? "lg:[&>*:first-child]:order-2" : ""
        }`}
      >
        <div>
          <div className="inline-flex items-center gap-2 h-9 px-3 rounded-full border border-border bg-surface-1 text-xs text-muted-foreground mb-5">
            <Icon size={14} className="text-primary" />
            {t("eyebrow")}
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-bold tracking-[-0.02em] leading-[1.1] mb-5">
            {t("title")}
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed mb-7 max-w-[520px]">
            {t("description")}
          </p>
          <ul className="flex flex-col gap-3 mb-8">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="shrink-0 w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center"
                  style={{ marginInlineEnd: "4px" }}
                >
                  <Check size={12} className="text-primary" strokeWidth={3} />
                </span>
                <span className="text-[15px] text-foreground/90 leading-snug">{b}</span>
              </li>
            ))}
          </ul>
          {href && (
            <a
              href={href}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-accent transition-colors group"
            >
              {t("cta")}
              <ArrowRight
                size={16}
                className="transition-transform duration-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 rtl:rotate-180"
              />
            </a>
          )}
        </div>

        {/* Screenshot placeholder — swap for <Image> once real assets land */}
        <div className="relative aspect-[16/10] rounded-2xl border border-border bg-gradient-to-br from-surface-1 to-surface-2 overflow-hidden shadow-[0_20px_60px_rgba(30,64,175,0.12)]">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "linear-gradient(rgba(30,64,175,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(30,64,175,0.08) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center px-6">
              <Icon size={40} className="text-primary/40" />
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
                {t("screenshotPlaceholder")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
