"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";

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
    let start = 0;
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
          background: "linear-gradient(135deg, rgba(91,91,255,0.3), rgba(139,92,246,0.2), rgba(59,130,246,0.15))",
          animation: "aurora-drift-1 12s ease-in-out infinite alternate",
        }}
      />
      <div
        className="absolute w-[600px] h-[500px] top-[20%] right-[-5%] rounded-full opacity-20 blur-[100px]"
        style={{
          background: "linear-gradient(225deg, rgba(139,92,246,0.25), rgba(91,91,255,0.2), rgba(34,211,238,0.1))",
          animation: "aurora-drift-2 15s ease-in-out infinite alternate",
        }}
      />
      <div
        className="absolute w-[500px] h-[400px] bottom-[10%] left-[30%] rounded-full opacity-15 blur-[90px]"
        style={{
          background: "linear-gradient(45deg, rgba(59,130,246,0.2), rgba(91,91,255,0.15), rgba(168,85,247,0.1))",
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
          background: "linear-gradient(90deg, rgba(91,91,255,0.8), rgba(139,92,246,0.6), rgba(91,91,255,0.4))",
          boxShadow: "0 0 12px rgba(91,91,255,0.4), 0 0 4px rgba(91,91,255,0.6)",
        }}
      />
    </div>
  );
}

/* ─── Floating Particles / Ambient Elements ─── */
export function FloatingElements({ className = "" }: { className?: string }) {
  const elements = [
    { size: 4, x: "10%", y: "20%", duration: 8, delay: 0 },
    { size: 3, x: "85%", y: "15%", duration: 10, delay: 1 },
    { size: 5, x: "70%", y: "60%", duration: 12, delay: 2 },
    { size: 3, x: "25%", y: "75%", duration: 9, delay: 0.5 },
    { size: 4, x: "55%", y: "35%", duration: 11, delay: 1.5 },
    { size: 2, x: "40%", y: "85%", duration: 7, delay: 3 },
    { size: 3, x: "90%", y: "45%", duration: 13, delay: 0.8 },
    { size: 2, x: "15%", y: "50%", duration: 10, delay: 2.5 },
  ];

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {elements.map((el, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: el.size,
            height: el.size,
            left: el.x,
            top: el.y,
            background: `rgba(91,91,255,${0.2 + Math.random() * 0.3})`,
            boxShadow: `0 0 ${el.size * 3}px rgba(91,91,255,0.3)`,
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
      el.style.filter = `brightness(${1.5 + proximity * 0.8}) drop-shadow(0 0 ${20 + glow * 40}px rgba(91,91,255,${0.1 + glow}))`;
    }

    function handleMouseLeave() {
      if (!el) return;
      el.style.transform = "translate(-50%, -50%) scale(1) rotate(0deg)";
      el.style.filter = "brightness(1.5) drop-shadow(0 0 20px rgba(91,91,255,0.1))";
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
      className="absolute top-1/2 left-1/2 w-[420px] h-[420px] z-0 pointer-events-none"
      style={{
        transform: "translate(-50%,-50%) scale(0.8)",
        opacity: entered ? 0.04 : 0,
        transition: "opacity 2s cubic-bezier(0.25,0.8,0.25,1), transform 0.2s ease-out, filter 0.2s ease-out",
        filter: "brightness(1.5) drop-shadow(0 0 20px rgba(91,91,255,0.1))",
        animation: entered ? "shadda-breathe 4s ease-in-out infinite" : "none",
      }}
    >
      <img
        src="/brand/logo-shadda.png"
        alt=""
        className="w-full h-full object-contain"
      />
    </div>
  );
}

/* ─── Floating Shaddas — scattered across sections ─── */
export function FloatingShaddas({ count = 5, className = "" }: { count?: number; className?: string }) {
  const shaddas = Array.from({ length: count }, (_, i) => ({
    id: i,
    size: 20 + Math.random() * 30,
    left: `${5 + Math.random() * 90}%`,
    top: `${5 + Math.random() * 90}%`,
    duration: 15 + Math.random() * 20,
    delay: Math.random() * 5,
    opacity: 0.015 + Math.random() * 0.02,
    rotate: Math.random() * 360,
  }));

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}>
      {shaddas.map((s) => (
        <motion.img
          key={s.id}
          src="/brand/logo-shadda.png"
          alt=""
          className="absolute object-contain"
          style={{
            width: s.size,
            height: s.size,
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
          background: "linear-gradient(90deg, transparent, rgba(91,91,255,0.5), rgba(139,92,246,0.3), rgba(91,91,255,0.5), transparent)",
          boxShadow: "0 0 20px rgba(91,91,255,0.2)",
        }}
      />
    </div>
  );
}
