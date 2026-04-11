# Task ID: 7

**Title:** Set Up i18n Framework (Arabic + English)

**Status:** pending

**Dependencies:** 1, 6

**Priority:** high

**Description:** Configure next-intl for bilingual support. Set up Arabic RTL and English LTR layouts, language detection, toggle, and translation dictionaries.

**Details:**

Setup:
- next-intl configuration with App Router
- Locale detection from browser Accept-Language header, default to Arabic
- Language toggle component in header/settings
- Persist language preference in user settings (localStorage initially, Supabase later)
- Set dir='rtl' on <html> for Arabic, dir='ltr' for English
- Load Noto Sans Arabic font for Arabic text, Inter for Latin
- Use Tailwind logical properties throughout: ps/pe instead of pl/pr, ms/me instead of ml/mr

Create message files:
- messages/ar.json — Arabic translations
- messages/en.json — English translations
- Start with navigation, auth, onboarding, and common UI strings

Number formatting: Arabic-Indic numerals in Arabic mode, Western in English.
Date formatting: Gregorian primary, Hijri reference.

**Test Strategy:**

Toggle language. Verify all visible strings change. Verify RTL layout switches correctly. Verify font changes. Verify number formatting in both modes.
