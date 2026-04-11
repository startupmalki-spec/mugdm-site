# Task ID: 8

**Title:** Update Landing Page for Product Positioning

**Status:** pending

**Dependencies:** 7

**Priority:** medium

**Description:** Rewrite the landing page sections (Hero, Services, Process, Why, Contact) from 'AI Software Studio' to Mugdm product marketing: features, benefits, signup CTA targeting Saudi micro-entrepreneurs.

**Details:**

Update each section:
- Hero: 'Everything your business needs in one app' / 'كل ما يحتاجه عملك في تطبيق واحد'. Signup CTA button. Value prop: Profile + Vault + Calendar + Bookkeeper.
- Services → Features: 4 cards for Business Profile, Document Vault, Compliance Calendar, AI Bookkeeper with Arabic/English descriptions
- Process → How It Works: 3 steps (Upload CR → AI sets up your profile → Start managing)
- Why → Why Mugdm: Free beta, bilingual, AI-powered, built for Saudi regulations
- Contact → Early Access: Email signup form for beta waitlist

Update metadata in layout.tsx: title, description, OG tags for product positioning.
Make bilingual using i18n framework from task 7.
Keep existing design tokens and visual style.

**Test Strategy:**

Visual review in both Arabic and English. Verify CTA button links to /signup. Verify responsive layout on mobile.
