"use client";

import { Star } from "lucide-react";
import {
  Reveal,
  StaggerContainer,
  StaggerItem,
  TiltCard,
  Counter,
  FloatingElements,
  FloatingShaddas,
  ParticleNetwork,
} from "@/lib/animations";

const testimonials = [
  {
    name: "Ahmed S.",
    role: "Restaurant Owner",
    initials: "AS",
    color: "bg-blue-600",
    quote:
      "Mugdm replaced my Excel spreadsheets and my accountant's monthly visits. I save 10+ hours a week.",
  },
  {
    name: "Sarah M.",
    role: "Trading Company",
    initials: "SM",
    color: "bg-violet-600",
    quote:
      "The AI bookkeeper caught a duplicate GOSI payment I would have missed. Paid for itself in the first month.",
  },
  {
    name: "Khalid R.",
    role: "Construction",
    initials: "KR",
    color: "bg-emerald-600",
    quote:
      "Finally, one place for all my compliance documents. No more WhatsApp reminders to myself.",
  },
];

const stats = [
  { label: "Businesses", target: 500, suffix: "+", prefix: "" },
  { label: "Documents Processed", target: 10000, suffix: "+", prefix: "" },
  { label: "In Deadlines Tracked", target: 2, suffix: "M+", prefix: "SAR " },
];

function Stars() {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={14}
          className="fill-yellow-400 text-yellow-400"
        />
      ))}
    </div>
  );
}

export function Testimonials() {
  return (
    <section id="testimonials" className="relative py-24 sm:py-32">
      <ParticleNetwork className="z-[0]" density={30000} opacity={0.1} lineOpacity={0.04} speed={0.15} />
      <FloatingElements />
      <FloatingShaddas count={3} />
      <div className="shadda-pattern" />
      <div className="relative z-[1] max-w-[1280px] mx-auto px-6">
        {/* Header */}
        <Reveal className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-surface-1 text-xs text-muted-foreground mb-6">
            Social Proof
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tighter mb-4">
            Trusted by <span className="text-gradient">real businesses</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            See what Saudi entrepreneurs are saying about Mugdm.
          </p>
        </Reveal>

        {/* Testimonial Cards */}
        <StaggerContainer
          stagger={0.12}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-[1080px] mx-auto mb-20"
        >
          {testimonials.map((t) => (
            <StaggerItem key={t.name} className="flex">
              <TiltCard
                tiltAmount={4}
                className="group relative flex flex-col w-full p-8 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-400"
              >
                {/* Inner glow */}
                <div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(ellipse at var(--glow-x, 50%) var(--glow-y, 50%), rgba(30,64,175,0.08) 0%, transparent 60%)",
                  }}
                />

                <div className="relative flex flex-col h-full">
                  {/* Stars */}
                  <Stars />

                  {/* Quote */}
                  <p className="text-sm text-foreground leading-relaxed mt-4 mb-6 flex-1">
                    &ldquo;{t.quote}&rdquo;
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full ${t.color} flex items-center justify-center text-white text-xs font-bold shrink-0`}
                    >
                      {t.initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {t.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </div>
              </TiltCard>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Counter Stats Bar */}
        <Reveal>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16 py-8 px-6 rounded-2xl border border-border bg-surface-1/50">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                  <Counter
                    target={stat.target}
                    suffix={stat.suffix}
                    prefix={stat.prefix}
                    duration={2.5}
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
