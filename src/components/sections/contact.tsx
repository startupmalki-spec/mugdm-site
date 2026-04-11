"use client";

import { useState } from "react";
import { Send, MessageCircle, Calendar, Loader2 } from "lucide-react";

export function Contact() {
  const [formState, setFormState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState("sending");

    try {
      // TODO: Connect to Supabase
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setFormState("sent");
      setFormData({ name: "", email: "", message: "" });
    } catch {
      setFormState("error");
    }
  };

  return (
    <section id="contact" className="relative py-24 sm:py-32">
      {/* Glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="inline-block text-xs font-medium text-primary uppercase tracking-widest mb-4">
            Contact
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tighter mb-4">
            Ready to <span className="text-gradient">build</span>?
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Tell us about your project. We&apos;ll get back to you within 24 hours.
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Form */}
          {formState === "sent" ? (
            <div className="text-center p-12 rounded-xl border border-primary/30 bg-card">
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
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <input
                  type="text"
                  placeholder="Your name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-12 w-full rounded-lg border border-border bg-surface-1 px-4 text-sm text-foreground placeholder:text-muted-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary"
                />
                <input
                  type="email"
                  placeholder="Your email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-12 w-full rounded-lg border border-border bg-surface-1 px-4 text-sm text-foreground placeholder:text-muted-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary"
                />
              </div>
              <textarea
                placeholder="Tell us about your project..."
                required
                rows={5}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface-1 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary resize-none"
              />
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  type="submit"
                  disabled={formState === "sending"}
                  className="flex-1 inline-flex items-center justify-center h-12 px-8 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all duration-200 shadow-lg shadow-primary/20 active:scale-[0.98] disabled:opacity-50 gap-2"
                >
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
              </div>
              {formState === "error" && (
                <p className="text-sm text-red-400 text-center">
                  Something went wrong. Please try again or reach out via WhatsApp.
                </p>
              )}
            </form>
          )}

          {/* Alternative CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-6 pt-8 border-t border-border">
            <a
              href="https://wa.me/966500000000"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <MessageCircle size={18} className="text-green-400" />
              WhatsApp us
            </a>
            <span className="hidden sm:block text-border">|</span>
            <a
              href="https://cal.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Calendar size={18} className="text-primary" />
              Book a call
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
