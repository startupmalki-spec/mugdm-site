"use client";

import { Globe, Smartphone, Rocket, Layout } from "lucide-react";
import { Reveal, StaggerContainer, StaggerItem, TiltCard } from "@/lib/animations";

const services = [
  {
    icon: Globe,
    title: "Websites & Landing Pages",
    description: "High-converting websites built to impress. Modern design, blazing-fast performance, and SEO-ready from day one.",
  },
  {
    icon: Layout,
    title: "Web Applications",
    description: "Custom SaaS platforms, dashboards, portals, and tools. Full-stack solutions that scale with your business.",
  },
  {
    icon: Smartphone,
    title: "Mobile Apps",
    description: "Cross-platform mobile applications for iOS and Android. Native-feel experiences built with modern frameworks.",
  },
  {
    icon: Rocket,
    title: "MVP Development",
    description: "Validate your idea fast. We build minimum viable products in days so you can test, learn, and iterate.",
  },
];

export function Services() {
  return (
    <section id="services" className="relative py-24 sm:py-32">
      <div className="shadda-pattern" />
      <div className="relative z-[1] max-w-[1280px] mx-auto px-6">
        {/* Header */}
        <Reveal className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-surface-1 text-xs text-muted-foreground mb-6">
            Services
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tighter mb-4">
            What we <span className="text-gradient">build</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Everything your business needs to go digital — built with AI speed and human quality.
          </p>
        </Reveal>

        {/* Grid */}
        <StaggerContainer stagger={0.12} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service) => (
            <StaggerItem key={service.title}>
              <TiltCard
                tiltAmount={6}
                className="group relative p-6 sm:p-8 rounded-xl border border-border bg-card hover:border-primary/30 transition-all duration-400 hover:shadow-xl hover:shadow-primary/5 h-full"
              >
                {/* Inner mouse-tracking glow */}
                <div
                  className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
                  style={{
                    background: "radial-gradient(ellipse at var(--glow-x, 50%) var(--glow-y, 50%), rgba(91,91,255,0.08) 0%, transparent 60%)",
                  }}
                />
                <div className="relative">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-all duration-300 group-hover:scale-110">
                    <service.icon size={24} className="text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 tracking-tight">{service.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{service.description}</p>
                </div>
              </TiltCard>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
