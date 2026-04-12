"use client";

import { Brain, Shield, Globe, Zap } from "lucide-react";
import { Reveal, StaggerContainer, StaggerItem, TiltCard, Counter, FloatingElements, FloatingShaddas } from "@/lib/animations";

const differentiators = [
  {
    icon: Zap,
    title: "Affordable, Not Cheap",
    description: "A fraction of the cost of hiring a COO or accountant. Mugdm gives you enterprise-grade operations at a price that makes sense for small businesses.",
    counterTarget: 90,
    counterPrefix: "",
    counterSuffix: "%",
    statLabel: "Cheaper",
  },
  {
    icon: Brain,
    title: "AI That Actually Works",
    description: "Not a chatbot. Mugdm's AI reads your documents, categorizes transactions, and flags what needs attention — no manual data entry, no prompts to write.",
    counterTarget: 100,
    counterPrefix: "",
    counterSuffix: "%",
    statLabel: "Automated",
  },
  {
    icon: Shield,
    title: "Knows Saudi Regulations",
    description: "GOSI, ZATCA, Balady, Chamber of Commerce, CR renewals — built with deep knowledge of every Saudi compliance requirement. No generic templates.",
    stat: "\uD83C\uDDF8\uD83C\uDDE6",
    statLabel: "Saudi",
  },
  {
    icon: Globe,
    title: "Replaces 5+ Tools",
    description: "Document storage, compliance tracking, bookkeeping, team management, reminders — all in one bilingual dashboard with Arabic, English, Hijri, and Gregorian dates.",
    counterTarget: 5,
    counterPrefix: "",
    counterSuffix: "+",
    statLabel: "Tools",
  },
];

export function Why() {
  return (
    <section id="why" className="relative py-24 sm:py-32">
      <FloatingElements />
      <FloatingShaddas count={3} />
      <div className="shadda-pattern" />
      <div className="relative z-[1] max-w-[1280px] mx-auto px-6">
        <Reveal className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-surface-1 text-xs text-muted-foreground mb-6">
            Why Mugdm
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tighter mb-4">
            Built by a Saudi founder, for <span className="text-gradient">Saudi businesses</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            The smartest investment you&apos;ll make for your business. Here&apos;s why.
          </p>
        </Reveal>

        <StaggerContainer stagger={0.12} className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-[960px] mx-auto">
          {differentiators.map((item) => (
            <StaggerItem key={item.title}>
              <TiltCard
                tiltAmount={5}
                className="group relative p-8 rounded-2xl border border-border bg-card overflow-hidden transition-all duration-400 ease-[cubic-bezier(0.25,0.8,0.25,1)] hover:border-primary/30 hover:shadow-[0_12px_40px_rgba(30,64,175,0.1)] h-full"
              >
                {/* Animated gradient border glow */}
                <div
                  className="absolute inset-[-1px] rounded-[17px] p-px opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
                  style={{
                    background: "linear-gradient(135deg, transparent 30%, rgba(30,64,175,0.5) 50%, transparent 70%)",
                    backgroundSize: "300% 300%",
                    WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                    WebkitMaskComposite: "xor",
                    maskComposite: "exclude",
                    animation: "border-glow-anim 3s ease infinite",
                  }}
                />
                {/* Inner mouse-tracking glow */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
                  style={{
                    background: "radial-gradient(ellipse at var(--glow-x, 50%) var(--glow-y, 50%), rgba(30,64,175,0.06) 0%, transparent 60%)",
                  }}
                />

                <div className="relative flex items-start gap-5">
                  <div className="shrink-0 w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center transition-all duration-400 group-hover:bg-primary/25 group-hover:scale-110 group-hover:rotate-[5deg] group-hover:shadow-[0_0_20px_rgba(30,64,175,0.2)]">
                    <item.icon size={26} className="text-primary transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1.5 mb-1">
                      <span className="text-[28px] font-extrabold text-gradient transition-transform duration-300 group-hover:scale-105" style={{ backgroundSize: "200% 200%" }}>
                        {item.counterTarget !== undefined ? (
                          <Counter
                            target={item.counterTarget}
                            prefix={item.counterPrefix}
                            suffix={item.counterSuffix}
                          />
                        ) : (
                          item.stat
                        )}
                      </span>
                      <span className="text-[11px] text-muted-foreground uppercase tracking-wider">{item.statLabel}</span>
                    </div>
                    <h3 className="text-lg font-semibold mb-1.5 tracking-tight">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                </div>
              </TiltCard>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
