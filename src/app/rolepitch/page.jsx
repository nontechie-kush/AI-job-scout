'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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
    .rp-nav-signin { display: none !important; }
    .rp-score-card { top: -8px !important; right: -8px !important; padding: 8px 12px !important; }
    .rp-score-ring { width: 100px !important; height: 100px !important; }
    .rp-score-ring svg { width: 100px !important; height: 100px !important; }
    .rp-score-ring svg circle { cx: 50px !important; cy: 50px !important; r: 38px !important; }
    .rp-score-num { font-size: 24px !important; }
    .rp-atom-stats { gap: 12px !important; }
    .rp-atom-stats div { font-size: 16px !important; }
  }
`;

function Nav({ dark, setDark, onGetStarted, onSignIn, user, onDashboard }) {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="#how" className="rp-nav-links" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>How it works</a>
          <a href="#pricing" className="rp-nav-links" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>Pricing</a>
          <button onClick={() => setDark(d => !d)} style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
            width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {dark
              ? <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="3" stroke="var(--text)" strokeWidth="1.4" /><path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M3.1 3.1l1.06 1.06M10.84 10.84l1.06 1.06M3.1 11.9l1.06-1.06M10.84 4.16l1.06-1.06" stroke="var(--text)" strokeWidth="1.4" strokeLinecap="round" /></svg>
              : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12.5 8.5A5.5 5.5 0 015.5 1.5a5.5 5.5 0 100 11 5.5 5.5 0 007-4z" stroke="var(--text)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            }
          </button>
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
              }} onClick={onGetStarted}>
                Get started
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function ScoreCounter({ from, to, duration = 1600, delay = 400 }) {
  const [val, setVal] = useState(from);
  const [done, setDone] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (startedRef.current) return;
      startedRef.current = true;
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - p, 4);
        setVal(Math.round(from + (to - from) * ease));
        if (p < 1) requestAnimationFrame(tick);
        else setDone(true);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(timeout);
  }, [from, to, duration, delay]);

  const r = 54, circ = 2 * Math.PI * r;
  const offset = circ * (1 - val / 100);
  const color = val >= 80 ? 'var(--green)' : val >= 60 ? 'var(--accent)' : 'var(--text-muted)';

  return (
    <div style={{ position: 'relative', width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="140" height="140" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
        <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke 0.3s ease', filter: done ? `drop-shadow(0 0 6px ${color})` : 'none' }} />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 32, fontWeight: 600, color, lineHeight: 1 }}>
          {val}<span style={{ fontSize: 18 }}>%</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>match</div>
      </div>
    </div>
  );
}

function ResumeCard({ highlighted = false, label, score }) {
  const lines = [
    { w: '85%', h: 8 }, { w: '60%', h: 6, mt: 4 },
    { w: '40%', h: 5, mt: 16, isLabel: true }, { w: '95%', h: 5, accent: highlighted, mt: 6 },
    { w: '88%', h: 5, accent: highlighted, mt: 4 }, { w: '70%', h: 5, mt: 4 },
    { w: '40%', h: 5, mt: 14, isLabel: true }, { w: '90%', h: 5, mt: 6 }, { w: '80%', h: 5, mt: 4 },
  ];
  return (
    <div style={{
      background: 'var(--card-bg)', borderRadius: 10, padding: '20px 18px',
      boxShadow: highlighted
        ? '0 8px 40px oklch(0 0 0 / 0.2), 0 0 0 1px oklch(0.72 0.17 155 / 0.3)'
        : '0 4px 24px oklch(0 0 0 / 0.12)',
      position: 'relative', minWidth: 220, width: '100%',
    }}>
      {label && (
        <div style={{
          position: 'absolute', top: -10, left: 14,
          background: highlighted ? 'var(--green)' : 'var(--surface2)',
          color: highlighted ? 'white' : 'var(--text-muted)',
          fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
          padding: '3px 8px', borderRadius: 4,
        }}>{label}</div>
      )}
      {lines.map((l, i) => (
        <div key={i} style={{
          height: l.h, width: l.w, borderRadius: 3, marginTop: l.mt || 0,
          background: l.accent
            ? 'linear-gradient(90deg, oklch(0.72 0.17 155 / 0.35) 0%, oklch(0.62 0.19 248 / 0.2) 100%)'
            : l.isLabel ? 'oklch(0.75 0.04 248)' : 'oklch(0.88 0.01 248)',
          border: l.accent ? '1px solid oklch(0.72 0.17 155 / 0.4)' : 'none',
        }} />
      ))}
      {score !== undefined && (
        <div style={{
          position: 'absolute', bottom: 12, right: 12,
          fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
          color: highlighted ? 'var(--green)' : 'oklch(0.55 0.03 248)',
          background: highlighted ? 'oklch(0.72 0.17 155 / 0.12)' : 'oklch(0.88 0.01 248)',
          padding: '3px 7px', borderRadius: 4,
        }}>{score}%</div>
      )}
    </div>
  );
}

function Hero({ onGetStarted }) {
  const [tab, setTab] = useState('after');

  return (
    <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', padding: '80px 24px 60px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translate(-30%,-50%)', width: 800, height: 500, background: 'radial-gradient(ellipse at center, oklch(0.62 0.19 248 / 0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '5%', width: 400, height: 400, background: 'radial-gradient(ellipse at center, oklch(0.72 0.17 155 / 0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div className="rp-hero-grid" style={{ maxWidth: 1100, margin: '0 auto', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
        <div>
          <div className="rp-fade-up-1" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent-dim)', border: '1px solid oklch(0.62 0.19 248 / 0.25)', borderRadius: 20, padding: '5px 12px', marginBottom: 24 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'block', animation: 'rp-dotBlink 2s ease infinite' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.03em' }}>Now in beta</span>
          </div>

          <h1 className="rp-fade-up-2" style={{ fontSize: 'clamp(36px, 4.5vw, 58px)', fontWeight: 600, lineHeight: 1.08, letterSpacing: '-0.04em', marginBottom: 20 }}>
            Your resume,<br />
            <span style={{ background: 'linear-gradient(135deg, var(--text) 0%, var(--text-muted) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>pitched to every role.</span>
          </h1>

          <p className="rp-fade-up-3" style={{ fontSize: 'clamp(15px, 1.8vw, 18px)', color: 'var(--text-muted)', lineHeight: 1.65, maxWidth: 440, marginBottom: 36, fontWeight: 400 }}>
            Paste a job link. RolePitch selects your best achievements and rewrites them to match — in under 60 seconds.
          </p>

          <div className="rp-fade-up-4" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button style={{
              background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer',
              padding: '13px 24px', borderRadius: 9, fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em',
              display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s ease',
              boxShadow: '0 4px 20px oklch(0.62 0.19 248 / 0.35)',
            }} onClick={onGetStarted}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
              Get Started — it&apos;s free
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'rp-arrowMove 1.5s ease infinite' }}>
                <path d="M1 7h12M8 3l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <a href="#how" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, padding: '13px 4px' }}>
              See how it works
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>

          <div className="rp-fade-up-4" style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 36 }}>
            <div style={{ display: 'flex' }}>
              {['#2563eb', '#16a34a', '#9333ea', '#ea580c'].map((c, i) => (
                <div key={i} style={{ width: 26, height: 26, borderRadius: '50%', background: c, marginLeft: i > 0 ? -6 : 0, border: '2px solid var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'white', fontWeight: 700 }}>{String.fromCharCode(65 + i)}</div>
              ))}
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text)' }}>1,200+</strong> resumes tailored this week
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', gap: 0, background: 'var(--surface)', borderRadius: 8, padding: 3, border: '1px solid var(--border-subtle)' }}>
            {['before', 'after'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '6px 18px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, letterSpacing: '0.03em', textTransform: 'capitalize',
                background: tab === t ? (t === 'after' ? 'var(--green)' : 'var(--surface2)') : 'transparent',
                color: tab === t ? (t === 'after' ? 'white' : 'var(--text)') : 'var(--text-muted)',
                transition: 'all 0.2s ease',
              }}>{t}</button>
            ))}
          </div>

          <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
            <div className="rp-score-card" style={{
              position: 'absolute', top: -16, right: -16, zIndex: 10,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 16, padding: '12px 16px',
              boxShadow: '0 8px 32px oklch(0 0 0 / 0.15)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <ScoreCounter from={63} to={tab === 'after' ? 84 : 63} key={tab} />
              {tab === 'after' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--green)', fontWeight: 600, fontFamily: 'var(--mono)' }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 8V2M2 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  +21% improvement
                </div>
              )}
            </div>

            <div style={{ paddingTop: 24 }}>
              <ResumeCard highlighted={tab === 'after'} label={tab === 'before' ? 'Generic resume' : 'Pitched resume'} score={tab === 'before' ? 63 : 84} />
            </div>

            {tab === 'after' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                <div style={{ background: 'var(--green-dim)', border: '1px solid oklch(0.72 0.17 155 / 0.25)', borderRadius: 8, padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><path d="M2 7l4 4 6-6" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--text)' }}>3 achievements selected</strong> · 2 bullets rewritten to match Product Manager, Stripe
                  </span>
                </div>
                <div style={{ background: 'var(--accent-dim)', border: '1px solid oklch(0.62 0.19 248 / 0.2)', borderRadius: 8, padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}><rect x="2" y="2" width="10" height="10" rx="2" stroke="var(--accent)" strokeWidth="1.4" /><path d="M4 5h6M4 7.5h4" stroke="var(--accent)" strokeWidth="1.2" strokeLinecap="round" /></svg>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--text)' }}>Your original layout preserved</strong> — or switch to a clean template
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: '01', title: 'Upload your resume', desc: 'We read your work history and extract every meaningful achievement into your personal vault.', tag: 'Vault built' },
    { n: '02', title: 'Paste a job link', desc: 'RolePitch analyzes the role requirements and matches them against your vault of achievements.', tag: 'Fit analyzed' },
    { n: '03', title: 'Download your pitch', desc: 'Your resume is rewritten with the best-fit achievements selected and bullets improved to match. Done in under 60 seconds.', tag: 'Ready to send' },
  ];

  return (
    <section id="how" style={{ padding: '96px 24px', borderTop: '1px solid var(--border-subtle)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 60 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.1em', fontWeight: 600, textTransform: 'uppercase' }}>How it works</span>
          <h2 style={{ fontSize: 'clamp(26px,3vw,38px)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.15, maxWidth: 480, marginTop: 10 }}>
            Three steps.<br />Under 60 seconds.
          </h2>
        </div>
        <div className="rp-steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ padding: '32px 28px', borderRadius: 12, border: '1px solid transparent', position: 'relative' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', marginBottom: 24, letterSpacing: '0.06em' }}>{s.n}</div>
              {i < 2 && (
                <div style={{ position: 'absolute', top: 40, right: -16, zIndex: 1, color: 'var(--text-faint)' }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8h12M10 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              )}
              <div style={{ display: 'inline-block', background: 'var(--accent-dim)', border: '1px solid oklch(0.62 0.19 248 / 0.2)', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.03em', marginBottom: 16 }}>{s.tag}</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 10, lineHeight: 1.3 }}>{s.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.65 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AtomizationBand() {
  return (
    <section style={{ padding: '0 24px' }}>
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
    { label: 'Remembers your career', us: true, them: false },
    { label: 'Selects best-fit achievements', us: true, them: false },
    { label: 'Shows match score delta', us: true, them: false },
    { label: 'Asks gap questions', us: true, them: false },
    { label: 'Lifetime pricing option', us: true, them: false },
    { label: 'Keep your original resume design', us: true, them: false },
    { label: 'Generates new resume from scratch', us: false, them: true },
  ];

  const Check = ({ on }) => on
    ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="oklch(0.72 0.17 155 / 0.15)" stroke="var(--green)" strokeWidth="1" /><path d="M5 8l2 2 4-4" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    : <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="oklch(0.5 0 0 / 0.08)" stroke="var(--border)" strokeWidth="1" /><path d="M5.5 10.5l5-5M10.5 10.5l-5-5" stroke="var(--text-faint)" strokeWidth="1.5" strokeLinecap="round" /></svg>;

  return (
    <section style={{ padding: '80px 24px', borderTop: '1px solid var(--border-subtle)' }}>
      <div className="rp-diff-grid" style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'start' }}>
        <div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.1em', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 14 }}>Why RolePitch</span>
          <h2 style={{ fontSize: 'clamp(26px,3vw,38px)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 20 }}>
            Most tools rewrite.<br />RolePitch <em style={{ fontStyle: 'normal', color: 'var(--green)' }}>selects.</em>
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 380 }}>
            Generic AI rewrites are forgettable. RolePitch stores your real achievements and positions them specifically for each job — like a career coach who knows your whole story.
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
  const plans = [
    { name: 'Free', price: null, sub: 'Get started', features: ['2 role pitches', 'Basic vault', 'PDF download'], cta: 'Start free', highlight: false },
    { name: 'Pro', price: '₹999', period: '/month', sub: 'Most popular', features: ['Unlimited pitches', 'Full career vault', 'Score delta + gap questions', 'Priority generation'], cta: 'Start Pro', highlight: true },
    { name: 'Lifetime', price: '₹5,999', period: 'once', sub: 'Best value', features: ['Everything in Pro', 'Forever access', 'All future features', 'No recurring charges'], cta: 'Get Lifetime', highlight: false },
  ];

  return (
    <section id="pricing" style={{ padding: '96px 24px', borderTop: '1px solid var(--border-subtle)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.1em', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 14 }}>Pricing</span>
          <h2 style={{ fontSize: 'clamp(26px,3vw,38px)', fontWeight: 600, letterSpacing: '-0.03em' }}>Simple. No surprises.</h2>
        </div>
        <div className="rp-pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, alignItems: 'start' }}>
          {plans.map((p, i) => (
            <div key={i} style={{
              borderRadius: 12, padding: '28px 24px',
              background: 'var(--surface)',
              border: p.highlight ? '1px solid oklch(0.62 0.19 248 / 0.5)' : '1px solid var(--border)',
              boxShadow: p.highlight ? '0 4px 40px oklch(0.62 0.19 248 / 0.15)' : 'none',
              position: 'relative', marginTop: p.highlight ? -8 : 0,
            }}>
              {p.highlight && (
                <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: 'white', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Most Popular</div>
              )}
              <div style={{ marginBottom: 6, fontSize: 13, fontWeight: 600, color: p.highlight ? 'var(--accent)' : 'var(--text-muted)' }}>{p.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                {p.price
                  ? <><span style={{ fontFamily: 'var(--mono)', fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em' }}>{p.price}</span><span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{p.period}</span></>
                  : <span style={{ fontFamily: 'var(--mono)', fontSize: 32, fontWeight: 600 }}>Free</span>
                }
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 24 }}>{p.sub}</div>
              <button onClick={onGetStarted} style={{
                width: '100%', padding: '11px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em',
                background: p.highlight ? 'var(--accent)' : 'var(--surface2)',
                color: p.highlight ? 'white' : 'var(--text)',
                marginBottom: 24,
              }}>{p.cta}</button>
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
        <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>© 2026 RolePitch. All rights reserved.</span>
      </div>
    </footer>
  );
}

export default function RolePitchLanding() {
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('rp_theme');
    if (saved === 'dark') setDark(true);
    createClient().auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  // Handle OAuth callback code landing on root (Supabase sometimes redirects here)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      const next = encodeURIComponent('/rolepitch/start?step=6&source=rolepitch');
      window.location.replace(`/api/auth/callback?code=${code}&next=${next}`);
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-rp-theme', dark ? 'dark' : 'light');
    localStorage.setItem('rp_theme', dark ? 'dark' : 'light');
  }, [dark]);

  const isRolePitchDomain = typeof window !== 'undefined' && (window.location.hostname === 'rolepitch.com' || window.location.hostname === 'www.rolepitch.com');
  const handleGetStarted = () => router.push(isRolePitchDomain ? '/start' : '/rolepitch/start');
  const handleDashboard = () => router.push('/rolepitch/dashboard');
  const handleSignIn = () => {
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

  return (
    <>
      <style>{CSS_VARS}</style>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
      <div className="rp-root">
        <Nav dark={dark} setDark={setDark} onGetStarted={handleGetStarted} onSignIn={handleSignIn} user={user} onDashboard={handleDashboard} />
        <Hero onGetStarted={handleGetStarted} />
        <HowItWorks />
        <AtomizationBand />
        <Differentiator />
        <Pricing onGetStarted={handleGetStarted} />
        <Footer />
      </div>
    </>
  );
}
