# MUGDM.COM — DESIGN & UI GUIDE

> This file lives in the project root. Every Claude Code session working on mugdm MUST read and follow these guidelines. Do not deviate without explicit user approval.

## Product Context

mugdm.com is a **Data Wallet** for small entrepreneurs in Saudi Arabia. Users upload their Commercial Registration (CR), track regulatory compliance deadlines, and manage bookkeeping/accounting. The app is bilingual (Arabic default + English) with full RTL support.

**Target user**: A Saudi entrepreneur who is not tech-savvy, manages 1-5 businesses, and needs to stay compliant without hiring a compliance officer. They use their phone 70%+ of the time.

---

## Color Palette

### Primary Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `--color-primary` | `#1E40AF` | Primary actions, links, active nav states. Deep trust blue. |
| `--color-primary-light` | `#3B82F6` | Hover states, secondary buttons |
| `--color-primary-dark` | `#1E3A8A` | Pressed states, headings |

### Status Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `--color-valid` | `#16A34A` | Compliant, valid, success states |
| `--color-warning` | `#D97706` | Expiring within 30 days, needs attention |
| `--color-danger` | `#DC2626` | Overdue, expired, action required |
| `--color-info` | `#0EA5E9` | Informational badges, tips |

### Neutral Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `--color-bg` | `#F8FAFC` | Page background (light mode) |
| `--color-bg-dark` | `#0F172A` | Page background (dark mode) |
| `--color-surface` | `#FFFFFF` | Cards, panels (light mode) |
| `--color-surface-dark` | `#1E293B` | Cards, panels (dark mode) |
| `--color-text` | `#1F2937` | Primary text (light mode) |
| `--color-text-dark` | `#F3F4F6` | Primary text (dark mode) |
| `--color-text-muted` | `#6B7280` | Secondary text, labels |
| `--color-border` | `#E5E7EB` | Borders, dividers |

### Rules
- Never use pure black (#000000) or pure white (#FFFFFF) for backgrounds
- Status colors are semantic — green ONLY for valid/compliant, yellow ONLY for warnings, red ONLY for errors/overdue
- Primary blue conveys trust — use it for all primary CTAs

---

## Typography

### Fonts
- **Arabic**: `Almarai` (Google Fonts) — clean, modern, excellent screen rendering
- **English**: `Inter` (Google Fonts) — pairs well with Almarai, excellent for data
- **Monospace/Numbers**: `Tabular Lining` from Inter — for financial figures, dates

### Scale
| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| Display | 30px / 1.875rem | 700 | Dashboard hero numbers (total income, compliance %) |
| H1 | 24px / 1.5rem | 700 | Page titles |
| H2 | 20px / 1.25rem | 600 | Section headers, card titles |
| H3 | 16px / 1rem | 600 | Subsection headers |
| Body | 14px / 0.875rem | 400 | Default text |
| Small | 12px / 0.75rem | 400 | Labels, captions, timestamps |

### Rules
- Never bold Arabic text excessively — Arabic script is inherently detailed
- Never use italics for Arabic — it doesn't exist in the script
- Financial numbers always use tabular lining (monospace digits) so columns align
- Mixed Arabic/English content: ensure proper `dir` attributes on inline elements

---

## Layout & Components

### Dashboard — Card-Based Architecture
Every dashboard uses a card grid. Each card is self-contained with: Icon + Title, Big number (Display size), Label (Small size, muted), Delta indicator (green/red).

**Standard dashboard cards for mugdm:**
1. **Compliance Status** — Progress ring showing % compliant. Green/yellow/red.
2. **CR Status** — Valid / Expiring Soon / Expired with countdown timer
3. **Upcoming Deadlines** — Next 3 deadlines with dates and countdown
4. **Financial Summary** — Total income, expenses, net (MTD)
5. **Recent Transactions** — Last 5 entries
6. **Document Vault** — Count of documents, quick upload action

### Compliance Status Visualization
- Use a circular progress ring (not a bar) for overall compliance %
- Individual requirements shown as a checklist with status badges
- Color coding: Green badge = "Valid", Yellow badge = "Renewing Soon", Red badge = "Action Required"
- Always show countdown: "Renews in 45 days" not just "Expires June 15"

### Sidebar Navigation
- **Position**: RIGHT side for RTL (Arabic default), LEFT for English
- **Width**: 260px desktop, full-screen drawer on mobile
- **Items**: Icon (20px) + Text label. Never icons alone.
- **Active state**: Primary blue background with white text
- **Structure**:
  1. Dashboard (LayoutDashboard icon)
  2. Compliance Tracker (ClipboardCheck icon)
  3. Document Vault (FolderLock icon)
  4. Bookkeeper (Calculator icon)
  5. Calendar (CalendarDays icon)
  6. Team (Users icon)
  7. Settings (Settings icon)

### Trust & Security Indicators
- Document Vault header: Show lock + "AES-256 Encrypted" badge
- Login screen: "Your data never leaves Saudi Arabia" (if applicable)
- Upload confirmations: "Securely stored" with lock icon
- Footer: Security certification badges

### Onboarding Flow (3-5 steps max)
1. **Welcome** — "Secure your business in 2 minutes" + language toggle
2. **Upload CR** — Drag-and-drop zone, accepted formats, progress bar
3. **Confirm Details** — AI-extracted CR data for user to verify/edit
4. **Set Reminders** — CR renewal date, notification preferences
5. **Done** — Redirect to dashboard with pre-populated data

---

## RTL / Arabic Implementation Rules

### CSS
- Use CSS Logical Properties EVERYWHERE: `margin-inline-start` not `margin-left`
- `padding-inline-end` not `padding-right`
- `border-inline-start` not `border-left`
- Set `dir="rtl"` on `<html>` for Arabic, `dir="ltr"` for English
- Flexbox and Grid auto-reverse with `dir` — no manual overrides needed

### Icons
- Navigation arrows: FLIP for RTL (back arrow points right)
- Universal icons (search, settings, close): DO NOT flip
- Progress indicators: Reverse direction (right-to-left fill)
- Checkmarks, plus signs, stars: DO NOT flip

### Text
- Use Modern Standard Arabic (MSA) for all app UI and legal text
- Numbers remain left-to-right even in Arabic context
- Email addresses, URLs, brand names: Always LTR with proper `dir="ltr"` wrapping
- Saudi business terminology over classical Arabic (e.g., سجل تجاري for CR)

### Mobile
- Primary action buttons in thumb zone (bottom-right for RTL)
- Swipe gestures reverse for RTL
- Test on actual devices, not just browser dev tools
- Bottom navigation bar for mobile (max 5 items)

---

## Design Principles (In Priority Order)

1. **Clarity over beauty** — If a user can't understand it in 2 seconds, simplify it
2. **Trust over flash** — Blues and greens, security badges, no playful animations
3. **Mobile-first** — Design for phone, enhance for desktop
4. **Localization-native** — Arabic is the default, not an afterthought
5. **Progressive disclosure** — Show what's needed now, hide the rest behind clicks
6. **Data density without clutter** — Cards with breathing room, not walls of text

---

## Anti-Patterns — DO NOT DO

- Never use pure black backgrounds or pure white text on dark mode
- Never use icons without text labels in navigation
- Never use italic text in Arabic
- Never use `margin-left` / `padding-right` (use logical properties)
- Never use fun/playful colors (orange, pink) for primary UI — this is a trust product
- Never have more than 6 cards on dashboard
- Never have more than 5 onboarding steps
- Never use generic placeholder content ("Lorem ipsum") — always use realistic Saudi business data
- Never put sidebar on the left in RTL mode
- Never show date formats without countdowns for compliance deadlines

---

## Reference Apps to Emulate

| App | What to borrow |
|-----|---------------|
| **Mercury** | Dashboard clarity, card layout, financial summary design |
| **Drata** | Compliance progress visualization, color-coded status system |
| **Qoyod** | Saudi business terminology, localized accounting UX |
| **FreshBooks** | Making accounting approachable for non-accountants |
| **Platforms Code (DGA)** | RTL implementation, government-grade bilingual design |

---

*Last updated: April 12, 2026*
*This guide is the single source of truth for mugdm UI decisions.*
