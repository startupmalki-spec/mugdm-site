# Every.io — Strategic Data Room Dossier

*Compiled April 15, 2026. For internal mugdm strategy use.*

---

## 1. Company profile

- **Legal entity:** Every, Inc.
- **HQ:** San Francisco, California
- **Founded:** 2021 (emerged from stealth November 2023, YC S23)
- **Headcount:** ~154 employees (as of late 2024)
- **One-liner:** "All-in-one financial and HR platform for early-stage tech founders."
- **Origin story:** Built by Rajeev Behera after scaling Reflektive (HR SaaS) to 250 employees and $100M raised. Thesis: founders juggle 5–7 separate vendors for back-office and waste 50+ hours/year on reconciliation and vendor management. Every consolidates into one data-unified platform.

---

## 2. Founders

### Rajeev Behera — Co-Founder & CEO
- LinkedIn: linkedin.com/in/rajeevbehera
- Previously founded **Reflektive** (HR performance SaaS), scaled to 250 people and $100M+ raised from a16z, Lightspeed, TPG. Exited as Chairman. Reflektive was Deloitte Fast 500's 13th fastest-growing company in North America.
- UC Berkeley
- Direct quote: *"After raising $100m and scaling Reflektive for 8+ years, I decided I wanted to build something that serves tech founders."*

### Barry Peterson — Co-Founder & CTO
- LinkedIn: linkedin.com/in/barrympeterson
- Previously Director/VP Engineering at Reflektive for 8+ years (worked alongside Behera)
- 17+ years in software engineering
- Low public profile, technical focus

**Takeaway:** This is a second-time founder team with deep fintech/HR scaling experience and an existing relationship. That's the single biggest reason they raised $32M on modest traction — the bet is on the operators, not the product.

---

## 3. Team signals

- Chief of Staff: Lisa Shmulyan
- No publicly-identified CFO, COO, or Head of Product (unusual for 154-person company — suggests the founders still run central functions)
- No notable hires from Stripe, Brex, Mercury, Ramp, or Gusto found in public signals (a credibility gap given the space)
- Engineering estimated at 40–50 people
- Hiring Senior SWE (Node.js / Postgres / TypeScript) at $125–200K, remote US or San Luis Obispo

---

## 4. Funding history

| Round | Date | Amount | Lead | Participants |
|-------|------|--------|------|--------------|
| Seed | Nov 2023 | $9.5M | Base10 Partners | Y Combinator, Formus Capital, Cambrian Ventures (Rex Salisbury) |
| Series A | Sep 2024 | $22.5M | Redpoint Ventures (Alex Bard) | Y Combinator, Okta Ventures, Base10, Formus |
| **Total** | | **$32.1M** | | |

**Estimated post-money Series A valuation:** ~$112.5M (inferred from standard 20% dilution).

### Growth metrics
- 6 months post-launch: $1M ARR, 75 customers
- December 2023: $4.5M ARR
- October 2024: $6.4M revenue, 150+ customers
- 78% of customers use the full product suite
- ~50% of customers come from Y Combinator
- $60M+ payroll processed life-to-date
- Zero reported tax penalties among customer base

**Valuation multiple:** ~17.6× revenue. Reasonable-to-conservative for a Series A fintech with bundling economics and 42% YoY growth.

---

## 5. Product: complete feature inventory

Every markets six core modules. Each combines AI-assisted automation with human expertise.

### Incorporation
- Free Delaware C-Corp formation
- Instant EIN (via IRS e-services automation, not manual filing)
- Registered agent, 83(b) filing automation, legal docs
- 1–3 business day turnaround

### Banking
- FDIC-insured business checking via **Thread Bank**
- Virtual + physical Visa debit cards (BIN-sponsored by Thread)
- ACH, wire, check, bill pay (all free)
- 3% cashback paid to founder's personal account (unusual structure)
- Up to **$3M FDIC coverage** via Thread's sweep program
- Real-time transaction dashboard

### Corporate cards & expense management
- Virtual + physical Visa cards per employee
- 3% cashback on all spend
- AI-assisted expense categorization
- Receipt capture and matching

### Treasury & cash management
- Treasury account via **Atomic Invest** (SEC-registered RIA, FINRA broker-dealer)
- Custody at **BNY Pershing**
- US T-Bill auto-investing ("Treasury Autopilot")
- Up to 4.3% APY on idle cash
- "Every Securities LLC" is their broker-dealer entity

### Payroll & HR
- US payroll in all 50 states + DC
- Automated state tax registration (their flagship automation story — claims to save 50+ hrs/founder)
- Contractor payouts (US + some international)
- Health, dental, vision benefits via "major carriers" (not named)
- Pre-tax commuter, dependent care benefits
- No international entity payroll

### Bookkeeping
- Dedicated human bookkeeper per customer
- AI transaction categorization (claimed 50% cost reduction vs manual entry)
- Unified GL sits across banking + payroll + treasury — no reconciliation needed
- GAAP-compliant monthly/quarterly close
- P&L, balance sheet, cash flow dashboards
- $150/month entry, up to $330/month premium tier

### Taxes
- Federal + state tax filing (1120-C, 1120-S, 1040)
- In-house CPA team (size undisclosed, likely 5–10)
- R&D credits, Delaware franchise tax, 1099s
- Tax planning advisory
- $3,000/year starting engagement

---

## 6. The "AI-native" claim — honest read

This is the section that matters most strategically.

**Every markets itself as "AI-native." The reality is AI-assisted.**

### Where AI actually shows up

| Feature | What it does | Type |
|---------|-------------|------|
| Bookkeeper AI | Auto-categorizes bank + payroll transactions into GL codes; human bookkeeper reviews | Supervised classifier |
| EIN retrieval | Automates IRS SS-4 submission, retrieves EIN instantly | Process automation (not ML) |
| State tax registration | Automatically files in required jurisdictions based on payroll setup | Rule-based automation |
| Expense categorization | Auto-codes corp card expenses | Classifier |
| Treasury Autopilot | Moves idle cash into T-Bills per rules | Rule-based automation |

### Where AI does NOT show up

- Payroll processing — human-supervised batch
- Tax return filing — human CPA prepared
- Benefits enrollment — standard flows
- Compliance — rule-based alerts, not predictive

### What competitors have that Every doesn't market

- No chatbot or copilot interface
- No agentic/autonomous workflows (unlike Octa)
- No predictive analytics (cash burn, runway, hiring projections)
- No document generation via LLM
- No disclosed underlying models (no public mention of OpenAI, Anthropic, or proprietary stack)

**Honest positioning:** "AI-enhanced back office with unified data and human experts." That's a defensible story. "AI-native" is marketing.

---

## 7. Pricing — complete

| Tier | Monthly | What's included |
|------|---------|-----------------|
| Incorporation only | $0 | Delaware C-Corp + EIN + registered agent |
| **Launch** | $25 | Banking, cards, bill pay, wires |
| **Build** | $150 | + Payroll (50 states), bookkeeping, benefits |
| **Scale** | $850 | + Tax filing, treasury, dedicated controller |

**Modular add-ons:**
- Bookkeeping standalone: $150–$330/mo
- Tax prep & filing: $3,000/year entry

**Revenue streams beyond subscription:**
- Interchange on card spend (offsets 3% cashback cost)
- Likely AUM fees on treasury balances
- Payroll processing margin (thin)

**Competitive cost claim:** 40–60% cheaper than buying Novo + Gusto + Pilot + Brex separately at comparable feature tiers.

---

## 8. Partnerships and backend infrastructure

| Function | Partner | Arrangement |
|----------|---------|-------------|
| Banking | **Thread Bank** (FDIC member) | Deposits, card issuance, sweep program |
| Card issuance | Visa (Thread Bank BIN) | Debit card BIN sponsorship |
| Treasury | **Atomic Invest** (SEC RIA) | Investment management |
| Custody | **BNY Pershing** | Security custody and settlement |
| Securities entity | Every Securities LLC | Every's own SEC-regulated broker |
| Payroll | In-house (not disclosed if using ADP/Gusto backend) | Unclear |
| Tax prep | In-house CPAs | Direct |
| Accelerator | Y Combinator | Investor + pipeline |
| Accelerator | Founder Institute | Partnership |

**No public integrations** with QuickBooks, Xero, Gusto, Carta, or any external ERPs. Closed-loop positioning.

### Red flag: Thread Bank FDIC enforcement order (May 2024)

Thread Bank received an FDIC enforcement order requiring improved BaaS oversight, third-party risk management, and due diligence. No specific violations cited against Every, but regulatory scrutiny on BaaS is elevated. Every has no disclosed backup banking partner.

---

## 9. Customer traction

- **150+ customers** (Sep 2024)
- **~50% from Y Combinator** network
- **78%** use the full suite
- Named customer: MediSearch (quoted in testimonial)
- Fortune 500 / Series C+ logos: none publicly disclosed
- Trustpilot: only 3 reviews (insufficient signal)
- No significant Reddit, HN, or X complaints surfaced

**Quote from customer:** *"I had to use multiple different tools for banking, payroll, HR, and bookkeeping. Found it attractive to consolidate everything under one roof at comparable cost."*

Churn/retention not disclosed.

---

## 10. Go-to-market

- **Primary:** inbound through Y Combinator network — founder-to-founder word of mouth
- **SEO strategy:** attack competitor keywords with "Best X Alternatives" blog posts (Mercury, Brex, Ramp, Novo, Relay)
- **Lead magnet:** free incorporation
- **Referral program:** credits for free incorporation on referral
- No visible outbound sales motion; founder-led selling to early customers
- Content cadence: 1–2 posts/month, founder education + competitive SEO

---

## 11. Press and awards

- **Fast Company Most Innovative Companies 2025** — category: HR & Payroll (not top-level)
- **TechCrunch** (Sep 12, 2024): "Why Y Combinator companies are flocking to banking and HR startup Every"
- **SiliconAngle, PR Newswire, American Bazaar, FINSMES, DHRMap**: round coverage
- **Globy podcast**: Behera interview on global hiring
- No negative coverage or regulatory actions against Every itself
- No major security or data incidents

---

## 12. Competitors they target

Every positions explicitly against:
- **Mercury** (banking)
- **Brex** (cards + spend)
- **Ramp** (cards + spend + AP)
- **Novo** (SMB banking)
- **Relay Financial** (banking)
- Implicit: **Gusto** (payroll), **Pilot** (bookkeeping), **Bench** (bookkeeping), **Rippling** (HR)

**Stated differentiation:**
1. Only platform covering all six back-office functions in one data-unified system
2. Central GL eliminates reconciliation between tools
3. Human + AI hybrid (bookkeeper + CPA dedicated per customer)
4. 40–60% cost savings vs buying point solutions
5. Deep YC network alignment

---

## 13. Product roadmap signals

**Recent (Jan 2025):** Free lawyer-quality incorporation product. "Entire back-office setup (banking, payroll, accounting, taxes) in under 2 hours."

**Hiring signals:**
- Senior backend engineers (Node.js, Postgres) — payments/banking scale
- Engineering, Finance, Operations roles open

**Likely next:**
- Deeper legal operations (general counsel features)
- Possibly cap table / equity management (currently a clear gap)
- International expansion remains absent from roadmap signals

---

## 14. Weaknesses, gaps, and strategic openings

1. **US-only.** No international entity setup, no foreign payroll processors. Cannot follow a founder expanding to UAE, UK, Singapore, or India.
2. **No cap table / equity management.** Cannot be the "single pane of glass" — Carta remains essential for customers.
3. **No QuickBooks/Xero integrations.** Closed-loop positioning; founders with legacy accounting have to migrate.
4. **AI narrative is oversold.** Transaction categorization + automation; no autonomous agents, no copilot, no predictive features. An AI-agent-first competitor (Octa model) can leapfrog positioning.
5. **Tax complexity ceiling.** In-house CPA team cannot handle multi-entity, fund structures, or international tax.
6. **Human-capital bottleneck.** Dedicated bookkeeper + CPA per customer does not scale past roughly 500–1,000 customers without major ops expansion or margin erosion.
7. **Single banking partner risk.** Thread Bank enforcement order is live; no backup partner.
8. **ICP narrow.** YC-heavy (~50%) means limited testing outside US founder culture; unclear if the ICP translates globally.

---

## 15. Key metrics summary

| Metric | Value |
|--------|-------|
| Total raised | $32.1M |
| Latest valuation (post-money) | ~$112.5M |
| Estimated ARR (Oct 2024) | $6.4M |
| Revenue multiple | ~17.6× |
| Customers | 150+ |
| Team size | 154 |
| YoY revenue growth | 42% |
| % on full suite | 78% |
| % YC network | ~50% |
| Payroll processed | $60M+ LTD |

---

## 16. Strategic implications for mugdm

1. **The business model is a banking wedge, not an AI platform.** Free incorporation acquires the customer; the Thread Bank deposit relationship is the monetization hub; everything else is margin-stacking on top. Any mugdm copy needs an equivalent wedge — free incorporation (Saudi PRO / ADGM / DIFC) + a card/deposit partner is the obvious analog.

2. **"AI-native" is underdelivered.** Every's actual AI is transaction categorization. A mugdm offering with real agentic workflows (Octa-style collections agent, compliance agent, tax filing agent) could credibly own the AI-native narrative they can't.

3. **The human + AI hybrid is their scaling ceiling.** Dedicated bookkeeper + CPA per customer caps them around 500–1,000 customers before ops breaks. A more automated design (MENA-staffed, agent-assisted) could be structurally more scalable.

4. **US-only is the biggest strategic opening.** Every cannot follow any customer outside the US. A MENA-native platform serving GCC entities (Zakat, VAT-by-country, WPS, Saudization/Nitaqat, Emiratization, Shariah-compliant treasury via Tam Capital) is in a market they structurally cannot enter.

5. **They have no cap table layer.** Every customer still needs Carta. A mugdm offering that includes cap table + SAFE management (especially for MENA-specific instruments like Shariah-compliant SAFEs) captures a real gap.

6. **The Tam Capital relationship is a structural advantage Every doesn't have.** Every bolts on Atomic Invest — a generic RIA. Tam as a captive investment partner would be a real moat if the relationship is exclusive and deeply integrated into product.

7. **Valuation is reasonable.** 17.6× revenue on 42% YoY growth is fair. It's not a bubble number — meaning the model is investable and replicable at reasonable valuations in MENA.

---

## Sources

Full list of 40 sources compiled from Every.io direct pages, TechCrunch, Y Combinator, Crunchbase, PitchBook, LinkedIn, PYMNTS, Banking Dive, PR Newswire, SiliconAngle, Fast Company, Trustpilot, Atomic Invest, Globy, American Bazaar Online, and supporting fintech press. Available in the agent research log.

---

*End of dossier.*
