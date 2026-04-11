# Task ID: 18

**Title:** Build Calendar List View (Next 30 Days)

**Status:** pending

**Dependencies:** 6, 7, 17

**Priority:** high

**Description:** Create the default compliance calendar view at /app/calendar showing obligations due within 30 days, with status badges and summary bar.

**Details:**

Create /app/calendar/page.tsx with list view as default:
- Fetch obligations where next_due_date is within 30 days of today
- Sort by due date ascending
- Each item shows: name, due date (Gregorian + Hijri), days remaining, status badge, linked document name (if any)
- Status badges: green (>15 days), yellow (<=15 days), red (overdue), checkmark (completed)
- Summary bar at top: 'X upcoming, Y due soon, Z overdue'
- Click item → expand to show description, notes, linked document link, 'Mark as done' button
- Empty state: 'No obligations in the next 30 days. You're all caught up!'
- Tab toggle between List View and Month View (task 19)

Bilingual. Responsive — full width on mobile, card layout on desktop.

**Test Strategy:**

With sample obligations at various dates, verify correct filtering (30-day window). Verify status badges match date logic. Verify summary counts are accurate. Verify empty state.
