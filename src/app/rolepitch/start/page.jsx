'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
    --amber: oklch(0.60 0.16 80);
    --amber-dim: oklch(0.60 0.16 80 / 0.10);
    --text: oklch(0.16 0.03 248);
    --text-muted: oklch(0.44 0.04 248);
    --text-faint: oklch(0.62 0.03 248);
    --mono: 'JetBrains Mono', monospace;
    --sans: 'DM Sans', sans-serif;
    --card-bg: oklch(1 0 0);
    --resume-text: oklch(0.2 0.02 248);
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
    --amber: oklch(0.78 0.16 80);
    --amber-dim: oklch(0.78 0.16 80 / 0.12);
    --text: oklch(0.94 0.01 248);
    --text-muted: oklch(0.58 0.04 248);
    --text-faint: oklch(0.38 0.03 248);
    --card-bg: oklch(0.99 0.003 248);
    --resume-text: oklch(0.25 0.02 248);
  }
  .rp-root { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--text); height: 100vh; overflow: hidden; display: flex; flex-direction: column; -webkit-font-smoothing: antialiased; }
  @keyframes rp-spin { to { transform: rotate(360deg); } }
  @keyframes rp-fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes rp-checkPop { 0% { transform: scale(0); } 70% { transform: scale(1.2); } 100% { transform: scale(1); } }
  @keyframes rp-pulse2 { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
  @keyframes rp-slideIn { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes rp-slideInLeft { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: translateX(0); } }
  .rp-anim-in { animation: rp-slideIn 0.35s cubic-bezier(0.22,1,0.36,1) both; min-height: 0; }
  .rp-anim-in-left { animation: rp-slideInLeft 0.35s cubic-bezier(0.22,1,0.36,1) both; min-height: 0; }
  .rp-fade-up { animation: rp-fadeUp 0.4s ease both; }
  .rp-btn-primary {
    background: var(--accent); color: white; border: none; cursor: pointer;
    padding: 13px 28px; border-radius: 9px; font-size: 15px; font-weight: 600;
    font-family: var(--sans); letter-spacing: -0.02em; transition: all 0.15s;
  }
  .rp-btn-primary:hover { background: var(--accent-hover); transform: translateY(-1px); }
  .rp-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
  .rp-btn-ghost {
    background: transparent; color: var(--text-muted); border: 1px solid var(--border);
    cursor: pointer; padding: 12px 24px; border-radius: 9px; font-size: 14px; font-weight: 500;
    font-family: var(--sans); transition: all 0.15s;
  }
  .rp-btn-ghost:hover { color: var(--text); border-color: oklch(0.4 0.04 248); }
  .rp-input {
    background: var(--surface); border: 1px solid var(--border); border-radius: 9px;
    color: var(--text); font-family: var(--sans); font-size: 14px; padding: 12px 14px;
    outline: none; width: 100%; transition: border-color 0.2s;
  }
  .rp-input:focus { border-color: var(--accent); }
  .rp-input::placeholder { color: var(--text-faint); }
  .rp-scroll::-webkit-scrollbar { width: 4px; }
  .rp-scroll::-webkit-scrollbar-track { background: transparent; }
  .rp-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
`;

const SAMPLE_JOB = `Product Manager, Payments Infrastructure\nStripe — Bengaluru, India\n\nWe're looking for a Product Manager to join our Payments Infrastructure team.\n\nResponsibilities:\n• Define strategy for B2B payment infrastructure\n• Lead cross-functional teams across Engineering, Design, and Data`;

// ── shared session state (persisted to localStorage) ─────────────────────────
function loadSession() {
  try {
    return JSON.parse(localStorage.getItem('rp_session') || '{}');
  } catch { return {}; }
}
function saveSession(patch) {
  try {
    const cur = loadSession();
    localStorage.setItem('rp_session', JSON.stringify({ ...cur, ...patch }));
  } catch {}
}

// ── ProgressBar ───────────────────────────────────────────────────────────────
function ProgressBar({ step, total, onHome }) {
  return (
    <div style={{ padding: '16px 32px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
      <button onClick={onHome} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', flexShrink: 0, padding: 0 }}>
        <div style={{ width: 22, height: 22, background: 'var(--accent)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M2 7h7M2 11h9" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </div>
        <span style={{ fontWeight: 600, fontSize: 13 }}>RolePitch</span>
      </button>
      <div style={{ flex: 1, display: 'flex', gap: 4 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{ height: 3, flex: 1, borderRadius: 2, background: i < step ? 'var(--accent)' : i === step ? 'var(--border)' : 'var(--border-subtle)' }} />
        ))}
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-faint)', flexShrink: 0 }}>{step + 1}/{total}</span>
    </div>
  );
}

// ── Step 1: Upload ─────────────────────────────────────────────────────────────
function StepUpload({ onNext, dir }) {
  const [phase, setPhase] = useState('idle'); // idle | dragging | loading | error | done
  const [loadingStep, setLoadingStep] = useState(0);
  const [parseResult, setParseResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileRef = useRef();

  const LOADING_STEPS = ['Reading your experience…', 'Extracting achievements…', 'Building your career vault…'];

  const parseFile = useCallback(async (file) => {
    setPhase('loading');
    setLoadingStep(0);

    // Animate loading steps while waiting for API
    let stepIdx = 0;
    const stepTimer = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, LOADING_STEPS.length - 1);
      setLoadingStep(stepIdx);
    }, 900);

    try {
      const form = new FormData();
      form.append('type', 'pdf');
      form.append('file', file);

      const res = await fetch('/api/rolepitch/parse-resume', { method: 'POST', body: form });
      clearInterval(stepTimer);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }

      const data = await res.json();
      const parsed = data.parsed || data;
      saveSession({ parsedName: parsed.name, parsedResume: parsed });
      setParseResult(parsed);
      setPhase('done');
    } catch (err) {
      clearInterval(stepTimer);
      setErrorMsg(err.message || 'Something went wrong — try again');
      setPhase('error');
    }
  }, []);

  const useSample = useCallback(async () => {
    setPhase('loading');
    setLoadingStep(0);
    let stepIdx = 0;
    const stepTimer = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, LOADING_STEPS.length - 1);
      setLoadingStep(stepIdx);
    }, 900);

    try {
      const form = new FormData();
      form.append('type', 'paste');
      form.append('text', `Kushendra Suryavanshi\nSenior Product Manager\n\nExperience:\nRazorpay (2024–Present) — Senior Product Manager\n• Led cross-functional team of 12 to redesign payment infrastructure, reducing latency by 40%\n• Launched RazorpayX Business Banking to 8,000+ SMEs in 3 months\n\nMeesho (2022–2024) — Product Manager\n• Owned seller onboarding v2 — reduced time-to-first-sale from 11 days to 3.5 days\n• Built A/B testing framework used by 6 product teams, improving experiment velocity by 60%\n• Drove supplier NPS from 34 to 61\n\nFlipkart (2020–2022) — Associate Product Manager\n• Redesigned checkout flow, increasing conversion by 32%\n• Shipped address autofill using ML signals, reducing manual input by 70%`);

      const res = await fetch('/api/rolepitch/parse-resume', { method: 'POST', body: form });
      clearInterval(stepTimer);
      if (!res.ok) throw new Error('Parse failed');
      const data = await res.json();
      const parsed = data.parsed || data;
      saveSession({ parsedName: parsed.name, parsedResume: parsed });
      setParseResult(parsed);
      setPhase('done');
    } catch (err) {
      clearInterval(stepTimer);
      setErrorMsg(err.message);
      setPhase('error');
    }
  }, []);

  return (
    <div className={dir === 1 ? 'rp-anim-in' : 'rp-anim-in-left'} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', gap: 32 }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div className="rp-fade-up" style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Step 1 of 7</div>
        <h1 className="rp-fade-up" style={{ fontSize: 'clamp(26px,3vw,36px)', fontWeight: 600, letterSpacing: '-0.03em', marginBottom: 10 }}>Upload your resume</h1>
        <p className="rp-fade-up" style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.6 }}>RolePitch reads your achievements—not just job titles</p>
      </div>

      {(phase === 'idle' || phase === 'dragging') && (
        <div onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setPhase('dragging'); }}
          onDragLeave={() => setPhase('idle')}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) parseFile(f); }}
          style={{ width: '100%', maxWidth: 480, border: `2px dashed ${phase === 'dragging' ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 14, padding: '52px 32px', textAlign: 'center', cursor: 'pointer', background: phase === 'dragging' ? 'var(--accent-dim)' : 'var(--surface)', transition: 'all 0.2s' }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 14V4M7 8l4-4 4 4" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 15v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Drop your resume here</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>PDF or DOCX — up to 5MB</div>
          <div style={{ display: 'inline-block', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 16px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Browse files</div>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
        </div>
      )}

      {phase === 'loading' && (
        <div style={{ width: '100%', maxWidth: 480, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '36px 32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {LOADING_STEPS.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 22, height: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {i < loadingStep
                    ? <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ animation: 'rp-checkPop 0.3s ease' }}><circle cx="9" cy="9" r="8" fill="var(--green-dim)" stroke="var(--green)" /><path d="M5.5 9l2.5 2.5 4.5-4.5" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    : i === loadingStep
                      ? <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'rp-spin 0.7s linear infinite' }} />
                      : <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border)', margin: 'auto' }} />
                  }
                </div>
                <span style={{ fontSize: 14, color: i <= loadingStep ? 'var(--text)' : 'var(--text-faint)', fontWeight: i === loadingStep ? 500 : 400 }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div style={{ width: '100%', maxWidth: 480, background: 'oklch(0.65 0.2 30 / 0.08)', border: '1px solid oklch(0.65 0.2 30 / 0.3)', borderRadius: 14, padding: '28px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'oklch(0.75 0.15 30)', marginBottom: 16 }}>{errorMsg}</div>
          <button className="rp-btn-ghost" onClick={() => setPhase('idle')} style={{ fontSize: 13 }}>Try again</button>
        </div>
      )}

      {phase === 'done' && (
        <div style={{ width: '100%', maxWidth: 480, background: 'var(--green-dim)', border: '1px solid oklch(0.72 0.17 155 / 0.3)', borderRadius: 14, padding: '28px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8, animation: 'rp-checkPop 0.4s ease' }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Resume parsed successfully</div>
          {parseResult && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Ready to build your vault{parseResult.name ? ` for ${parseResult.name}` : ''}
            </div>
          )}
          <button className="rp-btn-primary" onClick={onNext} style={{ marginTop: 24, width: '100%' }}>Preview my vault →</button>
        </div>
      )}

      {(phase === 'idle' || phase === 'dragging') && (
        <button className="rp-btn-ghost" onClick={useSample} style={{ fontSize: 13 }}>Use sample resume</button>
      )}
    </div>
  );
}

// ── Step 2: Vault ──────────────────────────────────────────────────────────────
const NUGGET_STYLE = {
  achievement: { label: 'achievement', color: 'var(--green)', bg: 'var(--green-dim)', border: 'oklch(0.72 0.17 155 / 0.2)' },
  skill_usage:  { label: 'skill',       color: 'var(--accent)', bg: 'var(--accent-dim)', border: 'oklch(0.50 0.19 248 / 0.2)' },
  context:      { label: 'context',     color: 'var(--text-muted)', bg: 'var(--surface2)', border: 'var(--border)' },
  metric:       { label: 'metric',      color: 'var(--amber)', bg: 'var(--amber-dim)', border: 'oklch(0.60 0.16 80 / 0.2)' },
};

function nuggetStyle(type) {
  return NUGGET_STYLE[type] || NUGGET_STYLE.context;
}

const BULLET_TYPE_STYLE = {
  achievement: { label: 'Achievement', color: 'oklch(0.55 0.18 248)', bg: 'oklch(0.55 0.18 248 / 0.1)', border: 'oklch(0.55 0.18 248 / 0.2)' },
  metric:      { label: 'Metric',      color: 'oklch(0.50 0.17 155)', bg: 'oklch(0.50 0.17 155 / 0.1)', border: 'oklch(0.50 0.17 155 / 0.2)' },
  skill:       { label: 'Skill',       color: 'oklch(0.55 0.16 80)',  bg: 'oklch(0.55 0.16 80 / 0.1)',  border: 'oklch(0.55 0.16 80 / 0.2)' },
  context:     { label: 'Context',     color: 'var(--text-faint)',    bg: 'var(--surface2)',             border: 'var(--border)' },
};

function StepVault({ onNext, onBack, dir }) {
  const [vault, setVault] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({});
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    const session = loadSession();
    const parsed = session.parsedResume;
    if (!parsed) { setError('Resume not found — go back and upload again'); setLoading(false); return; }

    const built = (parsed.experience || []).map((role) => ({
      company: role.company || 'Unknown Company',
      role: role.title || 'Unknown Role',
      period: [role.start_date, role.end_date].filter(Boolean).map(d => d.slice(0, 4)).join(' – ') || '',
      bullets: (role.bullets || []).map(b => ({
        text: typeof b === 'string' ? b : b.text,
        type: (typeof b === 'string' ? 'achievement' : b.type) || 'achievement',
      })),
    })).filter(r => r.bullets.length > 0);

    const bulletCount = built.reduce((s, r) => s + r.bullets.length, 0);
    const typeCounts = {};
    built.forEach(role => role.bullets.forEach(b => {
      typeCounts[b.type] = (typeCounts[b.type] || 0) + 1;
    }));

    setVault(built);
    setTotal(bulletCount);
    setCounts(typeCounts);
    setLoading(false);
  }, []);

  if (loading) return (
    <div className={dir === 1 ? 'rp-anim-in' : 'rp-anim-in-left'} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'rp-spin 0.7s linear infinite' }} />
    </div>
  );

  if (error) return (
    <div className={dir === 1 ? 'rp-anim-in' : 'rp-anim-in-left'} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: 'oklch(0.75 0.15 30)', marginBottom: 16 }}>{error}</p>
        <button className="rp-btn-ghost" onClick={onBack}>← Back</button>
      </div>
    </div>
  );

  return (
    <div className={dir === 1 ? 'rp-anim-in' : 'rp-anim-in-left'} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', gap: 24 }}>
      {/* Header */}
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Step 2 of 7</div>
        <h2 style={{ fontSize: 'clamp(22px,3vw,32px)', fontWeight: 600, letterSpacing: '-0.03em', marginBottom: 8 }}>
          We found <span style={{ color: 'var(--green)' }}>{total} highlights</span> across {vault.length} roles
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>Click any role to review. We&apos;ll use these to tailor your resume.</p>
        {/* Type pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>
          {Object.entries(counts).map(([type, n]) => {
            const s = BULLET_TYPE_STYLE[type] || BULLET_TYPE_STYLE.context;
            return <span key={type} style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, border: `1px solid ${s.border}`, padding: '3px 10px', borderRadius: 5 }}>{n} {s.label}s</span>;
          })}
        </div>
      </div>

      {/* Accordion role list */}
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {vault.map((role, i) => {
          const open = expanded === i;
          return (
            <div key={i} style={{ background: 'var(--surface)', border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.2s' }}>
              {/* Row header — always visible */}
              <button onClick={() => setExpanded(open ? null : i)} style={{ width: '100%', padding: '13px 18px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--sans)', textAlign: 'left' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{role.company}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{role.role}{role.period ? ` · ${role.period}` : ''}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid oklch(0.50 0.19 248 / 0.2)', padding: '2px 8px', borderRadius: 4 }}>{role.bullets.length}</span>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>
                    <path d="M3 5l4 4 4-4" stroke="var(--text-faint)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </button>

              {/* Expanded bullets */}
              {open && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '8px 0' }}>
                  {role.bullets.map((b, bi) => {
                    const s = BULLET_TYPE_STYLE[b.type] || BULLET_TYPE_STYLE.context;
                    return (
                      <div key={bi} style={{ padding: '9px 18px', display: 'flex', gap: 10, alignItems: 'flex-start', borderBottom: bi < role.bullets.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: s.color, background: s.bg, border: `1px solid ${s.border}`, padding: '2px 6px', borderRadius: 4, flexShrink: 0, marginTop: 2 }}>{s.label}</span>
                        <span style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>{b.text}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 560 }}>
        <button className="rp-btn-ghost" onClick={onBack} style={{ flex: '0 0 auto' }}>← Back</button>
        <button className="rp-btn-primary" onClick={onNext} style={{ flex: 1, fontSize: 15 }}>Looks good →</button>
      </div>
    </div>
  );
}

// ── Step 3: Job Input ─────────────────────────────────────────────────────────
function StepJobInput({ onNext, onBack, dir, returning = false }) {
  const [url, setUrl] = useState('');
  const [pasted, setPasted] = useState('');
  const [mode, setMode] = useState('url');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const proceed = useCallback(async () => {
    setError('');
    if (!url.trim() && pasted.trim().length < 30) {
      setError('Please enter a job URL or paste the description');
      return;
    }
    setLoading(true);
    try {
      const body = mode === 'url' && url.trim()
        ? { url: url.trim() }
        : { title: 'Role', company: '', description: pasted.trim() };

      const res = await fetch('/api/rolepitch/init-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.source === 'needs_paste') {
        setError(data.reason || "Couldn't read that URL — paste the job description below");
        setMode('paste');
        setLoading(false);
        return;
      }
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to save job');

      // Save JD to session (jdId may be null for guest users — full JD stored inline)
      saveSession({
        jdId: data.jd_id || null,
        jdTitle: data.title,
        jdCompany: data.company,
        jdDescription: data.description,
        tailoredResumeId: null,
        tailoredResult: null,
      });
      onNext();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [url, pasted, mode, onNext]);

  return (
    <div className={dir === 1 ? 'rp-anim-in' : 'rp-anim-in-left'} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', gap: 28 }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        {!returning && <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Step 3 of 7</div>}
        <h2 style={{ fontSize: 'clamp(24px,3vw,34px)', fontWeight: 600, letterSpacing: '-0.03em', marginBottom: 10 }}>Which role are you applying for?</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.6 }}>Paste the job link and we&apos;ll handle the rest</p>
      </div>

      <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 8, padding: 3, border: '1px solid var(--border-subtle)', alignSelf: 'flex-start' }}>
          {[['url', 'Job URL'], ['paste', 'Paste JD']].map(([v, l]) => (
            <button key={v} onClick={() => { setMode(v); setError(''); }} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--sans)', background: mode === v ? 'var(--surface2)' : 'transparent', color: mode === v ? 'var(--text)' : 'var(--text-muted)', transition: 'all 0.2s' }}>{l}</button>
          ))}
        </div>

        {mode === 'url' ? (
          <input className="rp-input" value={url} onChange={e => { setUrl(e.target.value); setError(''); }} placeholder="https://stripe.com/jobs/product-manager-payments" onKeyDown={e => e.key === 'Enter' && proceed()} />
        ) : (
          <textarea className="rp-input" value={pasted} onChange={e => { setPasted(e.target.value); setError(''); }} placeholder={SAMPLE_JOB} rows={8} style={{ resize: 'none', lineHeight: 1.6, fontSize: 13 }} />
        )}

        {error && (
          <div style={{ background: 'oklch(0.65 0.2 30 / 0.1)', border: '1px solid oklch(0.65 0.2 30 / 0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'oklch(0.75 0.15 30)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" /><path d="M7 4v4M7 9.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button className="rp-btn-ghost" onClick={onBack} disabled={loading} style={{ flex: '0 0 auto' }}>← Back</button>
          <button className="rp-btn-primary" onClick={proceed} disabled={loading} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading
              ? <><div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid white', borderTopColor: 'transparent', animation: 'rp-spin 0.7s linear infinite' }} /> Analyzing…</>
              : 'Analyze fit →'
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step 4: Processing ────────────────────────────────────────────────────────
function StepProcessing({ onNext, dir }) {
  const STEPS = ['Analyzing job requirements', 'Matching your experience', 'Identifying skill gaps', 'Rewriting bullets'];
  const [cur, setCur] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const session = loadSession();
    const { jdId, jdTitle, jdCompany, jdDescription, tailoredResult, parsedResume } = session;

    if (!jdDescription && !jdId) { setError('No job found — go back and enter a job URL'); return; }

    // Already tailored — skip API call
    if (tailoredResult) {
      setCur(STEPS.length - 1);
      setDone(true);
      setTimeout(onNext, 400);
      return;
    }

    // Animate steps while API runs
    let stepIdx = 0;
    const stepTimer = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, STEPS.length - 1);
      setCur(stepIdx);
    }, 900);

    // Use stateless tailor route (works pre-login, uses parsed resume from session)
    fetch('/api/rolepitch/tailor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parsed_resume: parsedResume,
        jd: { title: jdTitle, company: jdCompany, description: jdDescription },
      }),
    })
      .then(r => r.json())
      .then(data => {
        clearInterval(stepTimer);
        if (data.error) throw new Error(data.error);
        saveSession({ tailoredResult: data });
        setCur(STEPS.length - 1);
        setDone(true);
        setTimeout(onNext, 800);
      })
      .catch(err => {
        clearInterval(stepTimer);
        setError(err.message);
      });

    return () => clearInterval(stepTimer);
  }, [onNext]);

  if (error) return (
    <div className={dir === 1 ? 'rp-anim-in' : 'rp-anim-in-left'} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <p style={{ color: 'oklch(0.75 0.15 30)', marginBottom: 8 }}>Hit a wall — not you, it&apos;s them.</p>
        <p style={{ fontSize: 13, color: 'var(--text-faint)', marginBottom: 20 }}>{error}</p>
        <button className="rp-btn-ghost" onClick={() => window.location.reload()}>Retry</button>
      </div>
    </div>
  );

  return (
    <div className={dir === 1 ? 'rp-anim-in' : 'rp-anim-in-left'} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', gap: 40 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Step 4 of 7</div>
        <h2 style={{ fontSize: 'clamp(24px,3vw,34px)', fontWeight: 600, letterSpacing: '-0.03em', marginBottom: 10 }}>{done ? 'Done.' : 'Analyzing your fit…'}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{done ? 'Your resume has been tailored.' : 'This takes about 15 seconds'}</p>
      </div>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {STEPS.map((s, i) => {
          const state = i < cur ? 'done' : i === cur ? 'active' : 'pending';
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 10, background: state === 'done' ? 'var(--green-dim)' : state === 'active' ? 'var(--surface)' : 'transparent', border: `1px solid ${state === 'done' ? 'oklch(0.72 0.17 155 / 0.2)' : state === 'active' ? 'var(--border)' : 'transparent'}`, transition: 'all 0.3s ease' }}>
              <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {state === 'done'
                  ? <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ animation: 'rp-checkPop 0.3s ease' }}><circle cx="10" cy="10" r="9" fill="var(--green-dim)" stroke="var(--green)" strokeWidth="1.2" /><path d="M6 10l3 3 5-5" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  : state === 'active'
                    ? <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'rp-spin 0.7s linear infinite' }} />
                    : <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--border)', margin: 'auto' }} />
                }
              </div>
              <span style={{ fontSize: 14, fontWeight: state === 'active' ? 600 : 400, color: state === 'pending' ? 'var(--text-faint)' : 'var(--text)', transition: 'all 0.3s' }}>{s}</span>
              {state === 'active' && <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent)', animation: 'rp-pulse2 1s ease infinite' }}>running</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ target, size = 120, muted = false }) {
  const [val, setVal] = useState(muted ? target : Math.max(target - 25, 0));
  useEffect(() => {
    const dur = 1000, start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const startVal = muted ? target : Math.max(target - 25, 0);
      setVal(Math.round(startVal + (target - startVal) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, muted]);
  const r = size * 0.38, circ = 2 * Math.PI * r, offset = circ * (1 - val / 100);
  const color = muted ? 'var(--text-muted)' : val >= 80 ? 'var(--green)' : 'var(--accent)';
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.3s', filter: muted ? 'none' : `drop-shadow(0 0 5px ${color})` }} />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: size * 0.22, fontWeight: 600, color, lineHeight: 1 }}>{val}<span style={{ fontSize: size * 0.13 }}>%</span></div>
        <div style={{ fontSize: size * 0.09, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>match</div>
      </div>
    </div>
  );
}

// ── Step 5: Result ────────────────────────────────────────────────────────────
function StepResult({ onNext, onBack, dir }) {
  const [tab, setTab] = useState('after');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const session = loadSession();
    const tr = session.tailoredResult;
    if (!tr) { setError('No tailored resume found — go back and try again'); setLoading(false); return; }

    // Map stateless tailor response to the shape StepResult expects
    const jd = { title: session.jdTitle || '', company: session.jdCompany || '' };
    const bullets_by_role = (tr.tailored?.experience || []).map((role, i) => {
      const origRole = (session.parsedResume?.experience || [])[i] || {};
      return {
        company: role.company,
        role: role.title,
        before: (origRole.bullets || []).map(b => ({ text: typeof b === 'string' ? b : b.text })),
        after: (role.bullets || []).map(b => ({ text: b.text, original: b.original })),
      };
    });
    setResult({ jd, before_score: tr.before_score, after_score: tr.after_score, bullets_by_role, gaps: tr.gaps || [] });
    setLoading(false);
  }, []);

  if (loading) return (
    <div className={dir === 1 ? 'rp-anim-in' : 'rp-anim-in-left'} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'rp-spin 0.7s linear infinite' }} />
    </div>
  );

  if (error || !result) return (
    <div className={dir === 1 ? 'rp-anim-in' : 'rp-anim-in-left'} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: 'oklch(0.75 0.15 30)', marginBottom: 16 }}>{error || 'Result not found'}</p>
        <button className="rp-btn-ghost" onClick={onBack}>← Back</button>
      </div>
    </div>
  );

  // Pick first role that has before+after diff to display
  const displayRole = result.bullets_by_role?.find(r => r.before?.length && r.after?.length) || result.bullets_by_role?.[0];

  return (
    <div className={dir === 1 ? 'rp-anim-in' : 'rp-anim-in-left'} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '24px 32px 0', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Step 5 of 7</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 'clamp(20px,2.5vw,28px)', fontWeight: 600, letterSpacing: '-0.03em' }}>{result.jd?.title || 'Your tailored resume'}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 3 }}>{result.jd?.company ? `${result.jd.company} — ` : ''}matched against your vault</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="rp-btn-ghost" onClick={onBack} style={{ fontSize: 13, padding: '9px 16px' }}>← Back</button>
            <button className="rp-btn-primary" onClick={onNext} style={{ fontSize: 14, padding: '9px 20px' }}>Improve score →</button>
          </div>
        </div>
      </div>

      <div className="rp-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 32px 32px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 24, alignItems: 'start' }}>
        {/* Score panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 200, flexShrink: 0 }}>
          <div style={{ background: tab === 'after' ? 'var(--green-dim)' : 'var(--surface)', border: `1px solid ${tab === 'after' ? 'oklch(0.72 0.17 155 / 0.25)' : 'var(--border)'}`, borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, transition: 'all 0.3s' }}>
            <ScoreRing key={tab} target={tab === 'after' ? result.after_score : result.before_score} size={110} muted={tab === 'before'} />
            <div style={{ textAlign: 'center' }}>
              {tab === 'after'
                ? <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', color: 'var(--green)', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600 }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 8V2M2 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    +{result.after_score - result.before_score}% vs original
                  </div>
                : <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>original resume</div>
              }
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>{result.before_score}% → {result.after_score}%</div>
            </div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ['Highlights used', `${result.stats?.achievements_used} of ${result.stats?.total_achievements}`],
              ['Bullets rewritten', result.stats?.bullets_rewritten],
              ['Layout', 'Preserved ✓'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{k}</span>
                <span style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 600, color: String(v).includes('✓') ? 'var(--green)' : 'var(--text)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Resume preview */}
        {displayRole && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 7, padding: 3, border: '1px solid var(--border-subtle)' }}>
                {['before', 'after'].map(t => (
                  <button key={t} onClick={() => setTab(t)} style={{ padding: '5px 16px', borderRadius: 5, border: 'none', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, textTransform: 'capitalize', background: tab === t ? (t === 'after' ? 'var(--green)' : 'var(--surface2)') : 'transparent', color: tab === t ? (t === 'after' ? 'white' : 'var(--text)') : 'var(--text-muted)', transition: 'all 0.2s' }}>{t === 'after' ? 'After — tailored' : 'Before — original'}</button>
                ))}
              </div>
              {tab === 'before' && <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>generic, not positioned for this role</span>}
              {tab === 'after' && <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 500 }}>{result.stats?.bullets_rewritten} bullets rewritten for this role</span>}
            </div>
            <div style={{ background: 'var(--card-bg)', borderRadius: 10, padding: 28, boxShadow: '0 4px 32px oklch(0 0 0 / 0.12)', border: tab === 'after' ? '1px solid oklch(0.72 0.17 155 / 0.25)' : '1px solid var(--border)', opacity: tab === 'before' ? 0.75 : 1, transition: 'all 0.3s' }}>
              <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '2px solid var(--border)' }}>
                <div style={{ width: '55%', height: 10, background: 'var(--text)', borderRadius: 3, marginBottom: 6, opacity: tab === 'before' ? 0.4 : 1 }} />
                <div style={{ width: '35%', height: 7, background: 'var(--border)', borderRadius: 3 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(tab === 'after' ? displayRole.after : displayRole.before).map((bullet, i) => {
                  const text = typeof bullet === 'string' ? bullet : bullet.text;
                  const isImproved = tab === 'after' && text !== (typeof displayRole.before[i] === 'string' ? displayRole.before[i] : displayRole.before[i]?.text);
                  return (
                    <div key={i} style={{ background: isImproved ? 'oklch(0.72 0.17 155 / 0.07)' : 'transparent', border: isImproved ? '1px solid oklch(0.72 0.17 155 / 0.25)' : '1px solid transparent', borderRadius: 6, padding: isImproved ? '10px 12px' : '2px 0', transition: 'all 0.3s ease' }}>
                      <p style={{ fontSize: 12, lineHeight: 1.75, color: tab === 'before' ? 'var(--text-muted)' : 'var(--resume-text)', fontFamily: 'Georgia,serif', fontStyle: tab === 'before' ? 'normal' : 'normal' }}>{text}</p>
                      {isImproved && <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 5, fontWeight: 700, letterSpacing: '0.05em' }}>↑ REWRITTEN FOR THIS ROLE</div>}
                    </div>
                  );
                })}
                {[90, 75, 82, 65].map((w, i) => <div key={i} style={{ height: 5, width: `${w}%`, background: 'var(--border)', borderRadius: 3, opacity: tab === 'before' ? 0.5 : 0.3 }} />)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 6: Chat Gap Questions ────────────────────────────────────────────────
const DEFAULT_QUESTIONS = [
  { question: 'Do you have experience working directly with enterprise or B2B customers?', tip: 'e.g. customer calls, QBRs, pilots, contracts' },
  { question: 'Have you worked on payment systems or financial infrastructure?', tip: 'e.g. routing, fraud, settlement, compliance' },
  { question: 'Have you led a product through a 0→1 launch at scale?', tip: 'More than 10K users at launch' },
];

function StepGapQuestions({ onNext, onBack, dir }) {
  const [questions, setQuestions] = useState([]);
  const [loadingQ, setLoadingQ] = useState(true);
  const [current, setCurrent] = useState(0);       // which question we're on
  const [draft, setDraft] = useState('');           // current text input
  const [thread, setThread] = useState([]);         // [{role:'pilot'|'user', text}]
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef();
  const scrollRef = useRef();
  const collectedAnswers = useRef([]);             // [{question, answer}]
  const followupPending = useRef(false);           // true when waiting for follow-up reply

  useEffect(() => {
    // Use gap questions from tailored result (no auth needed)
    const session = loadSession();
    const gaps = session.tailoredResult?.gaps;
    let qs = DEFAULT_QUESTIONS;
    if (gaps?.length) {
      qs = gaps.slice(0, 3).map(gap => ({ question: `Tell me more about: ${gap}`, tip: gap }))
        .concat(DEFAULT_QUESTIONS).slice(0, DEFAULT_QUESTIONS.length);
    }
    setQuestions(qs);
    setThread([{ role: 'pilot', text: qs[0].question, tip: qs[0].tip }]);
    setLoadingQ(false);
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread]);

  // Focus input when question appears
  useEffect(() => {
    if (!loadingQ && !done) setTimeout(() => inputRef.current?.focus(), 100);
  }, [current, loadingQ, done]);

  const advanceToNext = useCallback((nextIdx) => {
    if (nextIdx < questions.length) {
      setTimeout(() => {
        setThread(t => [...t, { role: 'pilot', text: questions[nextIdx].question, tip: questions[nextIdx].tip }]);
        setCurrent(nextIdx);
      }, 380);
    } else {
      setTimeout(() => {
        setThread(t => [...t, { role: 'pilot', text: "Got it. Running the final pass now…", tip: null }]);
        setDone(true);
      }, 380);
      // Save answers to session for final output; re-tailor with context
      const session = loadSession();
      saveSession({ chatAnswers: collectedAnswers.current });
      setSubmitting(true);
      fetch('/api/rolepitch/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parsed_resume: session.parsedResume,
          jd: { title: session.jdTitle, company: session.jdCompany, description: session.jdDescription },
          context: collectedAnswers.current,
        }),
      })
        .then(r => r.json())
        .then(data => { if (!data.error) saveSession({ tailoredResult: data }); })
        .catch(() => {})
        .finally(() => { setSubmitting(false); setTimeout(onNext, 1200); });
    }
  }, [questions, onNext]);

  const sendAnswer = useCallback(async (text) => {
    if (!text.trim() && text !== '__skip__') return;
    const isSkip = text === '__skip__';
    const answer = isSkip ? 'Skip' : text.trim();
    const q = questions[current];

    setThread(t => [...t, { role: 'user', text: isSkip ? '(skipped)' : answer }]);
    setDraft('');
    collectedAnswers.current.push({ question: q.question, answer });

    if (isSkip) { advanceToNext(current + 1); return; }

    // Ask Haiku if answer is rich enough or needs a follow-up
    try {
      const res = await fetch('/api/rolepitch/chat-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q.question, answer, tip: q.tip }),
      });
      const data = await res.json();
      if (data.action === 'followup' && data.followup && !followupPending.current) {
        followupPending.current = true;
        setTimeout(() => {
          setThread(t => [...t, { role: 'pilot', text: data.followup, tip: null, isFollowup: true }]);
        }, 380);
        return;
      }
    } catch { /* on error, just advance */ }

    followupPending.current = false;
    advanceToNext(current + 1);
  }, [current, questions, advanceToNext]);

  const handleKey = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAnswer(draft); }
  }, [draft, sendAnswer]);

  return (
    <div className={dir === 1 ? 'rp-anim-in' : 'rp-anim-in-left'} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '20px 32px 0', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--amber)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Step 6 of 7</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 'clamp(18px,2vw,24px)', fontWeight: 600, letterSpacing: '-0.03em' }}>Fill in the gaps</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Your answers are atomized into your vault to improve the score</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {questions.length > 0 && !done && (
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-faint)' }}>{Math.min(current + 1, questions.length)}/{questions.length}</span>
            )}
            <button className="rp-btn-ghost" onClick={onBack} style={{ fontSize: 13, padding: '7px 14px' }}>← Back</button>
          </div>
        </div>
      </div>

      {/* Chat thread */}
      <div ref={scrollRef} className="rp-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loadingQ ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-dim)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M2 7h7M2 11h9" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border)', animation: `rp-pulse2 1.2s ease ${i*0.2}s infinite` }} />)}
            </div>
          </div>
        ) : thread.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-end', animation: 'rp-fadeUp 0.3s ease both' }}>
            {msg.role === 'pilot' && (
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-dim)', border: '1px solid oklch(0.50 0.19 248 / 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 2 }}>
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M2 7h7M2 11h9" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </div>
            )}
            <div style={{ maxWidth: '72%' }}>
              <div style={{
                background: msg.role === 'pilot' ? 'var(--surface)' : 'var(--accent)',
                color: msg.role === 'pilot' ? 'var(--text)' : 'white',
                border: msg.role === 'pilot' ? '1px solid var(--border)' : 'none',
                borderRadius: msg.role === 'pilot' ? '14px 14px 14px 4px' : '14px 14px 4px 14px',
                padding: '11px 15px',
                fontSize: 14,
                lineHeight: 1.55,
                fontStyle: msg.text === '(skipped)' ? 'italic' : 'normal',
                opacity: msg.text === '(skipped)' ? 0.6 : 1,
              }}>
                {msg.text}
              </div>
              {msg.tip && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 5, paddingLeft: 4 }}>{msg.tip}</div>}
            </div>
          </div>
        ))}

        {submitting && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-dim)', border: '1px solid oklch(0.50 0.19 248 / 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid var(--accent)', borderTopColor: 'transparent', animation: 'rp-spin 0.7s linear infinite' }} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Improving your resume…</div>
          </div>
        )}
      </div>

      {/* Input bar */}
      {!done && !loadingQ && (
        <div style={{ padding: '12px 32px 24px', flexShrink: 0, borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type your answer… (Enter to send)"
              rows={2}
              style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontFamily: 'var(--sans)', fontSize: 14, padding: '11px 14px', outline: 'none', resize: 'none', lineHeight: 1.5 }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={() => sendAnswer(draft)} disabled={!draft.trim()} style={{ width: 40, height: 40, borderRadius: 9, border: 'none', background: draft.trim() ? 'var(--accent)' : 'var(--border)', cursor: draft.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button onClick={() => sendAnswer('__skip__')} title="Skip this question" style={{ width: 40, height: 40, borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)' }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5h9M8 3l3 3.5-3 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /><path d="M11 2v9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
              </button>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8 }}>Press Enter to send · answers are saved to your vault</div>
        </div>
      )}

      {/* Hidden submit area — just show skip all if user wants out */}
      {!done && !loadingQ && (
        <div style={{ padding: '0 32px 16px', flexShrink: 0 }}>
          <button onClick={onNext} style={{ fontSize: 12, color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--sans)', padding: 0 }}>Skip all and continue →</button>
        </div>
      )}
    </div>
  );
}

// ── Step 7: Final Output ──────────────────────────────────────────────────────
function StepFinalOutput({ onBack, onHome, onTailorAnother, dir }) {
  const router = useRouter();
  const [modal, setModal] = useState(null);
  const [email, setEmail] = useState('');
  const [signedUp, setSignedUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const session = loadSession();
    const tr = session.tailoredResult;
    if (tr) {
      setResult({ jd: { title: session.jdTitle, company: session.jdCompany }, after_score: tr.after_score });
    }
    // Check if already signed in
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setSignedUp(true);
    });
  }, []);

  const finalScore = result ? Math.min(result.after_score + 7, 97) : 91;
  const jdLabel = result?.jd?.title || 'your target role';
  const jdCompany = result?.jd?.company || '';

  const handleGoogleSignup = () => {
    // step=6 means "returning from auth at final step — save + redirect to dashboard"
    const qs = new URLSearchParams({ step: '6', source: 'rolepitch' });
    router.push(`/rolepitch/auth?${qs.toString()}`);
  };

  const handleEmailSignup = () => {
    if (!email) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); setSignedUp(true); setModal(null); }, 1200);
  };

  const handleDownload = () => {
    if (!signedUp) { setModal('signup'); return; }
    // Already signed in — save to DB then go to dashboard
    const session = loadSession();
    if (session.parsedResume) {
      setSaving(true);
      fetch('/api/rolepitch/save-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parsed: session.parsedResume,
          jd: { title: session.jdTitle, company: session.jdCompany, description: session.jdDescription },
          jd_id: session.jdId || null,
          tailored: session.tailoredResult,
        }),
      })
        .then(() => { window.location.href = '/rolepitch/dashboard'; })
        .catch(() => { window.location.href = '/rolepitch/dashboard'; });
    } else {
      window.location.href = '/rolepitch/dashboard';
    }
  };

  return (
    <div className={dir === 1 ? 'rp-anim-in' : 'rp-anim-in-left'} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', gap: 32, position: 'relative' }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--green)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Done · Step 7 of 7</div>
        <div style={{ fontSize: 52, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--green)', letterSpacing: '-0.04em', marginBottom: 6, lineHeight: 1 }}>{finalScore}%</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 4 }}>match score</div>
        <h2 style={{ fontSize: 'clamp(22px,2.5vw,30px)', fontWeight: 600, letterSpacing: '-0.03em', marginBottom: 10, marginTop: 16 }}>Your resume is ready</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
          Tailored for <strong style={{ color: 'var(--text)' }}>{jdLabel}</strong>{jdCompany ? ` at ${jdCompany}` : ''}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 380 }}>
        <div style={{ background: 'var(--green-dim)', border: '1px solid oklch(0.55 0.17 155 / 0.25)', borderRadius: 10, padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" fill="var(--green-dim)" stroke="var(--green)" strokeWidth="1" /><path d="M5.5 9l2.5 2.5 4.5-4.5" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Original layout preserved</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Your formatting is intact</div>
          </div>
        </div>

        {signedUp && (
          <div style={{ background: 'var(--accent-dim)', border: '1px solid oklch(0.50 0.19 248 / 0.2)', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="5" r="2.5" stroke="var(--accent)" strokeWidth="1.3" /><path d="M2 12c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="var(--accent)" strokeWidth="1.3" strokeLinecap="round" /></svg>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Signed in · <strong style={{ color: 'var(--text)' }}>Vault saved</strong> · 1 of 2 free pitches used</span>
          </div>
        )}

        <button className="rp-btn-primary" style={{ width: '100%', padding: 14, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }} onClick={handleDownload} disabled={saving}>
          {saving
            ? <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid white', borderTopColor: 'transparent', animation: 'rp-spin 0.7s linear infinite' }} />
            : <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 10V3M5 7l3 3 3-3M3 13h10" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          }
          {saving ? 'Saving…' : signedUp ? 'Go to dashboard →' : 'Download PDF'}
        </button>
        <button className="rp-btn-ghost" style={{ width: '100%' }} onClick={onTailorAnother}>Tailor another role →</button>
        <button className="rp-btn-ghost" style={{ width: '100%' }} onClick={() => router.push('/rolepitch/dashboard')}>View all my pitches →</button>
        <button onClick={onHome} style={{ fontSize: 12, border: 'none', color: 'var(--text-faint)', background: 'none', cursor: 'pointer', padding: '4px 0', fontFamily: 'var(--sans)' }}>← Back to Home</button>
      </div>

      {/* Sign-up modal */}
      {modal === 'signup' && (
        <div onClick={() => setModal(null)} style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.45)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '36px 32px', maxWidth: 400, width: '100%', boxShadow: '0 24px 64px oklch(0 0 0 / 0.2)' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="20" height="20" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M2 7h7M2 11h9" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 8 }}>Save your progress</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Create a free account to download your resume and keep your vault safe — so you never start from scratch again.
              </p>
            </div>
            <button onClick={handleGoogleSignup} style={{ width: '100%', padding: 12, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
              <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" /><path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" /><path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05" /><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" /></svg>
              Continue with Google
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <input className="rp-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" onKeyDown={e => e.key === 'Enter' && handleEmailSignup()} style={{ marginBottom: 10 }} />
            <button onClick={handleEmailSignup} disabled={!email} style={{ width: '100%', padding: 12, borderRadius: 9, border: 'none', cursor: email ? 'pointer' : 'not-allowed', background: email ? 'var(--accent)' : 'var(--border)', color: 'white', fontSize: 14, fontWeight: 600, fontFamily: 'var(--sans)', opacity: email ? 1 : 0.5 }}>
              {loading ? 'Creating account…' : 'Create free account'}
            </button>
            <p style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'center', marginTop: 14 }}>2 free pitches. No credit card required.</p>
          </div>
        </div>
      )}

      {/* Paywall modal */}
      {modal === 'paywall' && (
        <div onClick={() => setModal(null)} style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.45)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '36px 32px', maxWidth: 400, width: '100%', boxShadow: '0 24px 64px oklch(0 0 0 / 0.2)' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>You&apos;ve used 2 free pitches</div>
              <h3 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 8 }}>Unlock unlimited tailoring</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>Unlimited role tailoring. Full career vault. Faster generation.</p>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              {[{ name: 'Pro', price: '₹999/mo', sub: 'Unlimited everything', accent: true }, { name: 'Lifetime', price: '₹5,999', sub: 'Pay once, yours forever', accent: false }].map(p => (
                <button key={p.name} style={{ flex: 1, padding: '14px 12px', borderRadius: 10, border: `1px solid ${p.accent ? 'var(--accent)' : 'var(--border)'}`, background: p.accent ? 'var(--accent-dim)' : 'transparent', cursor: 'pointer', fontFamily: 'var(--sans)', textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: p.accent ? 'var(--accent)' : 'var(--text)', marginBottom: 4 }}>{p.name}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{p.price}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{p.sub}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setModal(null)} style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 12, fontFamily: 'var(--sans)', padding: 8 }}>Maybe later</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Returning user: slim done screen ─────────────────────────────────────────
function StepReturningDone({ onTailorAnother, dir }) {
  const router = useRouter();
  const [saving, setSaving] = useState(true);
  const [savedId, setSavedId] = useState(null);
  const [score, setScore] = useState(null);
  const [jdLabel, setJdLabel] = useState('');

  useEffect(() => {
    const session = loadSession();
    const tr = session.tailoredResult;
    if (tr) setScore(Math.min((tr.after_score || 78) + 7, 97));
    setJdLabel(session.jdTitle || '');

    fetch('/api/rolepitch/save-resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parsed: session.parsedResume,
        jd: { title: session.jdTitle, company: session.jdCompany, description: session.jdDescription },
        jd_id: session.jdId || null,
        tailored: tr,
      }),
    })
      .then(r => r.json())
      .then(data => { if (data.tailored_resume_id) setSavedId(data.tailored_resume_id); })
      .finally(() => setSaving(false));
  }, []);

  return (
    <div className={dir === 1 ? 'rp-anim-in' : 'rp-anim-in-left'} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', gap: 28 }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--green)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Done</div>
        {score && <div style={{ fontSize: 52, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--green)', letterSpacing: '-0.04em', marginBottom: 6, lineHeight: 1 }}>{score}%</div>}
        {score && <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>match score</div>}
        <h2 style={{ fontSize: 'clamp(22px,2.5vw,30px)', fontWeight: 600, letterSpacing: '-0.03em', marginBottom: 8 }}>Your resume is tailored</h2>
        {jdLabel && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>For <strong style={{ color: 'var(--text)' }}>{jdLabel}</strong></p>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 360 }}>
        {savedId && (
          <button
            className="rp-btn-primary"
            style={{ width: '100%', padding: 14, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={() => window.open(`/api/rolepitch/download-pdf?tailored_resume_id=${savedId}`, '_blank')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 10V3M5 7l3 3 3-3M3 13h10" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Download PDF
          </button>
        )}
        <button
          className={savedId ? 'rp-btn-ghost' : 'rp-btn-primary'}
          style={{ width: '100%', padding: 14, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onClick={() => router.push('/rolepitch/dashboard')}
          disabled={saving}
        >
          {saving
            ? <><div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid white', borderTopColor: 'transparent', animation: 'rp-spin 0.7s linear infinite' }} /> Saving…</>
            : 'View in dashboard →'
          }
        </button>
        <button className="rp-btn-ghost" style={{ width: '100%' }} onClick={onTailorAnother}>Tailor another role →</button>
      </div>
    </div>
  );
}

// ── App shell ─────────────────────────────────────────────────────────────────
const TOTAL_NEW = 7;      // new users: full 7-step onboarding
const TOTAL_RETURNING = 4; // returning users: JD → Processing → Chat → Done

export default function RolePitchStart() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [isReturning, setIsReturning] = useState(false); // signed-in with existing vault
  const [ready, setReady] = useState(false); // don't render until we know the mode

  useEffect(() => {
    // Lock page scroll
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100%';
    document.documentElement.style.height = '100%';
    return () => {
      document.documentElement.style.overflow = prev;
      document.body.style.overflow = '';
      document.body.style.height = '';
      document.documentElement.style.height = '';
    };
  }, []);

  useEffect(() => {
    const theme = localStorage.getItem('rp_theme') || 'light';
    document.documentElement.setAttribute('data-rp-theme', theme);

    // On return from OAuth, URL may carry ?step=N&tr=UUID
    const params = new URLSearchParams(window.location.search);
    const urlStep = parseInt(params.get('step') || '', 10);
    const urlTr = params.get('tr');
    if (urlTr) saveSession({ tailoredResumeId: urlTr });

    const session = loadSession();

    // Returning from OAuth at step 6 (final) — save session data to DB then go to dashboard
    if (urlStep === 6 && params.get('source') === 'rolepitch' && session.parsedResume) {
      fetch('/api/rolepitch/save-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parsed: session.parsedResume,
          jd: { title: session.jdTitle, company: session.jdCompany, description: session.jdDescription },
          jd_id: session.jdId || null,
          tailored: session.tailoredResult,
        }),
      })
        .then(() => { window.location.href = '/rolepitch/dashboard'; })
        .catch(() => { window.location.href = '/rolepitch/dashboard'; });
      return;
    }

    // Clean URL without reloading
    if (params.has('step') || params.has('tr') || params.has('source')) {
      window.history.replaceState({}, '', '/rolepitch/start');
    }

    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        // Signed-in user — fetch their profile from DB if not already in session
        let parsedResume = session.parsedResume;
        if (!parsedResume) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('structured_resume, parsed_json')
            .eq('user_id', user.id)
            .maybeSingle();
          parsedResume = prof?.parsed_json || prof?.structured_resume || null;
          if (parsedResume) saveSession({ parsedResume });
        }

        if (parsedResume) {
          // Returning user with vault — slim 3-step flow
          saveSession({ isAuthenticated: true, step: 0, jdId: null, jdTitle: null, jdCompany: null, jdDescription: null, tailoredResumeId: null, tailoredResult: null });
          setIsReturning(true);
          setStep(0);
        } else {
          // Signed in but no profile yet — run full onboarding
          saveSession({ isAuthenticated: true });
          setStep(0);
        }
      } else {
        // Not signed in — new user full flow
        const startStep = !isNaN(urlStep) ? urlStep : (session.step || 0);
        setStep(startStep);
      }
      setReady(true);
    });
  }, []);

  const TOTAL = isReturning ? TOTAL_RETURNING : TOTAL_NEW;

  const go = useCallback((n) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
    if (!isReturning) saveSession({ step: n });
  }, [step, isReturning]);

  const next = useCallback(() => go(Math.min(step + 1, TOTAL - 1)), [step, go, TOTAL]);
  const back = useCallback(() => {
    const prev = Math.max(step - 1, 0);
    if (!isReturning && prev <= 2) saveSession({ jdId: null, jdTitle: null, jdCompany: null, jdDescription: null, tailoredResumeId: null, tailoredResult: null });
    go(prev);
  }, [step, go, isReturning]);
  const goHome = useCallback(() => router.push('/rolepitch'), [router]);
  const tailorAnother = useCallback(() => {
    saveSession({ jdId: null, jdTitle: null, jdCompany: null, jdDescription: null, tailoredResumeId: null, tailoredResult: null, step: isReturning ? 0 : 2 });
    go(isReturning ? 0 : 2);
  }, [go, isReturning]);

  // Returning users: 4 steps — JD input, Processing, Chat Q&A, Done
  const RETURNING_STEPS = [
    <StepJobInput key={`ret-${step}`} onNext={next} onBack={() => router.push('/rolepitch/dashboard')} dir={dir} returning />,
    <StepProcessing key={`ret-${step}`} onNext={next} dir={dir} />,
    <StepGapQuestions key={`ret-${step}`} onNext={next} onBack={back} dir={dir} />,
    <StepReturningDone key={`ret-${step}`} onTailorAnother={tailorAnother} dir={dir} />,
  ];

  // New users: full 7-step onboarding
  const NEW_STEPS = [
    <StepUpload key={`new-${step}`} onNext={next} dir={dir} />,
    <StepVault key={`new-${step}`} onNext={next} onBack={back} dir={dir} />,
    <StepJobInput key={`new-${step}`} onNext={next} onBack={back} dir={dir} />,
    <StepProcessing key={`new-${step}`} onNext={next} dir={dir} />,
    <StepResult key={`new-${step}`} onNext={next} onBack={back} dir={dir} />,
    <StepGapQuestions key={`new-${step}`} onNext={next} onBack={back} dir={dir} />,
    <StepFinalOutput key={`new-${step}`} onBack={back} onHome={goHome} onTailorAnother={tailorAnother} dir={dir} />,
  ];

  const currentSteps = isReturning ? RETURNING_STEPS : NEW_STEPS;

  if (!ready) return (
    <>
      <style>{CSS_VARS}</style>
      <div className="rp-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'rp-spin 0.7s linear infinite' }} />
      </div>
    </>
  );

  return (
    <>
      <style>{CSS_VARS}</style>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
      <div className="rp-root">
        {isReturning ? (
          // Returning users: minimal nav with back-to-dashboard link
          <div style={{ padding: '16px 32px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <button onClick={() => router.push('/rolepitch/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', padding: 0 }}>
              <div style={{ width: 22, height: 22, background: 'var(--accent)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M2 7h7M2 11h9" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </div>
              <span style={{ fontWeight: 600, fontSize: 13 }}>RolePitch</span>
            </button>
            <div style={{ display: 'flex', gap: 4 }}>
              {Array.from({ length: TOTAL_RETURNING }).map((_, i) => (
                <div key={i} style={{ height: 3, width: 48, borderRadius: 2, background: i < step ? 'var(--accent)' : i === step ? 'var(--border)' : 'var(--border-subtle)', transition: 'background 0.3s' }} />
              ))}
            </div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-faint)' }}>{step + 1}/{TOTAL_RETURNING}</span>
          </div>
        ) : (
          <ProgressBar step={step} total={TOTAL_NEW} onHome={goHome} />
        )}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {currentSteps[step]}
        </div>
      </div>
    </>
  );
}
