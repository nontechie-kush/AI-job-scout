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
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const step = searchParams.get('step') || '6';
  const tr = searchParams.get('tr') || '';

  useEffect(() => {
    const theme = localStorage.getItem('rp_theme') || 'light';
    document.documentElement.setAttribute('data-rp-theme', theme);
  }, []);

  const handleGoogle = async () => {
    setLoading(true);
    setError('');

    // Build the return URL with step + tr so start page restores position
    const qs = new URLSearchParams({ step, source: 'rolepitch' });
    if (tr) qs.set('tr', tr);
    const nextUrl = `/rolepitch/start?${qs.toString()}`;

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(nextUrl)}`,
        scopes: 'email profile',
      },
    });

    if (authError) { setError(authError.message); setLoading(false); }
  };

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
          {/* Vault saved badge */}
          <div style={{ background: 'var(--green-dim)', border: '1px solid oklch(0.55 0.17 155 / 0.25)', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 24 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="var(--green-dim)" stroke="var(--green)" strokeWidth="1.2" /><path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="var(--green)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Your resume is ready</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sign in to save it and download the PDF</div>
            </div>
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6 }}>Save your pitch</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
            Free account — 2 pitches included. No credit card. Your vault is preserved forever.
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
            {loading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          {error && (
            <p style={{ fontSize: 12, color: 'oklch(0.75 0.15 30)', textAlign: 'center', marginTop: 14 }}>{error}</p>
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
