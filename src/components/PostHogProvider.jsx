'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let initialized = false;

function init() {
  if (initialized || !POSTHOG_KEY || typeof window === 'undefined') return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false, // we fire manually below to get clean route names
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    autocapture: false,     // keep it clean — only explicit events
  });
  initialized = true;
}

// Expose capture globally so any component can call window.rp_track(...)
// without importing posthog directly
if (typeof window !== 'undefined') {
  window.rp_track = (event, props) => {
    if (!initialized) return;
    posthog.capture(event, props);
  };
}

export default function PostHogProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPath = useRef('');

  useEffect(() => {
    init();
  }, []);

  // Page view on route change
  useEffect(() => {
    if (!initialized) return;
    const url = pathname + (searchParams?.toString() ? '?' + searchParams.toString() : '');
    if (url === lastPath.current) return;
    lastPath.current = url;
    posthog.capture('$pageview', { $current_url: window.location.href });
  }, [pathname, searchParams]);

  return null;
}

// ── Typed event helpers (import these in components) ──────────────────────────

export function track(event, props) {
  if (typeof window === 'undefined' || !initialized) return;
  posthog.capture(event, props);
}

export function identify(userId, traits) {
  if (typeof window === 'undefined' || !initialized) return;
  posthog.identify(userId, traits);
}
