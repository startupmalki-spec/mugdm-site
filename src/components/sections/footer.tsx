"use client";

import Image from "next/image";

export function Footer() {
  return (
    <footer className="relative border-t border-border bg-surface-1/30 overflow-hidden">
      {/* Animated gradient line at top */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(91,91,255,0.6), transparent)",
          backgroundSize: "200% 100%",
          animation: "footer-line-glow 4s ease-in-out infinite",
        }}
      />
      {/* Subtle شدة watermark */}
      <div
        className="absolute -right-10 -bottom-10 w-[240px] h-[240px] pointer-events-none opacity-[0.06] brightness-200"
        style={{
          background: "url('/brand/logo-shadda.png') no-repeat center/contain",
        }}
      />

      <div className="relative z-[1] max-w-[1280px] mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2.5 group">
            <Image
              src="/brand/7-transparent.png"
              alt=""
              width={500}
              height={500}
              className="h-7 w-7 object-contain transition-transform duration-300 group-hover:scale-110"
            />
            <span className="text-lg font-bold tracking-tight text-foreground">
              Mugdm
            </span>
          </a>

          {/* Links */}
          <div className="flex items-center gap-6">
            {[
              { label: "Features", href: "#features" },
              { label: "How It Works", href: "#how-it-works" },
              { label: "Why Mugdm", href: "#why" },
              { label: "Contact", href: "#contact" },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-all duration-300 relative pb-0.5 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-px after:bg-primary after:transition-all after:duration-300 hover:after:w-full"
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* Social icons */}
          <div className="flex items-center gap-3">
            <a
              href="https://x.com/mmalki27"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground border border-transparent transition-all duration-300 hover:text-primary hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/[0.08] hover:shadow-[0_4px_15px_rgba(91,91,255,0.15)]"
            >
              <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href="https://linkedin.com/in/mohammed-malki"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground border border-transparent transition-all duration-300 hover:text-primary hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/[0.08] hover:shadow-[0_4px_15px_rgba(91,91,255,0.15)]"
            >
              <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Mugdm. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
