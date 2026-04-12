"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Reveal, StaggerContainer, StaggerItem, TiltCard, FloatingElements, FloatingShaddas } from "@/lib/animations";

const tiers = [
  {
    name: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: "Get started with the essentials. No credit card required.",
    features: [
      "1 business",
      "50 AI calls / day",
      "Document Vault (10 docs)",
      "Compliance Calendar",
      "Basic Bookkeeper",
    ],
    cta: "Start Free",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Pro",
    monthlyPrice: 99,
    yearlyPrice: 990,
    description: "Everything you need to run your business like a pro.",
    features: [
      "3 businesses",
      "Unlimited AI calls",
      "Unlimited documents",
      "Full Compliance Calendar with reminders",
      "AI Bookkeeper with VAT reports",
      "Team Management",
      "Email notifications",
      "Priority support",
    ],
    cta: "Start Pro Trial",
    ctaSubtext: "14-day free trial",
    href: "/signup?plan=pro",
    highlighted: true,
    badge: "Most Popular",
  },
  {
    name: "Business",
    monthlyPrice: 299,
    yearlyPrice: 2990,
    description: "For teams that need full power and dedicated support.",
    features: [
      "Unlimited businesses",
      "Everything in Pro",
      "WhatsApp notifications",
      "API access",
      "Dedicated support",
      "Custom integrations",
    ],
    cta: "Contact Sales",
    href: "#contact",
    highlighted: false,
  },
];

export function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="relative py-24 sm:py-32">
      <FloatingElements />
      <FloatingShaddas count={4} />
      <div className="shadda-pattern" />
      <div className="relative z-[1] max-w-[1280px] mx-auto px-6">
        {/* Header */}
        <Reveal className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-surface-1 text-xs text-muted-foreground mb-6">
            Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tighter mb-4">
            Simple pricing. <span className="text-gradient">No surprises.</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
            Start free and scale as you grow. Every plan includes AI-powered compliance, bookkeeping, and document management built for Saudi businesses.
          </p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-3 bg-surface-1 border border-border rounded-full p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                !annual
                  ? "bg-primary text-primary-foreground shadow-[0_2px_10px_rgba(30,64,175,0.3)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                annual
                  ? "bg-primary text-primary-foreground shadow-[0_2px_10px_rgba(30,64,175,0.3)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Annual
              <span className="ml-1.5 text-xs opacity-80">2 months free</span>
            </button>
          </div>
        </Reveal>

        {/* Tiers */}
        <StaggerContainer stagger={0.12} className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-[1080px] mx-auto items-stretch">
          {tiers.map((tier) => (
            <StaggerItem key={tier.name} className="flex">
              <TiltCard
                tiltAmount={4}
                className={`group relative flex flex-col w-full p-8 rounded-2xl border transition-all duration-400 ${
                  tier.highlighted
                    ? "border-primary bg-card shadow-[0_8px_40px_rgba(30,64,175,0.15)] scale-[1.02] md:scale-105 z-10"
                    : "border-border bg-card hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5"
                }`}
              >
                {/* Badge */}
                {tier.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-[0_4px_15px_rgba(30,64,175,0.3)]">
                      {tier.badge}
                    </span>
                  </div>
                )}

                {/* Inner mouse-tracking glow */}
                <div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(ellipse at var(--glow-x, 50%) var(--glow-y, 50%), rgba(30,64,175,0.08) 0%, transparent 60%)",
                  }}
                />

                <div className="relative flex flex-col h-full">
                  {/* Tier name */}
                  <h3 className="text-lg font-semibold tracking-tight mb-1">{tier.name}</h3>
                  <p className="text-sm text-muted-foreground mb-5">{tier.description}</p>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold tracking-tight">
                        {tier.monthlyPrice === 0
                          ? "Free"
                          : `SAR ${annual ? tier.yearlyPrice.toLocaleString() : tier.monthlyPrice}`}
                      </span>
                      {tier.monthlyPrice > 0 && (
                        <span className="text-sm text-muted-foreground">
                          /{annual ? "year" : "mo"}
                        </span>
                      )}
                    </div>
                    {annual && tier.monthlyPrice > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        SAR {Math.round(tier.yearlyPrice / 12)}/mo billed annually
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8 flex-1">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm">
                        <Check
                          size={16}
                          className={`mt-0.5 shrink-0 ${
                            tier.highlighted ? "text-primary" : "text-muted-foreground"
                          }`}
                        />
                        <span className="text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <div>
                    <a
                      href={tier.href}
                      className={`inline-flex items-center justify-center w-full h-11 rounded-lg text-sm font-medium transition-all duration-200 ${
                        tier.highlighted
                          ? "bg-primary text-primary-foreground shadow-[0_4px_15px_rgba(30,64,175,0.25)] hover:bg-[#1E3A8A] hover:shadow-[0_6px_25px_rgba(30,64,175,0.4)] hover:-translate-y-px active:scale-[0.98]"
                          : "border border-border bg-surface-1 text-foreground hover:border-primary/30 hover:bg-primary/5 hover:-translate-y-px active:scale-[0.98]"
                      }`}
                    >
                      {tier.cta}
                    </a>
                    {tier.ctaSubtext && (
                      <p className="text-xs text-muted-foreground text-center mt-2">
                        {tier.ctaSubtext}
                      </p>
                    )}
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
