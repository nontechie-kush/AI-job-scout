'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { track, identify } from '@/components/PostHogProvider';
import UpgradeModal from '@/components/UpgradeModal';

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
  /* ── rolepitch-flow.html design tokens (scoped to start flow only) ─────
     These are read only by the new mobile-redesign components. Existing
     desktop components keep using the oklch tokens above. */
  :root {
    --rp-primary: #2C52E0;
    --rp-primary-light: rgba(44,82,224,0.09);
    --rp-text: #141928;
    --rp-sub: #4E5872;
    --rp-muted: #8A93AA;
    --rp-border: #E4E7F0;
    --rp-divider: #ECEEF5;
    --rp-found: #0E9A68;
    --rp-found-bg: #EAF7F2;
    --rp-found-border: #B3E4D0;
    --rp-enrich-bg: #F5F7FF;
    --rp-enrich-border: #D8DFFF;
    --rp-card: #ffffff;
    --rp-bg: #F0F2F7;
  }
  /* Design keyframes from rolepitch-flow.html */
  @keyframes rp-popIn {
    0% { transform: scale(0.84); opacity: 0; }
    65% { transform: scale(1.03); opacity: 1; }
    100% { transform: scale(1); }
  }
  @keyframes rp-rowIn {
    from { opacity: 0; transform: translateX(-6px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes rp-pulseDot {
    0%,100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.25; transform: scale(1.7); }
  }
  @keyframes rp-toastIn {
    from { opacity: 0; transform: translateY(6px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes rp-expandDown {
    from { opacity: 0; max-height: 0; }
    to { opacity: 1; max-height: 700px; }
  }
  @keyframes rp-interim-shimmer {
    0% { opacity: 0.3; }
    50% { opacity: 1; }
    100% { opacity: 0.3; }
  }
  @keyframes rp-sheetUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  .rp-root { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--text); min-height: 100dvh; display: flex; flex-direction: column; -webkit-font-smoothing: antialiased; }
  .rp-sticky-header { position: sticky; top: 0; z-index: 10; background: var(--bg); }
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

// ── draft id (server-owned anonymous tailor state) ──────────────────────────
// rp_draft_id is the only handle the client needs to recover state across
// page reloads, OAuth round-trips, and mobile-browser localStorage quirks.
// All other in-flight tailor data (parsed_resume, jd, tailored) lives in
// the rp_drafts table and is fetched by id on demand.
function getDraftId() {
  try { return localStorage.getItem('rp_draft_id') || null; } catch { return null; }
}
function setDraftId(id) {
  try { if (id) localStorage.setItem('rp_draft_id', id); } catch {}
}
async function ensureDraftId() {
  let id = getDraftId();
  if (id) return id;
  try {
    const res = await fetch('/api/rolepitch/drafts', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (data?.draft_id) {
      setDraftId(data.draft_id);
      return data.draft_id;
    }
  } catch (e) {
    console.warn('[ensureDraftId] failed (non-fatal)', e?.message);
  }
  return null;
}
function clearDraftId() {
  try { localStorage.removeItem('rp_draft_id'); } catch {}
}

// ── viewport hook ────────────────────────────────────────────────────────────
// Returns true when viewport width <= 768px. Used to fork render paths between
// the new mobile redesign and the existing desktop UI. Re-evaluates on resize
// (covers tablet rotation, browser resize). SSR-safe — defaults to false until
// the first effect runs, so server-rendered output matches desktop layout.
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isMobile;
}

// ── platform helpers (rolepitch-flow.html design) ────────────────────────────
// Brand-colored chip styling for each link source. guessPlatform() infers the
// platform from a URL substring so the add-row icon updates live as the user
// types. Used only by the mobile redesign of StepVault's enrichment panel.
const RP_PLATFORMS = {
  linkedin:  { label: 'LinkedIn',  color: '#0a66c2', bg: '#E8F0FB' },
  github:    { label: 'GitHub',    color: '#1a1f36', bg: '#EBEBF0' },
  portfolio: { label: 'Portfolio', color: '#6d28d9', bg: '#EDE9FF' },
};
function guessPlatform(url) {
  if (!url) return 'portfolio';
  const u = url.toLowerCase();
  if (u.includes('linkedin')) return 'linkedin';
  if (u.includes('github')) return 'github';
  return 'portfolio';
}
function PlatformIcon({ platform, size = 13 }) {
  if (platform === 'linkedin') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="#0a66c2">
        <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.37V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.35-1.85 3.59 0 4.25 2.36 4.25 5.43v6.31zM5.34 7.43a2.06 2.06 0 110-4.12 2.06 2.06 0 010 4.12zM6.9 20.45H3.77V9H6.9v11.45z" />
      </svg>
    );
  }
  if (platform === 'github') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="#1a1f36">
        <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.49.5.09.68-.22.68-.48v-1.69C6.73 19.91 6.14 18 6.14 18c-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.56 9.56 0 0112 6.84c.85 0 1.7.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.85-2.34 4.7-4.57 4.95.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10.01 10.01 0 0022 12c0-5.52-4.48-10-10-10z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <circle cx="12" cy="12" r="9" stroke="#6d28d9" strokeWidth="1.8" />
      <path d="M3 12h18M12 3c-2.5 3-4 5.5-4 9s1.5 6 4 9M12 3c2.5 3 4 5.5 4 9s-1.5 6-4 9" stroke="#6d28d9" strokeWidth="1.4" />
    </svg>
  );
}

// ── ProgressBar ───────────────────────────────────────────────────────────────
// Mobile shows real-step numbering per rolepitch-flow.html: loaders are
// interim states (no number, "Tailoring…" / "Reading…" label, shimmering
// segment). Desktop keeps the original 1/7 numeric.
//
// New-user raw step (0–6) → mobile real step:
//   0 upload          → 1/5  "Let's go"
//   1 vault           → 2/5  "Just started"
//   2 jd_input        → 3/5  "Halfway"
//   3 processing      → null "Tailoring…"   (interim, shimmer)
//   4 result          → 4/5  "Almost there"
//   5 gap_questions   → 4/5  "Almost there" (continuation; same number)
//   6 final_output    → 5/5  "Done ✓"
const REAL_STEP_MAP_NEW = [
  { real: 1, label: "Let's go" },
  { real: 2, label: 'Just started' },
  { real: 3, label: 'Halfway' },
  { real: null, label: 'Tailoring…' },
  { real: 4, label: 'Almost there' },
  { real: 4, label: 'Almost there' },
  { real: 5, label: 'Done ✓' },
];
const REAL_TOTAL_MOBILE = 5;

function ProgressBar({ step, total, onHome }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    const meta = REAL_STEP_MAP_NEW[step] || { real: null, label: '…' };
    const isInterim = meta.real == null;
    // Filled segments = real steps already completed.
    // For interim, show the segment of the just-finished step as filled and
    // the next segment as shimmering.
    const filledCount = isInterim
      ? (step > 0 ? (REAL_STEP_MAP_NEW[step - 1]?.real || 0) : 0)
      : Math.max(0, meta.real - 1);

    return (
      <div className="rp-sticky-header" style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--rp-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onHome} aria-label="Home" style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rp-text)', flexShrink: 0, padding: 0 }}>
          <div style={{ width: 28, height: 28, background: 'var(--rp-primary)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
              <rect x="1" y="1" width="5" height="5" rx="1.2" />
              <rect x="8" y="1" width="5" height="5" rx="1.2" />
              <rect x="1" y="8" width="5" height="5" rx="1.2" />
              <rect x="8" y="8" width="5" height="5" rx="1.2" />
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--rp-text)' }}>RolePitch</span>
        </button>
        <div style={{ flex: 1, display: 'flex', gap: 3, margin: '0 4px' }}>
          {Array.from({ length: REAL_TOTAL_MOBILE }).map((_, i) => {
            const isFilled = i < filledCount;
            const isShimmer = isInterim && i === filledCount;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  background: isFilled ? 'var(--rp-primary)' : 'var(--rp-border)',
                  opacity: isFilled ? 1 : 0.3,
                  animation: isShimmer ? 'rp-interim-shimmer 1.4s ease infinite' : 'none',
                  transition: 'all 0.4s ease',
                }}
              />
            );
          })}
        </div>
        <span style={{ fontSize: 11, color: 'var(--rp-muted)', fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {isInterim ? meta.label : `${meta.real} of ${REAL_TOTAL_MOBILE}`}
        </span>
      </div>
    );
  }

  // ── Desktop (unchanged) ──
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

// ── Link source label helper ───────────────────────────────────────────────────
function linkLabel(url) {
  if (url.includes('linkedin.com')) return 'LinkedIn';
  if (url.includes('github.com')) return 'GitHub';
  if (url.includes('huggingface.co')) return 'HuggingFace';
  if (url.includes('framer.com')) return 'Framer';
  if (url.includes('behance.net')) return 'Behance';
  if (url.includes('dribbble.com')) return 'Dribbble';
  if (url.includes('medium.com')) return 'Medium';
  if (url.includes('notion.so')) return 'Notion';
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
}

// ── Step 1b: Enrich (links nudge after parse) ─────────────────────────────────
function StepEnrich({ parsedResult, detectedLinks, onDone, onSkip }) {
  // phase: nudge | loading | done
  const [phase, setPhase] = useState('nudge');
  const [manualLinks, setManualLinks] = useState('');
  const [enriching, setEnriching] = useState(false);
  const [sources, setSources] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  // Pre-select auto-detected links
  const [checkedLinks, setCheckedLinks] = useState(() => new Set(detectedLinks));

  const allLinks = [
    ...detectedLinks,
    ...manualLinks.split(/[\s,\n]+/).map(u => u.trim()).filter(u => u.startsWith('http')),
  ].filter((u, i, arr) => arr.indexOf(u) === i);

  const enrich = async () => {
    const urls = allLinks.filter(u => checkedLinks.has(u));
    const manualOnly = manualLinks.split(/[\s,\n]+/).map(u => u.trim()).filter(u => u.startsWith('http') && !detectedLinks.includes(u));
    const finalUrls = [...new Set([...urls, ...manualOnly])];

    if (!finalUrls.length) { onSkip(); return; }

    setEnriching(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/rolepitch/enrich-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: finalUrls }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Enrichment failed');

      if (!data.text || data.text.trim().length < 50) {
        // Scraped but empty — proceed without enrichment
        setSources(data.sources || []);
        setPhase('done');
        setTimeout(() => onDone(null, data.sources), 800);
        return;
      }

      // Re-parse with enriched context
      const { parsedResume } = JSON.parse(localStorage.getItem('rp_session') || '{}');
      const form = new FormData();

      if (parsedResume) {
        form.append('type', 'paste');
        form.append('text', JSON.stringify(parsedResume)); // pass existing parse as base text
        form.append('additionalContext', data.text);
      } else {
        form.append('type', 'links_only');
        form.append('additionalContext', data.text);
      }

      const draftId = getDraftId();
      if (draftId) form.append('draft_id', draftId);

      const parseRes = await fetch('/api/rolepitch/parse-resume', { method: 'POST', body: form });
      const parseData = await parseRes.json();
      if (!parseRes.ok) throw new Error(parseData.error || 'Re-parse failed');

      setSources(data.sources || []);
      setPhase('done');
      setTimeout(() => onDone(parseData.parsed, data.sources), 800);
    } catch (err) {
      setErrorMsg(err.message);
      setEnriching(false);
    }
  };

  if (phase === 'done') {
    const okCount = sources.filter(s => s.status === 'ok').length;
    return (
      <div style={{ width: '100%', maxWidth: 480, background: 'var(--green-dim)', border: '1px solid oklch(0.72 0.17 155 / 0.3)', borderRadius: 14, padding: '28px 32px', textAlign: 'center', animation: 'rp-fadeUp 0.3s ease' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
          {okCount > 0 ? `Read ${okCount} source${okCount > 1 ? 's' : ''}` : 'Profile enriched'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Vault will include everything Pilot found</div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: 480, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px 28px', animation: 'rp-fadeUp 0.35s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
        <div style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--accent-dim)', border: '1px solid oklch(0.50 0.19 248 / 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 2a5 5 0 110 10A5 5 0 018 3z" fill="var(--accent)" opacity="0.3"/><path d="M8 5v4l2.5 1.5" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round"/></svg>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>Make your vault richer</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Pilot can read your LinkedIn, GitHub, or portfolio to pull in work that didn&apos;t make it onto your resume.
          </div>
        </div>
      </div>

      {/* Auto-detected links */}
      {detectedLinks.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Found in your resume</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {detectedLinks.map(url => (
              <label key={url} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px', background: checkedLinks.has(url) ? 'var(--accent-dim)' : 'var(--surface2)', border: `1px solid ${checkedLinks.has(url) ? 'oklch(0.50 0.19 248 / 0.25)' : 'var(--border)'}`, borderRadius: 8, transition: 'all 0.15s' }}>
                <input
                  type="checkbox"
                  checked={checkedLinks.has(url)}
                  onChange={e => setCheckedLinks(prev => { const n = new Set(prev); e.target.checked ? n.add(url) : n.delete(url); return n; })}
                  style={{ accentColor: 'var(--accent)', width: 14, height: 14, flexShrink: 0 }}
                />
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{linkLabel(url)}</span>
                <span style={{ fontSize: 11, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{url.replace(/^https?:\/\//, '')}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Manual link input */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          {detectedLinks.length > 0 ? 'Add more links' : 'Your links'}
        </div>
        <textarea
          className="rp-input"
          value={manualLinks}
          onChange={e => setManualLinks(e.target.value)}
          placeholder={'https://linkedin.com/in/yourname\nhttps://github.com/yourname\nhttps://yourportfolio.com'}
          rows={3}
          style={{ resize: 'none', lineHeight: 1.6, fontSize: 13 }}
        />
        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 5 }}>LinkedIn · GitHub · Framer · Behance · portfolio — one per line</div>
      </div>

      {errorMsg && (
        <div style={{ fontSize: 12, color: 'oklch(0.75 0.15 30)', background: 'oklch(0.65 0.2 30 / 0.08)', border: '1px solid oklch(0.65 0.2 30 / 0.25)', borderRadius: 7, padding: '8px 12px', marginBottom: 12 }}>{errorMsg}</div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="rp-btn-ghost" onClick={onSkip} style={{ fontSize: 13, flex: '0 0 auto' }}>Skip</button>
        <button className="rp-btn-primary" onClick={enrich} disabled={enriching} style={{ flex: 1, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {enriching
            ? <><div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid white', borderTopColor: 'transparent', animation: 'rp-spin 0.7s linear infinite' }} />Reading your links…</>
            : 'Let Pilot read them →'
          }
        </button>
      </div>
    </div>
  );
}

// ── Step 1: Upload ─────────────────────────────────────────────────────────────
function StepUpload({ onNext, dir }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  // phase: idle | dragging | loading | links_only | error | done
  // (`enrich` removed — enrichment now lives on StepVault as an opt-in card.)
  // ?mode=links boots us straight into the links_only screen (designers /
  // no-resume users). This gives us a distinct URL for analytics so we can
  // tell upload-page drop-off from links-page drop-off.
  const initialPhase = searchParams.get('mode') === 'links' ? 'links_only' : 'idle';
  const [phase, setPhase] = useState(initialPhase);
  const [loadingStep, setLoadingStep] = useState(0);
  const [parseResult, setParseResult] = useState(null);
  const [, setDetectedLinks] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [linksOnlyInput, setLinksOnlyInput] = useState('');
  const [linksOnlyLoading, setLinksOnlyLoading] = useState(false);
  const fileRef = useRef();

  const LOADING_STEPS = ['Reading your experience…', 'Extracting achievements…', 'Building your career vault…'];

  const parseFile = useCallback(async (file) => {
    setPhase('loading');
    setLoadingStep(0);

    let stepIdx = 0;
    const stepTimer = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, LOADING_STEPS.length - 1);
      setLoadingStep(stepIdx);
    }, 900);

    try {
      const draftId = await ensureDraftId();
      const form = new FormData();
      form.append('type', 'pdf');
      form.append('file', file);
      if (draftId) form.append('draft_id', draftId);

      const res = await fetch('/api/rolepitch/parse-resume', { method: 'POST', body: form });
      clearInterval(stepTimer);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }

      const data = await res.json();
      const parsed = data.parsed || data;
      saveSession({
        parsedName: parsed.name,
        parsedResume: parsed,
        parsedSource: data.source || 'pdf',
        detectedLinks: data.detectedLinks || [],
      });
      setParseResult(parsed);
      setDetectedLinks(data.detectedLinks || []);
      track('rp_resume_uploaded', { method: 'pdf', years_exp: parsed.years_exp, seniority: parsed.seniority });
      // Skip the enrich nudge — go straight to highlights (StepVault) so the
      // user sees their value immediately. Enrichment is offered as an opt-in
      // on StepVault now.
      setPhase('done');
      setTimeout(onNext, 400);
    } catch (err) {
      clearInterval(stepTimer);
      setErrorMsg(err.message || 'Something went wrong — try again');
      setPhase('error');
    }
  }, [onNext]);

  const useSample = useCallback(async () => {
    setPhase('loading');
    setLoadingStep(0);
    let stepIdx = 0;
    const stepTimer = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, LOADING_STEPS.length - 1);
      setLoadingStep(stepIdx);
    }, 900);

    try {
      const draftId = await ensureDraftId();
      const form = new FormData();
      form.append('type', 'paste');
      form.append('text', `Kushendra Suryavanshi\nSenior Product Manager\nhttps://linkedin.com/in/kushendra\nhttps://github.com/nontechie-kush\n\nExperience:\nRazorpay (2024–Present) — Senior Product Manager\n• Led cross-functional team of 12 to redesign payment infrastructure, reducing latency by 40%\n• Launched RazorpayX Business Banking to 8,000+ SMEs in 3 months\n\nMeesho (2022–2024) — Product Manager\n• Owned seller onboarding v2 — reduced time-to-first-sale from 11 days to 3.5 days\n• Built A/B testing framework used by 6 product teams, improving experiment velocity by 60%\n• Drove supplier NPS from 34 to 61\n\nFlipkart (2020–2022) — Associate Product Manager\n• Redesigned checkout flow, increasing conversion by 32%\n• Shipped address autofill using ML signals, reducing manual input by 70%`);
      if (draftId) form.append('draft_id', draftId);

      const res = await fetch('/api/rolepitch/parse-resume', { method: 'POST', body: form });
      clearInterval(stepTimer);
      if (!res.ok) throw new Error('Parse failed');
      const data = await res.json();
      const parsed = data.parsed || data;
      saveSession({
        parsedName: parsed.name,
        parsedResume: parsed,
        parsedSource: data.source || 'text',
        detectedLinks: data.detectedLinks || [],
      });
      setParseResult(parsed);
      setDetectedLinks(data.detectedLinks || []);
      // Skip enrich; go straight to highlights.
      setPhase('done');
      setTimeout(onNext, 400);
    } catch (err) {
      clearInterval(stepTimer);
      setErrorMsg(err.message);
      setPhase('error');
    }
  }, [onNext]);

  // Links-only path (designers, no resume)
  const handleLinksOnly = useCallback(async () => {
    const urls = linksOnlyInput.split(/[\s,\n]+/).map(u => u.trim()).filter(u => u.startsWith('http'));
    if (!urls.length) return;
    setLinksOnlyLoading(true);
    try {
      const enrichRes = await fetch('/api/rolepitch/enrich-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });
      const enrichData = await enrichRes.json();
      if (!enrichData.text || enrichData.text.length < 50) throw new Error('Could not read those links — try adding your LinkedIn or portfolio');

      const draftId = await ensureDraftId();
      const form = new FormData();
      form.append('type', 'links_only');
      form.append('additionalContext', enrichData.text);
      if (draftId) form.append('draft_id', draftId);
      const parseRes = await fetch('/api/rolepitch/parse-resume', { method: 'POST', body: form });
      const parseData = await parseRes.json();
      if (!parseRes.ok) throw new Error(parseData.error || 'Could not extract profile from links');

      saveSession({ parsedName: parseData.parsed?.name, parsedResume: parseData.parsed, parsedSource: parseData.source || 'website' });
      setParseResult(parseData.parsed);
      track('rp_resume_uploaded', { method: 'links_only' });
      setPhase('done');
      setTimeout(onNext, 400);
    } catch (err) {
      setErrorMsg(err.message);
      setLinksOnlyLoading(false);
    }
  }, [linksOnlyInput, onNext]);

  return (
    <div className={dir === 1 ? 'rp-anim-in' : 'rp-anim-in-left'} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', gap: 28 }}>
      {/* Header */}
      {phase !== 'done' && (
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
            <h1 className="rp-fade-up" style={{ fontSize: 'clamp(26px,3vw,36px)', fontWeight: 600, letterSpacing: '-0.03em', marginBottom: 10 }}>
            {phase === 'links_only' ? 'No resume? No problem.' : 'Tell Pilot about yourself'}
          </h1>
          <p className="rp-fade-up" style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.6 }}>
            {phase === 'links_only'
              ? 'Drop your LinkedIn, portfolio, GitHub — Pilot will read them all.'
              : 'Upload your resume. Pilot reads the work behind the job titles.'}
          </p>
        </div>
      )}

      {/* Drop zone */}
      {(phase === 'idle' || phase === 'dragging') && (
        <div onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setPhase('dragging'); }}
          onDragLeave={() => setPhase('idle')}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) parseFile(f); }}
          style={{ width: '100%', maxWidth: 480, border: `2px dashed ${phase === 'dragging' ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 14, padding: '48px 32px', textAlign: 'center', cursor: 'pointer', background: phase === 'dragging' ? 'var(--accent-dim)' : 'var(--surface)', transition: 'all 0.2s' }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 14V4M7 8l4-4 4 4" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 15v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Drop your resume here</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>PDF, DOCX, or screenshot — up to 10MB</div>
          <div style={{ display: 'inline-block', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 16px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Browse files</div>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
        </div>
      )}

      {/* Links-only path */}
      {phase === 'links_only' && (
        <div style={{ width: '100%', maxWidth: 480, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px 28px' }}>
          <textarea
            className="rp-input"
            value={linksOnlyInput}
            onChange={e => setLinksOnlyInput(e.target.value)}
            placeholder={'https://linkedin.com/in/yourname\nhttps://github.com/yourname\nhttps://yourportfolio.com'}
            rows={4}
            style={{ resize: 'none', lineHeight: 1.6, fontSize: 14, marginBottom: 12 }}
            autoFocus
          />
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 16 }}>LinkedIn · GitHub · Framer · Behance · portfolio — one per line</div>
          {errorMsg && <div style={{ fontSize: 12, color: 'oklch(0.75 0.15 30)', marginBottom: 12 }}>{errorMsg}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="rp-btn-ghost"
              onClick={() => {
                setPhase('idle');
                setErrorMsg('');
                router.replace('/rolepitch/start');
              }}
              style={{ fontSize: 13 }}
            >← Back</button>
            <button className="rp-btn-primary" onClick={handleLinksOnly} disabled={linksOnlyLoading || !linksOnlyInput.trim()} style={{ flex: 1, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {linksOnlyLoading
                ? <><div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid white', borderTopColor: 'transparent', animation: 'rp-spin 0.7s linear infinite' }} />Reading…</>
                : 'Read my links →'
              }
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {phase === 'loading' && (
        isMobile ? (
          // Mobile: rolepitch-flow.html design — running/done/pending labels with subtle shadow
          <div
            style={{
              width: '100%', maxWidth: 480,
              background: 'var(--rp-card)',
              borderRadius: 16, padding: '18px 20px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
              display: 'flex', flexDirection: 'column', gap: 14,
              animation: 'rp-fadeUp 0.3s ease both',
            }}
          >
            {LOADING_STEPS.map((s, i) => {
              const isDone = i < loadingStep;
              const isRunning = i === loadingStep;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isDone ? 'var(--rp-found-bg)' : isRunning ? 'var(--rp-primary-light)' : 'var(--rp-border)',
                    transition: 'background 0.3s',
                  }}>
                    {isDone
                      ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-6" stroke="var(--rp-found)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      : isRunning
                        ? <div style={{ width: 11, height: 11, borderRadius: '50%', border: '2px solid var(--rp-primary)', borderTopColor: 'transparent', animation: 'rp-spin 0.8s linear infinite' }} />
                        : <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--rp-muted)', opacity: 0.3 }} />
                    }
                  </div>
                  <span style={{
                    fontSize: 13,
                    fontWeight: isRunning ? 700 : 400,
                    color: isDone ? 'var(--rp-muted)' : isRunning ? 'var(--rp-text)' : 'var(--rp-muted)',
                    transition: 'all 0.3s',
                  }}>{s.replace(/…$/, '')}</span>
                  {isDone && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--rp-found)', fontWeight: 600 }}>Done</span>}
                  {isRunning && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--rp-primary)', fontWeight: 600 }}>running</span>}
                </div>
              );
            })}
          </div>
        ) : (
          // Desktop: unchanged
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
        )
      )}

      {/* Error */}
      {phase === 'error' && (
        <div style={{ width: '100%', maxWidth: 480, background: 'oklch(0.65 0.2 30 / 0.08)', border: '1px solid oklch(0.65 0.2 30 / 0.3)', borderRadius: 14, padding: '28px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'oklch(0.75 0.15 30)', marginBottom: 16 }}>{errorMsg}</div>
          <button className="rp-btn-ghost" onClick={() => setPhase('idle')} style={{ fontSize: 13 }}>Try again</button>
        </div>
      )}

      {/* Done */}
      {phase === 'done' && (
        <div style={{ width: '100%', maxWidth: 480, background: 'var(--green-dim)', border: '1px solid oklch(0.72 0.17 155 / 0.3)', borderRadius: 14, padding: '28px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8, animation: 'rp-checkPop 0.4s ease' }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Vault building…</div>
          {parseResult && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{parseResult.name || 'Your profile'} · {parseResult.experience?.length || 0} roles</div>}
        </div>
      )}

      {/* Bottom actions — idle/dragging only */}
      {(phase === 'idle' || phase === 'dragging') && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <button className="rp-btn-ghost" onClick={useSample} style={{ fontSize: 13 }}>Use sample resume</button>
          <button
            onClick={() => {
              setPhase('links_only');
              router.replace('/rolepitch/start?mode=links');
              track('rp_links_mode_opened');
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-faint)', textDecoration: 'underline', fontFamily: 'var(--sans)' }}
          >
            No resume? Start with your links →
          </button>
        </div>
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

// ── MobileEnrichCard ────────────────────────────────────────────────────────
// Mobile-only redesign of the StepVault enrichment panel — chip-based,
// brand-colored platform icons, live-updating add row, single green "Let
// Pilot read N profiles →" CTA inside the panel. Replaces the old plain-card
// version on mobile viewports only.
//
// Calls the same enrich-profile + parse-resume APIs as the existing flow;
// onComplete fires with (enrichedParsed, sources) just like StepEnrich's
// onDone callback so StepVault can refresh its role list.
function MobileEnrichCard({ detectedLinks, onComplete, onCloseExpanded }) {
  const [expanded, setExpanded] = useState(false);
  const [addedLinks, setAddedLinks] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [enriching, setEnriching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const allLinks = [
    ...detectedLinks.map(url => ({ url, source: 'found' })),
    ...addedLinks.map(url => ({ url, source: 'added' })),
  ];
  const totalCount = allLinks.length;

  const commitInput = () => {
    const v = inputVal.trim();
    if (v.length > 5 && !addedLinks.includes(v) && !detectedLinks.includes(v)) {
      setAddedLinks(l => [...l, v]);
      setInputVal('');
    }
  };

  const removeAdded = (url) => setAddedLinks(l => l.filter(u => u !== url));

  const handleEnrich = async () => {
    const urls = allLinks.map(l => l.url);
    if (!urls.length) return;
    setEnriching(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/rolepitch/enrich-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Enrichment failed');

      if (!data.text || data.text.trim().length < 50) {
        // Scraped but empty — call onComplete with no parse so StepVault still records sources
        onComplete(null, data.sources || []);
        setExpanded(false);
        setEnriching(false);
        if (onCloseExpanded) onCloseExpanded();
        return;
      }

      // Re-parse with enriched context + draft mirroring
      const session = loadSession();
      const draftId = getDraftId();
      const form = new FormData();
      if (session.parsedResume) {
        form.append('type', 'paste');
        form.append('text', JSON.stringify(session.parsedResume));
        form.append('additionalContext', data.text);
      } else {
        form.append('type', 'links_only');
        form.append('additionalContext', data.text);
      }
      if (draftId) form.append('draft_id', draftId);

      const parseRes = await fetch('/api/rolepitch/parse-resume', { method: 'POST', body: form });
      const parseData = await parseRes.json();
      if (!parseRes.ok) throw new Error(parseData.error || 'Could not extract enriched profile');

      onComplete(parseData.parsed, data.sources || []);
      setExpanded(false);
      setEnriching(false);
      if (onCloseExpanded) onCloseExpanded();
    } catch (err) {
      setErrorMsg(err.message);
      setEnriching(false);
    }
  };

  const livePlatform = guessPlatform(inputVal);
  const liveCfg = RP_PLATFORMS[livePlatform];

  // ─ Collapsed teaser ─
  if (!expanded) {
    return (
      <div
        style={{
          background: 'var(--rp-enrich-bg)',
          border: '1.5px solid var(--rp-enrich-border)',
          borderRadius: 14,
          padding: '13px 14px',
          width: '100%',
          maxWidth: 560,
          animation: 'rp-fadeUp 0.35s ease 0.22s both',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--rp-text)', marginBottom: 3 }}>
              Want richer highlights?
            </div>
            <div style={{ fontSize: 12, color: 'var(--rp-sub)', lineHeight: 1.55 }}>
              {detectedLinks.length > 0
                ? `Found ${detectedLinks.length} profile${detectedLinks.length === 1 ? '' : 's'} in your resume. Pilot can read them for more detail.`
                : 'Add your LinkedIn, GitHub, or portfolio so Pilot can build a richer picture.'}
            </div>
          </div>
          {detectedLinks.length > 0 && (
            <div style={{ display: 'flex', flexShrink: 0 }}>
              {detectedLinks.slice(0, 3).map((url, i) => {
                const p = guessPlatform(url);
                const cfg = RP_PLATFORMS[p];
                return (
                  <div
                    key={i}
                    style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: cfg.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginLeft: i > 0 ? -8 : 0,
                      border: '2px solid var(--rp-enrich-bg)',
                    }}
                  >
                    <PlatformIcon platform={p} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <button
          onClick={() => { setExpanded(true); track('rp_enrich_card_clicked'); }}
          style={{
            marginTop: 11, width: '100%', height: 38, borderRadius: 9, border: 'none',
            background: 'var(--rp-primary)', color: '#fff', fontSize: 13, fontWeight: 700,
            fontFamily: 'var(--sans)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          {detectedLinks.length > 0 && (
            <div style={{ position: 'relative', width: 6, height: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#7EFFD4' }} />
              <div style={{ position: 'absolute', inset: -2, borderRadius: '50%', background: '#7EFFD4', opacity: 0.3, animation: 'rp-pulseDot 2s ease infinite' }} />
            </div>
          )}
          {detectedLinks.length > 0
            ? `Review ${detectedLinks.length} found profile${detectedLinks.length === 1 ? '' : 's'}`
            : '+ Add links'}
        </button>
      </div>
    );
  }

  // ─ Expanded panel ─
  return (
    <div
      style={{
        background: 'var(--rp-card)',
        borderRadius: 16,
        boxShadow: '0 2px 14px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        width: '100%',
        maxWidth: 560,
        animation: 'rp-expandDown 0.3s ease both',
      }}
    >
      {/* header */}
      <div style={{ padding: '11px 14px 9px', borderBottom: '1px solid var(--rp-divider)', display: 'flex', alignItems: 'center', gap: 7 }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--rp-found-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <circle cx="5.5" cy="5.5" r="4.5" stroke="var(--rp-found)" strokeWidth="1.3" />
            <path d="M3.5 5.5l1.5 1.5 2.5-3" stroke="var(--rp-found)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--rp-text)', flex: 1 }}>Your online profiles</span>
        <button
          onClick={() => setExpanded(false)}
          aria-label="Close profiles panel"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rp-muted)', fontSize: 18, lineHeight: 1, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}
        >×</button>
      </div>

      {/* found sub-header */}
      {detectedLinks.length > 0 && (
        <div style={{ padding: '7px 14px 6px', background: 'var(--rp-found-bg)', borderBottom: '1px solid var(--rp-found-border)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ position: 'relative', width: 7, height: 7, flexShrink: 0 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--rp-found)' }} />
            <div style={{ position: 'absolute', inset: -2, borderRadius: '50%', background: 'var(--rp-found)', opacity: 0.22, animation: 'rp-pulseDot 2.2s ease infinite' }} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--rp-found)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Found in your resume
          </span>
        </div>
      )}

      {/* found rows */}
      {detectedLinks.map((url, i) => {
        const p = guessPlatform(url);
        const cfg = RP_PLATFORMS[p];
        const display = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
        return (
          <div
            key={`f-${i}`}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--rp-divider)', animation: `rp-rowIn 0.28s ease ${i * 0.04}s both` }}
          >
            <div style={{ width: 30, height: 30, borderRadius: 8, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <PlatformIcon platform={p} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: cfg.color, marginBottom: 1 }}>{cfg.label}</div>
              <div style={{ fontSize: 11, color: 'var(--rp-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{display}</div>
            </div>
          </div>
        );
      })}

      {/* added rows */}
      {addedLinks.map((url, i) => {
        const p = guessPlatform(url);
        const cfg = RP_PLATFORMS[p];
        const display = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
        return (
          <div
            key={`a-${i}`}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--rp-divider)', animation: 'rp-popIn 0.28s ease both' }}
          >
            <div style={{ width: 30, height: 30, borderRadius: 8, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <PlatformIcon platform={p} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{cfg.label}</div>
              <div style={{ fontSize: 11, color: 'var(--rp-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{display}</div>
            </div>
            <button
              onClick={() => removeAdded(url)}
              aria-label="Remove link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C8CDD8', fontSize: 16, padding: '2px 4px' }}
            >×</button>
          </div>
        );
      })}

      {/* add row with live icon preview */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px' }}>
        <div
          style={{
            width: 30, height: 30, borderRadius: 8,
            background: inputVal.trim().length > 3 ? liveCfg.bg : 'var(--rp-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            transition: 'background 0.18s',
          }}
        >
          {inputVal.trim().length > 3
            ? <PlatformIcon platform={livePlatform} />
            : <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1.5v8M1.5 5.5h8" stroke="var(--rp-muted)" strokeWidth="1.6" strokeLinecap="round" /></svg>}
        </div>
        <input
          type="url"
          placeholder="Add another link…"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitInput(); } }}
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--rp-text)', fontFamily: 'var(--sans)', minWidth: 0 }}
        />
        {inputVal.trim().length > 5 && (
          <button
            onClick={commitInput}
            style={{ background: 'var(--rp-primary)', color: '#fff', border: 'none', borderRadius: 7, padding: '5px 11px', fontSize: 12, fontWeight: 700, fontFamily: 'var(--sans)', cursor: 'pointer' }}
          >Add</button>
        )}
      </div>

      <div style={{ padding: '6px 14px 10px', borderTop: '1px solid var(--rp-divider)', fontSize: 11, color: 'var(--rp-muted)' }}>
        LinkedIn · GitHub · Framer · Behance · portfolio
      </div>

      {errorMsg && (
        <div style={{ padding: '0 14px 10px', fontSize: 11, color: 'oklch(0.65 0.2 30)' }}>
          {errorMsg}
        </div>
      )}

      {/* primary green CTA — only when at least one link present */}
      {totalCount > 0 && (
        <div style={{ padding: '0 12px 12px' }}>
          <button
            onClick={handleEnrich}
            disabled={enriching}
            style={{
              width: '100%', height: 40, borderRadius: 10, border: 'none',
              background: enriching ? '#9ec9b6' : 'var(--rp-found)',
              color: '#fff', fontSize: 13, fontWeight: 700,
              fontFamily: 'var(--sans)', cursor: enriching ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {enriching
              ? <><div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid white', borderTopColor: 'transparent', animation: 'rp-spin 0.7s linear infinite' }} />Reading…</>
              : `Let Pilot read ${totalCount} profile${totalCount === 1 ? '' : 's'} →`
            }
          </button>
        </div>
      )}
    </div>
  );
}

function StepVault({ onNext, onBack, dir }) {
  const isMobile = useIsMobile();
  const [vault, setVault] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [enrichOpen, setEnrichOpen] = useState(false);
  const [detectedLinks, setDetectedLinks] = useState([]);
  const [enrichJustRan, setEnrichJustRan] = useState(false);

  // Pulled out so we can call it after enrichment refreshes session.parsedResume.
  const rebuildFromSession = useCallback(() => {
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
    setDetectedLinks(session.detectedLinks || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    rebuildFromSession();
    track('rp_enrich_card_seen');
  }, [rebuildFromSession]);

  const handleEnrichDone = useCallback((enrichedParsed, sources) => {
    if (enrichedParsed) {
      saveSession({
        parsedName: enrichedParsed.name,
        parsedResume: enrichedParsed,
        enrichSources: sources || [],
      });
    } else {
      saveSession({ enrichSources: sources || [] });
    }
    track('rp_profile_enriched', {
      sources_ok: (sources || []).filter(s => s.status === 'ok').length,
      from: 'vault_card',
    });
    setEnrichJustRan(true);
    setEnrichOpen(false);
    rebuildFromSession();
  }, [rebuildFromSession]);

  const handleEnrichSkip = useCallback(() => {
    setEnrichOpen(false);
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
    // Natural-height top-aligned. The page (body) scrolls. No internal flex
    // tricks, no min-height percentage games — long role lists just push the
    // page taller and the user scrolls.
    <div
      className={dir === 1 ? 'rp-anim-in' : 'rp-anim-in-left'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 24px 48px',
        gap: 24,
        width: '100%',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
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

      {/* Enrichment opt-in — mobile (rolepitch-flow.html design) vs desktop
          (existing accent card). Both call the same enrich-profile flow under
          the hood. */}
      {isMobile ? (
        // ── Mobile: chip-based card ──
        <>
          {!enrichJustRan && (
            <MobileEnrichCard
              detectedLinks={detectedLinks}
              onComplete={handleEnrichDone}
              onCloseExpanded={() => setEnrichOpen(false)}
            />
          )}
          {enrichJustRan && (
            <div
              style={{
                width: '100%', maxWidth: 560,
                background: 'var(--rp-found-bg)',
                border: '1px solid var(--rp-found-border)',
                borderRadius: 12, padding: '12px 16px',
                fontSize: 13, color: 'var(--rp-text)',
                display: 'flex', alignItems: 'center', gap: 10,
                animation: 'rp-toastIn 0.25s ease both',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="var(--rp-found)" /><path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Highlights refreshed from your links.
            </div>
          )}
        </>
      ) : (
        // ── Desktop: existing card (unchanged) ──
        <>
          {!enrichOpen && !enrichJustRan && (
            <div style={{ width: '100%', maxWidth: 560, background: 'var(--accent-dim)', border: '1px solid oklch(0.50 0.19 248 / 0.2)', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--bg)', border: '1px solid oklch(0.50 0.19 248 / 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M5 8h6M5 5h6M5 11h4" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="13" cy="11.5" r="2.2" stroke="var(--accent)" strokeWidth="1.3" fill="none" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Want richer highlights?</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {detectedLinks.length
                    ? `Found ${detectedLinks.length} link${detectedLinks.length === 1 ? '' : 's'} on your resume. Pilot can read them for more detail.`
                    : 'Add your LinkedIn, portfolio, or GitHub — Pilot will pull in work that didn\'t make the resume.'}
                </div>
              </div>
              <button
                className="rp-btn-ghost"
                onClick={() => { setEnrichOpen(true); track('rp_enrich_card_clicked'); }}
                style={{ fontSize: 12, padding: '7px 14px', flexShrink: 0, fontWeight: 600 }}
              >
                + Add links
              </button>
            </div>
          )}
          {enrichOpen && (
            <div style={{ width: '100%', maxWidth: 560 }}>
              <StepEnrich
                parsedResult={null}
                detectedLinks={detectedLinks}
                onDone={handleEnrichDone}
                onSkip={handleEnrichSkip}
              />
            </div>
          )}
          {enrichJustRan && (
            <div style={{ width: '100%', maxWidth: 560, background: 'var(--green-dim)', border: '1px solid oklch(0.72 0.17 155 / 0.3)', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--green)" strokeWidth="1.4" /><path d="M5 8.5l2 2 4-4.5" stroke="var(--green)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
              Highlights refreshed from your links.
            </div>
          )}
        </>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 560 }}>
        <button className="rp-btn-ghost" onClick={onBack} style={{ flex: '0 0 auto' }}>← Back</button>
        <button className="rp-btn-primary" onClick={onNext} style={{ flex: 1, fontSize: 15 }}>Looks good →</button>
      </div>
    </div>
  );
}

// ── Step 3: Job Input ─────────────────────────────────────────────────────────
function StepJobInput({ onNext, onBack, dir }) {
  const isMobile = useIsMobile();
  const [url, setUrl] = useState('');
  const [pasted, setPasted] = useState('');
  const [mode, setMode] = useState('url');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);        // File[] for screenshots/PDF/DOCX
  const [fileStatus, setFileStatus] = useState(''); // 'reading' | 'done' | ''
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const ACCEPTED = 'image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  const addFiles = useCallback((incoming) => {
    const valid = Array.from(incoming).filter(f => {
      const mt = f.type || '';
      return mt.startsWith('image/') || mt === 'application/pdf' || f.name?.endsWith('.pdf') || f.name?.endsWith('.docx') || mt.includes('wordprocessingml');
    });
    if (!valid.length) { setError('Only images (PNG/JPG/WEBP), PDF, or DOCX allowed'); return; }
    setFiles(prev => [...prev, ...valid].slice(0, 6)); // max 6 files
    setError('');
  }, []);

  const removeFile = useCallback((i) => setFiles(prev => prev.filter((_, idx) => idx !== i)), []);

  const proceedFiles = useCallback(async () => {
    if (!files.length) { setError('Add at least one screenshot or file'); return; }
    setError('');
    setLoading(true);
    setFileStatus('reading');
    try {
      const fd = new FormData();
      files.forEach(f => fd.append('files', f));
      const res = await fetch('/api/rolepitch/parse-jd-file', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Could not read files');
      setFileStatus('done');
      // Feed extracted text into init-match as paste
      const draftIdForJd = getDraftId();
      const matchRes = await fetch('/api/rolepitch/init-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: data.title || 'Role', company: data.company || '', description: data.description, draft_id: draftIdForJd }),
      });
      const matchData = await matchRes.json();
      if (!matchRes.ok || matchData.error) throw new Error(matchData.error || 'Failed to save job');
      saveSession({
        jdId: matchData.jd_id || null,
        jdTitle: matchData.title,
        jdCompany: matchData.company,
        jdDescription: matchData.description,
        tailoredResumeId: null,
        tailoredResult: null,
      });
      track('rp_jd_submitted', { method: 'file', source: 'file_upload', company: matchData.company, title: matchData.title });
      onNext();
    } catch (err) {
      setError(err.message);
      setFileStatus('');
      setLoading(false);
    }
  }, [files, onNext]);

  const proceed = useCallback(async () => {
    if (mode === 'file') { proceedFiles(); return; }
    setError('');
    if (!url.trim() && pasted.trim().length < 30) {
      setError('Please enter a job URL or paste the description');
      return;
    }
    setLoading(true);
    try {
      const draftIdForJd = getDraftId();
      const body = mode === 'url' && url.trim()
        ? { url: url.trim(), draft_id: draftIdForJd }
        : { title: 'Role', company: '', description: pasted.trim(), draft_id: draftIdForJd };

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

      saveSession({
        jdId: data.jd_id || null,
        jdTitle: data.title,
        jdCompany: data.company,
        jdDescription: data.description,
        tailoredResumeId: null,
        tailoredResult: null,
      });
      track('rp_jd_submitted', { method: mode, source: data.source, company: data.company, title: data.title });
      onNext();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [url, pasted, mode, onNext, proceedFiles]);

  return (
    <div className={dir === 1 ? 'rp-anim-in' : 'rp-anim-in-left'} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', gap: 28 }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <h2 style={{ fontSize: 'clamp(24px,3vw,34px)', fontWeight: 600, letterSpacing: '-0.03em', marginBottom: 10 }}>Which role are you applying for?</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.6 }}>Share the job any way you have it</p>
      </div>

      <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Mode tabs — pill-style on mobile per rolepitch-flow.html design,
            full-width split with primary fill on the active pill */}
        {isMobile ? (
          <div style={{ display: 'flex', background: 'var(--rp-card)', borderRadius: 10, padding: 3, gap: 2, animation: 'rp-fadeUp 0.3s ease 0.07s both' }}>
            {[['url', 'Paste URL'], ['paste', 'Paste text'], ['file', 'Screenshot']].map(([v, l]) => (
              <button
                key={v}
                onClick={() => { setMode(v); setError(''); }}
                style={{
                  flex: 1, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 700, fontFamily: 'var(--sans)',
                  background: mode === v ? 'var(--rp-primary)' : 'transparent',
                  color: mode === v ? '#fff' : 'var(--rp-muted)',
                  transition: 'all 0.15s',
                }}
              >{l}</button>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 8, padding: 3, border: '1px solid var(--border-subtle)', alignSelf: 'flex-start' }}>
            {[['url', 'Job URL'], ['paste', 'Paste JD'], ['file', '📸 Screenshots / File']].map(([v, l]) => (
              <button key={v} onClick={() => { setMode(v); setError(''); }} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--sans)', background: mode === v ? 'var(--surface2)' : 'transparent', color: mode === v ? 'var(--text)' : 'var(--text-muted)', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>{l}</button>
            ))}
          </div>
        )}

        {mode === 'url' && (
          <input className="rp-input" value={url} onChange={e => { setUrl(e.target.value); setError(''); }} placeholder="https://stripe.com/jobs/product-manager-payments" onKeyDown={e => e.key === 'Enter' && proceed()} />
        )}

        {mode === 'paste' && (
          <textarea className="rp-input" value={pasted} onChange={e => { setPasted(e.target.value); setError(''); }} placeholder={SAMPLE_JOB} rows={8} style={{ resize: 'none', lineHeight: 1.6, fontSize: 13 }} />
        )}

        {mode === 'file' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 12,
                padding: '28px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? 'var(--accent-dim)' : 'var(--surface)',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>📸</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                Drop screenshots here or tap to upload
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                PNG, JPG, WEBP screenshots · PDF or DOCX · up to 6 files
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                multiple
                style={{ display: 'none' }}
                onChange={e => { addFiles(e.target.files); e.target.value = ''; }}
              />
            </div>

            {/* File previews */}
            {files.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {files.map((f, i) => {
                  const isImg = f.type?.startsWith('image/');
                  const previewUrl = isImg ? URL.createObjectURL(f) : null;
                  return (
                    <div key={i} style={{ position: 'relative', width: 72, height: 72, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface2)', flexShrink: 0 }}>
                      {isImg
                        ? <img src={previewUrl} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 4 }}>
                            <div style={{ fontSize: 20 }}>{f.name?.endsWith('.pdf') ? '📄' : '📝'}</div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', wordBreak: 'break-all', lineHeight: 1.2 }}>{f.name?.slice(0, 16)}</div>
                          </div>
                      }
                      <button
                        onClick={e => { e.stopPropagation(); removeFile(i); }}
                        style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, lineHeight: 1 }}
                      >×</button>
                    </div>
                  );
                })}
                {files.length < 6 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ width: 72, height: 72, borderRadius: 8, border: '1.5px dashed var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: 'var(--text-faint)' }}
                  >+</button>
                )}
              </div>
            )}

            {fileStatus === 'reading' && (
              <div style={{ fontSize: 13, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'rp-spin 0.7s linear infinite' }} />
                Reading {files.length} file{files.length > 1 ? 's' : ''} with AI…
              </div>
            )}
          </div>
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
              ? <><div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid white', borderTopColor: 'transparent', animation: 'rp-spin 0.7s linear infinite' }} /> {fileStatus === 'reading' ? 'Reading files…' : 'Analyzing…'}</>
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
  const isMobile = useIsMobile();
  const STEPS = ['Analyzing job requirements', 'Matching your experience', 'Identifying skill gaps', 'Rewriting bullets'];
  const [cur, setCur] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const session = loadSession();
    const { jdId, jdTitle, jdCompany, jdDescription, tailoredResult, parsedResume } = session;

    if (!jdDescription && !jdId) { setError('No job found — go back and enter a job URL'); return; }
    // Resume must exist before we can tailor. If we got here without one,
    // the user jumped past the upload step (or session was cleared mid-flow).
    // Surface a friendly message and link them back instead of firing a 400.
    const hasUsableResume = parsedResume && (parsedResume.experience?.length || parsedResume.summary || parsedResume.skills?.length);
    if (!hasUsableResume) {
      setError('We lost your resume — please upload it again to tailor for this job.');
      return;
    }

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
        draft_id: getDraftId(),
      }),
    })
      .then(r => r.json())
      .then(data => {
        clearInterval(stepTimer);
        if (data.error) throw new Error(data.error);
        saveSession({ tailoredResult: data, tailoredAt: new Date().toISOString() });
        track('rp_tailor_completed', {
          before_score: data.before_score,
          after_score: data.after_score,
          improvement: (data.after_score || 0) - (data.before_score || 0),
          jd_title: jdTitle,
          jd_company: jdCompany,
        });
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

  if (error) {
    const lostResume = error.toLowerCase().includes('lost your resume');
    return (
      <div className={dir === 1 ? 'rp-anim-in' : 'rp-anim-in-left'} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <p style={{ color: 'oklch(0.75 0.15 30)', marginBottom: 8 }}>{lostResume ? 'One thing missing.' : 'Hit a wall — not you, it\'s them.'}</p>
          <p style={{ fontSize: 13, color: 'var(--text-faint)', marginBottom: 20 }}>{error}</p>
          {lostResume ? (
            <button className="rp-btn-primary" onClick={() => { try { saveSession({ step: 0 }); } catch {} window.location.href = '/rolepitch/start'; }}>Upload my resume</button>
          ) : (
            <button className="rp-btn-ghost" onClick={() => window.location.reload()}>Retry</button>
          )}
        </div>
      </div>
    );
  }

  // Mobile: rolepitch-flow.html design — ⚡ icon header + tight white-card checklist
  if (isMobile) {
    return (
      <div
        className={dir === 1 ? 'rp-anim-in' : 'rp-anim-in-left'}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', gap: 24, width: '100%', minHeight: 'calc(100dvh - 80px)' }}
      >
        <div style={{ textAlign: 'center', animation: 'rp-fadeUp 0.3s ease both' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚡</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--rp-text)', lineHeight: 1.3 }}>
            {done ? 'Done.' : 'Tailoring your resume'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--rp-muted)', marginTop: 4 }}>
            {done ? 'Your resume has been tailored.' : 'This takes about 20 seconds'}
          </div>
        </div>
        <div
          style={{
            background: 'var(--rp-card)',
            borderRadius: 16,
            padding: '18px 20px',
            width: '100%', maxWidth: 420,
            boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
            display: 'flex', flexDirection: 'column', gap: 14,
            animation: 'rp-fadeUp 0.3s ease 0.1s both',
          }}
        >
          {STEPS.map((s, i) => {
            const isDone = i < cur || (done && i === STEPS.length - 1);
            const isRunning = i === cur && !isDone;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, animation: `rp-fadeUp 0.3s ease ${i * 0.08}s both` }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isDone ? 'var(--rp-found-bg)' : isRunning ? 'var(--rp-primary-light)' : 'var(--rp-border)',
                  transition: 'background 0.3s',
                }}>
                  {isDone
                    ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-6" stroke="var(--rp-found)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    : isRunning
                      ? <div style={{ width: 11, height: 11, borderRadius: '50%', border: '2px solid var(--rp-primary)', borderTopColor: 'transparent', animation: 'rp-spin 0.7s linear infinite' }} />
                      : <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--rp-border)' }} />
                  }
                </div>
                <span style={{
                  fontSize: 13,
                  fontWeight: isRunning ? 700 : 400,
                  color: isDone ? 'var(--rp-muted)' : isRunning ? 'var(--rp-text)' : 'var(--rp-muted)',
                  transition: 'all 0.3s',
                }}>{s}</span>
                {isDone && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--rp-found)', fontWeight: 600 }}>Done</span>}
                {isRunning && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--rp-primary)', fontWeight: 600 }}>running</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Desktop: unchanged
  return (
    <div className={dir === 1 ? 'rp-anim-in' : 'rp-anim-in-left'} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', gap: 40 }}>
      <div style={{ textAlign: 'center' }}>
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

// ── MobileScoreAndGap ────────────────────────────────────────────────────────
// Mobile-only hard merge of Step 5 (StepResult) + Step 6 (StepGapQuestions)
// into a single screen per rolepitch-flow.html design. Both components keep
// their internal state and effects; we just render them stacked.
//
// Score's onNext becomes a no-op (the gap UI is already on the same screen
// below it). Gap's onNext advances directly to the final-output raw step,
// skipping the now-collapsed gap raw step. Back goes to JobInput.
//
// Used only when isMobile === true; on desktop both stay as separate steps.
function MobileScoreAndGap({ onNext, onBack, dir }) {
  return (
    <div
      className={dir === 1 ? 'rp-anim-in' : 'rp-anim-in-left'}
      style={{ display: 'flex', flexDirection: 'column', width: '100%', minHeight: 0 }}
    >
      {/* Score card — internal `Continue →` becomes a no-op since the gap
          questions are already visible below. We still render its full body
          so the user sees the score, the breakdown, and the before/after. */}
      <div style={{ width: '100%' }}>
        <StepResult onNext={() => { /* intentionally no-op on mobile merged view */ }} onBack={onBack} dir={dir} />
      </div>
      {/* Gap-questions chat — its onNext is the real "advance to final" trigger.
          Back is disabled here (use the score card's back). */}
      <div style={{ width: '100%' }}>
        <StepGapQuestions onNext={onNext} onBack={onBack} dir={dir} />
      </div>
    </div>
  );
}

// ── Step 5: Result ────────────────────────────────────────────────────────────
function StepResult({ onNext, onBack, dir }) {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState('after');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const session = loadSession();
    const tr = session.tailoredResult;
    if (!tr) { setError('No tailored resume found — go back and try again'); setLoading(false); return; }

    const jd = { title: session.jdTitle || '', company: session.jdCompany || '' };
    const isLinksOnly = !session.parsedResume?.experience?.some(r => (r.bullets || []).length > 0);

    const bullets_by_role = (tr.tailored?.experience || []).map((role, i) => {
      const origRole = (session.parsedResume?.experience || [])[i] || {};
      const beforeBullets = (origRole.bullets || []).map(b => ({ text: typeof b === 'string' ? b : b.text }));
      const afterBullets = (role.bullets || []).map(b => ({ text: b.text, original: b.original }));
      return {
        company: role.company,
        role: role.title,
        before: beforeBullets,
        after: afterBullets,
        rewrittenCount: afterBullets.filter((b, idx) => b.text !== (beforeBullets[idx]?.text || '')).length,
      };
    });

    // Compute stats from actual data
    const totalBullets = bullets_by_role.reduce((s, r) => s + r.after.length, 0);
    const rewrittenTotal = bullets_by_role.reduce((s, r) => s + r.rewrittenCount, 0);
    const originalTotal = bullets_by_role.reduce((s, r) => s + r.before.length, 0);

    setResult({
      jd,
      before_score: tr.before_score,
      after_score: tr.after_score,
      bullets_by_role,
      gaps: tr.gaps || [],
      isLinksOnly,
      enrichSources: session.enrichSources || [],
      jdSnippet: session.jdDescription ? session.jdDescription.slice(0, 300) : '',
      stats: {
        total_bullets: totalBullets,
        rewritten: rewrittenTotal,
        original_total: originalTotal,
      },
    });
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
        {!isMobile && <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Step 5 of 7</div>}
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
              ['Bullets written', result.stats.total_bullets],
              ['Rewritten for JD', result.stats.rewritten],
              result.isLinksOnly
                ? ['Source', 'Links only']
                : ['Original bullets', result.stats.original_total],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{k}</span>
                <span style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--text)' }}>{v}</span>
              </div>
            ))}
          </div>

          {/* What Pilot read — evidence panel */}
          {(result.jdSnippet || result.enrichSources?.length > 0) && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>What Pilot read</div>
              {result.jdSnippet && (
                <div style={{ marginBottom: result.enrichSources?.length > 0 ? 10 : 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>Job description</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.55, fontStyle: 'italic' }}>
                    &ldquo;{result.jdSnippet.replace(/\s+/g, ' ').trim()}…&rdquo;
                  </div>
                </div>
              )}
              {result.enrichSources?.filter(s => s.status === 'ok').map(s => (
                <div key={s.url} style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--green)', marginBottom: 2 }}>{linkLabel(s.url)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{s.chars.toLocaleString()} chars extracted</div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Resume preview */}
        {displayRole && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 7, padding: 3, border: '1px solid var(--border-subtle)' }}>
                {(result.isLinksOnly ? ['after'] : ['before', 'after']).map(t => (
                  <button key={t} onClick={() => setTab(t)} style={{ padding: '5px 16px', borderRadius: 5, border: 'none', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, textTransform: 'capitalize', background: tab === t ? (t === 'after' ? 'var(--green)' : 'var(--surface2)') : 'transparent', color: tab === t ? (t === 'after' ? 'white' : 'var(--text)') : 'var(--text-muted)', transition: 'all 0.2s' }}>{t === 'after' ? (result.isLinksOnly ? 'Generated resume' : 'After — tailored') : 'Before — original'}</button>
                ))}
              </div>
              {tab === 'before' && <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>generic, not positioned for this role</span>}
              {tab === 'after' && !result.isLinksOnly && <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 500 }}>{result.stats.rewritten} bullets rewritten for this role</span>}
              {tab === 'after' && result.isLinksOnly && <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 500 }}>Generated from your profile</span>}
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

// Converts a raw gap string like "No direct ERP experience (SAP, Oracle)"
// into a Pilot-voice conversational opener
function gapToQuestion(gap) {
  const g = gap.toLowerCase();

  // Pattern: "No X experience" → "Have you worked with X?"
  const noExpMatch = gap.match(/^No (?:direct |explicit |demonstrated |proven |formal |strong )?(.+?) experience/i);
  if (noExpMatch) {
    const topic = noExpMatch[1].trim();
    return `The JD wants ${topic} experience — have you touched this at all, even indirectly? Walk me through it.`;
  }

  // Pattern: "Lacks X" or "Missing X"
  const lacksMatch = gap.match(/^(?:Lacks?|Missing) (.+)/i);
  if (lacksMatch) {
    return `They're looking for ${lacksMatch[1].trim()} — any exposure there, even in a side project or adjacent role?`;
  }

  // Pattern: "No X domain expertise"
  const domainMatch = gap.match(/^No (?:explicit |demonstrated )?(.+?) (?:domain )?expertise/i);
  if (domainMatch) {
    return `How familiar are you with ${domainMatch[1].trim()}? Even working knowledge counts — tell me what you've seen.`;
  }

  // Pattern: "No demonstrated experience with X"
  const expWithMatch = gap.match(/^No (?:\w+ )?experience (?:with|in|managing|leading) (.+)/i);
  if (expWithMatch) {
    return `Have you had any experience with ${expWithMatch[1].trim()}? Even at a smaller scale or supporting someone who did?`;
  }

  // Fallback: clean up and ask naturally
  const cleaned = gap.replace(/^No (?:direct |explicit |demonstrated |proven )?/i, '').replace(/\.$/, '');
  return `The JD flags a gap here: "${cleaned}". Have you dealt with this anywhere — even briefly? Give me the context.`;
}

const DEFAULT_QUESTIONS = [
  { question: 'Do you have experience working directly with enterprise or B2B customers?', tip: 'e.g. customer calls, QBRs, pilots, contracts' },
  { question: 'Have you worked on payment systems or financial infrastructure?', tip: 'e.g. routing, fraud, settlement, compliance' },
  { question: 'Have you led a product through a 0→1 launch at scale?', tip: 'More than 10K users at launch' },
];

function StepGapQuestions({ onNext, onBack, dir }) {
  const isMobile = useIsMobile();
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
    const session = loadSession();
    const tr = session.tailoredResult;
    const gapQuestions = tr?.gap_questions;
    const gaps = tr?.gaps;

    let qs = DEFAULT_QUESTIONS;
    if (gapQuestions?.length) {
      // Use Claude-generated questions directly — specific to this job+candidate
      qs = gapQuestions.slice(0, 3).map((q, i) => ({ question: q, tip: gaps?.[i] || '' }));
    } else if (gaps?.length) {
      // Fallback: convert gap strings via regex (legacy path)
      qs = gaps.slice(0, 3).map(gap => ({ question: gapToQuestion(gap), tip: gap }))
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
          draft_id: getDraftId(),
        }),
      })
        .then(r => r.json())
        .then(data => { if (!data.error) saveSession({ tailoredResult: data, tailoredAt: new Date().toISOString() }); })
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
              {/* tip hidden on mobile — it's redundant with the question */}
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
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8 }}>
            {typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
              ? 'Tap → to send · answers are saved to your vault'
              : 'Press Enter to send · answers are saved to your vault'}
          </div>
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
  const isMobile = useIsMobile();
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

  const handleGoogleSignup = async () => {
    track('rp_oauth_triggered', { source: 'signup_wall' });
    // Ensure draft exists before leaving — on mobile the mount call may not have completed
    const draftId = await ensureDraftId().catch(() => getDraftId());
    // step=6 means "returning from auth at final step — save + redirect to dashboard"
    const qs = new URLSearchParams({ step: '6', source: 'rolepitch' });
    if (draftId) qs.set('draft_id', draftId);
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
          source: session.parsedSource,
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
        <div style={{ fontSize: 52, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--green)', letterSpacing: '-0.04em', marginBottom: 6, lineHeight: 1 }}>{finalScore}%</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 4 }}>match score</div>
        <h2 style={{ fontSize: 'clamp(22px,2.5vw,30px)', fontWeight: 600, letterSpacing: '-0.03em', marginBottom: 10, marginTop: 16 }}>Your resume is ready</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
          Tailored for <strong style={{ color: 'var(--text)' }}>{jdLabel}</strong>{jdCompany ? ` at ${jdCompany}` : ''}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 380 }}>
        {(() => {
          const sess = loadSession();
          const hasOriginalResume = sess.parsedResume?.experience?.some(r => (r.bullets || []).length > 0);
          return (
            <div style={{ background: 'var(--green-dim)', border: '1px solid oklch(0.55 0.17 155 / 0.25)', borderRadius: 10, padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" fill="var(--green-dim)" stroke="var(--green)" strokeWidth="1" /><path d="M5.5 9l2.5 2.5 4.5-4.5" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{hasOriginalResume ? 'Original layout preserved' : 'Resume generated from your profile'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{hasOriginalResume ? 'Your formatting is intact' : 'Built from your links and context'}</div>
              </div>
            </div>
          );
        })()}

        {signedUp && (
          <div style={{ background: 'var(--accent-dim)', border: '1px solid oklch(0.50 0.19 248 / 0.2)', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="5" r="2.5" stroke="var(--accent)" strokeWidth="1.3" /><path d="M2 12c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="var(--accent)" strokeWidth="1.3" strokeLinecap="round" /></svg>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Signed in · <strong style={{ color: 'var(--text)' }}>Vault saved</strong> · 5 free pitches included</span>
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
        // Mobile: bottom-sheet that slides up. Desktop: centered modal (unchanged).
        isMobile ? (
          <div
            onClick={() => setModal(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,20,0.6)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', zIndex: 200 }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--rp-card)',
                borderRadius: '24px 24px 0 0',
                padding: '20px 20px calc(28px + env(safe-area-inset-bottom, 0px))',
                animation: 'rp-sheetUp 0.28s cubic-bezier(0.22,1,0.36,1) both',
                color: 'var(--rp-text)',
              }}
            >
              {/* drag handle */}
              <div style={{ width: 36, height: 4, background: 'var(--rp-border)', borderRadius: 2, margin: '0 auto 18px' }} />
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Save your resume</div>
              <div style={{ fontSize: 13, color: 'var(--rp-muted)', lineHeight: 1.6, marginBottom: 18 }}>
                Sign up free to download, keep, and share your tailored pitch. Your work is already saved.
              </div>
              <button
                onClick={handleGoogleSignup}
                style={{
                  width: '100%', height: 50, borderRadius: 12, border: 'none',
                  background: 'var(--rp-primary)', color: '#fff',
                  fontSize: 15, fontWeight: 700, fontFamily: 'var(--sans)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#fff" opacity="0.95" /><path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#fff" opacity="0.85" /><path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#fff" opacity="0.75" /><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#fff" opacity="0.7" /></svg>
                Continue with Google
              </button>
              <button
                onClick={() => setModal(null)}
                style={{
                  marginTop: 10, background: 'none', border: 'none',
                  color: 'var(--rp-muted)', fontSize: 13, fontFamily: 'var(--sans)',
                  cursor: 'pointer', width: '100%', padding: '8px',
                }}
              >
                Not now
              </button>
              <p style={{ fontSize: 11, color: 'var(--rp-muted)', textAlign: 'center', marginTop: 8 }}>
                5 free pitches. No credit card required.
              </p>
            </div>
          </div>
        ) : (
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
              <p style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'center', marginTop: 14 }}>5 free pitches. No credit card required.</p>
            </div>
          </div>
        )
      )}

      {/* Paywall modal */}
      {modal === 'paywall' && (
        <div onClick={() => setModal(null)} style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.45)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '36px 32px', maxWidth: 400, width: '100%', boxShadow: '0 24px 64px oklch(0 0 0 / 0.2)' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>You&apos;ve used your free pitches</div>
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
  const [noCredits, setNoCredits] = useState(false);

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
        source: session.parsedSource,
        jd: { title: session.jdTitle, company: session.jdCompany, description: session.jdDescription },
        jd_id: session.jdId || null,
        tailored: tr,
      }),
    })
      .then(async r => {
        const data = await r.json();
        if (r.status === 402 && data.error === 'no_credits') { setNoCredits(true); return; }
        if (data.tailored_resume_id) setSavedId(data.tailored_resume_id);
      })
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

      {noCredits && (
        <UpgradeModal
          trigger="no_credits"
          onClose={() => router.push('/rolepitch/dashboard')}
          onSuccess={() => router.push('/rolepitch/dashboard')}
        />
      )}
    </div>
  );
}

// ── App shell ─────────────────────────────────────────────────────────────────
const TOTAL_NEW = 7;      // new users: full 7-step onboarding
const TOTAL_RETURNING = 4; // returning users: JD → Processing → Chat → Done

function RolePitchStartInner() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [isReturning, setIsReturning] = useState(false); // signed-in with existing vault
  const [ready, setReady] = useState(false); // don't render until we know the mode
  const [saveError, setSaveError] = useState('');  // surfaces failed step=6 save

  // Body scroll is the source of truth now. We previously locked body and
  // tried to scroll an inner container, which kept causing scroll-clipping
  // bugs on mobile (top role half-cut, CTAs unreachable, expand/collapse
  // jumps). Letting the page scroll naturally is the boring correct answer.

  useEffect(() => {
    const theme = localStorage.getItem('rp_theme') || 'light';
    document.documentElement.setAttribute('data-rp-theme', theme);

    // Eagerly create draft row so claim-draft always has something to find
    ensureDraftId().catch(() => {}); // non-blocking, best-effort

    // On return from OAuth, URL may carry ?step=N&tr=UUID
    const params = new URLSearchParams(window.location.search);
    const urlStep = parseInt(params.get('step') || '', 10);
    const urlTr = params.get('tr');
    if (urlTr) saveSession({ tailoredResumeId: urlTr });

    const session = loadSession();

    // Diagnostic: capture URL params + session shape so we can tell whether
    // step=6 was lost in transit OR localStorage was empty when /start mounted
    // post-OAuth. Logs presence/lengths only — no PII.
    if (typeof window !== 'undefined') {
      const diag = {
        url_step_raw: params.get('step'),
        url_step_parsed: isNaN(urlStep) ? null : urlStep,
        url_source: params.get('source'),
        url_tr: !!urlTr,
        url_save_error: !!params.get('save_error'),
        url_search_len: window.location.search.length,
        url_hash_len: window.location.hash.length,
        has_parsed_resume: !!session.parsedResume,
        has_parsed_source: !!session.parsedSource,
        has_jd_id: !!session.jdId,
        has_jd_title: !!session.jdTitle,
        has_jd_description: !!session.jdDescription,
        jd_description_len: session.jdDescription?.length || 0,
        has_tailored_result: !!session.tailoredResult,
        tailored_after_score: session.tailoredResult?.after_score || null,
        is_authenticated_flag: !!session.isAuthenticated,
        session_keys: Object.keys(session),
      };
      console.log('[rolepitch/start mount] diag', diag);
      // Also POST to a server route so it lands in Vercel logs (not just browser console).
      // Best-effort: do NOT block render on this.
      try {
        navigator.sendBeacon?.(
          '/api/rolepitch/log-client',
          new Blob([JSON.stringify({ event: 'start_mount', diag })], { type: 'application/json' })
        );
      } catch {}
    }

    // Returning from OAuth at step 6 (final) — save session data to DB then go to dashboard.
    // Pass Bearer token explicitly to avoid the auth-cookie propagation race that can drop
    // the save silently. On failure: keep localStorage intact and surface an error so the
    // user can retry instead of landing on an empty dashboard with no signal.
    if (urlStep === 6 && params.get('source') === 'rolepitch' && session.parsedResume) {
      (async () => {
        try {
          const supabase = createClient();
          const { data: { session: authSession } } = await supabase.auth.getSession();
          const token = authSession?.access_token;
          if (!token) throw new Error('Sign-in did not complete — please try again.');

          const res = await fetch('/api/rolepitch/save-resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              parsed: session.parsedResume,
              source: session.parsedSource,
              jd: { title: session.jdTitle, company: session.jdCompany, description: session.jdDescription },
              jd_id: session.jdId || null,
              tailored: session.tailoredResult,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || data.error) {
            console.error('[rolepitch/start step=6] save-resume failed', { status: res.status, body: data });
            throw new Error(data.message || data.error || 'Save failed — your work is preserved, please retry.');
          }
          // Success — clear session data we just persisted, then go to dashboard
          saveSession({ jdId: null, jdTitle: null, jdCompany: null, jdDescription: null, tailoredResumeId: null, tailoredResult: null });
          window.location.href = '/rolepitch/dashboard?welcome=1';
        } catch (err) {
          // Keep localStorage intact so the user can retry without losing work.
          // Surface the error visibly via URL param the start page can render.
          const msg = encodeURIComponent(err.message || 'Save failed');
          window.location.href = `/rolepitch/start?save_error=${msg}`;
        }
      })();
      return;
    }

    // Render save-error banner if redirected here from a failed save
    const saveErrParam = params.get('save_error');
    if (saveErrParam) {
      setSaveError(decodeURIComponent(saveErrParam));
      window.history.replaceState({}, '', '/rolepitch/start');
    } else if (session.pendingSaveError) {
      setSaveError(session.pendingSaveError);
    }

    // Clean URL without reloading
    if (params.has('step') || params.has('tr') || params.has('source')) {
      window.history.replaceState({}, '', '/rolepitch/start');
    }

    const supabase = createClient();
    // ?reupload=1 forces the new-user flow even if the user has a saved
    // profile — used by the LAYOUT_UNAVAILABLE prompt in download-pdf.
    const urlParams = new URLSearchParams(window.location.search);
    const forceReupload = urlParams.get('reupload') === '1';

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        identify(user.id, { email: user.email });

        // DB profile is the source of truth for "does this user have a resume".
        // Always check it first — session/localStorage can be empty (cleared by
        // tailoring flow, fresh tab, signed-in on a different device).
        //
        // Critically: we also check whether the original CV LAYOUT is captured
        // (original_html / original_pdf_path). Without it we can't honour the
        // "your layout, preserved" promise, so we treat the user as new and
        // route them through resume upload — even if parsed_json exists.
        const { data: prof } = await supabase
          .from('profiles')
          .select('structured_resume, parsed_json, original_html, original_pdf_path')
          .eq('user_id', user.id)
          .maybeSingle();

        const hasParsed = !!(prof?.parsed_json || prof?.structured_resume);
        const hasLayout = !!(prof?.original_html || prof?.original_pdf_path);
        let parsedResume = (hasParsed && hasLayout && !forceReupload)
          ? (prof.parsed_json || prof.structured_resume)
          : null;
        let hasDbProfile = !!parsedResume;
        if (hasParsed && !hasLayout) {
          console.log('[rolepitch/start mount] profile exists but layout missing → forcing upload step');
        }
        if (forceReupload) {
          console.log('[rolepitch/start mount] ?reupload=1 → forcing upload step');
        }

        // Defensive recovery — covers the Vshrant case where step=6 didn't
        // execute (URL param lost / localStorage empty at OAuth return) but
        // the user still has in-flight tailor work in localStorage.
        //
        // We hit save-resume regardless of urlStep when:
        //   - signed in
        //   - session has parsedResume
        //   - either: no DB profile yet, OR session has a tailoredResult
        //     that hasn't been persisted to tailored_resumes yet
        //
        // save-resume is idempotent on profile (only inserts if missing) and
        // on tailored_resumes (deduct_pitch_credit fires only on successful
        // insert). Worst case is a no-op + 1 wasted credit-check read.
        const sessionHasInflightPitch = !!(session.parsedResume && session.tailoredResult && session.jdDescription);

        let needFullSave = false;
        if (sessionHasInflightPitch) {
          // Check whether this specific in-flight tailor result is already saved.
          // Match on jd description snippet to avoid re-saving a previous pitch.
          // Falls back to checking if ANY row exists for this jd company+title combo.
          const jdSnippet = (session.jdDescription || '').slice(0, 100);
          const { data: existingTr } = await supabase
            .from('tailored_resumes')
            .select('id, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1);
          // Save if: no rows at all, OR the latest row predates this session's tailor
          // (session.tailoredAt set when tailor completes — if missing, always save)
          const latestSavedAt = existingTr?.[0]?.created_at
            ? new Date(existingTr[0].created_at).getTime()
            : 0;
          const tailoredAt = session.tailoredAt ? new Date(session.tailoredAt).getTime() : Date.now();
          needFullSave = !existingTr?.length || tailoredAt > latestSavedAt;
        }

        if (!hasDbProfile || needFullSave) {
          parsedResume = parsedResume || session.parsedResume;
          try {
            const { data: { session: authSession } } = await supabase.auth.getSession();
            const token = authSession?.access_token;
            const body = needFullSave
              ? {
                  parsed: parsedResume,
                  source: session.parsedSource,
                  jd: { title: session.jdTitle, company: session.jdCompany, description: session.jdDescription },
                  jd_id: session.jdId || null,
                  tailored: session.tailoredResult,
                }
              : { parsed: parsedResume, source: session.parsedSource };

            console.log('[rolepitch/start mount] firing recovery save-resume', {
              path: needFullSave ? 'full_recovery' : 'profile_only',
              has_db_profile: hasDbProfile,
              session_has_inflight_pitch: sessionHasInflightPitch,
            });

            const res = await fetch('/api/rolepitch/save-resume', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify(body),
            });

            if (res.ok) {
              hasDbProfile = true;
              if (needFullSave) {
                const data = await res.json().catch(() => ({}));
                if (data.tailored_resume_id) {
                  console.log('[rolepitch/start mount] full recovery succeeded', { tailored_resume_id: data.tailored_resume_id });
                  // Clear consumed session keys, redirect to dashboard with welcome marker
                  saveSession({
                    jdId: null, jdTitle: null, jdCompany: null,
                    jdDescription: null, tailoredResumeId: null, tailoredResult: null,
                  });
                  window.location.href = '/rolepitch/dashboard?welcome=1&recovered=1';
                  return;
                }
              }
            } else {
              const errBody = await res.json().catch(() => ({}));
              console.warn('[rolepitch/start mount] recovery save-resume failed', {
                status: res.status,
                body: errBody,
                path: needFullSave ? 'full_recovery' : 'profile_only',
              });
            }
          } catch (e) {
            console.warn('[rolepitch/start mount] recovery save-resume threw', { message: e?.message });
          }
        }

        // Hydrate session from DB so downstream steps don't re-query.
        if (parsedResume && !session.parsedResume) {
          saveSession({ parsedResume });
        }

        if (parsedResume) {
          // Returning-user flow: 4 steps starting at JD input.
          // DO NOT wipe in-flight JD/tailor data here — the user may have just signed in
          // mid-flow with work in progress. Only set isAuthenticated and the flow flag.
          // The JD-input step itself resets jd state when the user submits a new JD.
          saveSession({ isAuthenticated: true });
          setIsReturning(true);
          setStep(0);
        } else {
          // Signed in but no profile and no session resume — run full onboarding
          saveSession({ isAuthenticated: true });
          setStep(0);
        }
      } else {
        // Not signed in — new user full flow.
        // Honor URL/session step BUT clamp to upload (0) if there's no parsed resume yet.
        // Otherwise a deep link like ?step=2 lands the user at JD input with no resume,
        // and the tailor step 400s with a confusing error.
        const requestedStep = !isNaN(urlStep) ? urlStep : (session.step || 0);
        const hasResume = !!session.parsedResume;
        const startStep = (requestedStep > 0 && !hasResume) ? 0 : requestedStep;
        setStep(startStep);
      }
      setReady(true);
    });
  }, []);

  const TOTAL = isReturning ? TOTAL_RETURNING : TOTAL_NEW;

  const STEP_NAMES_NEW = ['upload', 'vault', 'jd_input', 'processing', 'result', 'gap_questions', 'final_output'];
  const STEP_NAMES_RETURNING = ['jd_input', 'processing', 'gap_questions', 'done'];

  const go = useCallback((n) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
    if (!isReturning) saveSession({ step: n });
    const names = isReturning ? STEP_NAMES_RETURNING : STEP_NAMES_NEW;
    const stepName = names[n] || `step_${n}`;
    track('rp_step_viewed', { step: n, step_name: stepName, flow: isReturning ? 'returning' : 'new' });
  }, [step, isReturning]);

  const next = useCallback(() => go(Math.min(step + 1, TOTAL - 1)), [step, go, TOTAL]);
  const back = useCallback(() => {
    const prev = Math.max(step - 1, 0);
    if (!isReturning && prev <= 2) saveSession({ jdId: null, jdTitle: null, jdCompany: null, jdDescription: null, tailoredResumeId: null, tailoredResult: null });
    go(prev);
  }, [step, go, isReturning]);
  const goHome = useCallback(() => router.push('/rolepitch'), [router]);
  const tailorAnother = useCallback(() => {
    saveSession({ jdId: null, jdTitle: null, jdCompany: null, jdDescription: null, tailoredResumeId: null, tailoredResult: null, tailoredAt: null, step: isReturning ? 0 : 2 });
    go(isReturning ? 0 : 2);
  }, [go, isReturning]);

  // Returning users: 4 steps — JD input, Processing, Chat Q&A, Done
  const RETURNING_STEPS = [
    <StepJobInput key={`ret-${step}`} onNext={next} onBack={() => router.push('/rolepitch/dashboard')} dir={dir} returning />,
    <StepProcessing key={`ret-${step}`} onNext={next} dir={dir} />,
    <StepGapQuestions key={`ret-${step}`} onNext={next} onBack={back} dir={dir} />,
    <StepReturningDone key={`ret-${step}`} onTailorAnother={tailorAnother} dir={dir} />,
  ];

  // On mobile, raw steps 4 and 5 (StepResult + StepGapQuestions) hard-merge
  // into a single combined screen (MobileScoreAndGap). Its onNext jumps
  // directly to raw step 6 (final), skipping the now-collapsed gap step.
  // We slot the same merged component into both index 4 AND index 5 so the
  // user sees the same screen even if browser-back lands them on raw step 5.
  const goToFinal = useCallback(() => go(6), [go]);

  // New users: full 7-step onboarding (with mobile merge of steps 4+5)
  const NEW_STEPS = [
    <StepUpload key={`new-${step}`} onNext={next} dir={dir} />,
    <StepVault key={`new-${step}`} onNext={next} onBack={back} dir={dir} />,
    <StepJobInput key={`new-${step}`} onNext={next} onBack={back} dir={dir} />,
    <StepProcessing key={`new-${step}`} onNext={next} dir={dir} />,
    isMobile
      ? <MobileScoreAndGap key={`new-${step}`} onNext={goToFinal} onBack={back} dir={dir} />
      : <StepResult key={`new-${step}`} onNext={next} onBack={back} dir={dir} />,
    isMobile
      ? <MobileScoreAndGap key={`new-${step}`} onNext={goToFinal} onBack={back} dir={dir} />
      : <StepGapQuestions key={`new-${step}`} onNext={next} onBack={back} dir={dir} />,
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
        {saveError && (
          <div style={{
            background: 'oklch(0.96 0.05 30)',
            borderBottom: '1px solid oklch(0.85 0.12 30)',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            fontSize: 13,
            color: 'oklch(0.35 0.15 30)',
          }}>
            <span><strong>Save failed:</strong> {saveError} Your work is still here — click retry.</span>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                className="rp-btn-primary"
                style={{ padding: '6px 14px', fontSize: 12 }}
                onClick={() => {
                  setSaveError('');
                  saveSession({ pendingSaveError: null });
                  window.location.href = '/rolepitch/start?step=6&source=rolepitch';
                }}
              >Retry save</button>
              <button
                className="rp-btn-ghost"
                style={{ padding: '6px 14px', fontSize: 12 }}
                onClick={() => { setSaveError(''); saveSession({ pendingSaveError: null }); }}
              >Dismiss</button>
            </div>
          </div>
        )}
        {isReturning ? (
          // Returning users: minimal nav with back-to-dashboard link.
          // Sticky so it stays pinned while the page scrolls.
          <div className="rp-sticky-header" style={{ padding: '16px 32px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
          // ProgressBar is rendered inline; we wrap it so it sticks at top while
          // the body of the page scrolls naturally.
          <div className="rp-sticky-header">
            <ProgressBar step={step} total={TOTAL_NEW} onHome={goHome} />
          </div>
        )}
        <div
          style={{
            // Body scrolls the page. No inner overflow container any more —
            // that's what kept clipping the top role and breaking scroll on
            // mobile. Padding-bottom respects the iOS home indicator.
            display: 'flex',
            flexDirection: 'column',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {currentSteps[step]}
        </div>
      </div>
    </>
  );
}

// Suspense wrapper — required by Next 16 because we read URL params via
// useSearchParams() in StepUpload (?mode=links).
export default function RolePitchStart() {
  return (
    <Suspense fallback={null}>
      <RolePitchStartInner />
    </Suspense>
  );
}
