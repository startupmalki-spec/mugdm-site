# Task ID: 19

**Title:** Build Calendar Month View with Hijri Dates

**Status:** pending

**Dependencies:** 18

**Priority:** medium

**Description:** Create a traditional monthly calendar grid showing obligations on their due dates, with Hijri reference dates and navigation between months.

**Details:**

Add month view tab to /app/calendar:
- Calendar grid: 7 columns (Sat-Fri for Arabic locale, Sun-Sat for English)
- Each cell shows: Gregorian date, small Hijri reference date below
- Cells with obligations show colored dots (green/yellow/red)
- Click a date → shows obligations due that day in a popover or bottom sheet
- Month navigation: previous/next arrows, month/year header
- Today highlighted
- Hijri conversion using a library (e.g., hijri-converter or custom implementation with date-fns)

Bilingual month names. RTL grid for Arabic.

**Test Strategy:**

Navigate to current month. Verify today is highlighted. Verify Hijri dates are accurate. Click a date with obligations, verify popover shows them. Navigate to next/previous month.
