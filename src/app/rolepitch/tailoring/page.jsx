'use client';

/**
 * /rolepitch/tailoring?critique_id=xxx
 *
 * Post-signup welcome page. Decides what to tailor for, runs the tailor,
 * and either auto-redirects to the result page or invites the user to
 * provide a different JD.
 *
 * Decision tree (based on critique-preview):
 *   - target_context present  → "Tailoring for {target}" → fire immediately
 *   - inferred high           → "Looks like {role} is your next step" → fire immediately
 *   - inferred medium         → show inferred + 10s countdown → fire on timeout, opt-out cancels
 *   - inferred low / none     → "Want a JD or shall we build a generic one?" → 10s default to generic
 */

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { track } from '@/components/PostHogProvider';

const PILOT_BEATS = [
  'Reading your story.',
  'Picking the bullets that punch hardest.',
  'Rewriting weak ones.',
  'Calibrating for the role.',
];

export default function TailoringPageWrapper() {
  return (
    <Suspense fallback={null}>
      <TailoringPage />
    </Suspense>
  );
}

function TailoringPage() {
  const router = useRouter();
  const params = useSearchParams();
  const critiqueId = params.get('critique_id');

  const [phase, setPhase] = useState('loading'); // loading, decide, running, done, error, no_critique
  const [preview, setPreview] = useState(null);
  const [decision, setDecision] = useState(null); // 'target' | 'inferred' | 'generic'
  const [countdown, setCountdown] = useState(10);
  const [beat, setBeat] = useState(0);
  const [error, setError] = useState(null);
  const cancelledRef = useRef(false);
  const tailorStartedRef = useRef(false);

  // ── Step 1: Load preview ─────────────────────────────────────────
  useEffect(() => {
    if (!critiqueId) { setPhase('no_critique'); return; }
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.access_token) {
        router.replace('/rolepitch/auth?error=no_session');
        return;
      }
      try {
        const res = await fetch(`/api/rolepitch/critique-preview?critique_id=${encodeURIComponent(critiqueId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setError(j.error || 'Could not load your ATS report.');
          setPhase('error');
          return;
        }
        const data = await res.json();
        setPreview(data);

        // Decide
        if (data.target_context) {
          setDecision('target');
          setPhase('running');
        } else if (data.inferred_target?.confidence === 'high' && data.inferred_target?.inferred_role) {
          setDecision('inferred');
          setPhase('running');
        } else if (data.inferred_target?.confidence === 'medium' && data.inferred_target?.inferred_role) {
          setDecision('inferred');
          setPhase('decide'); // show countdown for medium
        } else {
          setDecision('generic');
          setPhase('decide'); // show countdown for low/no inference
        }
      } catch (err) {
        setError(err.message);
        setPhase('error');
      }
    });
  }, [critiqueId, router]);

  // ── Step 2a: Countdown timer for 'decide' phase ──────────────────
  useEffect(() => {
    if (phase !== 'decide') return;
    setCountdown(10);
    const interval = setInterval(() => {
      setCountdown(c => {
        if (cancelledRef.current) { clearInterval(interval); return c; }
        if (c <= 1) {
          clearInterval(interval);
          setPhase('running');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // ── Step 2b: Pilot voice beat rotation while running ─────────────
  useEffect(() => {
    if (phase !== 'running') return;
    setBeat(0);
    const interval = setInterval(() => {
      setBeat(b => Math.min(b + 1, PILOT_BEATS.length - 1));
    }, 4000);
    return () => clearInterval(interval);
  }, [phase]);

  // ── Step 3: Fire auto-tailor when phase becomes 'running' ────────
  useEffect(() => {
    if (phase !== 'running') return;
    if (tailorStartedRef.current) return;
    tailorStartedRef.current = true;

    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        router.replace('/rolepitch/auth?error=no_session');
        return;
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      try {
        track('rp_resume_pitch_started', {
          source: 'ats_report',
          critique_id: critiqueId,
          mode: decision,
          has_target: !!preview?.target_context,
        });

        const res = await fetch('/api/rolepitch/auto-tailor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ critique_id: critiqueId, mode: decision }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const data = await res.json();
        if (!res.ok || !data.tailored_resume_id) {
          setError(data.error || "Couldn't auto-tailor. Let's do it together.");
          setPhase('error');
          return;
        }
        // Clear the critique session pointers — done with them
        try {
          sessionStorage.removeItem('rp_session');
          localStorage.removeItem('rp_session');
        } catch {}
        track('rp_tailor_completed', {
          source: 'ats_report',
          critique_id: critiqueId,
          tailored_resume_id: data.tailored_resume_id,
          mode: data.used?.mode || decision,
          cached: !!data.cached,
        });
        router.replace(`/rolepitch/resume/${data.tailored_resume_id}?welcome=1`);
      } catch (err) {
        clearTimeout(timeoutId);
        const msg = err.name === 'AbortError'
          ? "Timed out — the tailor is taking longer than usual. Let's do it together."
          : err.message;
        setError(msg);
        setPhase('error');
      }
    })();
  }, [phase, critiqueId, decision, router]);

  const cancelAuto = () => {
    cancelledRef.current = true;
    // Take user to start with their critique resume preloaded
    router.replace('/rolepitch/start?step=0&source=critique');
  };

  return (
    <>
      <style jsx global>{`
        :root {
          --bg: oklch(0.98 0.006 248);
          --surface: oklch(0.955 0.009 248);
          --border: oklch(0.86 0.015 248);
          --accent: oklch(0.50 0.19 248);
          --text: oklch(0.16 0.03 248);
          --text-muted: oklch(0.44 0.04 248);
          --text-faint: oklch(0.62 0.03 248);
        }
        body { background: var(--bg); }
        @keyframes rp-spin { to { transform: rotate(360deg); } }
        @keyframes rp-fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes rp-pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
      `}</style>

      <div style={{
        fontFamily: 'DM Sans, sans-serif',
        background: 'var(--bg)',
        color: 'var(--text)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        WebkitFontSmoothing: 'antialiased',
      }}>
        <div style={{
          maxWidth: 560,
          width: '100%',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 'clamp(28px, 5vw, 44px)',
          animation: 'rp-fadeUp 0.4s ease-out',
        }}>

          {phase === 'loading' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'var(--text-muted)', fontSize: 15 }}>
              <div style={{ width: 18, height: 18, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'rp-spin 0.8s linear infinite' }} />
              Pulling your ATS report…
            </div>
          )}

          {phase === 'no_critique' && (
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8, letterSpacing: '-0.02em' }}>Welcome aboard.</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
                We don't have an ATS report to start from — let's build one together.
              </p>
              <button
                onClick={() => router.replace('/rolepitch/start?step=0')}
                style={{ background: 'var(--accent)', color: 'white', border: 'none', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Start tailoring
              </button>
            </div>
          )}

          {phase === 'decide' && decision === 'inferred' && preview?.inferred_target && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                Pilot — best guess at your next role
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 600, marginBottom: 10, letterSpacing: '-0.02em', lineHeight: 1.25 }}>
                Looks like <span style={{ color: 'var(--accent)' }}>{preview.inferred_target.inferred_role}</span> is your next step.
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.65, marginBottom: 8 }}>
                {preview.inferred_target.reasoning}
              </p>
              {preview.inferred_target.inferred_domain && (
                <p style={{ color: 'var(--text-faint)', fontSize: 13, marginBottom: 24 }}>
                  Domain: {preview.inferred_target.inferred_domain}
                </p>
              )}
              <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 22 }}>
                I'll tailor your resume for this in <strong style={{ color: 'var(--text)' }}>{countdown}s</strong> — first one's on me, no credit deducted.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setPhase('running')}
                  style={{ background: 'var(--accent)', color: 'white', border: 'none', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  Tailor now
                </button>
                <button
                  onClick={cancelAuto}
                  style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', padding: '12px 18px', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
                >
                  Use a specific JD instead
                </button>
              </div>
            </div>
          )}

          {phase === 'decide' && decision === 'generic' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                Pilot
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 10, letterSpacing: '-0.02em', lineHeight: 1.3 }}>
                You didn't pin a role you're targeting.
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.65, marginBottom: 22 }}>
                I'll build a strong, generic version of your resume in <strong style={{ color: 'var(--text)' }}>{countdown}s</strong> — or paste a job description and I'll tailor sharper. First one's free either way.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setPhase('running')}
                  style={{ background: 'var(--accent)', color: 'white', border: 'none', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  Build generic resume
                </button>
                <button
                  onClick={cancelAuto}
                  style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', padding: '12px 18px', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
                >
                  Paste a job description instead
                </button>
              </div>
            </div>
          )}

          {phase === 'running' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                Pilot at work
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 18, letterSpacing: '-0.02em', lineHeight: 1.3 }}>
                {decision === 'target' && preview?.target_context && <>Tailoring for <span style={{ color: 'var(--accent)' }}>{preview.target_context}</span>.</>}
                {decision === 'inferred' && preview?.inferred_target?.inferred_role && <>Tailoring for <span style={{ color: 'var(--accent)' }}>{preview.inferred_target.inferred_role}</span>.</>}
                {decision === 'generic' && <>Building a strong generic version.</>}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-muted)', fontSize: 15, marginBottom: 8, animation: 'rp-pulse 1.6s ease-in-out infinite' }}>
                <div style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'rp-spin 0.8s linear infinite' }} />
                {PILOT_BEATS[beat]}
              </div>
              <p style={{ color: 'var(--text-faint)', fontSize: 13, marginTop: 18 }}>
                Usually takes 15–25 seconds. No credit deducted — this one's on me.
              </p>
              <button
                onClick={cancelAuto}
                style={{ marginTop: 24, background: 'transparent', color: 'var(--text-faint)', border: 'none', padding: 0, fontSize: 13, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Use a different JD instead
              </button>
            </div>
          )}

          {phase === 'error' && (
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 10, letterSpacing: '-0.02em' }}>Hit a wall — not you, it's me.</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.6, marginBottom: 22 }}>
                {error || "Couldn't auto-tailor."} Let's do it together — paste a JD on the next screen.
              </p>
              <button
                onClick={() => router.replace('/rolepitch/start?step=0&source=critique')}
                style={{ background: 'var(--accent)', color: 'white', border: 'none', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Continue to tailor
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
