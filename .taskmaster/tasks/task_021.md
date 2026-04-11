# Task ID: 21

**Title:** Build Email Reminder System

**Status:** pending

**Dependencies:** 17, 20

**Priority:** medium

**Description:** Create a cron job that sends email reminders at 30, 15, 7, and 1 day before obligation due dates. Includes obligation name, due date, document status, and 'Mark as done' link.

**Details:**

Create:
- src/app/api/cron/reminders/route.ts — API route triggered by cron
- Daily at 08:00 AST (05:00 UTC)
- For each obligation: check if reminder_30d/15d/7d/1d should be sent based on days until next_due_date
- Skip if already sent (flag = true) or obligation is completed
- Email content: obligation name, due date, days remaining, linked document status (valid/expiring/expired/none), 'Mark as done' button linking to /app/calendar
- Use Resend or Supabase email (evaluate)
- Set up Vercel Cron or Supabase pg_cron to trigger daily

Bilingual email templates (send in user's preferred language).
No duplicate emails — check flags before sending.

**Test Strategy:**

Manually trigger cron endpoint. Verify emails sent for obligations within reminder windows. Verify flags are set after sending. Trigger again, verify no duplicates.
