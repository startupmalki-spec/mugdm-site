"use client";

import { ArrowRight, MessageCircle } from "lucide-react";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/8 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 pt-32 pb-20 text-center">
        <div className="stagger">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-surface-1 text-xs text-muted-foreground mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            AI-Powered Software Studio
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
            We build your software.
            <br />
            <span className="text-gradient">Incredibly fast.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            From idea to live product in days, not months. We combine AI-powered development
            with human expertise to ship websites, apps, and MVPs for businesses that move fast.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#contact"
              className="inline-flex items-center justify-center h-14 px-10 rounded-lg bg-primary text-primary-foreground text-lg font-medium hover:bg-primary/90 transition-all duration-200 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:shadow-xl active:scale-[0.98] gap-2"
            >
              Start a Project
              <ArrowRight size={20} />
            </a>
            <a
              href="https://wa.me/966500000000"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-14 px-10 rounded-lg border border-border bg-transparent text-foreground text-lg font-medium hover:bg-surface-2 hover:border-primary/50 transition-all duration-200 gap-2"
            >
              <MessageCircle size={20} />
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
