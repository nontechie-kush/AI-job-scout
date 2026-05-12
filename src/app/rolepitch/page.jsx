'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { track } from '@/components/PostHogProvider';

const CSS_VARS = `
  :root {
    --bg: oklch(0.98 0.006 248);
    --surface: oklch(0.955 0.009 248);
    --surface2: oklch(0.93 0.012 248);
    --border: oklch(0.86 0.015 248);
    --border-subtle: oklch(0.91 0.01 248);
    --accent: oklch(0.50 0.19 248);
    --accent-dim: oklch(0.50 0.19 248 / 0.10);
    --accent-hover: oklch(0.44 0.19 248);
    --green: oklch(0.55 0.17 155);
    --green-dim: oklch(0.55 0.17 155 / 0.10);
    --red: oklch(0.55 0.18 25);
    --red-dim: oklch(0.55 0.18 25 / 0.10);
    --text: oklch(0.16 0.03 248);
    --text-muted: oklch(0.44 0.04 248);
    --text-faint: oklch(0.62 0.03 248);
    --mono: 'JetBrains Mono', monospace;
    --sans: 'DM Sans', sans-serif;
    --shadow-nav: 0 1px 0 var(--border-subtle);
    --card-bg: oklch(1 0 0);
  }
  [data-rp-theme="dark"] {
    --bg: oklch(0.11 0.03 248);
    --surface: oklch(0.155 0.035 248);
    --surface2: oklch(0.19 0.04 248);
    --border: oklch(0.26 0.04 248);
    --border-subtle: oklch(0.195 0.03 248);
    --accent: oklch(0.62 0.19 248);
    --accent-dim: oklch(0.62 0.19 248 / 0.12);
    --accent-hover: oklch(0.68 0.19 248);
    --green: oklch(0.72 0.17 155);
    --green-dim: oklch(0.72 0.17 155 / 0.12);
    --red: oklch(0.68 0.18 25);
    --red-dim: oklch(0.68 0.18 25 / 0.12);
    --text: oklch(0.94 0.01 248);
    --text-muted: oklch(0.58 0.04 248);
    --text-faint: oklch(0.38 0.03 248);
    --shadow-nav: none;
    --card-bg: oklch(0.99 0.003 248);
  }
  .rp-root { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; -webkit-font-smoothing: antialiased; }
  @keyframes rp-fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes rp-dotBlink { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }
  @keyframes rp-arrowMove { 0%,100% { transform: translateX(0); } 50% { transform: translateX(3px); } }
  @keyframes rp-shimmer { from { background-position: -200% center; } to { background-position: 200% center; } }
  @keyframes rp-slideIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
  .rp-fade-up-1 { animation: rp-fadeUp 0.6s ease both 0.1s; }
  .rp-fade-up-2 { animation: rp-fadeUp 0.6s ease both 0.25s; }
  .rp-fade-up-3 { animation: rp-fadeUp 0.6s ease both 0.4s; }
  .rp-fade-up-4 { animation: rp-fadeUp 0.6s ease both 0.55s; }
  @media (max-width: 768px) {
    .rp-hero-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
    .rp-steps-grid { grid-template-columns: 1fr !important; }
    .rp-diff-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
    .rp-pricing-grid { grid-template-columns: 1fr !important; }
    .rp-nav-links { display: none !important; }
    .rp-nav-signin { display: inline-flex !important; }
    .rp-blog-preview { display: flex !important; }
    .rp-blog-desktop { display: none !important; }
    .rp-score-card { top: -8px !important; right: -8px !important; padding: 8px 12px !important; }
    .rp-score-ring { width: 100px !important; height: 100px !important; }
    .rp-score-ring svg { width: 100px !important; height: 100px !important; }
    .rp-score-ring svg circle { cx: 50px !important; cy: 50px !important; r: 38px !important; }
    .rp-score-num { font-size: 24px !important; }
    .rp-atom-stats { gap: 12px !important; }
    .rp-atom-stats div { font-size: 16px !important; }
    .rp-testimonials-grid { grid-template-columns: 1fr !important; }
    .rp-inbox-toggle { flex-direction: column !important; }
    .rp-inbox-toggle button { width: 100% !important; }
  }
`;

function Nav({ onGetStarted, onSignIn, user, authChecked, onDashboard }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: scrolled ? 'color-mix(in oklch, var(--bg) 92%, transparent)' : 'transparent',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      borderBottom: scrolled ? '1px solid var(--border-subtle)' : '1px solid transparent',
      transition: 'all 0.3s ease',
      padding: '0 24px',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, background: 'var(--accent)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 3h10M2 7h7M2 11h9" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em' }}>RolePitch</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a href="#how" className="rp-nav-links" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 14, fontWeight: 500, padding: '0 8px' }}>How it works</a>
          <a href="/blog" className="rp-nav-links" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 14, fontWeight: 500, padding: '0 8px' }}>Blog</a>
          <a href="#pricing" className="rp-nav-links" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 14, fontWeight: 500, padding: '0 8px' }}>Pricing</a>
          {user ? (
            <button onClick={onDashboard} style={{
              background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer',
              padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'oklch(1 0 0 / 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                {(user.email || '?')[0].toUpperCase()}
              </div>
              <span className="rp-nav-links" style={{ display: 'inline' }}>My Dashboard</span>
            </button>
          ) : (
            <>
              <button onClick={onSignIn} className="rp-nav-signin" style={{
                background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)',
                cursor: 'pointer', padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              }}>
                Sign in
              </button>
              <button style={{
                background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer',
                padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em',
                opacity: authChecked ? 1 : 0.65,
              }} onClick={onGetStarted} disabled={!authChecked}>
                {authChecked ? 'Get started free' : 'Checking...'}
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function RecruiterInbox({ tab, setTab }) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setTab(t => t === 'before' ? 'after' : 'before');
    }, 3000);
    return () => clearInterval(id);
  }, [paused, setTab]);

  const applicants = [
    { name: 'Rahul S.', role: 'Backend Developer', match: 41, isYou: false },
    { name: 'Anjali P.', role: 'Software Engineer', match: 55, isYou: false },
    { name: 'You', role: 'Software Engineer', match: tab === 'after' ? 89 : 44, isYou: true },
    { name: 'Meera K.', role: 'Full Stack Dev', match: 74, isYou: false },
  ];

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%' }}>
      <div className="rp-inbox-toggle" style={{ display: 'flex', gap: 0, background: 'var(--surface)', borderRadius: 8, padding: 3, border: '1px solid var(--border-subtle)' }}>
        {[['before', '🏃 Before'], ['after', '✅ After RolePitch']].map(([t, label]) => (
          <button key={t} onClick={() => { setTab(t); setPaused(true); }} style={{
            padding: '6px 20px', borderRadius: 6, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 700, letterSpacing: '0.02em',
            background: tab === t ? (t === 'after' ? 'var(--green)' : 'var(--red)') : 'transparent',
            color: tab === t ? 'white' : 'var(--text-muted)',
            transition: 'all 0.2s ease',
          }}>{label}</button>
        ))}
      </div>

      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', width: '100%', maxWidth: 420, boxShadow: '0 16px 60px oklch(0 0 0 / 0.12)' }}>
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
          <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>Applications · Senior PM, Stripe</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: tab === 'after' ? 'var(--green)' : 'var(--text-faint)', animation: tab === 'after' ? 'rp-slideIn 0.4s ease' : 'none' }}>
            {tab === 'after' ? '✓ 1 shortlisted' : '0 shortlisted'}
          </span>
        </div>

        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {applicants.map((a, i) => {
            const isCall = a.match >= 75 || (a.isYou && tab === 'after');
            const matchColor = a.match >= 80 ? 'var(--green)' : a.match >= 60 ? 'var(--accent)' : 'var(--red)';
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8,
                border: a.isYou
                  ? (isCall ? '1.5px solid oklch(0.55 0.17 155 / 0.5)' : '1.5px solid oklch(0.55 0.18 25 / 0.4)')
                  : '1px solid var(--border-subtle)',
                background: a.isYou
                  ? (isCall ? 'oklch(0.55 0.17 155 / 0.05)' : 'oklch(0.55 0.18 25 / 0.04)')
                  : 'transparent',
                transition: 'all 0.4s ease',
              }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: a.isYou ? 'var(--accent)' : 'var(--surface2)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: a.isYou ? 'white' : 'var(--text-faint)', flexShrink: 0 }}>{a.name[0]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: a.isYou ? 700 : 500, color: a.isYou ? 'var(--text)' : 'var(--text-muted)' }}>
                    {a.name}
                    {a.isYou && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', marginLeft: 6, background: 'var(--accent-dim)', padding: '1px 6px', borderRadius: 4 }}>YOU</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>{a.role}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: matchColor }}>{a.match}%</div>
                  {isCall
                    ? <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', background: 'var(--green-dim)', border: '1px solid oklch(0.55 0.17 155 / 0.3)', padding: '2px 8px', borderRadius: 4, letterSpacing: '0.05em' }}>✓ CALL</div>
                    : <div style={{ fontSize: 10, fontWeight: 700, color: 'oklch(0.55 0.18 25)', background: 'oklch(0.55 0.18 25 / 0.1)', border: '1px solid oklch(0.55 0.18 25 / 0.25)', padding: '2px 8px', borderRadius: 4, letterSpacing: '0.05em' }}>SKIP</div>
                  }
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Avg. recruiter time per resume: <strong style={{ color: 'var(--text-muted)' }}>7 sec</strong></span>
          {tab === 'after' && <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--green)', animation: 'rp-slideIn 0.4s ease' }}>+45% match ↑</span>}
        </div>
      </div>

      {tab === 'after' && (
        <div style={{ background: 'var(--green-dim)', border: '1px solid oklch(0.72 0.17 155 / 0.3)', borderRadius: 10, padding: '10px 16px', display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%', maxWidth: 420, animation: 'rp-fadeUp 0.4s ease' }}>
          <svg width="15" height="15" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><path d="M2 7l4 4 6-6" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}><strong style={{ color: 'var(--text)' }}>3 achievements selected · 2 bullets rewritten</strong><br />Your resume now speaks the recruiter's language.</span>
        </div>
      )}
    </div>
  );
}

function Hero({ onGetStarted, onCritique }) {
  const [tab, setTab] = useState('before');

  return (
    <section style={{ minHeight: '92vh', display: 'flex', alignItems: 'center', padding: '80px 24px 60px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '20%', left: '42%', width: 700, height: 400, background: 'radial-gradient(ellipse, oklch(0.55 0.18 25 / 0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '5%', width: 500, height: 400, background: 'radial-gradient(ellipse, oklch(0.62 0.19 248 / 0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div className="rp-hero-grid" style={{ maxWidth: 1100, margin: '0 auto', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
        <div style={{ animation: 'rp-fadeUp 0.6s ease 0.1s both' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent-dim)', border: '1px solid oklch(0.62 0.19 248 / 0.25)', borderRadius: 20, padding: '5px 12px', marginBottom: 24 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'block', animation: 'rp-dotBlink 2s ease infinite' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.03em' }}>Now in beta</span>
          </div>

          <h1 style={{ fontSize: 'clamp(38px, 3.8vw, 60px)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.04em', marginBottom: 20 }}>
            Recruiters spend only{' '}
            <span style={{ color: 'var(--red)' }}>7 seconds</span> on<br />
            your resume.
          </h1>

          <p style={{ fontSize: 'clamp(15px, 1.8vw, 17px)', fontWeight: 700, color: 'var(--text)', lineHeight: 1.5, maxWidth: 460, marginBottom: 12 }}>
            Don't leave your career to chance.
          </p>

          <p style={{ fontSize: 'clamp(14px, 1.6vw, 16px)', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 460, marginBottom: 36 }}>
            Most resumes get skipped. Yours shouldn't be.<br />
            Paste a job link — RolePitch picks your strongest achievements and rewrites to match the role. In 60 seconds.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 36 }}>
            <button style={{
              background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer',
              padding: '14px 26px', borderRadius: 10, fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em',
              display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s ease',
              boxShadow: '0 4px 20px oklch(0.62 0.19 248 / 0.35)',
            }} onClick={onGetStarted}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
              Get shortlisted — free
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'rp-arrowMove 1.5s ease infinite' }}>
                <path d="M1 7h12M8 3l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button style={{
              background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer',
              padding: '14px 22px', borderRadius: 10, fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em',
              display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s ease',
            }} onClick={onCritique}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'translateY(0)'; }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M7 4.5v3M7 9.5h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              Roast my resume
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex' }}>
              {[['#4f46e5', 'A'], ['#0e9f6e', 'B'], ['#9333ea', 'C'], ['#ea580c', 'D']].map(([c, l], i) => (
                <div key={i} style={{ width: 28, height: 28, borderRadius: '50%', background: c, marginLeft: i > 0 ? -7 : 0, border: '2px solid var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'white', fontWeight: 700 }}>{l}</div>
              ))}
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text)' }}>5 free pitches</strong> · no card required
            </span>
          </div>
        </div>

        <div style={{ animation: 'rp-fadeUp 0.6s ease 0.25s both' }}>
          <RecruiterInbox tab={tab} setTab={setTab} />
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const quotes = [
    { text: <span>Got <strong style={{ color: 'var(--accent)' }}>3 interview calls in one week</strong> after using RolePitch. Previously sending 30 apps with the same resume got me nothing.</span>, name: 'Shreya M.', role: 'Product Manager · Bangalore', color: '#4f46e5', init: 'S' },
    { text: <span>I was applying to the same companies for months. RolePitch showed me <strong style={{ color: 'var(--accent)' }}>exactly why I wasn't getting picked</strong> — and fixed it in minutes.</span>, name: 'Arjun T.', role: 'Software Engineer · Hyderabad', color: '#0e9f6e', init: 'A' },
    { text: <span>"Roast my resume" was brutal. And completely right. <strong style={{ color: 'var(--accent)' }}>Rewrote 4 bullets. Got a recruiter callback the same day.</strong></span>, name: 'Priya K.', role: 'Data Analyst · Mumbai', color: '#9333ea', init: 'P' },
  ];
  return (
    <section style={{ padding: '80px 24px', borderTop: '1px solid var(--border-subtle)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.12em', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 14 }}>What people are saying</span>
        <h2 style={{ fontSize: 'clamp(26px,3vw,38px)', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.12, marginBottom: 48, maxWidth: 460 }}>The callbacks<br />started showing up.</h2>
        <div className="rp-testimonials-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {quotes.map((q, i) => (
            <div key={i} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 2 }}>
                {[1,2,3,4,5].map(s => <svg key={s} width="13" height="13" viewBox="0 0 12 12" fill="oklch(0.62 0.16 72)"><path d="M6 1l1.4 3h3.1l-2.5 1.8.9 3L6 7.1 3.1 8.8l.9-3L1.5 4H4.6z"/></svg>)}
              </div>
              <p style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--text)' }}>{q.text}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: q.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'white', fontWeight: 700, flexShrink: 0 }}>{q.init}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{q.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 1 }}>{q.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: '01', title: 'Upload your resume once', desc: 'RolePitch reads your career history and builds a vault of every achievement, metric, and skill. No more copy-paste jobs ever again.', tag: 'Your vault' },
    { n: '02', title: 'Drop any job link', desc: "RolePitch scores your fit against the JD in seconds. Spots gaps, asks 2–3 quick questions — only what it can't figure out itself.", tag: 'Fit scored' },
    { n: '03', title: 'Download. Apply. Win.', desc: 'Your best achievements, repositioned for this specific role. Not a rewrite from scratch — a precise selection. In under 60 seconds.', tag: 'Interview-ready' },
  ];

  return (
    <section id="how" style={{ padding: '96px 24px', borderTop: '1px solid var(--border-subtle)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 60 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.1em', fontWeight: 600, textTransform: 'uppercase' }}>How it works</span>
          <h2 style={{ fontSize: 'clamp(26px,3vw,38px)', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.12, maxWidth: 380, marginTop: 10 }}>
            Under 60 seconds.<br />Seriously.
          </h2>
        </div>
        <div className="rp-steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ padding: '32px 28px', borderRadius: 12, border: '1px solid var(--border-subtle)', position: 'relative', background: i === 2 ? 'var(--accent-dim)' : 'transparent' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', marginBottom: 20, letterSpacing: '0.06em' }}>{s.n}</div>
              {i < 2 && (
                <div style={{ position: 'absolute', top: 42, right: -14, zIndex: 1, color: 'var(--text-faint)' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              )}
              <div style={{ display: 'inline-block', background: 'var(--accent-dim)', border: '1px solid oklch(0.62 0.19 248 / 0.2)', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.03em', marginBottom: 14 }}>{s.tag}</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 10, lineHeight: 1.3 }}>{s.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AtomizationBand() {
  return (
    <section style={{ padding: '48px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{
          borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)',
          padding: '28px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 40, flexWrap: 'wrap', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, oklch(0.62 0.19 248 / 0.06) 1px, transparent 1px)', backgroundSize: '24px 24px', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: 'var(--accent-dim)', border: '1px solid oklch(0.62 0.19 248 / 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="2.5" fill="var(--accent)" />
                <ellipse cx="10" cy="10" rx="8" ry="3.5" stroke="var(--accent)" strokeWidth="1.2" strokeOpacity="0.6" fill="none" />
                <ellipse cx="10" cy="10" rx="8" ry="3.5" stroke="var(--accent)" strokeWidth="1.2" strokeOpacity="0.6" fill="none" transform="rotate(60 10 10)" />
                <ellipse cx="10" cy="10" rx="8" ry="3.5" stroke="var(--accent)" strokeWidth="1.2" strokeOpacity="0.6" fill="none" transform="rotate(120 10 10)" />
              </svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>Atomization™</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid oklch(0.62 0.19 248 / 0.25)', padding: '2px 6px', borderRadius: 4 }}>Proprietary</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 520, margin: 0 }}>
                Our engine breaks your career history into discrete, structured achievement units — then recombines exactly the right ones for each role. Not a rewrite. A precise selection.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, flexShrink: 0, position: 'relative' }}>
            {[['26+', 'achievements extracted'], ['~2s', 'per role match'], ['0', 'resumes rewritten from scratch']].map(([n, l]) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em' }}>{n}</div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2, lineHeight: 1.4, maxWidth: 80 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Differentiator() {
  const rows = [
    { label: 'Remembers your entire career', us: true, them: false },
    { label: 'Selects your best achievements per role', us: true, them: false },
    { label: 'Shows match score before and after', us: true, them: false },
    { label: 'Keeps your original resume design', us: true, them: false },
    { label: 'No subscription — pay only when you need', us: true, them: false },
    { label: 'Generates resume from scratch', us: false, them: true },
  ];

  const Check = ({ on }) => on
    ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="oklch(0.72 0.17 155 / 0.15)" stroke="var(--green)" strokeWidth="1" /><path d="M5 8l2 2 4-4" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    : <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="oklch(0.5 0 0 / 0.08)" stroke="var(--border)" strokeWidth="1" /><path d="M5.5 10.5l5-5M10.5 10.5l-5-5" stroke="var(--text-faint)" strokeWidth="1.5" strokeLinecap="round" /></svg>;

  return (
    <section style={{ padding: '80px 24px', borderTop: '1px solid var(--border-subtle)' }}>
      <div className="rp-diff-grid" style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'start' }}>
        <div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.1em', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 14 }}>Why RolePitch</span>
          <h2 style={{ fontSize: 'clamp(26px,3vw,38px)', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.12, marginBottom: 20 }}>
            Others rewrite.<br />RolePitch <em style={{ fontStyle: 'normal', color: 'var(--green)' }}>selects.</em>
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.75, maxWidth: 380 }}>
            A rewrite that forgets your best work is just noise. RolePitch stores your real achievements and positions them specifically for each role — like a career coach who's read every line of your CV.
          </p>
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', borderBottom: '1px solid var(--border)', padding: '12px 20px', gap: 16, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Feature</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', width: 80, textAlign: 'center' }}>RolePitch</span>
            <span style={{ fontSize: 12, color: 'var(--text-faint)', width: 80, textAlign: 'center' }}>Others</span>
          </div>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', padding: '13px 20px', gap: 16, alignItems: 'center', borderBottom: i < rows.length - 1 ? '1px solid var(--border-subtle)' : 'none', background: r.us && !r.them ? 'oklch(0.72 0.17 155 / 0.03)' : 'transparent' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{r.label}</span>
              <div style={{ width: 80, display: 'flex', justifyContent: 'center' }}><Check on={r.us} /></div>
              <div style={{ width: 80, display: 'flex', justifyContent: 'center' }}><Check on={r.them} /></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing({ onGetStarted }) {
  const [buyLoading, setBuyLoading] = useState(null);
  const [buyError, setBuyError] = useState('');

  const plans = [
    { id: 'free', name: 'Free',       price: '₹0',   sub: '5 pitches to start',          features: ['5 role pitches', 'Achievement vault', 'PDF download', 'Match score feedback'], cta: 'Start free',      highlight: false, badge: null },
    { id: '25',   name: '25 Pitches', price: '₹299', sub: '+ GST · one-time, never expires', features: ['25 pitch credits', 'Never expires', 'Achievement vault', 'PDF download'],      cta: 'Buy 25 pitches', highlight: true,  badge: 'Most Popular' },
    { id: '50',   name: '50 Pitches', price: '₹499', sub: '+ GST · one-time, never expires', features: ['50 pitch credits', 'Never expires', '₹9.98 per pitch', 'PDF download'],        cta: 'Buy 50 pitches', highlight: false, badge: null },
  ];

  const handleBuy = async (plan) => {
    if (plan.id === 'free') { onGetStarted(); return; }
    setBuyLoading(plan.id);
    setBuyError('');
    try {
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: plan.id }),
      });
      // Not logged in — redirect to sign in first
      if (res.status === 401) { window.location.href = '/rolepitch/auth?redirect=/rolepitch%23pricing'; return; }
      const order = await res.json();
      if (!res.ok || order.error) throw new Error(order.error || 'Failed to create order');

      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'RolePitch',
        description: order.label,
        order_id: order.order_id,
        theme: { color: '#4f46e5' },
        handler: async (response) => {
          const vRes = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const vData = await vRes.json();
          if (vData.ok) window.location.href = '/rolepitch/dashboard';
          else setBuyError(vData.error || 'Verification failed');
        },
        modal: { ondismiss: () => setBuyLoading(null) },
      });
      rzp.on('payment.failed', (r) => { setBuyError(r.error?.description || 'Payment failed'); setBuyLoading(null); });
      rzp.open();
    } catch (err) {
      setBuyError(err.message);
      setBuyLoading(null);
    }
  };

  return (
    <section id="pricing" style={{ padding: '96px 24px', borderTop: '1px solid var(--border-subtle)' }}>
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.1em', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 14 }}>Pricing</span>
          <h2 style={{ fontSize: 'clamp(26px,3vw,38px)', fontWeight: 700, letterSpacing: '-0.035em' }}>Pay only when you need more.</h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 12 }}>No subscription. No monthly pressure. Credits never expire.</p>
        </div>
        {buyError && <div style={{ textAlign: 'center', fontSize: 13, color: 'oklch(0.65 0.2 30)', marginBottom: 20 }}>{buyError}</div>}
        <div className="rp-pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, alignItems: 'start' }}>
          {plans.map((p, i) => (
            <div key={i} style={{
              borderRadius: 12, padding: '28px 24px',
              background: 'var(--surface)',
              border: p.highlight ? '1px solid oklch(0.62 0.19 248 / 0.5)' : '1px solid var(--border)',
              boxShadow: p.highlight ? '0 4px 40px oklch(0.62 0.19 248 / 0.15)' : 'none',
              position: 'relative', marginTop: p.highlight ? -8 : 0,
            }}>
              {p.badge && (
                <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: 'white', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{p.badge}</div>
              )}
              <div style={{ marginBottom: 6, fontSize: 13, fontWeight: 600, color: p.highlight ? 'var(--accent)' : 'var(--text-muted)' }}>{p.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em' }}>{p.price}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 24 }}>{p.sub}</div>
              <button
                onClick={() => handleBuy(p)}
                disabled={buyLoading === p.id}
                style={{
                  width: '100%', padding: '11px', borderRadius: 8, border: 'none', cursor: buyLoading === p.id ? 'not-allowed' : 'pointer',
                  fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em',
                  background: p.highlight ? 'var(--accent)' : 'var(--surface2)',
                  color: p.highlight ? 'white' : 'var(--text)',
                  marginBottom: 24, opacity: buyLoading === p.id ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {buyLoading === p.id
                  ? <><div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${p.highlight ? 'white' : 'var(--text)'}`, borderTopColor: 'transparent', animation: 'rp-spin 0.7s linear infinite' }} />Processing…</>
                  : p.cta}
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {p.features.map((f, j) => (
                  <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3 3 7-6" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-faint)', marginTop: 24 }}>All prices in INR · GST 18% added at checkout · Credits never expire</p>
      </div>
    </section>
  );
}

const ATS_SLUG = 'why-your-resume-gets-rejected-by-ats-and-exactly-how-to-fix-it-for-remote-first-companies';

function BlogPreview() {
  const [posts, setPosts] = useState([]);
  useEffect(() => {
    fetch('/api/rolepitch/blog-preview')
      .then((r) => r.ok ? r.json() : { posts: [] })
      .then((d) => setPosts(d.posts || []))
      .catch(() => {});
  }, []);
  if (!posts.length) return null;
  const ats = posts.find((p) => p.slug === ATS_SLUG);
  const others = posts.filter((p) => p.slug !== ATS_SLUG);
  const cards = ats ? [ats, ...others].slice(0, 2) : posts.slice(0, 2);
  return (
    <section style={{ padding: '80px 24px', borderTop: '1px solid var(--border-subtle)' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>From the blog</h2>
          <a href="/blog" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>View all →</a>
        </div>
        <div className="rp-blog-preview" style={{ display: 'none', flexDirection: 'column', gap: 12 }}>
          {cards.map((p) => (
            <a key={p.slug} href={`/blog/${p.slug}`} style={{ textDecoration: 'none' }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
                {p.tag && <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)', display: 'block', marginBottom: 6 }}>{p.tag}</span>}
                <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text)', lineHeight: 1.4, marginBottom: 6 }}>{p.title}</div>
                <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{p.read_time || '5 min read'}</span>
              </div>
            </a>
          ))}
        </div>
        <div className="rp-blog-desktop" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {cards.map((p) => (
            <a key={p.slug} href={`/blog/${p.slug}`} style={{ textDecoration: 'none' }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', height: '100%', boxSizing: 'border-box' }}>
                {p.tag && <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)', display: 'block', marginBottom: 8 }}>{p.tag}</span>}
                <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text)', lineHeight: 1.4, marginBottom: 8 }}>{p.title}</div>
                <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{p.read_time || '5 min read'}</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ padding: '32px 24px', borderTop: '1px solid var(--border-subtle)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 20, height: 20, background: 'var(--accent)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M2 7h7M2 11h9" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </div>
          <span style={{ fontWeight: 600, fontSize: 13 }}>RolePitch</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <a href="/blog" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>Blog</a>
          <a href="/privacy" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>Privacy</a>
          <a href="/terms" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>Terms</a>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>© 2026 RolePitch. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}

export default function RolePitchLanding() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [campaign, setCampaign] = useState(null);
  const [showCampaignModal, setShowCampaignModal] = useState(false);

  // If we landed here mid-OAuth (Supabase Site-URL fallback for critique flow),
  // we want to skip rendering the landing entirely and show a loader until the
  // post-signup useEffect routes us out. Compute synchronously from URL.
  const isOAuthHandoff = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('code');

  useEffect(() => {
    if (isOAuthHandoff) return;
    createClient().auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setAuthChecked(true);
      if (user) {
        window.location.replace('/rolepitch/dashboard');
      }
    }).catch(() => setAuthChecked(true));
  }, [isOAuthHandoff]);

  // Detect ?ref=CODE → fetch campaign details → show modal + persist code for OAuth roundtrip.
  useEffect(() => {
    if (isOAuthHandoff) return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (!ref) return;

    fetch(`/api/rolepitch/campaign/${encodeURIComponent(ref)}`)
      .then(r => r.ok ? r.json() : null)
      .then(c => {
        if (!c || c.error) return;
        localStorage.setItem('rp_campaign_code', c.code);
        setCampaign(c);
        // Redirect-only campaigns (bonus_pitches === 0): track + persist code for attribution,
        // but skip the bonus modal so the user lands on the normal homepage.
        if (Number(c.bonus_pitches) > 0) {
          setShowCampaignModal(true);
        }
        track('rp_campaign_landed', { code: c.code, name: c.name, bonus: c.bonus_pitches });
      })
      .catch(() => {});
  }, [isOAuthHandoff]);

  // Handle OAuth callback code landing on root.
  // Supabase already exchanged the code and set the session cookie before redirecting here,
  // so we just need to route the user — DON'T re-call /api/auth/callback (which would
  // try to re-exchange a single-use code and fail with oauth_failed).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        window.location.replace('/rolepitch/auth?error=oauth_failed');
        return;
      }

      // Critique handoff: claim any pending critique, then route to start (JD input)
      let critiqueId = null;
      let fromCritique = false;
      try {
        const sess = JSON.parse(sessionStorage.getItem('rp_session') || '{}');
        const local = JSON.parse(localStorage.getItem('rp_session') || '{}');
        critiqueId = sess.critiqueId || local.critiqueId || null;
        fromCritique = !!(sess.fromCritique || local.fromCritique);
      } catch {}

      let critiqueClaimed = false;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (critiqueId && token) {
        try {
          const res = await fetch('/api/rolepitch/claim-critique', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ critique_id: critiqueId }),
          });
          const j = await res.json().catch(() => ({}));
          critiqueClaimed = !!j.claimed;
        } catch {}
      }

      // Campaign redemption — fire-and-forget; idempotent on the server.
      try {
        const refCode = localStorage.getItem('rp_campaign_code');
        if (refCode && token) {
          const res = await fetch('/api/rolepitch/campaign/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ code: refCode }),
          });
          const j = await res.json().catch(() => ({}));
          if (j?.granted || j?.already_redeemed) {
            localStorage.removeItem('rp_campaign_code');
            track('rp_campaign_redeemed', { code: refCode, granted: j.granted || 0 });
          }
        }
      } catch {}

      // If they came from critique AND we successfully claimed it → auto-tailor flow.
      // Otherwise fall back to dashboard — user is signed in, no critique context to
      // honor, so step=6 of /start with no parsedResume in session is a dead-end.
      let dest;
      if (fromCritique && critiqueId && critiqueClaimed) {
        dest = `/rolepitch/tailoring?critique_id=${encodeURIComponent(critiqueId)}`;
      } else if (fromCritique) {
        dest = '/rolepitch/start?step=0&source=critique';
      } else {
        dest = '/rolepitch/dashboard';
      }
      window.location.replace(dest);
    });
  }, []);


  const isRolePitchDomain = typeof window !== 'undefined' && (window.location.hostname === 'rolepitch.com' || window.location.hostname === 'www.rolepitch.com');
  const handleGetStarted = () => {
    track('rp_get_started_clicked', { source: 'landing', user_signed_in: !!user });
    if (user) {
      router.push('/rolepitch/dashboard');
      return;
    }
    router.push(isRolePitchDomain ? '/start' : '/rolepitch/start');
  };
  const handleCritique = () => {
    track('rp_critique_clicked', { source: 'landing' });
    router.push(isRolePitchDomain ? '/critique' : '/rolepitch/critique');
  };
  const handleDashboard = () => router.push('/rolepitch/dashboard');
  const handleSignIn = () => {
    track('rp_sign_in_clicked', { source: 'landing' });
    // Reuse the auth page, redirect to dashboard after sign-in
    const supabase = createClient();
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent('/rolepitch/dashboard')}`,
        scopes: 'email profile',
      },
    });
  };

  // OAuth handoff: don't flash the landing UI — show a loader until our
  // post-OAuth useEffect routes the user to /tailoring or /start.
  if (isOAuthHandoff) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        background: 'oklch(0.98 0.006 248)',
        fontFamily: 'DM Sans, sans-serif',
        color: 'oklch(0.16 0.03 248)',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '2.5px solid oklch(0.86 0.015 248)',
          borderTopColor: 'oklch(0.50 0.19 248)',
          animation: 'rp-spin 0.8s linear infinite',
        }} />
        <div style={{ fontSize: 14, color: 'oklch(0.44 0.04 248)' }}>Signing you in…</div>
        <style>{`@keyframes rp-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
      <style>{CSS_VARS}</style>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
      <div className="rp-root">
        <Nav onGetStarted={handleGetStarted} onSignIn={handleSignIn} user={user} authChecked={authChecked} onDashboard={handleDashboard} />
        <Hero onGetStarted={handleGetStarted} onCritique={handleCritique} />
        <Testimonials />
        <HowItWorks />
        <AtomizationBand />
        <Differentiator />
        <Pricing onGetStarted={handleGetStarted} />
        <BlogPreview />
        <Footer />
        {showCampaignModal && campaign && (
          <CampaignModal
            campaign={campaign}
            onClose={() => setShowCampaignModal(false)}
            onClaim={() => {
              track('rp_campaign_claim_clicked', { code: campaign.code });
              // Route through /rolepitch/auth (implicit flow) — PKCE via /api/auth/callback
              // loses the verifier cookie across paths. The auth page redeems the campaign
              // from localStorage and writes the session cookie before sending the user to
              // `redirect`, so dashboard reads the live credit total from the server.
              const dest = '/rolepitch/dashboard?welcome=1';
              window.location.href = `/rolepitch/auth?source=campaign&redirect=${encodeURIComponent(dest)}`;
            }}
          />
        )}
      </div>
    </>
  );
}

function CampaignModal({ campaign, onClose, onClaim }) {
  const expiry = new Date(campaign.expires_at);
  const expiryLabel = expiry.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  });
  // ₹299 / 25 pitches = ₹11.96/pitch — round to ₹12 so the modal never claims
  // a higher per-unit price than what the user can actually pay on the pricing page.
  const inrValue = campaign.bonus_pitches * 12;
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rp-camp-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'oklch(0 0 0 / 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, animation: 'rp-fadeUp 0.25s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rp-camp-card"
        style={{
          background: 'var(--card-bg)', borderRadius: 16, padding: 28,
          maxWidth: 420, width: '100%',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 60px oklch(0 0 0 / 0.25)',
          animation: 'rp-fadeUp 0.35s ease',
        }}
      >
        <style>{`
          @media (max-width: 480px) {
            .rp-camp-card { padding: 22px 18px !important; }
            .rp-camp-card h2 { font-size: 19px !important; line-height: 1.3 !important; }
          }
        `}</style>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 10px', borderRadius: 999,
          background: 'var(--green-dim)', color: 'var(--green)',
          fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase',
          marginBottom: 14,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />
          Exclusive referral
        </div>
        <h2 id="rp-camp-title" style={{
          fontSize: 22, fontWeight: 600, color: 'var(--text)',
          letterSpacing: '-0.02em', lineHeight: 1.25, margin: '0 0 10px',
        }}>
          Sign up to receive {campaign.bonus_pitches} additional pitches worth ₹{inrValue.toFixed(0)}/-
        </h2>
        <p style={{
          fontSize: 14, lineHeight: 1.6, color: 'var(--text-muted)', margin: '0 0 18px',
        }}>
          You'll get <strong style={{ color: 'var(--text)' }}>5 free pitches + {campaign.bonus_pitches} bonus = {5 + campaign.bonus_pitches} total</strong> on signup.
          Tailor your resume for any job in under 30 seconds.
        </p>
        <div style={{
          padding: '10px 12px', borderRadius: 8,
          background: 'var(--surface)', border: '1px solid var(--border-subtle)',
          fontSize: 12, color: 'var(--text-muted)', marginBottom: 18,
          fontFamily: 'var(--mono)',
        }}>
          ⏱ Valid until {expiryLabel}
        </div>
        <button
          onClick={onClaim}
          style={{
            width: '100%', padding: '12px 18px', borderRadius: 10,
            background: 'var(--accent)', color: 'white', border: 'none',
            fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', cursor: 'pointer',
          }}
        >
          Claim my {campaign.bonus_pitches} bonus pitches →
        </button>
        <button
          onClick={onClose}
          style={{
            width: '100%', marginTop: 8, padding: '10px',
            background: 'transparent', color: 'var(--text-faint)', border: 'none',
            fontSize: 12, cursor: 'pointer',
          }}
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
