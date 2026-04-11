# Task ID: 5

**Title:** Set Up Supabase Auth with Magic Link

**Status:** pending

**Dependencies:** 1

**Priority:** high

**Description:** Configure Supabase Auth for email + magic link authentication. Create auth helper utilities, middleware for route protection, and the Supabase client (browser + server).

**Details:**

Create:
- src/lib/supabase/client.ts — browser client (createBrowserClient)
- src/lib/supabase/server.ts — server client (createServerClient with cookies)
- src/lib/supabase/middleware.ts — auth middleware for protected routes
- middleware.ts — Next.js middleware that redirects unauthenticated users from /app/* to /login, and authenticated users from /login to /app

Configure Supabase Auth:
- Email + magic link (no password)
- Session: 1-hour access token, 7-day refresh token
- Redirect URL: /auth/callback
- Create /auth/callback route handler to exchange code for session

No phone OTP in Phase 1.

**Test Strategy:**

Sign up with email. Receive magic link. Click link. Verify session is created. Access /app route. Sign out. Verify redirect to /login.
