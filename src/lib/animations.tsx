"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import Image from "next/image";

/* ─── Scroll-triggered reveal wrapper ─── */
export function Reveal({
  children,
  delay = 0,
  direction = "up",
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  const directionMap = {
    up: { y: 40, x: 0 },
    down: { y: -40, x: 0 },
    left: { x: 60, y: 0 },
    right: { x: -60, y: 0 },
    none: { x: 0, y: 0 },
  };

  const { x, y } = directionMap[direction];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x, y }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, x, y }}
      transition={{
        duration: 0.7,
        delay,
        ease: [0.25, 0.8, 0.25, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Staggered children reveal ─── */
export function StaggerContainer({
  children,
  stagger = 0.1,
  className = "",
}: {
  children: React.ReactNode;
  stagger?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={{
        visible: {
          transition: { staggerChildren: stagger },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 40 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.6, ease: [0.25, 0.8, 0.25, 1] },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Text character animation ─── */
export function AnimatedText({
  text,
  className = "",
  delay = 0,
  as: Tag = "span",
}: {
  text: string;
  className?: string;
  delay?: number;
  as?: "h1" | "h2" | "h3" | "span" | "p";
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const words = text.split(" ");

  return (
    <Tag ref={ref} className={className}>
      {words.map((word, wi) => (
        <span key={wi} className="inline-block overflow-hidden" style={{ marginRight: "0.25em" }}>
          <motion.span
            className="inline-block"
            initial={{ y: "110%", opacity: 0 }}
            animate={isInView ? { y: "0%", opacity: 1 } : { y: "110%", opacity: 0 }}
            transition={{
              duration: 0.5,
              delay: delay + wi * 0.06,
              ease: [0.25, 0.8, 0.25, 1],
            }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

/* ─── 3D Tilt Card ─── */
export function TiltCard({
  children,
  className = "",
  tiltAmount = 8,
}: {
  children: React.ReactNode;
  className?: string;
  tiltAmount?: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("perspective(1000px) rotateX(0deg) rotateY(0deg)");

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const card = cardRef.current;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const rotateX = ((e.clientY - centerY) / (rect.height / 2)) * -tiltAmount;
      const rotateY = ((e.clientX - centerX) / (rect.width / 2)) * tiltAmount;
      setTransform(
        `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`
      );
      // Glow position
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty("--glow-x", x + "%");
      card.style.setProperty("--glow-y", y + "%");
    },
    [tiltAmount]
  );

  const handleMouseLeave = useCallback(() => {
    setTransform("perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)");
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={{
        transform,
        transition: "transform 0.3s ease-out",
        transformStyle: "preserve-3d",
      }}
    >
      {children}
    </div>
  );
}

/* ─── Animated Counter ─── */
export function Counter({
  target,
  suffix = "",
  prefix = "",
  className = "",
  duration = 2,
}: {
  target: number;
  suffix?: string;
  prefix?: string;
  className?: string;
  duration?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const startTime = Date.now();
    const durationMs = duration * 1000;

    function tick() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [isInView, target, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {count}
      {suffix}
    </span>
  );
}

/* ─── Aurora Gradient Background ─── */
export function AuroraBackground({ className = "" }: { className?: string }) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      <div
        className="absolute w-[800px] h-[600px] top-[-10%] left-[10%] rounded-full opacity-30 blur-[120px]"
        style={{
          background: "linear-gradient(135deg, rgba(30,64,175,0.3), rgba(139,92,246,0.2), rgba(59,130,246,0.15))",
          animation: "aurora-drift-1 12s ease-in-out infinite alternate",
        }}
      />
      <div
        className="absolute w-[600px] h-[500px] top-[20%] right-[-5%] rounded-full opacity-20 blur-[100px]"
        style={{
          background: "linear-gradient(225deg, rgba(139,92,246,0.25), rgba(30,64,175,0.2), rgba(34,211,238,0.1))",
          animation: "aurora-drift-2 15s ease-in-out infinite alternate",
        }}
      />
      <div
        className="absolute w-[500px] h-[400px] bottom-[10%] left-[30%] rounded-full opacity-15 blur-[90px]"
        style={{
          background: "linear-gradient(45deg, rgba(59,130,246,0.2), rgba(30,64,175,0.15), rgba(168,85,247,0.1))",
          animation: "aurora-drift-3 18s ease-in-out infinite alternate",
        }}
      />
    </div>
  );
}

/* ─── Magnetic Element ─── */
export function Magnetic({
  children,
  className = "",
  strength = 0.3,
}: {
  children: React.ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) * strength;
      const dy = (e.clientY - cy) * strength;
      setPos({ x: dx, y: dy });
    },
    [strength]
  );

  const handleMouseLeave = useCallback(() => {
    setPos({ x: 0, y: 0 });
  }, []);

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: pos.x, y: pos.y }}
      transition={{ type: "spring", stiffness: 200, damping: 15, mass: 0.5 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Scroll-driven Progress Line ─── */
export function ScrollProgressLine({
  className = "",
}: {
  className?: string;
}) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.8", "end 0.5"],
  });
  const width = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Track */}
      <div className="absolute top-[40px] left-[12.5%] right-[12.5%] h-px bg-border/50" />
      {/* Animated fill */}
      <motion.div
        className="absolute top-[40px] left-[12.5%] h-px origin-left"
        style={{
          width,
          maxWidth: "75%",
          background: "linear-gradient(90deg, rgba(30,64,175,0.8), rgba(139,92,246,0.6), rgba(30,64,175,0.4))",
          boxShadow: "0 0 12px rgba(30,64,175,0.4), 0 0 4px rgba(30,64,175,0.6)",
        }}
      />
    </div>
  );
}

/* ─── Floating Particles / Ambient Elements ─── */
const FLOATING_ELEMENTS = [
  { size: 4, x: "10%", y: "20%", duration: 8, delay: 0, alpha: 0.35 },
  { size: 3, x: "85%", y: "15%", duration: 10, delay: 1, alpha: 0.4 },
  { size: 5, x: "70%", y: "60%", duration: 12, delay: 2, alpha: 0.28 },
  { size: 3, x: "25%", y: "75%", duration: 9, delay: 0.5, alpha: 0.45 },
  { size: 4, x: "55%", y: "35%", duration: 11, delay: 1.5, alpha: 0.32 },
  { size: 2, x: "40%", y: "85%", duration: 7, delay: 3, alpha: 0.38 },
  { size: 3, x: "90%", y: "45%", duration: 13, delay: 0.8, alpha: 0.42 },
  { size: 2, x: "15%", y: "50%", duration: 10, delay: 2.5, alpha: 0.3 },
] as const;

export function FloatingElements({ className = "" }: { className?: string }) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {FLOATING_ELEMENTS.map((el, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: `${el.size}px`,
            height: `${el.size}px`,
            left: el.x,
            top: el.y,
            background: `rgba(30,64,175,${el.alpha})`,
            boxShadow: `0 0 ${el.size * 3}px rgba(30,64,175,0.3)`,
          }}
          animate={{
            y: [0, -30, 0, 20, 0],
            x: [0, 15, -10, 5, 0],
            opacity: [0.3, 0.7, 0.4, 0.8, 0.3],
            scale: [1, 1.3, 0.9, 1.2, 1],
          }}
          transition={{
            duration: el.duration,
            delay: el.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/* ─── Reactive Shadda (hero) — scales, glows, breathes, rotates on mouse proximity ─── */
export function ReactiveShadda() {
  const ref = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    // Entrance delay
    const t = setTimeout(() => setEntered(true), 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const section = el.closest("section");
    if (!section) return;

    function handleMouseMove(e: MouseEvent) {
      if (!el || !section) return;
      const rect = section.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = Math.sqrt(rect.width * rect.width + rect.height * rect.height) / 2;
      const proximity = 1 - Math.min(dist / maxDist, 1); // 0 = far, 1 = center

      const scale = 1 + proximity * 0.15;
      const rotate = (dx / maxDist) * 8;
      const glow = proximity * 0.4;
      const translateX = (dx / maxDist) * -15;
      const translateY = (dy / maxDist) * -15;

      el.style.transform = `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px)) scale(${scale}) rotate(${rotate}deg)`;
      el.style.filter = `brightness(${1.5 + proximity * 0.8}) drop-shadow(0 0 ${20 + glow * 40}px rgba(30,64,175,${0.1 + glow}))`;
    }

    function handleMouseLeave() {
      if (!el) return;
      el.style.transform = "translate(-50%, -50%) scale(1) rotate(0deg)";
      el.style.filter = "brightness(1.5) drop-shadow(0 0 20px rgba(30,64,175,0.1))";
    }

    section.addEventListener("mousemove", handleMouseMove);
    section.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      section.removeEventListener("mousemove", handleMouseMove);
      section.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="absolute top-1/2 left-1/2 w-[500px] h-[500px] z-0 pointer-events-none"
      style={{
        transform: "translate(-50%,-50%) scale(0.8)",
        opacity: entered ? 0.08 : 0,
        transition: "opacity 2s cubic-bezier(0.25,0.8,0.25,1), transform 0.2s ease-out, filter 0.2s ease-out",
        filter: "brightness(1.5) drop-shadow(0 0 20px rgba(30,64,175,0.1))",
        animation: entered ? "shadda-breathe 4s ease-in-out infinite" : "none",
      }}
    >
      <Image
        src="/brand/7-transparent.png"
        alt=""
        width={500}
        height={500}
        className="w-full h-full object-contain"
      />
    </div>
  );
}

/* ─── Floating Shaddas — scattered across sections ─── */
const FLOATING_SHADDAS = [
  { size: 28, left: "8%", top: "12%", duration: 18, delay: 0, opacity: 0.03, rotate: 25 },
  { size: 42, left: "72%", top: "28%", duration: 22, delay: 1.2, opacity: 0.04, rotate: 140 },
  { size: 35, left: "45%", top: "65%", duration: 25, delay: 2.5, opacity: 0.035, rotate: 80 },
  { size: 22, left: "88%", top: "75%", duration: 20, delay: 0.8, opacity: 0.028, rotate: 200 },
  { size: 38, left: "25%", top: "42%", duration: 30, delay: 3.5, opacity: 0.045, rotate: 310 },
  { size: 30, left: "60%", top: "85%", duration: 17, delay: 1.8, opacity: 0.032, rotate: 55 },
  { size: 25, left: "15%", top: "90%", duration: 23, delay: 4.2, opacity: 0.038, rotate: 170 },
] as const;

export function FloatingShaddas({ count = 5, className = "" }: { count?: number; className?: string }) {
  const shaddas = FLOATING_SHADDAS.slice(0, count);

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}>
      {shaddas.map((s, i) => (
        <motion.img
          key={i}
          src="/brand/7-transparent.png"
          alt=""
          className="absolute object-contain"
          style={{
            width: `${s.size}px`,
            height: `${s.size}px`,
            left: s.left,
            top: s.top,
            opacity: s.opacity,
            rotate: s.rotate,
            filter: "brightness(2)",
          }}
          animate={{
            y: [0, -20, 10, -15, 0],
            x: [0, 10, -8, 12, 0],
            rotate: [s.rotate, s.rotate + 15, s.rotate - 10, s.rotate + 8, s.rotate],
            scale: [1, 1.1, 0.95, 1.05, 1],
          }}
          transition={{
            duration: s.duration,
            delay: s.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/* ─── Particle Network Canvas ─── */
interface ParticleNetworkProps {
  className?: string;
  /** Particle density — higher = more particles. Default: 14000 (area per particle) */
  density?: number;
  /** Particle color in rgba format. Default: "30,64,175" */
  color?: string;
  /** Particle opacity. Default: 0.4 */
  opacity?: number;
  /** Line opacity multiplier. Default: 0.12 */
  lineOpacity?: number;
  /** Max connection distance. Default: 130 */
  maxDistance?: number;
  /** Particle speed multiplier. Default: 0.4 */
  speed?: number;
}

export function ParticleNetwork({
  className = "",
  density = 14000,
  color = "30,64,175",
  opacity = 0.4,
  lineOpacity = 0.12,
  maxDistance = 130,
  speed = 0.4,
}: ParticleNetworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; r: number }[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function initParticles() {
      cancelAnimationFrame(animRef.current);
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.offsetWidth;
      canvas.height = parent.offsetHeight;
      particlesRef.current = [];
      const count = Math.floor((canvas.width * canvas.height) / density);
      for (let i = 0; i < count; i++) {
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * speed,
          vy: (Math.random() - 0.5) * speed,
          r: Math.random() * 1.8 + 0.8,
        });
      }
      drawParticles();
    }

    function drawParticles() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color},${opacity})`;
        ctx.fill();
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDistance) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(${color},${lineOpacity * (1 - dist / maxDistance)})`;
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
  }, [density, color, opacity, lineOpacity, maxDistance, speed]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
    />
  );
}

/* ─── Glowing Section Divider ─── */
export function GlowDivider({ className = "" }: { className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <div ref={ref} className={`relative h-px w-full max-w-[800px] mx-auto ${className}`}>
      <motion.div
        className="absolute inset-0"
        initial={{ scaleX: 0, opacity: 0 }}
        animate={isInView ? { scaleX: 1, opacity: 1 } : { scaleX: 0, opacity: 0 }}
        transition={{ duration: 1.2, ease: [0.25, 0.8, 0.25, 1] }}
        style={{
          background: "linear-gradient(90deg, transparent, rgba(30,64,175,0.5), rgba(139,92,246,0.3), rgba(30,64,175,0.5), transparent)",
          boxShadow: "0 0 20px rgba(30,64,175,0.2)",
        }}
      />
    </div>
  );
}
