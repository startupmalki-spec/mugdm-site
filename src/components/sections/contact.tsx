"use client";

import { useState } from "react";
import { Send, Mail, Calendar, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase";
import { Reveal, ParticleNetwork } from "@/lib/animations";

export function Contact() {
  const t = useTranslations("landing.contact");
  const [formState, setFormState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState("sending");
    try {
      if (!supabase) throw new Error("Not configured");
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
    <section id="contact" className="relative py-24 sm:py-32">
      <ParticleNetwork className="z-[0]" density={25000} opacity={0.15} lineOpacity={0.05} speed={0.2} />
      {/* Pulsing glow */}
      <div
        className="absolute bottom-0 left-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(30,64,175,0.08) 0%, transparent 70%)",
          filter: "blur(80px)",
          animation: "contact-glow-pulse 4s ease-in-out infinite",
        }}
      />

      <div className="relative max-w-[1280px] mx-auto px-6">
        <Reveal className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-surface-1 text-xs text-muted-foreground mb-6">
            {t("badge")}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tighter mb-4">
            {t("title")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </Reveal>

        {/* Glass form card */}
        <Reveal delay={0.2} className="relative max-w-[640px] mx-auto p-10 sm:p-10 rounded-2xl border border-border bg-[rgba(37,37,54,0.5)] backdrop-blur-[20px] transition-all duration-400 hover:border-primary/30 hover:shadow-[0_20px_60px_rgba(30,64,175,0.08)]">
        <div>
          {/* Spinning conic gradient border */}
          <div
            className="absolute inset-[-1px] rounded-[17px] p-px pointer-events-none opacity-50"
            style={{
              background: "conic-gradient(from var(--form-angle, 0deg), transparent 60%, rgba(30,64,175,0.4) 80%, transparent 100%)",
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
              <h3 className="text-xl font-semibold mb-2">{t("successTitle")}</h3>
              <p className="text-muted-foreground">{t("successMessage")}</p>
              <button
                onClick={() => setFormState("idle")}
                className="mt-4 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                {t("sendAnother")}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                <input
                  type="text"
                  placeholder={t("namePlaceholder")}
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-12 w-full rounded-[10px] border border-border bg-surface-1 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all duration-300 focus:border-primary focus:shadow-[0_0_0_3px_rgba(30,64,175,0.15),0_4px_20px_rgba(30,64,175,0.08)] focus:bg-surface-2"
                />
                <input
                  type="email"
                  placeholder={t("emailPlaceholder")}
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-12 w-full rounded-[10px] border border-border bg-surface-1 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all duration-300 focus:border-primary focus:shadow-[0_0_0_3px_rgba(30,64,175,0.15),0_4px_20px_rgba(30,64,175,0.08)] focus:bg-surface-2"
                />
              </div>
              <textarea
                placeholder={t("messagePlaceholder")}
                required
                rows={5}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full rounded-[10px] border border-border bg-surface-1 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all duration-300 focus:border-primary focus:shadow-[0_0_0_3px_rgba(30,64,175,0.15),0_4px_20px_rgba(30,64,175,0.08)] focus:bg-surface-2 resize-none min-h-[120px]"
              />
              <button
                type="submit"
                disabled={formState === "sending"}
                className="relative w-full h-[52px] mt-5 rounded-xl bg-primary text-white border-none text-[15px] font-semibold flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_4px_15px_rgba(30,64,175,0.25)] hover:bg-[#4a4aee] hover:shadow-[0_8px_30px_rgba(30,64,175,0.4)] hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 overflow-hidden"
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
                    {t("sending")}
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    {t("sendButton")}
                  </>
                )}
              </button>
              {formState === "error" && (
                <p className="text-sm text-red-400 text-center mt-4">
                  {t("errorMessage")}
                </p>
              )}
            </form>
          )}
        </div>
        </Reveal>

        {/* Alternative CTAs */}
        <div className="flex items-center justify-center gap-6 mt-8">
          <a
            href="mailto:contact@mugdm.com"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground px-4 py-2 rounded-lg transition-all duration-300 hover:text-foreground hover:bg-primary/[0.08]"
          >
            <Mail size={18} className="text-primary transition-transform duration-300 group-hover:scale-115" />
            {t("emailCta")}
          </a>
          <span className="text-border">|</span>
          <a
            href="mailto:contact@mugdm.com"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground px-4 py-2 rounded-lg transition-all duration-300 hover:text-foreground hover:bg-primary/[0.08]"
          >
            <Calendar size={18} className="text-primary transition-transform duration-300 group-hover:scale-115" />
            {t("bookCall")}
          </a>
        </div>
      </div>
    </section>
  );
}
