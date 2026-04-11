"use client";

import { Zap, Shield, Users, Brain } from "lucide-react";

const differentiators = [
  {
    icon: Zap,
    title: "3-5x Faster Delivery",
    description: "AI-powered workflows mean we ship in days what traditional agencies take weeks to build.",
    stat: "3-5x",
    statLabel: "Faster",
  },
  {
    icon: Shield,
    title: "Production-Ready Code",
    description: "AI speed with human quality control. Every line is reviewed, tested, and built to scale.",
    stat: "100%",
    statLabel: "Reviewed",
  },
  {
    icon: Users,
    title: "Direct Access",
    description: "No project managers or layers. You work directly with the builder — faster decisions, better results.",
    stat: "1:1",
    statLabel: "Direct",
  },
  {
    icon: Brain,
    title: "SMB-Focused",
    description: "Built for small and medium businesses. Enterprise-quality solutions without enterprise complexity or pricing.",
    stat: "SMB",
    statLabel: "First",
  },
];

export function Why() {
  return (
    <section id="why" className="relative py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="inline-block text-xs font-medium text-primary uppercase tracking-widest mb-4">
            Why Mugdm
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tighter mb-4">
            Built <span className="text-gradient">different</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            We&apos;re not another agency. We&apos;re a new kind of software studio — lean, fast, and AI-native.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {differentiators.map((item) => (
            <div
              key={item.title}
              className="group relative p-8 rounded-xl border border-border bg-card hover:border-primary/30 transition-all duration-300"
            >
              <div className="flex items-start gap-5">
                <div className="shrink-0 w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <item.icon size={26} className="text-primary" />
                </div>
                <div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-2xl font-bold text-gradient">{item.stat}</span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">{item.statLabel}</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-1.5 tracking-tight">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
