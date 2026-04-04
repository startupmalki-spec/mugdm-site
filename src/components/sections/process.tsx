"use client";

import { MessageSquare, Palette, Code2, Rocket } from "lucide-react";
import { Reveal, StaggerContainer, StaggerItem, ScrollProgressLine } from "@/lib/animations";

const steps = [
  {
    icon: MessageSquare,
    step: "01",
    title: "Share Your Idea",
    description: "Tell us what you need. We listen, ask the right questions, and define the scope together.",
  },
  {
    icon: Palette,
    step: "02",
    title: "We Design",
    description: "Clean, modern UI/UX tailored to your brand. You review, we refine until it's perfect.",
  },
  {
    icon: Code2,
    step: "03",
    title: "We Build",
    description: "AI-accelerated development with human oversight. Production-ready code, built to scale.",
  },
  {
    icon: Rocket,
    step: "04",
    title: "You Launch",
    description: "Deployed, tested, and live. We hand over everything and support you post-launch.",
  },
];

export function Process() {
  return (
    <section id="process" className="relative py-24 sm:py-32 bg-surface-1/50">
      <div className="max-w-[1280px] mx-auto px-6">
        <Reveal className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-surface-1 text-xs text-muted-foreground mb-6">
            Process
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tighter mb-4">
            How it <span className="text-gradient">works</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            A simple, transparent process from first conversation to launch day.
          </p>
        </Reveal>

        <StaggerContainer stagger={0.15} className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Scroll-driven connecting line — absolutely positioned so it doesn't take a grid cell */}
          <div className="hidden lg:block absolute inset-0 pointer-events-none z-0">
            <ScrollProgressLine className="h-full" />
          </div>

          {steps.map((step) => (
            <StaggerItem key={step.step} className="relative text-center">
              <div className="relative w-20 h-20 rounded-2xl bg-surface-2 border border-border flex items-center justify-center mx-auto mb-5 transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_20px_rgba(91,91,255,0.1)]">
                <step.icon size={28} className="text-primary" />
                <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-[0_4px_10px_rgba(91,91,255,0.3)]">
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
