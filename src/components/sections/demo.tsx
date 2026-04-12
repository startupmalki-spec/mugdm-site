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
import { useTranslations } from "next-intl";
import {
  Reveal,
  FloatingElements,
  FloatingShaddas,
  ParticleNetwork,
} from "@/lib/animations";

const TAB_IDS = ["dashboard", "vault", "chat"] as const;
const TAB_ICONS = { dashboard: LayoutDashboard, vault: FolderLock, chat: MessageSquare } as const;

type TabId = (typeof TAB_IDS)[number];

export function Demo() {
  const t = useTranslations("landing.demo");
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");

  return (
    <section id="demo" className="relative py-24 sm:py-32 bg-surface-1/50">
      <ParticleNetwork className="z-[0]" density={30000} opacity={0.1} lineOpacity={0.04} speed={0.15} />
      <FloatingElements />
      <FloatingShaddas count={3} />
      <div className="relative z-[1] max-w-[1280px] mx-auto px-6">
        {/* Header */}
        <Reveal className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-surface-1 text-xs text-muted-foreground mb-6">
            {t("badge")}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tighter mb-4">
            {t("title")} <span className="text-gradient">{t("titleGradient")}</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </Reveal>

        {/* Tab Switcher + Mockup */}
        <div className="max-w-[680px] mx-auto">
          {/* Tabs */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {TAB_IDS.map((id) => {
              const Icon = TAB_ICONS[id];
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    activeTab === id
                      ? "bg-primary text-primary-foreground shadow-[0_2px_10px_rgba(30,64,175,0.3)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
                  }`}
                >
                  <Icon size={16} />
                  {t(`tabs.${id}`)}
                </button>
              );
            })}
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
                  <span className="text-[11px] text-muted-foreground">app.mugdm.com</span>
                </div>
                <div className="w-12" />
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
                    {activeTab === "dashboard" && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-3">
                          {([
                            { labelKey: "dashboard.documents", valueKey: "dashboard.documentsValue", icon: FileCheck, color: "text-blue-400" },
                            { labelKey: "dashboard.dueSoon", valueKey: "dashboard.dueSoonValue", icon: CalendarCheck, color: "text-amber-400" },
                            { labelKey: "dashboard.netPosition", valueKey: "dashboard.netPositionValue", icon: TrendingUp, color: "text-emerald-400" },
                          ] as const).map((card) => (
                            <div key={card.labelKey} className="rounded-xl border border-border/60 bg-surface-2/50 p-3 flex flex-col gap-2">
                              <card.icon size={16} className={card.color} />
                              <span className="text-lg font-bold text-foreground">{t(card.valueKey)}</span>
                              <span className="text-[11px] text-muted-foreground">{t(card.labelKey)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="rounded-xl border border-border/60 bg-surface-2/50 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                              <Shield size={12} className="text-primary" />
                              {t("dashboard.complianceScore")}
                            </span>
                            <span className="text-xs font-bold text-emerald-400">92%</span>
                          </div>
                          <div className="h-2 rounded-full bg-surface-1 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500 w-[92%]" />
                          </div>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-surface-2/50 p-4 space-y-2.5">
                          <span className="text-xs font-medium text-foreground">{t("dashboard.recentActivity")}</span>
                          {(["activity1", "activity2", "activity3"] as const).map((key) => (
                            <div key={key} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                              {t(`dashboard.${key}`)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {activeTab === "vault" && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-foreground">{t("vault.documentsLabel")}</span>
                          <span className="text-[10px] text-muted-foreground">4 {t("vault.totalLabel")}</span>
                        </div>
                        {([
                          { nameKey: "vault.cr", type: "CR", status: "valid", expiry: "2027-03-15" },
                          { nameKey: "vault.vat", type: "VAT", status: "valid", expiry: "2026-12-01" },
                          { nameKey: "vault.gosi", type: "GOSI", status: "expiring", expiry: "2026-05-10" },
                          { nameKey: "vault.chamber", type: "LICENSE", status: "expired", expiry: "2026-03-01" },
                        ] as const).map((doc) => (
                          <div key={doc.nameKey} className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-2/50 p-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">{doc.type}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{t(doc.nameKey)}</p>
                              <p className="text-[10px] text-muted-foreground">{t("vault.expiresLabel")} {doc.expiry}</p>
                            </div>
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${{ valid: "bg-emerald-500/20 text-emerald-400", expiring: "bg-amber-500/20 text-amber-400", expired: "bg-red-500/20 text-red-400" }[doc.status]}`}>
                              {t(`vault.${doc.status}`)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {activeTab === "chat" && (
                      <div className="space-y-3">
                        {([
                          { role: "user" as const, key: "chat.userMessage1" },
                          { role: "assistant" as const, key: "chat.assistantMessage1" },
                          { role: "user" as const, key: "chat.userMessage2" },
                          { role: "assistant" as const, key: "chat.assistantMessage2" },
                        ] as const).map((msg, i) => (
                          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-surface-2/80 border border-border/60 text-foreground"}`}>
                              <p className="whitespace-pre-line">{t(msg.key)}</p>
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-surface-2/50 p-2">
                          <div className="flex-1 text-[11px] text-muted-foreground px-2">{t("chat.placeholder")}</div>
                          <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                            <Brain size={12} className="text-primary" />
                          </div>
                        </div>
                      </div>
                    )}
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
