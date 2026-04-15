"use client";

import { Building2, Landmark, Users, Receipt, FileLock2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { FeatureBlock } from "./feature-block";

export function Features() {
  const t = useTranslations("landing.featuresIntro");

  return (
    <div id="features">
      <section
        className="relative pt-24 pb-8"
        style={{ paddingInlineStart: "24px", paddingInlineEnd: "24px" }}
      >
        <div className="max-w-[880px] mx-auto text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-surface-1 text-xs text-muted-foreground mb-6">
            {t("badge")}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tighter mb-4">
            {t("title")}
          </h2>
          <p className="text-muted-foreground text-lg">{t("subtitle")}</p>
        </div>
      </section>

      {/*
        Only shipping ZATCA e-invoicing + AI vault/chat today. Incorporation,
        Banking, and Payroll blocks are pre-launch overclaims — re-enable them
        module-by-module as each ships so the site never promises what the
        product doesn't do.
      */}
      {/* <FeatureBlock namespace="landing.featureIncorporation" icon={Building2} /> */}
      {/* <FeatureBlock namespace="landing.featureBanking" icon={Landmark} reverse /> */}
      {/* <FeatureBlock namespace="landing.featurePayroll" icon={Users} /> */}
      <FeatureBlock namespace="landing.featureTax" icon={Receipt} />
      <FeatureBlock namespace="landing.featureVault" icon={FileLock2} reverse />
    </div>
  );
}
