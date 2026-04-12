# Mugdm Growth & Onboarding PRD — "From Landing to Loyal User"

## Overview
This PRD covers user acquisition, onboarding, engagement, and retention. The goal is to get Saudi business owners from "never heard of Mugdm" to "can't run my business without it" in under 7 days.

## Landing Page

### Current state
Complete with hero, features, process, why, contact, footer sections. Recently rebranded to "Your Business's Second Brain" positioning. English-only currently.

### Enhancements needed

#### 1. Arabic landing page
- Translate ALL landing page sections to Arabic using next-intl
- Create translation keys in messages/ar.json and messages/en.json for all landing page text
- Ensure RTL layout works for all landing sections
- Arabic-first: the default locale is Arabic, so the Arabic landing page is the primary version

#### 2. Pricing section
- Add a pricing section between "Why Mugdm" and "Contact"
- Tiers: Free (1 business, 50 AI calls/day, basic features), Pro (3 businesses, unlimited AI, all features, SAR 99/mo), Business (unlimited, priority support, SAR 299/mo)
- Highlight Pro as recommended
- Show annual pricing option (2 months free)

#### 3. Testimonials / Social proof
- Add testimonials section (can be placeholder for now)
- Show logos of Saudi entities (if partnerships exist)
- Counter stats: businesses served, documents processed, deadlines tracked

#### 4. Demo video / interactive tour
- Add a section with an embedded demo video or interactive product tour
- Show the actual product UI in action

## Signup & Onboarding

### Current state
Magic link auth → 3-step onboarding (upload CR → confirm profile → contact info). Recently enhanced with animated progress cards and feature highlights.

### Enhancements needed

#### 1. Faster time-to-value
- After CR upload, immediately show the user their extracted data and generated compliance calendar
- "Look what we found!" moment — show the AI extracting data in real-time
- Skip optional steps — let users go straight to dashboard after CR upload

#### 2. Guided first session
- After onboarding, show a guided tour of the dashboard
- Highlight key actions: "Upload your first document", "Check your compliance calendar", "Add a transaction"
- Checklist widget: "Getting Started" with 5 tasks that introduce core features

#### 3. Empty state education
- Every empty page (vault, bookkeeper, calendar, team) should have helpful content
- Not just "No data yet" — show what the feature does with example screenshots
- One-click demo data option: "See how it looks with sample data"

## Email & Notifications

### Current state
Notification preferences stored in settings, but NO emails are actually sent.

### Enhancements needed

#### 1. Transactional emails
- Welcome email after signup
- Magic link emails (Supabase handles this)
- Compliance reminder emails (7 days, 3 days, 1 day before deadline)
- Document expiry alerts
- Weekly business digest email

#### 2. Email service integration
- Integrate Resend (recommended) or SendGrid
- Create email templates matching Mugdm branding (dark theme, trust blue)
- Support both Arabic and English emails based on user preference

#### 3. Future: WhatsApp notifications
- WhatsApp Business API integration for Saudi users
- Send compliance reminders via WhatsApp
- Interactive WhatsApp messages: "Your CR expires in 7 days. Reply RENEW for help"

## Subscription & Payments

### Current state
No payment system. All features are free.

### Enhancements needed

#### 1. Stripe integration
- Stripe subscription management
- Support SAR currency
- Free trial: 14 days of Pro features
- Upgrade/downgrade/cancel flows
- Invoice generation for subscribers

#### 2. Usage tracking
- Track AI calls per business per day
- Track storage usage per business
- Show usage dashboard in settings
- Enforce limits on free tier

## Analytics & Growth

#### 1. User analytics
- Track key events: signup, onboarding completion, first document upload, first transaction, daily active usage
- Funnel analysis: landing → signup → onboarding → first value moment
- Retention tracking: 7-day, 30-day, 90-day retention

#### 2. Referral system (future)
- "Invite a business owner" referral link
- Reward: 1 month free Pro for both referrer and referee
- Track referral conversions

## Technical Requirements
- Resend or SendGrid for transactional emails
- Stripe for payments (SAR support)
- PostHog or Mixpanel for analytics (self-hosted PostHog recommended)
- Rate limiting per subscription tier
- GDPR/PDPL compliance for all data collection
