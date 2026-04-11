"use client";

import { Globe, Smartphone, Rocket, Layout } from "lucide-react";

const services = [
  {
    icon: Globe,
    title: "Websites & Landing Pages",
    description: "High-converting websites built to impress. Modern design, blazing-fast performance, and SEO-ready from day one.",
  },
  {
    icon: Layout,
    title: "Web Applications",
    description: "Custom SaaS platforms, dashboards, portals, and tools. Full-stack solutions that scale with your business.",
  },
  {
    icon: Smartphone,
    title: "Mobile Apps",
    description: "Cross-platform mobile applications for iOS and Android. Native-feel experiences built with modern frameworks.",
  },
  {
    icon: Rocket,
    title: "MVP Development",
    description: "Validate your idea fast. We build minimum viable products in days so you can test, learn, and iterate.",
  },
];

export function Services() {
  return (
    <section id="services" className="relative py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block text-xs font-medium text-primary uppercase tracking-widest mb-4">
            Services
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tighter mb-4">
            What we <span className="text-gradient">build</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Everything your business needs to go digital — built with AI speed and human quality.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service) => (
            <div
              key={service.title}
              className="group relative p-6 sm:p-8 rounded-xl border border-border bg-card hover:border-primary/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors duration-300">
                <service.icon size={24} className="text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2 tracking-tight">{service.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{service.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
