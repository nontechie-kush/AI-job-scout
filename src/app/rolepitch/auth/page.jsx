'use client';

/**
 * /rolepitch/auth
 *
 * Lightweight sign-in page for the RolePitch flow.
 * Triggers Google OAuth and returns the user to /rolepitch/start
 * with their step + tailored_resume_id preserved.
 *
 * URL params: ?step=N&tr=UUID
 */

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { createBrowserClient } from '@supabase/ssr';

const CSS = `
  :root {
    --bg: oklch(0.98 0.006 248);
    --surface: oklch(0.955 0.009 248);
    --border: oklch(0.86 0.015 248);
    --accent: oklch(0.50 0.19 248);
    --green: oklch(0.55 0.17 155);
    --green-dim: oklch(0.55 0.17 155 / 0.10);
    --text: oklch(0.16 0.03 248);
    --text-muted: oklch(0.44 0.04 248);
    --text-faint: oklch(0.62 0.03 248);
    --sans: 'DM Sans', sans-serif;
  }
  [data-rp-theme="dark"] {
    --bg: oklch(0.11 0.03 248);
    --surface: oklch(0.155 0.035 248);
    --border: oklch(0.26 0.04 248);
    --accent: oklch(0.62 0.19 248);
    --green: oklch(0.72 0.17 155);
    --green-dim: oklch(0.72 0.17 155 / 0.12);
    --text: oklch(0.94 0.01 248);
    --text-muted: oklch(0.58 0.04 248);
    --text-faint: oklch(0.38 0.03 248);
  }
  @keyframes rp-spin { to { transform: rotate(360deg); } }
  @keyframes rp-fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
`;

function RolePitchAuthInner() {
  const searchParams = useSearchParams();
  // Implicit flow client — avoids PKCE "invalid flow state" cookie loss across paths
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { flowType: 'implicit' } }
  );
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Redirecting…');
  const [error, setError] = useState('');
  const [hasResume, setHasResume] = useState(false);

  const step = searchParams.get('step') || '6';
  const tr = searchParams.get('tr') || '';
  const redirect = searchParams.get('redirect') || '';
  const source = searchParams.get('source') || '';
  const oauthFailed = searchParams.get('error') === 'oauth_failed';
  const oauthDraftId = searchParams.get('draft_id') || '';

  useEffect(() => {
    const theme = localStorage.getItem('rp_theme') || 'light';
    document.documentElement.setAttribute('data-rp-theme', theme);

    // Show "Your resume is ready" if any flow saved a resume in either storage
    try {
      const sess = JSON.parse(sessionStorage.getItem('rp_session') || '{}');
      const local = JSON.parse(localStorage.getItem('rp_session') || '{}');
      setHasResume(!!(sess.parsedResume || sess.tailoredResume || local.parsedResume || local.tailoredResume));
    } catch { setHasResume(false); }

    // Implicit flow: Google redirects back here with #access_token in the hash
    const hasHashToken = window.location.hash.includes('access_token');
    if (hasHashToken) {
      setLoading(true);

      // Parse the full token pair from the hash and hand it to Supabase via
      // setSession(). This is what writes the auth cookie — without it, the
      // immediate redirect races the cookie write and the next page 401s.
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      const establishSession = async () => {
        if (!accessToken || !refreshToken) return false;
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          console.error('[auth] setSession failed:', error.message);
          return false;
        }
        return true;
      };

      const claimAndRedirect = async (fallbackDest) => {
        let critiqueId = null;
        let claimed = false;
        try {
          const sess = JSON.parse(sessionStorage.getItem('rp_session') || '{}');
          const local = JSON.parse(localStorage.getItem('rp_session') || '{}');
          critiqueId = sess.critiqueId || local.critiqueId || null;

          if (critiqueId || source === 'critique') {
            const res = await fetch('/api/rolepitch/claim-critique', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
              },
              body: JSON.stringify({ critique_id: critiqueId }),
            });
            const j = await res.json().catch(() => ({}));
            claimed = !!j.claimed;
          }
        } catch (e) {
          console.error('[claim-critique]', e);
        }

        // Campaign redemption — runs alongside critique claim, idempotent.
        try {
          const refCode = localStorage.getItem('rp_campaign_code');
          if (refCode && accessToken) {
            const res = await fetch('/api/rolepitch/campaign/redeem', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ code: refCode }),
            });
            const j = await res.json().catch(() => ({}));
            if (j?.granted || j?.already_redeemed) {
              localStorage.removeItem('rp_campaign_code');
            }
          }
        } catch (e) {
          console.error('[campaign-redeem]', e);
        }

        // Critique flow: route to auto-tailor page when we have a claimed critique
        if (source === 'critique' && critiqueId && claimed) {
          window.location.href = `/rolepitch/tailoring?critique_id=${encodeURIComponent(critiqueId)}`;
          return;
        }

        // Draft claim — replaces the step=6 OAuth round-trip dance.
        // If the user had an in-flight tailor (anonymous draft), this atomically
        // promotes it into profiles + tailored_resumes and lands them on the
        // dashboard with their pitch already saved.
        try {
          const draftId = oauthDraftId || localStorage.getItem('rp_draft_id') || null;
          if (draftId || accessToken) {
            const res = await fetch('/api/rolepitch/claim-draft', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
              },
              body: JSON.stringify({ draft_id: draftId }),
            });
            const j = await res.json().catch(() => ({}));
            if (j?.claimed && j?.has_tailored && j?.tailored_resume_id) {
              // Successful end-to-end claim with a tailored pitch — go directly
              // to dashboard with welcome marker. Skip the start-page step=6 path.
              try { localStorage.removeItem('rp_draft_id'); } catch {}
              window.location.href = '/rolepitch/dashboard?welcome=1';
              return;
            }
            if (j?.claimed) {
              // Draft claimed but no tailored result yet (shouldn't happen on
              // the Download path, but covers other edges). Clear draft id and
              // fall through to default destination.
              try { localStorage.removeItem('rp_draft_id'); } catch {}
            }
          }
        } catch (e) {
          console.error('[claim-draft]', e);
        }

        window.location.href = fallbackDest;
      };

      setLoadingMsg(
        source === 'critique' ? (redirect ? 'Saving your roast…' : 'Tailoring your resume…')
        : source === 'campaign' ? 'Adding your bonus pitches…'
        : redirect ? 'Redirecting you to payment…'
        : 'Redirecting…'
      );

      // Critical sequence: write the auth cookie BEFORE navigating, otherwise
      // the destination page's first request races the cookie and 401s.
      establishSession().then(() => {
        const dest = redirect
          ? redirect
          : `/rolepitch/start?step=${step}&source=${source || 'rolepitch'}${tr ? `&tr=${tr}` : ''}`;
        claimAndRedirect(dest);
      });
      return;
    }

    // No hash token — but the user might already be signed in. If so, skip
    // showing the sign-in form and route them like a successful auth.
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      setLoading(true);
      setLoadingMsg(
        source === 'critique' ? 'Tailoring your resume…'
        : source === 'campaign' ? 'Adding your bonus pitches…'
        : redirect ? 'Redirecting…'
        : 'Redirecting…'
      );

      let critiqueId = null;
      let claimed = false;
      try {
        const sess = JSON.parse(sessionStorage.getItem('rp_session') || '{}');
        const local = JSON.parse(localStorage.getItem('rp_session') || '{}');
        critiqueId = sess.critiqueId || local.critiqueId || null;
        if (critiqueId || source === 'critique') {
          const res = await fetch('/api/rolepitch/claim-critique', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ critique_id: critiqueId }),
          });
          const j = await res.json().catch(() => ({}));
          claimed = !!j.claimed;
        }
      } catch (e) {
        console.error('[claim-critique]', e);
      }

      if (source === 'critique' && critiqueId && claimed) {
        window.location.href = `/rolepitch/tailoring?critique_id=${encodeURIComponent(critiqueId)}`;
        return;
      }

      // Draft claim — same logic as the OAuth-hash branch above. Covers the
      // case where the user was already signed in when they hit auth (e.g.
      // returning visitor whose session is still valid).
      try {
        const draftId = oauthDraftId || localStorage.getItem('rp_draft_id') || null;
        if (draftId) {
          const res = await fetch('/api/rolepitch/claim-draft', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ draft_id: draftId }),
          });
          const j = await res.json().catch(() => ({}));
          if (j?.claimed && j?.has_tailored && j?.tailored_resume_id) {
            try { localStorage.removeItem('rp_draft_id'); } catch {}
            window.location.href = '/rolepitch/dashboard?welcome=1';
            return;
          }
          if (j?.claimed) {
            try { localStorage.removeItem('rp_draft_id'); } catch {}
          }
        }
      } catch (e) {
        console.error('[claim-draft]', e);
      }

      const dest = redirect
        ? redirect
        : `/rolepitch/start?step=${step}&source=${source || 'rolepitch'}${tr ? `&tr=${tr}` : ''}`;
      window.location.href = dest;
    })();
  }, [step, tr, redirect, source]);

  const handleGoogle = async () => {
    setLoading(true);
    setError('');

    // Pass all params through the round-trip so we land correctly after OAuth
    const callbackQs = new URLSearchParams({ step, source: source || 'rolepitch' });
    if (tr) callbackQs.set('tr', tr);
    if (redirect) callbackQs.set('redirect', redirect);

    const liveDraftId = localStorage.getItem('rp_draft_id') || null;
    if (liveDraftId) callbackQs.set('draft_id', liveDraftId);

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Implicit flow: token arrives as URL hash on this page itself
        redirectTo: `${window.location.origin}/rolepitch/auth?${callbackQs.toString()}`,
        scopes: 'email profile',
      },
    });

    if (authError) { setError(authError.message); setLoading(false); }
  };

  // Context-aware copy
  const isCampaignFlow = source === 'campaign';
  const isPricingFlow = source === 'pricing' || source === 'checkout' || redirect.includes('#pricing');
  const isCritiqueFlow = source === 'critique';
  const isDashboardSignIn = redirect === '/rolepitch/dashboard' || redirect === 'rolepitch/dashboard';
  const headline = isCampaignFlow
    ? 'Claim your bonus'
    : isCritiqueFlow
    ? 'Save your roast'
    : isPricingFlow
    ? 'Continue to checkout'
    : isDashboardSignIn
    ? 'Welcome back'
    : hasResume
    ? 'Save your pitch'
    : 'Continue to RolePitch';
  const subline = isCampaignFlow
    ? 'Sign up with Google — your bonus pitches will be added to your account instantly.'
    : isCritiqueFlow
    ? 'Sign up free — your roast will be saved to your dashboard and you can tailor your resume from there.'
    : isPricingFlow
    ? 'Sign in with Google, then we\'ll take you to checkout.'
    : isDashboardSignIn
    ? 'Sign in to open your dashboard, saved pitches, resume roasts, and credits.'
    : hasResume
    ? 'Sign in to save your tailored resume and keep it in your dashboard.'
    : 'Sign in to continue with your RolePitch dashboard.';

  return (
    <div style={{ fontFamily: 'var(--sans)', background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380, animation: 'rp-fadeUp 0.35s ease both' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32, justifyContent: 'center' }}>
          <div style={{ width: 28, height: 28, background: 'var(--accent)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M2 7h7M2 11h9" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>RolePitch</span>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px 28px' }}>
          {/* Vault saved badge — only shown after a tailor flow, not for critique-only users */}
          {hasResume && !isPricingFlow && !isCritiqueFlow && !isDashboardSignIn && (
            <div style={{ background: 'var(--green-dim)', border: '1px solid oklch(0.55 0.17 155 / 0.25)', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 24 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="var(--green-dim)" stroke="var(--green)" strokeWidth="1.2" /><path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="var(--green)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Your resume is ready</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sign in to save it and download the PDF</div>
              </div>
            </div>
          )}

          {/* Critique context badge */}
          {isCritiqueFlow && (
            <div style={{ background: 'oklch(0.50 0.19 248 / 0.08)', border: '1px solid oklch(0.50 0.19 248 / 0.2)', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 24 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 2H3a1 1 0 00-1 1v9a1 1 0 001 1h3l2 2 2-2h3a1 1 0 001-1V3a1 1 0 00-1-1z" stroke="var(--accent)" strokeWidth="1.3" strokeLinejoin="round"/><path d="M5 6h6M5 9h4" stroke="var(--accent)" strokeWidth="1.3" strokeLinecap="round"/></svg>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Your roast is ready</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sign up to save it and tailor your resume from your dashboard</div>
              </div>
            </div>
          )}

          {/* Pricing context badge */}
          {isPricingFlow && (
            <div style={{ background: 'oklch(0.50 0.19 248 / 0.08)', border: '1px solid oklch(0.50 0.19 248 / 0.2)', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 24 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1l1.8 3.6L14 5.3l-3 2.9.7 4.1L8 10.4l-3.7 1.9.7-4.1-3-2.9 4.2-.7z" fill="var(--accent)" opacity="0.8"/></svg>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>One step away</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sign in first, then complete your purchase</div>
              </div>
            </div>
          )}

          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6 }}>{headline}</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
            {subline}
          </p>

          <button
            onClick={handleGoogle}
            disabled={loading}
            style={{ width: '100%', padding: '13px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'white', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 600, color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}
          >
            {loading
              ? <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #ccc', borderTopColor: '#333', animation: 'rp-spin 0.7s linear infinite' }} />
              : <svg width="18" height="18" viewBox="0 0 18 18">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
                  <path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05" />
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
                </svg>
            }
            {loading ? loadingMsg : 'Continue with Google'}
          </button>

          {(error || oauthFailed) && (
            <p style={{ fontSize: 12, color: 'oklch(0.75 0.15 30)', textAlign: 'center', marginTop: 14 }}>
              {error || 'Sign-in failed — please try again'}
            </p>
          )}

          <p style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'center', marginTop: 20, lineHeight: 1.6 }}>
            By continuing you agree to our Terms & Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RolePitchAuthPage() {
  return (
    <>
      <style>{CSS}</style>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <Suspense fallback={null}>
        <RolePitchAuthInner />
      </Suspense>
    </>
  );
}
