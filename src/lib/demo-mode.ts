/**
 * Demo-mode: session-scoped via a `mugdm_demo=1` cookie, gated by a
 * global kill-switch env var so prod can hard-disable at any time.
 *
 * Kill switch:
 *   NEXT_PUBLIC_MUGDM_DEMO_ALLOWED=true   → demo sessions permitted
 *   (unset / anything else)               → demo is OFF for everyone,
 *                                           regardless of cookie state
 *
 * Activation: visit any auth page with `?demo=1`. The middleware sets
 * the `mugdm_demo=1` cookie (session, SameSite=Lax, Secure, 8h max age)
 * and redirects to the clean URL. Demo is then active for this browser
 * session only — real visitors never see mocks or the banner.
 *
 * Legacy env fallback:
 *   MUGDM_DEMO_MODE=true / NEXT_PUBLIC_MUGDM_DEMO_MODE=true still forces
 *   demo on globally. Keep UNSET in prod — use the cookie flow instead.
 */

const COOKIE_NAME = 'mugdm_demo';
const COOKIE_VALUE = '1';

export function isDemoAllowed(): boolean {
  return (
    process.env.NEXT_PUBLIC_MUGDM_DEMO_ALLOWED === 'true' ||
    process.env.MUGDM_DEMO_MODE === 'true' ||
    process.env.NEXT_PUBLIC_MUGDM_DEMO_MODE === 'true'
  );
}

function hasLegacyEnvForce(): boolean {
  return (
    process.env.MUGDM_DEMO_MODE === 'true' ||
    process.env.NEXT_PUBLIC_MUGDM_DEMO_MODE === 'true'
  );
}

/**
 * Client-side demo check. Safe to call from "use client" components.
 * Reads `document.cookie`. Returns false during SSR.
 */
export function isDemoModeClient(): boolean {
  if (!isDemoAllowed()) return false;
  if (hasLegacyEnvForce()) return true;
  if (typeof document === 'undefined') return false;
  return document.cookie
    .split(';')
    .some((c) => c.trim() === `${COOKIE_NAME}=${COOKIE_VALUE}`);
}

/**
 * Server-side demo check. Must be awaited. Only valid inside a request
 * context (route handlers, server components, server actions). Falls
 * back to `false` if no cookie context is available.
 */
export async function isDemoModeServer(): Promise<boolean> {
  if (!isDemoAllowed()) return false;
  if (hasLegacyEnvForce()) return true;
  try {
    const { cookies } = await import('next/headers');
    const store = await cookies();
    return store.get(COOKIE_NAME)?.value === COOKIE_VALUE;
  } catch {
    return false;
  }
}

/**
 * Backwards-compat sync check. On the client reads the cookie, on the
 * server only returns true if the legacy env override is set. Prefer
 * `isDemoModeServer()` in new server code.
 */
export function isDemoMode(): boolean {
  if (!isDemoAllowed()) return false;
  if (hasLegacyEnvForce()) return true;
  if (typeof document !== 'undefined') {
    return document.cookie
      .split(';')
      .some((c) => c.trim() === `${COOKIE_NAME}=${COOKIE_VALUE}`);
  }
  return false;
}

export const DEMO_COOKIE_NAME = COOKIE_NAME;
export const DEMO_COOKIE_VALUE = COOKIE_VALUE;

export function demoSleep(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(minMs + Math.random() * (maxMs - minMs));
  return new Promise((r) => setTimeout(r, ms));
}
