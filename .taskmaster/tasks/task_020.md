# Task ID: 20

**Title:** Build Obligation CRUD (Create, Complete, Recurring)

**Status:** pending

**Dependencies:** 18

**Priority:** high

**Description:** Implement obligation management: manual creation of custom obligations, marking obligations complete (with recurring generation), and undo completion.

**Details:**

Add to calendar page:
- 'Add Obligation' button → form: name, description, due date, frequency (one-time/monthly/quarterly/annual/custom)
- 'Mark as done' on any obligation:
  - Sets last_completed_at = now()
  - If recurring: auto-generates next instance (next_due_date calculated from frequency)
  - Monthly: +1 month. Quarterly: +3 months. Annual: +1 year.
  - Resets all reminder flags on the new instance
- Undo completion: within 24 hours, restore previous state
- Edit obligation: name, description, due date, notes
- Delete custom obligations (not auto-generated ones)

Bilingual form labels and validation messages.

**Test Strategy:**

Create a custom monthly obligation. Mark it done. Verify next month's instance is auto-created. Undo completion within 24 hours. Try to delete an auto-generated obligation (should be prevented).
