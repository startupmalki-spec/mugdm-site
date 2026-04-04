"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Mail, Calendar, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function Contact() {
  const [formState, setFormState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const sectionRef = useRef<HTMLElement>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState("sending");
    try {
      const { error } = await supabase.from("leads").insert({
        name: formData.name,
        email: formData.email,
        message: formData.message,
      });
      if (error) throw error;
      setFormState("sent");
      setFormData({ name: "", email: "", message: "" });
    } catch {
      setFormState("error");
    }
  };

  return (
    <section id="contact" className="relative py-24 sm:py-32" ref={sectionRef}>
      {/* Pulsing glow */}
      <div
        className="absolute bottom-0 left-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(91,91,255,0.08) 0%, transparent 70%)",
          filter: "blur(80px)",
          animation: "contact-glow-pulse 4s ease-in-out infinite",
        }}
      />

      <div className="relative max-w-[1280px] mx-auto px-6">
        <div className="text-center mb-16 opacity-0 translate-y-8 transition-all duration-700" data-animate>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-surface-1 text-xs text-muted-foreground mb-6">
            Contact
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tighter mb-4">
            Ready to <span className="text-gradient">build</span>?
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Tell us about your project. We&apos;ll get back to you within 24 hours.
          </p>
        </div>

        {/* Glass form card */}
        <div
          data-animate
          className="relative max-w-[640px] mx-auto p-10 sm:p-10 rounded-2xl border border-border bg-[rgba(37,37,54,0.5)] backdrop-blur-[20px] transition-all duration-400 hover:border-primary/30 hover:shadow-[0_20px_60px_rgba(91,91,255,0.08)] opacity-0 translate-y-8"
          style={{ transitionDelay: "200ms" }}
        >
          {/* Spinning conic gradient border */}
          <div
            className="absolute inset-[-1px] rounded-[17px] p-px pointer-events-none opacity-50"
            style={{
              background: "conic-gradient(from var(--form-angle, 0deg), transparent 60%, rgba(91,91,255,0.4) 80%, transparent 100%)",
              WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
              animation: "6s linear infinite",
              animationName: "formBorderSpin",
            }}
          />

          {formState === "sent" ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Send size={28} className="text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Message sent!</h3>
              <p className="text-muted-foreground">We&apos;ll be in touch within 24 hours.</p>
              <button
                onClick={() => setFormState("idle")}
                className="mt-4 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                <input
                  type="text"
                  placeholder="Your name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-12 w-full rounded-[10px] border border-border bg-surface-1 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all duration-300 focus:border-primary focus:shadow-[0_0_0_3px_rgba(91,91,255,0.15),0_4px_20px_rgba(91,91,255,0.08)] focus:bg-surface-2"
                />
                <input
                  type="email"
                  placeholder="Your email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-12 w-full rounded-[10px] border border-border bg-surface-1 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all duration-300 focus:border-primary focus:shadow-[0_0_0_3px_rgba(91,91,255,0.15),0_4px_20px_rgba(91,91,255,0.08)] focus:bg-surface-2"
                />
              </div>
              <textarea
                placeholder="Tell us about your project..."
                required
                rows={5}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full rounded-[10px] border border-border bg-surface-1 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all duration-300 focus:border-primary focus:shadow-[0_0_0_3px_rgba(91,91,255,0.15),0_4px_20px_rgba(91,91,255,0.08)] focus:bg-surface-2 resize-none min-h-[120px]"
              />
              <button
                type="submit"
                disabled={formState === "sending"}
                className="relative w-full h-[52px] mt-5 rounded-xl bg-primary text-white border-none text-[15px] font-semibold flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_4px_15px_rgba(91,91,255,0.25)] hover:bg-[#4a4aee] hover:shadow-[0_8px_30px_rgba(91,91,255,0.4)] hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 overflow-hidden"
              >
                {/* Shimmer effect */}
                <span
                  className="absolute top-0 w-full h-full pointer-events-none"
                  style={{
                    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",
                    animation: "shimmer 3s ease-in-out infinite",
                  }}
                />
                {formState === "sending" ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Send Message
                  </>
                )}
              </button>
              {formState === "error" && (
                <p className="text-sm text-red-400 text-center mt-4">
                  Something went wrong. Please try again or reach out via WhatsApp.
                </p>
              )}
            </form>
          )}
        </div>

        {/* Alternative CTAs */}
        <div className="flex items-center justify-center gap-6 mt-8">
          <a
            href="mailto:contact@mugdm.com"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground px-4 py-2 rounded-lg transition-all duration-300 hover:text-foreground hover:bg-primary/[0.08]"
          >
            <Mail size={18} className="text-primary transition-transform duration-300 group-hover:scale-115" />
            contact@mugdm.com
          </a>
          <span className="text-border">|</span>
          <a
            href="https://cal.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground px-4 py-2 rounded-lg transition-all duration-300 hover:text-foreground hover:bg-primary/[0.08]"
          >
            <Calendar size={18} className="text-primary transition-transform duration-300 group-hover:scale-115" />
            Book a call
          </a>
        </div>
      </div>
    </section>
  );
}
