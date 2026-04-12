"use client";

import { UserPlus, Upload, CalendarCheck, Shield } from "lucide-react";
import { useTranslations } from "next-intl";
import { Reveal, StaggerContainer, StaggerItem, ScrollProgressLine, ParticleNetwork } from "@/lib/animations";

const STEP_KEYS = ["step1", "step2", "step3", "step4"] as const;
const STEP_ICONS = [UserPlus, Upload, CalendarCheck, Shield] as const;

export function Process() {
  const t = useTranslations("landing.howItWorks");
  return (
    <section id="how-it-works" className="relative py-24 sm:py-32 bg-surface-1/50">
      <ParticleNetwork className="z-[0]" density={25000} opacity={0.15} lineOpacity={0.05} speed={0.2} />
      <div className="max-w-[1280px] mx-auto px-6">
        <Reveal className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-surface-1 text-xs text-muted-foreground mb-6">
            {t("badge")}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tighter mb-4">
            {t("title")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </Reveal>

        <StaggerContainer stagger={0.15} className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Scroll-driven connecting line — absolutely positioned so it doesn't take a grid cell */}
          <div className="hidden lg:block absolute inset-0 pointer-events-none z-0">
            <ScrollProgressLine className="h-full" />
          </div>

          {STEP_KEYS.map((key, index) => {
            const Icon = STEP_ICONS[index];
            return (
              <StaggerItem key={key} className="relative text-center">
                <div className="relative w-20 h-20 rounded-2xl bg-surface-2 border border-border flex items-center justify-center mx-auto mb-5 transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_20px_rgba(30,64,175,0.1)]">
                  <Icon size={28} className="text-primary" />
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-[0_4px_10px_rgba(30,64,175,0.3)]">
                    {t(`${key}.number`)}
                  </span>
                </div>
                <h3 className="text-lg font-semibold mb-2 tracking-tight">{t(`${key}.title`)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  {t(`${key}.description`)}
                </p>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </div>
    </section>
  );
}
