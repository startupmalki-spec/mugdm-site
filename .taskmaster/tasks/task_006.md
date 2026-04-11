# Task ID: 6

**Title:** Create App Route Scaffolding and Layout

**Status:** pending

**Dependencies:** 5

**Priority:** high

**Description:** Create the /app/* route structure with authenticated layout (sidebar navigation, header with business name/logo), auth guard, and all page stubs.

**Details:**

Routes to create:
- /login — magic link form
- /signup — registration + redirect to onboarding
- /auth/callback — code exchange route handler
- /app — dashboard (protected)
- /app/onboarding — guided setup wizard
- /app/profile — business profile
- /app/team — team management
- /app/vault — document vault
- /app/calendar — compliance calendar
- /app/bookkeeper — financial dashboard
- /app/bookkeeper/upload — bank statement upload
- /app/settings — language, notifications, account

Create /app/layout.tsx with:
- Auth guard (redirect to /login if not authenticated)
- Onboarding guard (redirect to /app/onboarding if no business profile)
- Sidebar navigation with icons (Lucide)
- Header with business name, logo, language toggle
- Mobile-responsive: sidebar collapses to hamburger menu

All page files start as stubs with page title and 'Coming Soon' state.

**Test Strategy:**

Navigate to each route. Verify auth guard redirects. Verify sidebar renders on desktop, hamburger on mobile. Verify active route is highlighted.
