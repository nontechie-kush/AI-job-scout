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

const GA4_KEY_EVENT_ALIASES = {
  rp_signup_completed: 'sign_up',
  rp_resume_pitch_started: 'resume_pitch_started',
  rp_tailor_completed: 'resume_tailored',
  rp_match_score_received: 'match_score_received',
  rp_ats_score_started: 'ats_score_started',
  rp_ats_score_completed: 'ats_report_generated',
  rp_ats_to_tailor_clicked: 'ats_to_tailor_clicked',
  rp_pdf_downloaded: 'pdf_downloaded',
  rp_base_resume_downloaded: 'base_resume_downloaded',
};

export function track(event, props) {
  if (typeof window === 'undefined' || typeof window.gtag === 'undefined') return;
  const payload = { transport_type: 'beacon', ...(props || {}) };
  window.gtag('event', event, payload);

  const alias = GA4_KEY_EVENT_ALIASES[event];
  if (alias && alias !== event) {
    window.gtag('event', alias, payload);
  }
}

export function identify(userId, traits) {
  if (typeof window === 'undefined' || typeof window.gtag === 'undefined') return;
  window.gtag('set', 'user_properties', { ...traits, user_id: userId });
}
