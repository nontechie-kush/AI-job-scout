'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function PostHogProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPath = useRef('');

  useEffect(() => {
    const url = pathname + (searchParams?.toString() ? '?' + searchParams.toString() : '');
    if (url === lastPath.current) return;
    lastPath.current = url;
    if (typeof window !== 'undefined' && typeof window.gtag !== 'undefined') {
      window.gtag('event', 'page_view', {
        page_location: window.location.href,
        page_path: url,
      });
    }
  }, [pathname, searchParams]);

  return null;
}

export function track(event, props) {
  if (typeof window === 'undefined' || typeof window.gtag === 'undefined') return;
  window.gtag('event', event, { transport_type: 'beacon', ...(props || {}) });
}

export function identify(userId, traits) {
  if (typeof window === 'undefined' || typeof window.gtag === 'undefined') return;
  window.gtag('set', 'user_properties', { ...traits, user_id: userId });
}
