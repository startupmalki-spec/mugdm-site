# Task ID: 23

**Title:** Build Dashboard Shell

**Status:** pending

**Dependencies:** 6, 7, 17

**Priority:** high

**Description:** Create the main /app dashboard page with compliance overview, financial summary cards, document status, AI warnings section, and quick-action prompts.

**Details:**

Create /app/page.tsx (dashboard):
- Welcome header: 'Welcome back, [Business Name]' with logo
- Compliance overview card: next upcoming obligation, days until due, summary counts (upcoming/due soon/overdue)
- Document status card: 'X current, Y expiring soon, Z expired' with link to vault
- Financial summary card (placeholder until bookkeeper tasks): Money In, Money Out, Net Position this month
- AI Warnings section: 'Attention' panel showing dependency warnings from task 22 (empty state if none)
- Quick actions: 'Upload a document', 'Add a transaction', 'View calendar'
- Welcome state for new users: prompts for 'Upload your first document' and 'Connect your bank statements'

Bilingual. Responsive grid layout. Use design tokens.

**Test Strategy:**

View dashboard with sample data. Verify all cards show correct numbers. Verify quick actions navigate correctly. Verify welcome state for new user with no data.
