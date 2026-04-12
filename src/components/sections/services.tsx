"use client";

import { FileText, CalendarCheck, Receipt, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Reveal, StaggerContainer, StaggerItem, TiltCard, FloatingElements, FloatingShaddas, ParticleNetwork } from "@/lib/animations";

const FEATURE_KEYS = ["vault", "calendar", "bookkeeper", "team"] as const;
const FEATURE_ICONS = { vault: FileText, calendar: CalendarCheck, bookkeeper: Receipt, team: Users } as const;

export function Services() {
  const t = useTranslations("landing.features");
  return (
    <section id="features" className="relative py-24 sm:py-32">
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
            {t("title")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </Reveal>

        {/* Grid */}
        <StaggerContainer stagger={0.12} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURE_KEYS.map((key) => {
            const Icon = FEATURE_ICONS[key];
            return (
              <StaggerItem key={key}>
                <TiltCard
                  tiltAmount={6}
                  className="group relative p-6 sm:p-8 rounded-xl border border-border bg-card hover:border-primary/30 transition-all duration-400 hover:shadow-xl hover:shadow-primary/5 h-full"
                >
                  {/* Inner mouse-tracking glow */}
                  <div
                    className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
                    style={{
                      background: "radial-gradient(ellipse at var(--glow-x, 50%) var(--glow-y, 50%), rgba(30,64,175,0.08) 0%, transparent 60%)",
                    }}
                  />
                  <div className="relative">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-all duration-300 group-hover:scale-110">
                      <Icon size={24} className="text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2 tracking-tight">{t(`${key}.title`)}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t(`${key}.description`)}</p>
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
