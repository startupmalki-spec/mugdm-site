'use client'

import { trackEvent as posthogTrack } from './posthog'

/**
 * Dual-write event collector (PRD_ML §9.1).
 * Sends every event to PostHog (for product analytics) and to /api/events
 * (for our ML intelligence pipeline). Both calls are fire-and-forget and
 * silently ignore errors — analytics must never break the UI.
 */

const SESSION_KEY = 'mugdm_session_id'
const BUSINESS_KEY = 'mugdm_selected_business_id'

let warned = false

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return ''
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return ''
  }
}

function getActiveBusinessId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(BUSINESS_KEY)
  } catch {
    return null
  }
}

function detectDeviceType(): 'desktop' | 'mobile' | 'tablet' {
  if (typeof window === 'undefined') return 'desktop'
  const w = window.innerWidth
  if (w < 768) return 'mobile'
  if (w < 1024) return 'tablet'
  return 'desktop'
}

function detectLocale(): 'en' | 'ar' | null {
  if (typeof window === 'undefined') return null
  const path = window.location.pathname
  if (path.startsWith('/ar')) return 'ar'
  if (path.startsWith('/en')) return 'en'
  return null
}

function categoryFor(eventName: string): string {
  const [prefix] = eventName.split('.')
  return prefix || 'uncategorized'
}

async function sendToServer(payload: unknown) {
  try {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: 'same-origin',
    })
  } catch {
    // Silent
  }
}

export interface TrackOptions {
  businessId?: string
  properties?: Record<string, unknown>
}

/**
 * Fire an event to both PostHog and the server collector.
 * Requires an active businessId (from options, or localStorage selection).
 * If no business is selected yet (pre-onboarding), PostHog still receives
 * the event and we skip the server write rather than fail.
 */
export function track(eventName: string, options: TrackOptions = {}): void {
  if (typeof window === 'undefined') return

  const businessId = options.businessId ?? getActiveBusinessId()
  const properties = options.properties ?? {}

  // 1. Fire to PostHog (works with or without businessId).
  try {
    posthogTrack(eventName, { ...properties, business_id: businessId ?? undefined })
  } catch {
    // Silent
  }

  // 2. Fire to server collector — requires businessId for RLS.
  if (!businessId) {
    if (!warned && process.env.NODE_ENV !== 'production') {
      console.warn('[event-collector] skipped server write: no business selected yet')
      warned = true
    }
    return
  }

  void sendToServer({
    event_name: eventName,
    event_category: categoryFor(eventName),
    business_id: businessId,
    properties,
    session_id: getOrCreateSessionId(),
    page_path: window.location.pathname,
    locale: detectLocale(),
    device_type: detectDeviceType(),
  })
}

export function trackPageView(pathOverride?: string): void {
  if (typeof window === 'undefined') return
  track('page.view', {
    properties: { path: pathOverride ?? window.location.pathname },
  })
}
