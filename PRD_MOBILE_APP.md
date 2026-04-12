# Product Requirements Document: Mugdm Mobile App

**Document Version**: 1.0
**Date**: 2026-04-12
**Product**: Mugdm Mobile App
**Status**: Ideation / Pre-Design

---

## Executive Summary

Mugdm is a "Data Wallet" platform for Saudi micro-enterprises, currently deployed as a Next.js web application. Over 70% of the target user base (non-tech-savvy Saudi entrepreneurs managing 1-5 businesses) access the platform primarily from mobile devices. The current responsive web experience is functional but lacks push notifications, native camera integration, app store presence, and biometric authentication -- all critical for this audience.

This PRD recommends a **Capacitor-first approach**: wrap the existing Next.js web app in a native shell for Phase 1, add native enhancements in Phase 2, and evaluate a full React Native rewrite only if Capacitor performance proves insufficient. This gets Mugdm into the App Store and Google Play in 2-3 weeks instead of 2-3 months, while preserving the existing codebase investment.

---

## Problem Statement

### What users experience today

1. **No push notifications**: Users miss compliance deadlines because they must actively log in to check. Saudi government penalties for late GOSI, VAT, or CR renewal are steep (SAR 10,000+ per violation). Push notifications are the single highest-impact mobile feature.

2. **Clunky receipt capture**: The web-based `react-dropzone` component requires users to open the camera app, take a photo, navigate back to the browser, and upload the file. A native camera integration reduces this to a single tap.

3. **No app store presence**: Saudi users trust apps they find in the App Store. "Just use the website" is not a compelling pitch when competitors have native apps. App store presence is a marketing and trust requirement, not just a technical one.

4. **Re-authentication friction**: Magic links require switching to the email app every session. On mobile, this is especially painful -- users lose context, links expire, and email apps are slow. Password auth (BRD Feature 2) partially solves this; biometric auth completes the solution.

5. **No offline access**: Users in areas with poor connectivity (common in Saudi secondary cities) cannot access their business data at all.

### What this costs the business

- **User drop-off**: Estimated 15-20% of signups abandon after first magic link login on mobile due to friction.
- **Missed compliance alerts**: Users who miss deadlines blame the platform, not themselves. This drives churn.
- **Competitive disadvantage**: Competitors with native apps rank higher in app store search, which is the primary discovery channel in Saudi Arabia.

---

## Target Users

### Primary Persona: Abu Mohammed

- **Age**: 28-45
- **Device**: Samsung Galaxy A-series (mid-range Android), some iPhone users
- **Tech comfort**: Uses WhatsApp, banking apps, and Absher (Saudi government app) daily. Not comfortable with "web apps" as a concept.
- **Language**: Arabic primary, some English. Expects full RTL support.
- **Businesses**: 1-3 (usually a main business + a side venture)
- **Key pain**: Government compliance deadlines. "I just need someone to remind me before I get fined."

### Secondary Persona: Sara

- **Age**: 22-35
- **Device**: iPhone 13+
- **Tech comfort**: Higher than Abu Mohammed. Active on social media, uses multiple SaaS tools.
- **Language**: Bilingual Arabic/English.
- **Businesses**: 1 (often an e-commerce or creative business)
- **Key pain**: Financial visibility. "I don't know if my business is actually making money."

### Device Distribution (Estimated)

| Platform | Share | Key Devices |
|---|---|---|
| Android | 55-60% | Samsung Galaxy A14, A34, A54; Huawei Nova series |
| iOS | 40-45% | iPhone 13, 14, 15 series |

---

## User Journeys

### Journey 1: First-Time Mobile User

```
1. User discovers Mugdm in App Store / Google Play
2. Downloads app (< 50MB)
3. Opens app -> sees landing screen with "Sign up" / "Log in"
4. Taps "Sign up" -> enters email -> receives magic link
5. Opens magic link in email -> app intercepts deep link -> user is authenticated
6. Onboarding: uploads CR photo using native camera
7. CR is analyzed (Opus model) -> business profile populated
8. Prompted to set password + enable biometric auth
9. Prompted to enable push notifications
10. Lands on dashboard with obligations, insights, and quick actions
```

**Critical moments**: Steps 5 (deep link must work), 6 (camera must be smooth), 8-9 (must not feel like a wall of permission requests).

### Journey 2: Daily Check-In

```
1. User opens app -> biometric auth (< 1 second)
2. Dashboard shows: 2 obligations due this week, 3 new insights
3. User taps an obligation -> sees details and "Mark as Done"
4. Push notification arrives: "Your CR expires in 28 days. Tap to renew."
5. User taps notification -> deep links to the vault document page
```

### Journey 3: Receipt Capture on the Go

```
1. User receives a paper receipt at a store
2. Opens Mugdm app -> taps "Scan Receipt" from bottom nav
3. Camera viewfinder opens with document edge detection
4. User captures photo -> auto-cropped and enhanced
5. AI analyzes receipt (Haiku model) -> extracts amount, vendor, category
6. User confirms or edits -> transaction saved to bookkeeper
```

### Journey 4: Offline Access

```
1. User is in a location with no connectivity
2. Opens app -> sees cached dashboard with last-synced data
3. "Last updated 2 hours ago" indicator shown
4. User can browse obligations, transactions, documents (read-only)
5. When connectivity returns, app syncs in background
```

---

## Feature Prioritization (MoSCoW)

### Must Have (Phase 1 -- Capacitor MVP)

| Feature | Rationale |
|---|---|
| Native app shell (iOS + Android) | App store presence is the primary goal |
| Push notifications | Highest-impact feature for compliance alerts |
| Deep link handling | Magic link auth must work inside the app |
| Password login + biometric auth | Eliminates the biggest mobile login friction |
| Basic camera integration | Receipt scanning from within the app |
| Bottom tab navigation | Mobile-appropriate navigation pattern |
| Arabic RTL support | Non-negotiable for Saudi market |

### Should Have (Phase 2 -- Native Enhancements)

| Feature | Rationale |
|---|---|
| Offline data caching | Important for users in low-connectivity areas |
| Document edge detection on camera | Improves receipt/document scan quality |
| Background sync for uploads | Large PDF uploads fail on flaky connections |
| Haptic feedback on actions | Polish that signals "native" quality |
| iOS home screen widget | Upcoming obligation at a glance |

### Could Have (Phase 3 -- If Capacitor Insufficient)

| Feature | Rationale |
|---|---|
| React Native rewrite | Only if Capacitor performance is unacceptable |
| Native animations/transitions | React Native provides smoother 60fps animations |
| Custom native UI components | If web-based components feel "off" |

### Won't Have (Out of Scope)

| Feature | Rationale |
|---|---|
| Apple Watch / WearOS app | Too small an audience to justify |
| Tablet-optimized layout | Desktop web serves this need |
| In-app payments (IAP) | Stripe web billing is sufficient; IAP adds 30% Apple/Google tax |
| Chat with other users | Mugdm is a data tool, not a communication platform |

---

## Technical Architecture Decision

### Recommended: Capacitor (Phase 1)

**What Capacitor does**: Wraps the existing Next.js web app in a native WebView, then provides JavaScript bridges to native device APIs (camera, push notifications, biometrics, filesystem).

**Why Capacitor over alternatives**:

#### vs. React Native (Expo)

| Factor | Capacitor | React Native |
|---|---|---|
| Time to MVP | 2-3 weeks | 2-3 months |
| Code reuse from web | ~95% (same Next.js app) | ~30% (business logic only, all UI rewritten) |
| Component rewrite needed | None (existing Radix UI + Tailwind works) | Every component (Radix has no RN equivalent) |
| Native performance | Good for content apps, adequate for Mugdm | Excellent, true native rendering |
| Team skill required | Existing web team can ship | Needs React Native experience |
| Native API access | Via Capacitor plugins (push, camera, bio) | Full native module access |
| App store approval | Yes | Yes |
| Risk | WebView performance on low-end Android | 2-3 month timeline risk, scope creep |

**The decisive factor**: Mugdm is a content/data management app, not a game or social media feed. It does not need 60fps scroll performance or complex gesture handling. The screens are forms, tables, charts (Recharts), and document viewers. A WebView handles this well.

Rewriting every component in React Native -- including all Radix UI primitives, the Tailwind design system, the `next-intl` i18n setup, the Supabase auth flow, and the chat streaming UI -- would take 2-3 months minimum and introduce a separate codebase to maintain indefinitely.

#### vs. PWA Enhancement

| Factor | Capacitor | PWA |
|---|---|---|
| Push notifications on iOS | Yes | No (Apple does not support Web Push reliably) |
| App Store presence | Yes | No |
| Camera API quality | Native quality via plugin | Limited, no edge detection |
| Biometric auth | Yes, via plugin | No |
| Install friction | Standard app install | "Add to Home Screen" (users don't know how) |

**The decisive factor**: No iOS push notifications is a dealbreaker. Over 40% of the user base is on iPhone, and push notifications are the highest-impact mobile feature.

### Architecture Overview

```
+--------------------------------------------------+
|                  Mobile App Shell                  |
|                   (Capacitor)                      |
|                                                    |
|  +----------------------------------------------+  |
|  |           Next.js Web App (WebView)          |  |
|  |                                              |  |
|  |  Existing pages, components, API routes      |  |
|  |  Radix UI + Tailwind + Framer Motion         |  |
|  |  next-intl (ar/en) + Supabase client         |  |
|  +----------------------------------------------+  |
|                                                    |
|  +----------------------------------------------+  |
|  |          Capacitor Plugin Bridge              |  |
|  |                                              |  |
|  |  @capacitor/push-notifications               |  |
|  |  @capacitor/camera                           |  |
|  |  @capacitor-community/biometrics             |  |
|  |  @capacitor/app (deep links)                 |  |
|  |  @capacitor-community/sqlite (Phase 2)       |  |
|  +----------------------------------------------+  |
|                                                    |
|  +-------------------+  +----------------------+  |
|  |    iOS Native     |  |   Android Native     |  |
|  |  (Swift/Obj-C)    |  |   (Kotlin/Java)      |  |
|  |  APNs for push    |  |   FCM for push       |  |
|  |  Keychain for     |  |   Keystore for       |  |
|  |  session tokens   |  |   session tokens     |  |
|  +-------------------+  +----------------------+  |
+--------------------------------------------------+
```

### What Changes in the Web App

Minimal changes required for Capacitor compatibility:

1. **Navigation**: Detect Capacitor environment (`Capacitor.isNativePlatform()`) and render a bottom tab bar instead of the sidebar. The existing sidebar remains for desktop web.

2. **Camera integration**: The existing `ReceiptCapture.tsx` component gets a Capacitor branch: if native, use `@capacitor/camera`; if web, use existing `react-dropzone`.

3. **Auth flow**: Deep link handler in `capacitor.config.ts` to intercept magic link callbacks. Biometric auth wraps the existing password login.

4. **Push notifications**: Register for push on app startup; send device token to Supabase (new `device_tokens` table). Backend sends push via FCM/APNs when obligations or documents approach deadlines.

5. **Safe area handling**: Add CSS `env(safe-area-inset-*)` padding for notched devices. Most of this is handled by Capacitor's `StatusBar` and `SafeArea` plugins.

---

## Figma-First Workflow

### Why Design Before Code

The mobile app introduces UI patterns that do not exist in the current web app: bottom navigation, swipe gestures, camera viewfinder overlays, push notification opt-in screens, and compact card layouts. Building these without design review risks rework.

### Design Deliverables

| Screen | Key Design Decisions |
|---|---|
| Bottom tab bar | Which 4-5 tabs? Proposal: Dashboard, Bookkeeper, Vault, Chat, More |
| Dashboard (mobile) | Compact obligation cards, swipeable insights carousel |
| Bookkeeper (mobile) | Transaction list with swipe-to-categorize, FAB for "add transaction" |
| Vault (mobile) | Document grid with expiry badges, camera FAB for quick scan |
| Receipt capture | Camera viewfinder with edge detection overlay, auto-crop preview |
| Chat (mobile) | Full-screen chat with floating keyboard, attachment button for receipts |
| Push notification opt-in | Friendly permission prompt explaining value before system dialog |
| Biometric auth prompt | Face ID / fingerprint prompt on app open |
| Onboarding (mobile) | Simplified flow optimized for thumb reach |
| Settings (mobile) | Grouped list with password, biometric toggle, notification preferences |

### Design Review Process

1. Designer creates screens in Figma with both LTR (English) and RTL (Arabic) variants.
2. Product review: ensure all user journeys are covered.
3. Engineering review: flag anything that Capacitor's WebView cannot render well.
4. Usability testing: 3-5 target users test the Figma prototype on their actual phones.
5. Approved designs become the implementation spec.

---

## Shipping Strategy

### Phase 1: Capacitor MVP (Weeks 1-3)

**Goal**: Get Mugdm into the App Store and Google Play with push notifications.

| Week | Deliverables |
|---|---|
| Week 1 | Capacitor project setup, deep link handling, bottom tab navigation, push notification registration |
| Week 2 | Camera integration for receipts, biometric auth, safe area handling, RTL testing |
| Week 3 | App Store / Play Store submission, TestFlight beta for 10 users, bug fixes |

**What ships**: The existing web app in a native shell with push notifications, camera for receipts, biometric login, and bottom tab navigation. All existing features (dashboard, bookkeeper, vault, chat, calendar, team, billing) work as-is inside the WebView.

**What does NOT ship**: Offline mode, widgets, background sync, edge detection.

### Phase 2: Native Enhancements (Weeks 4-8)

**Goal**: Features that require native capabilities beyond what the WebView provides.

| Week | Deliverables |
|---|---|
| Week 4-5 | Offline data caching via SQLite, background sync for uploads |
| Week 6 | Document edge detection on camera, haptic feedback |
| Week 7 | iOS home screen widget (next obligation) |
| Week 8 | Performance optimization, Lighthouse audit, app store rating prompt |

### Phase 3: Evaluate React Native (Month 3+)

**Gate criteria** -- consider React Native rewrite ONLY if:

- [ ] App store reviews consistently mention "slow" or "feels like a website" (> 20% of reviews).
- [ ] Time to interactive on Samsung Galaxy A14 exceeds 3 seconds.
- [ ] Scroll performance on transaction list drops below 30fps.
- [ ] User retention on mobile is significantly lower than desktop (> 15% gap).

If none of these gates are triggered, Capacitor remains the long-term solution. Many successful apps (Basecamp, Discourse, Ionic apps) run in WebViews indefinitely.

---

## Timeline

```
Week 0         Figma design sprint (can start immediately)
                |
Week 1-3       Phase 1: Capacitor MVP
                |
Week 3         App Store / Play Store submission
                |
Week 4-8       Phase 2: Native enhancements
                |
Month 3+       Phase 3: React Native evaluation (only if gates triggered)
```

**Total time to app store**: ~4 weeks (1 week design + 3 weeks development). Compare to React Native: ~12-14 weeks (2 weeks design + 8-10 weeks development + 2 weeks app store review buffer).

---

## Risks

### R1: WebView Performance on Low-End Android (Medium Risk)

**Impact**: Sluggish experience on Samsung Galaxy A14 and similar devices with 3-4GB RAM.
**Mitigation**: Profile on a real A14 during Phase 1. If time-to-interactive exceeds 3 seconds, aggressively optimize: reduce JavaScript bundle size, lazy-load non-critical routes, reduce Framer Motion animations on mobile.
**Fallback**: Phase 3 React Native rewrite.

### R2: App Store Rejection (Low Risk)

**Impact**: Delays launch by 1-2 weeks per rejection cycle.
**Mitigation**: Apple sometimes rejects "thin" WebView apps that add no native value. Capacitor apps with push notifications, camera, and biometrics have sufficient native functionality to pass review. Include a clear app description emphasizing the native features.
**Fallback**: Add more native-feeling UI elements (splash screen, native alerts) if initial submission is rejected.

### R3: Deep Link Handling Across Platforms (Medium Risk)

**Impact**: Magic link authentication fails when the user clicks the email link on a device with the app installed.
**Mitigation**: Use Universal Links (iOS) and App Links (Android) to intercept Supabase auth callback URLs. Test extensively with both the app installed and not installed. Provide a fallback "Open in browser" option.

### R4: Push Notification Opt-In Rate (Medium Risk)

**Impact**: If users decline push notifications, the primary mobile value proposition is lost.
**Mitigation**: Show a custom pre-permission screen explaining the value ("We'll remind you before government deadlines so you never get fined") before triggering the system permission dialog. Apps that explain value before asking see 40-60% opt-in rates vs. 30-40% for immediate system prompts.

### R5: Maintaining Two Navigation Patterns (Low Risk)

**Impact**: Bottom tab bar on mobile + sidebar on desktop increases UI maintenance burden.
**Mitigation**: Both patterns share the same route structure and page components. Only the navigation shell differs. Detect platform with `Capacitor.isNativePlatform()` or viewport width. This is a one-time implementation cost.

### R6: Arabic RTL in Native Shell (Low Risk)

**Impact**: Visual glitches with RTL text in WebView or native components.
**Mitigation**: The existing web app already has full RTL support via `next-intl` and Tailwind's `rtl:` variant. Capacitor's WebView inherits all CSS direction settings. Test specifically: swipe gestures, bottom tab icon order, and system alert text direction.

---

## Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| App store rating | >= 4.0 stars | App Store Connect / Google Play Console |
| Push notification opt-in rate | >= 50% | PostHog event tracking |
| Mobile user retention (D7) | >= 40% (vs current web ~30%) | PostHog cohort analysis |
| Time to interactive (Galaxy A14) | < 3 seconds | Lighthouse / manual profiling |
| Receipt scan success rate | >= 90% AI confidence | `ai_usage_log` aggregate |
| App store installs (Month 1) | 500+ | Store analytics |
| Compliance deadline miss rate | 30% reduction vs web-only | Obligation completion tracking |

---

## Open Questions

1. **Capacitor SSR compatibility**: Next.js 16 uses React Server Components. Need to verify that Capacitor's WebView can hydrate RSC output correctly, or whether the app needs to run in SPA/client-only mode. This is a Week 1 spike.

2. **Push notification backend**: Should push notifications be sent from a Supabase Edge Function (cron-based, checks obligations daily) or from a separate worker? Edge Functions are simpler but have a 60-second execution limit.

3. **App store metadata localization**: Should the app store listing be in Arabic only, English only, or both? Recommendation: Arabic primary with English as secondary locale.

4. **In-app update mechanism**: How do we push web app updates to the Capacitor shell without requiring an app store update? Capacitor Live Update (Appflow) is an option but adds cost.

5. **Multi-business switching**: The current web app supports users with multiple businesses. On mobile, how should business switching work in the bottom tab bar context? Recommendation: business selector in the "More" tab or a swipe-down gesture on the dashboard.
