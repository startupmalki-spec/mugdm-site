"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, Play } from "lucide-react";
import { AnimatedText, AuroraBackground, Magnetic, ReactiveShadda } from "@/lib/animations";

export function Hero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; r: number }[]>([]);
  const animRef = useRef<number>(0);

  // Particle system
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function initParticles() {
      cancelAnimationFrame(animRef.current);
      const section = sectionRef.current;
      if (!section || !canvas) return;
      canvas.width = section.offsetWidth;
      canvas.height = section.offsetHeight;
      particlesRef.current = [];
      const count = Math.floor((canvas.width * canvas.height) / 14000);
      for (let i = 0; i < count; i++) {
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          r: Math.random() * 1.8 + 0.8,
        });
      }
      drawParticles();
    }

    function drawParticles() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const particles = particlesRef.current;
      const maxDist = 130;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(91,91,255,0.4)";
        ctx.fill();
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(91,91,255,${0.12 * (1 - dist / maxDist)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animRef.current = requestAnimationFrame(drawParticles);
    }

    initParticles();
    window.addEventListener("resize", initParticles);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", initParticles);
    };
  }, []);

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
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-[1] pointer-events-none"
      />

      {/* Aurora gradient background */}
      <AuroraBackground className="z-0" />

      {/* Background orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Grid pattern */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(91,91,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(91,91,255,0.03) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            maskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)",
          }}
        />
        <div
          data-speed="0.03"
          className="absolute top-[15%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[80px] transition-transform duration-150 ease-out"
          style={{
            background: "radial-gradient(circle, rgba(91,91,255,0.12) 0%, transparent 70%)",
            animation: "orb-float-1 12s ease-in-out infinite",
          }}
        />
        <div
          data-speed="0.05"
          className="absolute bottom-[10%] left-[20%] w-[400px] h-[400px] rounded-full blur-[60px] transition-transform duration-150 ease-out"
          style={{
            background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)",
            animation: "orb-float-2 15s ease-in-out infinite",
          }}
        />
        <div
          data-speed="0.02"
          className="absolute top-[30%] right-[10%] w-[300px] h-[300px] rounded-full blur-[50px] transition-transform duration-150 ease-out"
          style={{
            background: "radial-gradient(circle, rgba(91,91,255,0.06) 0%, transparent 70%)",
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
          AI-Powered Compliance Platform
        </div>

        {/* Headline */}
        <h1 className="text-[clamp(40px,6vw,76px)] font-extrabold tracking-[-0.04em] leading-[1.08] mb-6">
          <AnimatedText text="Your business compliance." delay={0.2} as="span" className="block" />
          <span
            className="text-gradient block"
            style={{
              backgroundSize: "200% 200%",
              animation: "gradient-shift 4s ease infinite",
            }}
          >
            <AnimatedText text="On autopilot." delay={0.6} as="span" />
          </span>
        </h1>

        {/* Subtitle */}
        <p
          className="text-[clamp(16px,2vw,20px)] text-muted-foreground max-w-[640px] mx-auto mb-10 leading-relaxed opacity-0"
          style={{ animation: "fade-up 0.8s ease-out 0.3s forwards" }}
        >
          Mugdm manages your CR renewals, GOSI payments, VAT filings, document tracking, and
          bookkeeping — so you can focus on growing your business.
        </p>

        {/* CTAs */}
        <div
          className="flex items-center justify-center gap-4 flex-wrap opacity-0"
          style={{ animation: "fade-up 0.8s ease-out 0.45s forwards" }}
        >
          <Magnetic strength={0.15}>
            <a
              href="/en/signup"
              className="inline-flex items-center gap-2.5 h-14 px-10 rounded-xl bg-primary text-white text-lg font-medium transition-all duration-250 shadow-[0_8px_30px_rgba(91,91,255,0.3)] hover:shadow-[0_12px_40px_rgba(91,91,255,0.5)] hover:-translate-y-0.5 active:scale-[0.98]"
              style={{ animation: "glow 3s ease-in-out infinite" }}
            >
              Get Started Free
              <ArrowRight size={20} />
            </a>
          </Magnetic>
          <Magnetic strength={0.15}>
            <a
              href="#features"
              className="inline-flex items-center gap-2.5 h-14 px-10 rounded-xl border border-border bg-transparent text-foreground text-lg font-medium transition-all duration-250 hover:bg-surface-2 hover:border-primary/40"
            >
              <Play size={20} />
              See How It Works
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
          Scroll
        </span>
      </div>
    </section>
  );
}
