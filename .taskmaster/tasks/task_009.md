# Task ID: 9

**Title:** Build Onboarding Wizard UI

**Status:** pending

**Dependencies:** 6, 7

**Priority:** high

**Description:** Create a 3-step guided onboarding wizard at /app/onboarding: Step 1 (Upload CR), Step 2 (Confirm Profile), Step 3 (Contact Info). Gated — dashboard inaccessible until complete.

**Details:**

Create /app/onboarding/page.tsx with:
- Step indicator (1/3, 2/3, 3/3) with progress bar
- Step 1: CR Upload — drag-and-drop zone, camera button (mobile), file picker, accepted formats (PDF/PNG/JPG/JPEG), max 10MB, progress indicator during upload
- Step 2: Profile Confirmation — pre-filled form from AI extraction (task 11), all fields editable, required fields validated (name_ar, cr_number, activity_type, city), logo upload, stamp upload
- Step 3: Contact Info — phone (Saudi +966 5X validation), email (pre-filled from signup), address (free text), skippable
- Completion: redirect to /app dashboard with welcome state

Onboarding guard in /app/layout.tsx: if user has no business record, redirect to /app/onboarding.
Bilingual throughout. Framer Motion page transitions between steps.

**Test Strategy:**

Complete full wizard flow. Verify step navigation (next/back). Verify validation on required fields. Verify skip on step 3. Verify redirect to dashboard on completion.
