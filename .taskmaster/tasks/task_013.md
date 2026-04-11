# Task ID: 13

**Title:** Build Team Member Management

**Status:** pending

**Dependencies:** 2, 6

**Priority:** medium

**Description:** Create /app/team page for adding, editing, and managing team members with Iqama validation and Saudization ratio display.

**Details:**

Create /app/team/page.tsx:
- Team member list: name, role, nationality, status badge (Active/Terminated)
- Add member form: name (required), nationality (required), role (required), iqama_number (required, 10-digit, starts with 1 for Saudi or 2 for non-Saudi), start_date (required), salary (optional)
- Edit member: inline edit or modal
- Deactivate: set status=TERMINATED, termination_date=today
- Terminated members hidden by default, 'Show terminated' toggle
- Saudization ratio display: 'X Saudi / Y total (Z%)'
- Empty state: 'No team members yet. Add your first employee.'

Bilingual labels. Iqama validation with clear error messages.

**Test Strategy:**

Add a team member with valid Iqama. Try invalid Iqama (wrong length, wrong start digit). Verify Saudization count. Deactivate and verify hidden by default. Toggle to show terminated.
