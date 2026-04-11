"use client";

import { ExternalLink } from "lucide-react";

export function About() {
  return (
    <section id="about" className="relative py-24 sm:py-32 bg-surface-1/50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block text-xs font-medium text-primary uppercase tracking-widest mb-4">
            About
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tighter mb-6">
            What is <span className="text-gradient">Mugdm</span>?
          </h2>

          {/* Avatar placeholder */}
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center mx-auto mb-8 text-3xl font-bold text-white shadow-xl shadow-primary/20">
            م
          </div>

          <p className="text-lg text-muted-foreground leading-relaxed mb-4">
            <span className="text-gradient font-medium">مقدم</span> (Mugdm) means &ldquo;the one who provides and delivers&rdquo; in Arabic.
          </p>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            Mugdm is a compliance platform built specifically for Saudi micro-enterprises — the 700,000+ small businesses that struggle with compliance paperwork, government portals, and financial record-keeping every day.
          </p>
          <p className="text-base text-muted-foreground leading-relaxed mb-8">
            Founded by <span className="text-foreground font-medium">Mohammed Malki</span>, Mugdm brings together AI-powered document analysis, bilingual support, and deep knowledge of Saudi regulations into one simple dashboard.
          </p>

          <a
            href="https://mohammedmalki.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            Meet the founder
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </section>
  );
}
