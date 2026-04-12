"use client";

import { FileText, CalendarCheck, Receipt, Users } from "lucide-react";
import { Reveal, StaggerContainer, StaggerItem, TiltCard, FloatingElements, FloatingShaddas } from "@/lib/animations";

const features = [
  {
    icon: FileText,
    title: "Document Vault",
    description: "Never lose a document again. Upload your CR, GOSI certificates, Zakat clearance, and insurance once — access anywhere, and get reminded before anything expires.",
  },
  {
    icon: CalendarCheck,
    title: "Compliance Calendar",
    description: "GOSI, ZATCA VAT, CR renewal, Zakat filing — every deadline tracked and every reminder sent automatically. Sleep easy knowing nothing slips through the cracks.",
  },
  {
    icon: Receipt,
    title: "AI Bookkeeper",
    description: "Snap a receipt, upload a bank statement — done. AI categorizes every transaction, flags government payments, and keeps your VAT numbers ready before ZATCA asks.",
  },
  {
    icon: Users,
    title: "Team Management",
    description: "Track employees, Iqama renewals, and your Saudization ratio in one place. Stay ahead of Ministry of Labor requirements without the spreadsheet chaos.",
  },
];

export function Services() {
  return (
    <section id="features" className="relative py-24 sm:py-32">
      <FloatingElements />
      <FloatingShaddas count={4} />
      <div className="shadda-pattern" />
      <div className="relative z-[1] max-w-[1280px] mx-auto px-6">
        {/* Header */}
        <Reveal className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-surface-1 text-xs text-muted-foreground mb-6">
            Features
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tighter mb-4">
            Stop juggling. <span className="text-gradient">Start growing.</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Documents, deadlines, bookkeeping, and team — handled by one AI-powered platform so you can focus on what actually makes you money.
          </p>
        </Reveal>

        {/* Grid */}
        <StaggerContainer stagger={0.12} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <StaggerItem key={feature.title}>
              <TiltCard
                tiltAmount={6}
                className="group relative p-6 sm:p-8 rounded-xl border border-border bg-card hover:border-primary/30 transition-all duration-400 hover:shadow-xl hover:shadow-primary/5 h-full"
              >
                {/* Inner mouse-tracking glow */}
                <div
                  className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
                  style={{
                    background: "radial-gradient(ellipse at var(--glow-x, 50%) var(--glow-y, 50%), rgba(30,64,175,0.08) 0%, transparent 60%)",
                  }}
                />
                <div className="relative">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-all duration-300 group-hover:scale-110">
                    <feature.icon size={24} className="text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 tracking-tight">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </TiltCard>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
