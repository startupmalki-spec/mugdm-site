"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FolderLock,
  MessageSquare,
  TrendingUp,
  FileCheck,
  CalendarCheck,
  Shield,
  Brain,
} from "lucide-react";
import {
  Reveal,
  FloatingElements,
  FloatingShaddas,
  ParticleNetwork,
} from "@/lib/animations";

const tabs = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "vault",
    label: "Document Vault",
    icon: FolderLock,
  },
  {
    id: "chat",
    label: "AI Chat",
    icon: MessageSquare,
  },
] as const;

type TabId = (typeof tabs)[number]["id"];

/* ─── Mockup cards for each tab ─── */

function DashboardMockup() {
  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Documents", value: "24", icon: FileCheck, color: "text-blue-400" },
          { label: "Due Soon", value: "3", icon: CalendarCheck, color: "text-amber-400" },
          { label: "Net Position", value: "SAR 42K", icon: TrendingUp, color: "text-emerald-400" },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-border/60 bg-surface-2/50 p-3 flex flex-col gap-2"
          >
            <card.icon size={16} className={card.color} />
            <span className="text-lg font-bold text-foreground">{card.value}</span>
            <span className="text-[11px] text-muted-foreground">{card.label}</span>
          </div>
        ))}
      </div>

      {/* Compliance bar */}
      <div className="rounded-xl border border-border/60 bg-surface-2/50 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <Shield size={12} className="text-primary" />
            Compliance Score
          </span>
          <span className="text-xs font-bold text-emerald-400">92%</span>
        </div>
        <div className="h-2 rounded-full bg-surface-1 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500 w-[92%]" />
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-xl border border-border/60 bg-surface-2/50 p-4 space-y-2.5">
        <span className="text-xs font-medium text-foreground">Recent Activity</span>
        {[
          "CR Renewal uploaded",
          "GOSI payment marked done",
          "VAT Return due in 5 days",
        ].map((item) => (
          <div key={item} className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function VaultMockup() {
  const docs = [
    { name: "Commercial Registration", type: "CR", status: "valid", expiry: "2027-03-15" },
    { name: "VAT Certificate", type: "VAT", status: "valid", expiry: "2026-12-01" },
    { name: "GOSI Certificate", type: "GOSI", status: "expiring", expiry: "2026-05-10" },
    { name: "Chamber Membership", type: "LICENSE", status: "expired", expiry: "2026-03-01" },
  ];

  const statusColors: Record<string, string> = {
    valid: "bg-emerald-500/20 text-emerald-400",
    expiring: "bg-amber-500/20 text-amber-400",
    expired: "bg-red-500/20 text-red-400",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">Documents</span>
        <span className="text-[10px] text-muted-foreground">4 total</span>
      </div>
      {docs.map((doc) => (
        <div
          key={doc.name}
          className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-2/50 p-3"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
            {doc.type}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{doc.name}</p>
            <p className="text-[10px] text-muted-foreground">Expires {doc.expiry}</p>
          </div>
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${statusColors[doc.status]}`}
          >
            {doc.status}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChatMockup() {
  const messages = [
    { role: "user" as const, text: "What's my compliance status?" },
    {
      role: "assistant" as const,
      text: "Your compliance score is 92%. You have 3 upcoming deadlines:\n\n- GOSI Payment due May 10\n- VAT Return due May 15\n- Chamber Renewal overdue since Mar 1\n\nI recommend renewing your Chamber membership ASAP to avoid penalties.",
    },
    { role: "user" as const, text: "What's the penalty for late Chamber renewal?" },
    {
      role: "assistant" as const,
      text: "Late Chamber of Commerce renewal typically incurs a fee of SAR 500-2,000 depending on your business type. I'd recommend scheduling it this week.",
    },
  ];

  return (
    <div className="space-y-3">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-surface-2/80 border border-border/60 text-foreground"
            }`}
          >
            <p className="whitespace-pre-line">{msg.text}</p>
          </div>
        </div>
      ))}
      {/* Input mockup */}
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-surface-2/50 p-2">
        <div className="flex-1 text-[11px] text-muted-foreground px-2">
          Type your message...
        </div>
        <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
          <Brain size={12} className="text-primary" />
        </div>
      </div>
    </div>
  );
}

const mockups: Record<TabId, () => React.JSX.Element> = {
  dashboard: DashboardMockup,
  vault: VaultMockup,
  chat: ChatMockup,
};

export function Demo() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const ActiveMockup = mockups[activeTab];

  return (
    <section id="demo" className="relative py-24 sm:py-32 bg-surface-1/50">
      <ParticleNetwork className="z-[0]" density={30000} opacity={0.1} lineOpacity={0.04} speed={0.15} />
      <FloatingElements />
      <FloatingShaddas count={3} />
      <div className="relative z-[1] max-w-[1280px] mx-auto px-6">
        {/* Header */}
        <Reveal className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-surface-1 text-xs text-muted-foreground mb-6">
            Product Tour
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tighter mb-4">
            See Mugdm <span className="text-gradient">in action</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            One dashboard, one vault, one AI assistant — everything your business needs.
          </p>
        </Reveal>

        {/* Tab Switcher + Mockup */}
        <div className="max-w-[680px] mx-auto">
          {/* Tabs */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-[0_2px_10px_rgba(30,64,175,0.3)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Mockup Frame */}
          <Reveal>
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xl shadow-black/10">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface-1">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
                </div>
                <div className="flex-1 text-center">
                  <span className="text-[11px] text-muted-foreground">
                    app.mugdm.com
                  </span>
                </div>
                <div className="w-12" /> {/* Spacer for symmetry */}
              </div>

              {/* Content */}
              <div className="p-5 min-h-[380px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.3, ease: [0.25, 0.8, 0.25, 1] }}
                  >
                    <ActiveMockup />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
