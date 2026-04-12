"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { AnimatedText, AuroraBackground, Magnetic, ParticleNetwork, ReactiveShadda, ShootingStar } from "@/lib/animations";

export function Hero() {
  const t = useTranslations("landing.hero");
  const sectionRef = useRef<HTMLElement>(null);

  // 3D Parallax mouse tracking
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    function handleMouseMove(e: MouseEvent) {
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const cx = (e.clientX - rect.left) / rect.width - 0.5;
      const cy = (e.clientY - rect.top) / rect.height - 0.5;
      section.querySelectorAll<HTMLElement>("[data-speed]").forEach((layer) => {
        const speed = parseFloat(layer.dataset.speed || "0.02");
        const x = cx * speed * 1000;
        const y = cy * speed * 1000;
        if (layer.dataset.parallaxType === "shadda") {
          layer.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(1) rotate(0deg)`;
        } else {
          layer.style.transform = `translate(${x}px, ${y}px)`;
        }
      });
    }

    function handleMouseLeave() {
      if (!section) return;
      section.querySelectorAll<HTMLElement>("[data-speed]").forEach((layer) => {
        if (layer.dataset.parallaxType === "shadda") {
          layer.style.transform = "translate(-50%,-50%) scale(1) rotate(0deg)";
        } else {
          layer.style.transform = "translate(0, 0)";
        }
      });
    }

    section.addEventListener("mousemove", handleMouseMove);
    section.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      section.removeEventListener("mousemove", handleMouseMove);
      section.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="hero-section"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ padding: "120px 24px 80px" }}
    >
      {/* Particle canvas */}
      <ParticleNetwork className="z-[1]" />

      {/* Shooting star effect */}
      <ShootingStar interval={6000} className="z-[1]" />

      {/* Aurora gradient background */}
      <AuroraBackground className="z-0" />

      {/* Background orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Grid pattern */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(30,64,175,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(30,64,175,0.03) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            maskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)",
          }}
        />
        <div
          data-speed="0.03"
          className="absolute top-[15%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[80px] transition-transform duration-150 ease-out"
          style={{
            background: "radial-gradient(circle, rgba(30,64,175,0.12) 0%, transparent 70%)",
            animation: "orb-float-1 12s ease-in-out infinite",
          }}
        />
        <div
          data-speed="0.05"
          className="absolute bottom-[10%] ltr:left-[20%] rtl:right-[20%] w-[400px] h-[400px] rounded-full blur-[60px] transition-transform duration-150 ease-out"
          style={{
            background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)",
            animation: "orb-float-2 15s ease-in-out infinite",
          }}
        />
        <div
          data-speed="0.02"
          className="absolute top-[30%] ltr:right-[10%] rtl:left-[10%] w-[300px] h-[300px] rounded-full blur-[50px] transition-transform duration-150 ease-out"
          style={{
            background: "radial-gradient(circle, rgba(30,64,175,0.06) 0%, transparent 70%)",
            animation: "orb-float-1 18s ease-in-out infinite reverse",
          }}
        />
      </div>

      {/* شدة background mark — reactive to mouse */}
      <ReactiveShadda />

      {/* Hero content */}
      <div
        data-speed="0.008"
        className="relative z-[2] text-center max-w-[900px] mx-auto transition-transform duration-150 ease-out"
      >
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-surface-1 text-xs text-muted-foreground mb-8"
          style={{ animation: "fade-down 0.6s ease-out forwards" }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-primary"
            style={{ animation: "pulse 2s infinite" }}
          />
          {t("badge")}
        </div>

        {/* Headline */}
        <h1 className="text-[clamp(40px,6vw,76px)] font-extrabold tracking-[-0.04em] leading-[1.08] mb-6">
          <AnimatedText text={t("headline1")} delay={0.2} as="span" className="block" />
          <span
            className="text-gradient block"
            style={{
              backgroundSize: "200% 200%",
              animation: "gradient-shift 4s ease infinite",
            }}
          >
            <AnimatedText text={t("headline2")} delay={0.6} as="span" />
          </span>
        </h1>

        {/* Subtitle */}
        <p
          className="text-[clamp(16px,2vw,20px)] text-muted-foreground max-w-[640px] mx-auto mb-10 leading-relaxed opacity-0"
          style={{ animation: "fade-up 0.8s ease-out 0.3s forwards" }}
        >
          {t("description")}
        </p>

        {/* CTAs */}
        <div
          className="flex items-center justify-center gap-4 flex-wrap opacity-0"
          style={{ animation: "fade-up 0.8s ease-out 0.45s forwards" }}
        >
          <Magnetic strength={0.15}>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2.5 h-14 px-10 rounded-xl bg-primary text-white text-lg font-medium transition-all duration-250 shadow-[0_8px_30px_rgba(30,64,175,0.3)] hover:shadow-[0_12px_40px_rgba(30,64,175,0.5)] hover:-translate-y-0.5 active:scale-[0.98]"
              style={{ animation: "glow 3s ease-in-out infinite" }}
            >
              {t("cta")}
              <ArrowRight size={20} />
            </Link>
          </Magnetic>
          <Magnetic strength={0.15}>
            <a
              href="#features"
              className="inline-flex items-center gap-2.5 h-14 px-10 rounded-xl border border-border bg-transparent text-foreground text-lg font-medium transition-all duration-250 hover:bg-surface-2 hover:border-primary/40"
            >
              <Play size={20} />
              {t("secondaryCta")}
            </a>
          </Magnetic>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-[3] opacity-0"
        style={{ animation: "fade-in 1s ease 1.5s forwards" }}
      >
        <div className="w-6 h-[38px] border-2 border-border rounded-xl relative">
          <div
            className="w-[3px] h-2 bg-primary rounded-sm absolute top-1.5 left-1/2 -translate-x-1/2"
            style={{ animation: "scroll-dot 2s ease infinite" }}
          />
        </div>
        <span className="text-xs text-muted-foreground tracking-widest uppercase">
          {t("scroll")}
        </span>
      </div>
    </section>
  );
}
