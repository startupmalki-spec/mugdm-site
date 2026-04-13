# Mugdm Testing Strategy

> Full-platform test plan covering unit, integration, and end-to-end testing.
> Last updated: 2026-04-13

---

## 1. Overview

Mugdm is a Next.js 16 + Supabase platform serving Saudi SMEs with bookkeeping, compliance tracking, document management, team/HR tools, and an AI assistant — all bilingual (AR/EN) with Hijri date support. This document defines **what to test**, **how to test it**, **coverage targets**, and provides **real test scaffolding** for every layer.

### Testing Pyramid

```
          ╱  E2E (Playwright)  ╲        ~10 tests — critical user journeys
         ╱  Integration (Vitest) ╲       ~25 tests — API routes, middleware, Supabase
        ╱   Unit Tests (Vitest)    ╲     ~80 tests — pure logic, calculations, rules
```

### Tooling

| Tool | Purpose |
|------|---------|
| **Vitest** | Unit + integration tests (fast, native ESM, TS-first) |
| **@testing-library/react** | Component rendering and interaction |
| **Playwright** | E2E browser tests (Chrome + Firefox) |
| **MSW (Mock Service Worker)** | API mocking for integration tests |

---

## 2. Module Map & Test Coverage Targets

### 2.1 Pure Logic (Unit Tests) — Target: 95%

These modules are pure functions with zero side effects. They are the highest-value, lowest-cost tests.

| Module | File | Key Functions | Priority |
|--------|------|---------------|----------|
| **Financial Calculations** | `src/lib/bookkeeper/calculations.ts` | `calculateSummary`, `calculateVATEstimate`, `calculateCategoryBreakdown`, `calculateMonthlyTrend`, `calculateCashFlow`, `formatSAR` | P0 |
| **VAT Report** | `src/lib/bookkeeper/vat-report.ts` | `generateVATReport` | P0 |
| **Profit & Loss** | `src/lib/bookkeeper/profit-loss.ts` | `generateProfitLoss`, `getCategoryLabel` | P0 |
| **GOSI Calculator** | `src/lib/team/gosi-calculator.ts` | `calculateGOSI`, `calculateTenure`, `getContractExpiryWarning` | P0 |
| **Compliance Rules Engine** | `src/lib/compliance/rules-engine.ts` | `getObligationStatus`, `generateObligations`, `getNextOccurrence` | P0 |
| **Duplicate Detection** | `src/lib/bookkeeper/duplicate-detection.ts` | `detectFuzzyDuplicates` | P0 |
| **Gov Payment Detection** | `src/lib/bookkeeper/gov-detection.ts` | `detectGovernmentPayment` | P0 |
| **Smart Categorizer** | `src/lib/bookkeeper/smart-categorizer.ts` | `categorizeTransaction` | P1 |
| **Recurring Detection** | `src/lib/bookkeeper/recurring-detection.ts` | `detectRecurringExpenses`, `calculateMonthlyRecurringCost` | P1 |
| **Cash Flow Forecast** | `src/lib/bookkeeper/forecast.ts` | `forecastCashFlow` | P1 |
| **Reconciliation** | `src/lib/bookkeeper/reconciliation.ts` | `reconcileTransactions` | P1 |
| **Validations** | `src/lib/validations.ts` | `isValidCRNumber`, `isValidIqama`, `isValidSaudiPhone`, `formatSaudiPhone`, `maskIqama`, `isSaudiNational` | P0 |
| **Hijri Dates** | `src/lib/hijri.ts` | `toHijri`, `formatHijri`, `toArabicNumerals` | P1 |
| **Utilities** | `src/lib/utils.ts` | `cn` (classname merge) | P2 |

### 2.2 API Routes (Integration Tests) — Target: 85%

| Route | File | What to Test |
|-------|------|-------------|
| **Document Analysis** | `src/app/api/analyze-document/route.ts` | Auth guard, file validation, AI call, response shape |
| **Receipt Analysis** | `src/app/api/analyze-receipt/route.ts` | Image validation, OCR response, error handling |
| **Chat** | `src/app/api/chat/route.ts` | Auth, message format, streaming response, rate limiting |
| **Chat Upload** | `src/app/api/chat/upload/route.ts` | File size limits, type validation |
| **Onboarding** | `src/app/api/onboarding/route.ts` | Business creation, CR validation |
| **Bank Statement Parse** | `src/app/api/parse-statement/route.ts` | CSV/PDF handling, transaction extraction |
| **File Upload** | `src/app/api/upload/route.ts` | Size limits, storage, auth |
| **Stripe Checkout** | `src/app/api/stripe/checkout/route.ts` | Session creation, plan mapping |
| **Stripe Webhook** | `src/app/api/stripe/webhook/route.ts` | Signature verification, subscription updates |
| **Usage Tracking** | `src/app/api/usage/route.ts` | Tier limits, count accuracy |
| **Rate Limiting** | `src/lib/rate-limit.ts` | Tier-based limits (free: 50, pro: 500, business: unlimited) |

### 2.3 Middleware (Integration) — Target: 90%

| Area | What to Test |
|------|-------------|
| **Auth Routing** | Unauthenticated → `/login`, authenticated on `/login` → `/dashboard` |
| **Locale Routing** | `/ar/*` and `/en/*` paths resolve correctly |
| **Public Paths** | `/`, `/terms`, `/privacy`, `/login`, `/signup` are accessible without auth |
| **Session Refresh** | `updateSession` is called on every request |

### 2.4 Frontend Components (Component Tests) — Target: 75%

| Component | File | What to Test |
|-----------|------|-------------|
| **TransactionForm** | `src/components/bookkeeper/TransactionForm.tsx` | Form validation, category selection, SAR formatting |
| **ReceiptCapture** | `src/components/bookkeeper/ReceiptCapture.tsx` | Camera/upload toggle, file type restrictions |
| **ReviewQueue** | `src/components/bookkeeper/ReviewQueue.tsx` | Approve/reject actions, empty state |
| **FileUpload** | `src/components/upload/FileUpload.tsx` | Drag-and-drop, file size error, accepted types |
| **Hero** | `src/components/sections/hero.tsx` | Renders AR/EN content, CTA links |
| **EmptyState** | `src/components/ui/empty-state.tsx` | Icon, title, description render |
| **Toast** | `src/components/ui/toast.tsx` | Show/dismiss, variants |

### 2.5 E2E (Playwright) — Critical Journeys

| Journey | Steps |
|---------|-------|
| **Signup → Onboarding** | Visit `/signup` → create account → fill CR number → complete onboarding → land on dashboard |
| **Login → Dashboard** | Visit `/login` → enter credentials → see dashboard with financials |
| **Upload Bank Statement** | Navigate to bookkeeper → upload CSV → review parsed transactions → approve |
| **Capture Receipt** | Bookkeeper → upload receipt photo → verify AI extraction → approve transaction |
| **Locale Switch** | Toggle AR ↔ EN → verify RTL layout, translated content, Hijri dates |
| **Compliance Calendar** | Visit calendar → see upcoming obligations → click one → see details |
| **Vault Upload** | Navigate to vault → upload document → verify it appears in list |
| **Team Management** | Visit team → add member → verify GOSI calculation displays |
| **Billing Flow** | Settings → billing → click upgrade → verify Stripe redirect |
| **Chat Assistant** | Open floating assistant → send message → receive streamed response |

---

## 3. Saudi-Specific Test Cases

These are domain-specific tests unique to the Saudi regulatory environment:

### 3.1 VAT (15%)
- Verify 15% rate applied to taxable transactions
- Verify GOVERNMENT, SALARY, INSURANCE categories are VAT-exempt
- Verify VAT extraction from inclusive amounts: `amount * 0.15 / 1.15`
- Verify net VAT = output VAT - input VAT

### 3.2 GOSI Contributions
- Saudi employee: 10.5% employee share, 12.5% employer share
- Non-Saudi employee: 0% employee, 2% employer (occupational hazards only)
- Zero salary edge case returns all zeros

### 3.3 Compliance Obligations
- CR Confirmation: annual, based on `cr_issuance_date`
- GOSI: monthly on the 15th
- ZATCA VAT: quarterly on the 25th (Jan, Apr, Jul, Oct)
- Zakat: annual, 120 days after fiscal year end
- Status transitions: upcoming → due_soon (≤15 days) → overdue → completed

### 3.4 Government Payment Detection
- Exact-match patterns (confidence 1.0): "التأمينات الاجتماعية", "هيئة الزكاة"
- Keyword patterns (confidence 0.7): "gosi", "zatca", "balady"
- Mixed Arabic/English descriptions

### 3.5 Saudi Validations
- CR number: exactly 10 digits
- Iqama: 10 digits, starts with 1 (Saudi) or 2 (non-Saudi)
- Phone: +966XXXXXXXXX, 05XXXXXXXX, 5XXXXXXXX formats
- Hijri date conversion accuracy (known date pairs)

---

## 4. Security & Edge Cases

| Area | Test Cases |
|------|-----------|
| **Auth Guard** | All `/api/*` routes return 401 without valid session |
| **Rate Limiting** | Free tier blocked after 50 AI calls/day; pro after 500; business unlimited |
| **Input Sanitization** | SQL injection in search fields, XSS in transaction descriptions |
| **File Upload Limits** | Oversized files rejected, dangerous MIME types blocked |
| **Stripe Webhooks** | Invalid signature → 400, replay attack prevention |
| **CORS** | API routes don't respond to unauthorized origins |

---

## 5. i18n & RTL Testing

| Test | Details |
|------|---------|
| **All UI strings** | Every key in `messages/en.json` has a corresponding `messages/ar.json` entry |
| **RTL layout** | Arabic pages have `dir="rtl"`, number inputs remain LTR |
| **Hijri dates** | Arabic locale shows Hijri dates with Arabic numerals (٠-٩) |
| **SAR formatting** | `formatSAR(1234, 'ar')` uses Arabic-SA locale formatting |
| **Category labels** | P&L report shows Arabic labels when locale is `ar` |

---

## 6. Test File Structure

```
mugdm-site/
├── vitest.config.ts
├── playwright.config.ts
├── __tests__/
│   ├── unit/
│   │   ├── bookkeeper/
│   │   │   ├── calculations.test.ts
│   │   │   ├── vat-report.test.ts
│   │   │   ├── profit-loss.test.ts
│   │   │   ├── duplicate-detection.test.ts
│   │   │   ├── gov-detection.test.ts
│   │   │   ├── smart-categorizer.test.ts
│   │   │   ├── recurring-detection.test.ts
│   │   │   ├── forecast.test.ts
│   │   │   └── reconciliation.test.ts
│   │   ├── compliance/
│   │   │   └── rules-engine.test.ts
│   │   ├── team/
│   │   │   └── gosi-calculator.test.ts
│   │   ├── validations.test.ts
│   │   └── hijri.test.ts
│   ├── integration/
│   │   ├── api/
│   │   │   ├── analyze-document.test.ts
│   │   │   ├── onboarding.test.ts
│   │   │   ├── upload.test.ts
│   │   │   └── rate-limit.test.ts
│   │   └── middleware.test.ts
│   └── e2e/
│       ├── auth-flow.spec.ts
│       ├── bookkeeper-flow.spec.ts
│       ├── locale-switch.spec.ts
│       ├── compliance-calendar.spec.ts
│       └── billing-flow.spec.ts
```

---

## 7. CI/CD Integration

```yaml
# Suggested GitHub Actions workflow
name: Test Suite
on: [push, pull_request]
jobs:
  unit-integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx vitest run --coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/

  e2e:
    runs-on: ubuntu-latest
    needs: unit-integration
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 8. Coverage Targets Summary

| Layer | Target | Metric |
|-------|--------|--------|
| Pure logic (unit) | 95% | Line coverage |
| API routes (integration) | 85% | Branch coverage |
| Middleware | 90% | Branch coverage |
| Components | 75% | Line coverage |
| E2E critical paths | 100% of journeys listed | Pass/fail |
| Overall | 85% | Line coverage |
