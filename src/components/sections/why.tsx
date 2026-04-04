"use client";

import { useEffect, useRef, useCallback } from "react";
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
  const sectionRef = useRef<HTMLElement>(null);

  // Intersection Observer for scroll animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("opacity-100", "translate-y-0");
            entry.target.classList.remove("opacity-0", "translate-y-8");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );
    const els = sectionRef.current?.querySelectorAll("[data-animate]");
    els?.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Mouse-tracking glow effect on cards
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty("--glow-x", x + "%");
    card.style.setProperty("--glow-y", y + "%");
  }, []);

  return (
    <section id="why" className="relative py-24 sm:py-32" ref={sectionRef}>
      <div className="shadda-pattern" />
      <div className="relative z-[1] max-w-[1280px] mx-auto px-6">
        <div className="text-center mb-16 opacity-0 translate-y-8 transition-all duration-700" data-animate>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-surface-1 text-xs text-muted-foreground mb-6">
            Why Mugdm
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tighter mb-4">
            Built <span className="text-gradient">different</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            We&apos;re not another agency. We&apos;re a new kind of software studio — lean, fast, and AI-native.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-[960px] mx-auto">
          {differentiators.map((item, i) => (
            <div
              key={item.title}
              data-animate
              onMouseMove={handleMouseMove}
              className="group relative p-8 rounded-2xl border border-border bg-card overflow-hidden transition-all duration-400 ease-[cubic-bezier(0.25,0.8,0.25,1)] hover:border-primary/30 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[0_12px_40px_rgba(91,91,255,0.1)] opacity-0 translate-y-8"
              style={{ transitionDelay: `${(i + 1) * 100}ms` }}
            >
              {/* Animated gradient border glow */}
              <div
                className="absolute inset-[-1px] rounded-[17px] p-px opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
                style={{
                  background: "linear-gradient(135deg, transparent 30%, rgba(91,91,255,0.5) 50%, transparent 70%)",
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
                  background: "radial-gradient(ellipse at var(--glow-x, 50%) var(--glow-y, 50%), rgba(91,91,255,0.06) 0%, transparent 60%)",
                }}
              />

              <div className="relative flex items-start gap-5">
                <div className="shrink-0 w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center transition-all duration-400 group-hover:bg-primary/25 group-hover:scale-110 group-hover:rotate-[5deg] group-hover:shadow-[0_0_20px_rgba(91,91,255,0.2)]">
                  <item.icon size={26} className="text-primary transition-transform duration-300 group-hover:scale-110" />
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5 mb-1">
                    <span className="text-[28px] font-extrabold text-gradient transition-transform duration-300 group-hover:scale-105" style={{ backgroundSize: "200% 200%" }}>
                      {item.stat}
                    </span>
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider">{item.statLabel}</span>
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
