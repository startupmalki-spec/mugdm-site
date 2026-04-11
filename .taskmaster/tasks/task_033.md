# Task ID: 33

**Title:** Responsive Polish and Mobile Optimization

**Status:** pending

**Dependencies:** 9, 14, 18, 30

**Priority:** medium

**Description:** Ensure all pages work on mobile (<768px), tablet (768-1024px), and desktop (>1024px). Fix touch targets, sidebar behavior, camera access, and table layouts.

**Details:**

Mobile-first review of all pages:
- Sidebar: collapses to hamburger menu on mobile
- Tables: convert to card layout on mobile (transactions, team members, review queue)
- Touch targets: minimum 44x44px for all interactive elements
- Camera access: CR upload and receipt capture use native camera on mobile
- File upload: drag-drop on desktop, tap-to-upload on mobile
- Calendar: month view adapts to narrow width
- Charts: responsive container, touch-friendly tooltips
- Modals/dialogs: full-screen on mobile, centered on desktop
- Form inputs: appropriate mobile keyboard types (numeric for amounts, tel for phone)

Test on 375px (iPhone SE), 390px (iPhone 14), 768px (iPad), 1280px+ (desktop).

**Test Strategy:**

Resize browser to each breakpoint. Verify layout adapts. Test camera access on mobile device. Verify touch targets are large enough. Verify no horizontal scroll.
