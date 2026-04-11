# Task ID: 30

**Title:** Build Financial Dashboard with Charts

**Status:** pending

**Dependencies:** 27, 29

**Priority:** high

**Description:** Create the financial dashboard at /app/bookkeeper with summary cards (Money In, Money Out, Net, Upcoming Payments), category pie chart, monthly trend bar chart, cash flow line chart, and period selector.

**Details:**

Create /app/bookkeeper/page.tsx dashboard section:

Summary cards:
- Money In: total income for selected period
- Money Out: total expenses for selected period
- Net Position: income minus expenses
- Upcoming Payments: sum of upcoming government obligations from compliance calendar
- Receivables: placeholder (manual tracking, Phase 2)

Charts (using Recharts):
- Category breakdown: pie/donut chart of expense categories for current period
- Monthly trend: bar chart, income vs expenses, last 6 months
- Cash flow: line chart, running balance over time

Period selector: This month, Last 3 months, Last 6 months, This year, Custom range
All cards and charts update when period changes.

Only includes reviewed transactions (is_reviewed=true).
Empty state when no transactions.
Bilingual labels, SAR formatting, Arabic-Indic numerals in Arabic mode.

**Test Strategy:**

With sample transactions, verify all summary cards calculate correctly. Verify charts render with data. Change period, verify updates. Verify empty state. Test in both Arabic and English.
