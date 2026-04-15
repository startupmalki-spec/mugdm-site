'use client';

/**
 * Visible "DEMO MODE" banner. Renders only when the session has the
 * `mugdm_demo` cookie (set by the middleware when user visits any URL
 * with `?demo=1`, gated by NEXT_PUBLIC_MUGDM_DEMO_ALLOWED kill-switch).
 * Real visitors never see it.
 */
import { useEffect, useState } from 'react';
import { isDemoModeClient } from '@/lib/demo-mode';

export function DemoModeBadge() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(isDemoModeClient());
  }, []);

  if (!on) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 h-7 text-[11px] font-semibold uppercase tracking-[0.18em] bg-amber-400 text-amber-950 shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
    >
      <span aria-hidden="true">●</span>
      Demo mode — Wathq &amp; ZATCA calls are mocked
    </div>
  );
}
