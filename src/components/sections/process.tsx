"use client";

import { UserPlus, Upload, CalendarCheck, Shield } from "lucide-react";
import { Reveal, StaggerContainer, StaggerItem, ScrollProgressLine } from "@/lib/animations";

const steps = [
  {
    icon: UserPlus,
    step: "01",
    title: "Sign Up",
    description: "Create your account with just an email. Magic link login — no passwords to remember.",
  },
  {
    icon: Upload,
    step: "02",
    title: "Upload Your CR",
    description: "Upload your Commercial Registration. Our AI reads it and sets up your business profile automatically.",
  },
  {
    icon: CalendarCheck,
    step: "03",
    title: "Auto-Generate Obligations",
    description: "Mugdm creates your compliance calendar — GOSI, ZATCA, Chamber renewal — all with the right deadlines.",
  },
  {
    icon: Shield,
    step: "04",
    title: "Stay Compliant",
    description: "Get reminders before deadlines. Upload statements for bookkeeping. Focus on your business, not paperwork.",
  },
];

export function Process() {
  return (
    <section id="how-it-works" className="relative py-24 sm:py-32 bg-surface-1/50">
      <div className="max-w-[1280px] mx-auto px-6">
        <Reveal className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-surface-1 text-xs text-muted-foreground mb-6">
            How It Works
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tighter mb-4">
            Up and running in <span className="text-gradient">minutes</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            From signup to full compliance dashboard in under 5 minutes.
          </p>
        </Reveal>

        <StaggerContainer stagger={0.15} className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Scroll-driven connecting line — absolutely positioned so it doesn't take a grid cell */}
          <div className="hidden lg:block absolute inset-0 pointer-events-none z-0">
            <ScrollProgressLine className="h-full" />
          </div>

          {steps.map((step) => (
            <StaggerItem key={step.step} className="relative text-center">
              <div className="relative w-20 h-20 rounded-2xl bg-surface-2 border border-border flex items-center justify-center mx-auto mb-5 transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_20px_rgba(30,64,175,0.1)]">
                <step.icon size={28} className="text-primary" />
                <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-[0_4px_10px_rgba(30,64,175,0.3)]">
                  {step.step}
                </span>
              </div>
              <h3 className="text-lg font-semibold mb-2 tracking-tight">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                {step.description}
              </p>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
