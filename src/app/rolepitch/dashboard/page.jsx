'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { track } from '@/components/PostHogProvider';
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
    --green: oklch(0.55 0.17 155);
    --green-dim: oklch(0.55 0.17 155 / 0.10);
    --amber: oklch(0.60 0.16 80);
    --text: oklch(0.16 0.03 248);
    --text-muted: oklch(0.44 0.04 248);
    --text-faint: oklch(0.62 0.03 248);
    --mono: 'JetBrains Mono', monospace;
    --sans: 'DM Sans', sans-serif;
  }
  [data-rp-theme="dark"] {
    --bg: oklch(0.11 0.03 248);
    --surface: oklch(0.155 0.035 248);
    --surface2: oklch(0.19 0.04 248);
    --border: oklch(0.26 0.04 248);
    --border-subtle: oklch(0.195 0.03 248);
    --accent: oklch(0.62 0.19 248);
    --accent-dim: oklch(0.62 0.19 248 / 0.12);
    --green: oklch(0.72 0.17 155);
    --green-dim: oklch(0.72 0.17 155 / 0.12);
    --amber: oklch(0.78 0.16 80);
    --text: oklch(0.94 0.01 248);
    --text-muted: oklch(0.58 0.04 248);
    --text-faint: oklch(0.38 0.03 248);
  }
  .rp-dash { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; -webkit-font-smoothing: antialiased; }
  .rp-btn-primary { background: var(--accent); color: white; border: none; cursor: pointer; padding: 11px 22px; border-radius: 9px; font-size: 14px; font-weight: 600; font-family: var(--sans); letter-spacing: -0.02em; transition: all 0.15s; }
  .rp-btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
  .rp-btn-ghost { background: transparent; color: var(--text-muted); border: 1px solid var(--border); cursor: pointer; padding: 9px 18px; border-radius: 9px; font-size: 13px; font-weight: 500; font-family: var(--sans); transition: all 0.15s; }
  .rp-btn-ghost:hover { color: var(--text); border-color: oklch(0.4 0.04 248); }
  @keyframes rp-spin { to { transform: rotate(360deg); } }
  @keyframes rp-fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  .rp-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 22px 24px; transition: box-shadow 0.2s, border-color 0.2s; }
  .rp-card:hover { box-shadow: 0 4px 24px oklch(0 0 0 / 0.08); border-color: oklch(0.78 0.015 248); }
  .rp-scroll::-webkit-scrollbar { width: 4px; }
  .rp-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
  @media (max-width: 600px) {
    .rp-nav { padding: 10px 14px !important; gap: 6px !important; }
    .rp-nav-label { display: none !important; }
    .rp-nav-memory { display: none !important; }
    .rp-nav-signout { display: none !important; }
    .rp-credits-badge { max-width: 110px; overflow: hidden; }
    .rp-credits-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rp-btn-ghost { padding: 8px 12px !important; font-size: 12px !important; }
    .rp-btn-primary { padding: 8px 14px !important; font-size: 12px !important; }
    .rp-card { padding: 13px 13px 11px !important; }
    .rp-card-stats { display: none !important; }
    .rp-pitch-avatar { display: none !important; }
    .rp-pitch-score-col { display: none !important; }
    .rp-pitch-meta-row { display: none !important; }
    .rp-pitch-mobile-actions { display: flex !important; }
  }
`;

function ScorePill({ before, after }) {
  const diff = after - before;
  const color = scoreColor(after);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {diff > 0 && (
        <>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-faint)' }}>{before}%</span>
          <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M2 5h10M8 1l4 4-4 4" stroke="var(--accent)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </>
      )}
      <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color }}>{after}%</span>
      {diff > 0 && <span style={{ fontSize: 11, color, fontFamily: 'var(--mono)' }}>+{diff}%</span>}
    </div>
  );
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatEditStamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return `${day}, ${time}`;
}

function downloadLabel(resume) {
  if (!resume?.has_edits || !resume?.edited_at) return '';
  return `Edit ${resume.edit_count || 1} · ${formatEditStamp(resume.edited_at)}`;
}

function companyInitials(company) {
  if (!company) return '?';
  return company.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function companyColor(company) {
  if (!company) return '#6366f1';
  let h = 0;
  for (let i = 0; i < company.length; i++) h = (h * 31 + company.charCodeAt(i)) >>> 0;
  const hues = [220, 260, 160, 30, 320, 190, 45];
  return `hsl(${hues[h % hues.length]}, 60%, 45%)`;
}

function scoreColor(score) {
  if (score >= 75) return 'var(--green)';
  if (score >= 50) return 'var(--amber)';
  return 'oklch(0.65 0.2 30)';
}

function CritiqueCard({ c, i, router }) {
  const score = c.critique_json?.overall_score || 0;
  const verdict = c.critique_json?.headline_verdict || '';
  const label = c.critique_json?.score_label || '';
  const expiresAt = new Date(c.expires_at);
  const msLeft = expiresAt - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / 86400000));
  const expiryLabel = msLeft <= 0 ? 'expired' : daysLeft === 0 ? 'expires today' : `${daysLeft}d left`;

  const handleTailor = () => {
    // Auto-tailor route: server reads critique.parsed_resume + inferred_target,
    // runs the tailor, saves a tailored_resumes row, and redirects to the result.
    // No client-side session juggling needed — DB is the source of truth.
    router.push(`/rolepitch/tailoring?critique_id=${encodeURIComponent(c.id)}`);
  };

  return (
    <div className="rp-card" style={{ animation: `rp-fadeUp 0.35s ${i * 0.05}s ease both` }}>
      <div className="rp-card-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
        {/* Score circle */}
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `${scoreColor(score)}18`, border: `1.5px solid ${scoreColor(score)}44`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(score), lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: 8, color: scoreColor(score), opacity: 0.7 }}>/100</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: scoreColor(score), background: `${scoreColor(score)}15`, padding: '2px 8px', borderRadius: 20 }}>{label}</span>
            {c.target_context && <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>· {c.target_context}</span>}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            "{verdict}"
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
            {formatDate(c.created_at)} · {expiryLabel}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="rp-btn-ghost" style={{ fontSize: 12, padding: '7px 14px' }} onClick={() => router.push(`/rolepitch/report/${c.id}`)}>
          View report
        </button>
        <button className="rp-btn-primary" style={{ fontSize: 12, padding: '7px 14px' }} onClick={handleTailor}>
          Tailor for a job →
        </button>
      </div>
    </div>
  );
}

export default function RolePitchDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState('pitches'); // 'pitches' | 'critiques'
  const [resumes, setResumes] = useState([]);
  const [critiques, setCritiques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [critiquesLoading, setCritiquesLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(null);
  const [user, setUser] = useState(null);
  const [credits, setCredits] = useState(null);
  const [planTier, setPlanTier] = useState('free');
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [welcome, setWelcome] = useState(null); // { granted, total }
  const [downloadPrompt, setDownloadPrompt] = useState(null);
  const [accountSheet, setAccountSheet] = useState(false);

  const fetchCredits = () => {
    fetch('/api/rolepitch/credits')
      .then(r => r.json())
      .then(d => { setCredits(d.pitch_credits ?? 5); setPlanTier(d.plan_tier ?? 'free'); })
      .catch(() => {});
  };

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => { setUser(user); });

    const params = new URLSearchParams(window.location.search);
    const isWelcome = params.get('welcome') === '1';

    // Welcome flow: came from campaign signup (?welcome=1) — read live credits only.
    if (isWelcome) {
      fetch('/api/rolepitch/credits')
        .then(r => r.json())
        .then(d => {
          const total = d.pitch_credits ?? 5;
          setCredits(total);
          setPlanTier(d.plan_tier ?? 'free');
          setWelcome({ granted: Math.max(0, total - 5), total });
        })
        .catch(() => setWelcome({ granted: 0, total: 5 }));
      window.history.replaceState({}, '', '/rolepitch/dashboard');
    }

    // If coming from critique flow, default to critiques tab and consume the
    // marker from rp_session. Safe to clear: /tailoring doesn't read rp_session,
    // and /start writes its own session keys before redirecting here.
    let pendingCritiqueId = null;
    try {
      const sess = JSON.parse(sessionStorage.getItem('rp_session') || '{}');
      const local = JSON.parse(localStorage.getItem('rp_session') || '{}');
      pendingCritiqueId = sess.critiqueId || local.critiqueId || null;
      if (sess.fromCritique || local.fromCritique) {
        setTab('critiques');
        sessionStorage.removeItem('rp_session');
        localStorage.removeItem('rp_session');
      }
    } catch {}

    // Belt-and-suspenders: re-claim critique on dashboard mount in case the
    // auth-page claim missed (cookie not yet propagated, etc).
    if (pendingCritiqueId) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        const token = session?.access_token;
        if (!token) return;
        fetch('/api/rolepitch/claim-critique', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ critique_id: pendingCritiqueId }),
        })
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            if (d?.claimed > 0) {
              fetch('/api/rolepitch/my-critiques')
                .then(r => r.ok ? r.json() : { critiques: [] })
                .then(data => setCritiques(data.critiques || []));
            }
          })
          .catch(() => {});
      });
    }

    // Belt-and-suspenders: try to claim any pending draft on dashboard mount.
    // Catches the case where auth-page claim was interrupted by user navigation,
    // mobile tab eviction, or transient errors. claim-draft must only claim by
    // explicit draft_id or email; never re-add the old recency fallback.
    {
      let pendingDraftId = null;
      try { pendingDraftId = localStorage.getItem('rp_draft_id') || null; } catch {}
      supabase.auth.getSession().then(({ data: { session } }) => {
        const token = session?.access_token;
        if (!token) return;
        fetch('/api/rolepitch/claim-draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ draft_id: pendingDraftId }),
        })
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            if (d?.claimed) {
              try { localStorage.removeItem('rp_draft_id'); } catch {}
              if (d?.tailored_resume_id) {
                fetch('/api/rolepitch/my-resumes')
                  .then(r => r.ok ? r.json() : { resumes: [] })
                  .then(data => setResumes(data.resumes || []));
                fetchCredits();
              }
            }
          })
          .catch(() => {});
      });
    }

    // Welcome flow = brand-new user just completed OAuth. Skip the data probe
    // entirely — they have zero resumes and the cookie may not yet be readable
    // by the API route on first redirect (race), which would 401 → bounce to /start.
    if (isWelcome) {
      setResumes([]);
      setLoading(false);
      setCritiquesLoading(false);
    } else {
      // Single fetch: one auth check, 3 parallel DB queries server-side
      fetch('/api/rolepitch/dashboard-data')
        .then(r => {
          if (r.status === 401) { window.location.href = '/rolepitch/auth'; return null; }
          return r.json();
        })
        .then(data => {
          if (!data) return;
          if (data.error) { setError(data.error); setLoading(false); setCritiquesLoading(false); return; }
          setResumes(data.resumes || []);
          setCritiques(data.critiques || []);
          setCredits(data.pitch_credits ?? 5);
          setPlanTier(data.plan_tier ?? 'free');
          setLoading(false);
          setCritiquesLoading(false);
        })
        .catch(err => { setError(err.message); setLoading(false); setCritiquesLoading(false); });
    }
  }, []);

  const handleDownload = async (resumeId) => {
    setDownloading(resumeId);
    const resume = resumes.find(r => r.id === resumeId);
    track('rp_pdf_downloaded', { resume_id: resumeId, jd_title: resume?.jd?.title, jd_company: resume?.jd?.company });
    try {
      const res = await fetch(`/api/rolepitch/download-pdf?tailored_resume_id=${resumeId}`, {
        headers: { Accept: 'text/html,application/json' },
      });
      if (res.redirected && res.url.includes('/rolepitch/start')) {
        window.location.href = res.url;
        return;
      }
      if (!res.ok) throw new Error('Could not prepare PDF');
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/i);
      const filename = match?.[1] || 'RolePitch_resume.pdf';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      if (resume && !resume.has_edits) setDownloadPrompt(resume);
    } catch (e) {
      setError(e.message || 'Could not prepare PDF');
    } finally {
      setDownloading(null);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/rolepitch');
  };

  return (
    <>
      <style>{CSS_VARS}</style>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
      <div className="rp-dash">
        {/* Nav */}
        <div className="rp-nav" style={{ padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10, backdropFilter: 'blur(12px)' }}>
          <button onClick={() => router.push('/rolepitch')} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', padding: 0, flexShrink: 0 }}>
            <div style={{ width: 24, height: 24, background: 'var(--accent)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M2 7h7M2 11h9" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em' }}>RolePitch</span>
          </button>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Credits badge */}
            {credits !== null && (
              <button
                onClick={() => setShowUpgrade(true)}
                className="rp-credits-badge"
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: credits <= 2 ? 'oklch(0.65 0.2 30 / 0.1)' : 'var(--surface)', border: `1px solid ${credits <= 2 ? 'oklch(0.65 0.2 30 / 0.4)' : 'var(--border)'}`, borderRadius: 20, padding: '4px 9px 4px 7px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: credits <= 2 ? 'oklch(0.65 0.2 30)' : 'var(--text-muted)', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
              >
                <span style={{ fontSize: 13 }}>🎯</span>
                <span className="rp-credits-text">{credits}</span>
              </button>
            )}
            <button className="rp-btn-ghost rp-nav-memory" onClick={() => router.push('/rolepitch/dashboard/memory')} style={{ fontSize: 12, padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
              🧠 <span className="rp-nav-label">Memory</span>
            </button>
            <button onClick={() => router.push('/rolepitch/start')} aria-label="Start a new pitch" style={{ fontSize: 12, padding: '7px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 9, cursor: 'pointer', color: 'var(--text)', lineHeight: 1, fontFamily: 'var(--sans)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: 15, lineHeight: 1 }}>＋</span>
              <span>Pitch</span>
            </button>
            {user && (
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-dim)', border: '1.5px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--accent)', flexShrink: 0, cursor: 'pointer' }}
                onClick={() => setAccountSheet(true)} title="Account">
                {(user.email || '?')[0].toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ maxWidth: 860, margin: '0 auto', padding: 'clamp(20px, 4vw, 40px) clamp(14px, 4vw, 24px)' }}>
          <div style={{ marginBottom: 'clamp(16px, 3vw, 28px)', animation: 'rp-fadeUp 0.4s ease both' }}>
            <h1 style={{ fontSize: 'clamp(20px, 3vw, 34px)', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 'clamp(12px, 2vw, 20px)' }}>Your vault</h1>
            {/* Tab switcher */}
            <div style={{ display: 'flex', gap: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 3, width: 'fit-content' }}>
              {[
                { id: 'pitches', label: 'Pitches', count: resumes.length },
                { id: 'critiques', label: 'Resume Roasts', count: critiques.length },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    padding: '7px 18px', borderRadius: 7, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600, fontFamily: 'var(--sans)',
                    background: tab === t.id ? 'var(--bg)' : 'transparent',
                    color: tab === t.id ? 'var(--text)' : 'var(--text-muted)',
                    boxShadow: tab === t.id ? '0 1px 4px oklch(0 0 0 / 0.08)' : 'none',
                    transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {t.label}
                  {t.count > 0 && (
                    <span style={{ fontSize: 11, background: tab === t.id ? 'var(--accent-dim)' : 'var(--border)', color: tab === t.id ? 'var(--accent)' : 'var(--text-faint)', borderRadius: 10, padding: '1px 6px', fontWeight: 700 }}>
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── Pitches Tab ── */}
          {tab === 'pitches' && (
            <>
              {loading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'rp-spin 0.7s linear infinite' }} />
                </div>
              )}
              {error && (
                <div style={{ background: 'oklch(0.65 0.2 30 / 0.08)', border: '1px solid oklch(0.65 0.2 30 / 0.25)', borderRadius: 12, padding: '20px 24px', color: 'oklch(0.75 0.15 30)', fontSize: 14 }}>
                  {error}
                </div>
              )}
              {!loading && !error && resumes.length === 0 && (
                <div style={{ textAlign: 'center', padding: '80px 24px' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
                  <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>No pitches yet</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 28 }}>Tailor your resume for a role and it&apos;ll appear here.</p>
                  <button className="rp-btn-primary" onClick={() => router.push('/rolepitch/start')}>Start your first pitch →</button>
                </div>
              )}
              {!loading && resumes.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 2vw, 14px)' }}>
                  {resumes.map((r, i) => {
                const color = companyColor(r.jd.company);
                const afterScore = r.after_score || 0;
                const improvement = Math.max(0, afterScore - (r.before_score || 0));
                const sc = scoreColor(afterScore);
                return (
                  <div key={r.id} className="rp-card" style={{ animation: `rp-fadeUp 0.35s ${i * 0.05}s ease both` }}>
                    {/* Top row: avatar (hidden mobile) + title/company + score (hidden mobile) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <div className="rp-pitch-avatar" style={{ width: 38, height: 38, borderRadius: 9, background: color + '22', border: `1.5px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color }}>{companyInitials(r.jd.company)}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.jd.title || 'Untitled role'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.jd.company && <span>{r.jd.company} · </span>}
                          <span>{formatDate(r.created_at)}</span>
                        </div>
                      </div>
                      {/* Score badge — visible on desktop, hidden on mobile (shown inline below) */}
                      <div className="rp-pitch-score-col" style={{ flexShrink: 0 }}>
                        <ScorePill before={r.before_score} after={afterScore} />
                      </div>
                    </div>

                    {/* Desktop bottom row: stats + buttons */}
                    <div className="rp-pitch-meta-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="rp-card-stats" style={{ display: 'flex', gap: 16 }}>
                        {[
                          [`${r.highlights_used}`, 'highlights'],
                          [`${r.bullets_rewritten}`, 'bullets'],
                        ].map(([val, label]) => (
                          <div key={label} style={{ textAlign: 'center' }}>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{val}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ flex: 1 }} />
                      {/* Desktop: View/Edit + primary PDF side by side */}
                      <div className="rp-card-actions rp-pitch-desktop-actions" style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button
                          onClick={() => router.push(`/rolepitch/resume/${r.id}`)}
                          style={{ fontSize: 12, padding: '8px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text)', fontFamily: 'var(--sans)', minHeight: 36 }}
                        >
                          View
                        </button>
                        <button
                          onClick={() => router.push(`/rolepitch/resume/${r.id}/edit`)}
                          style={{ fontSize: 12, padding: '8px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text)', fontFamily: 'var(--sans)', minHeight: 36 }}
                        >
                          Edit
                        </button>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                          <button
                            className="rp-btn-primary"
                            onClick={() => handleDownload(r.id)}
                            disabled={downloading === r.id}
                            style={{ fontSize: 12, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
                          >
                            {downloading === r.id
                              ? <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid white', borderTopColor: 'transparent', animation: 'rp-spin 0.7s linear infinite' }} />
                              : <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 8V2M3 5.5l3 3 3-3M2 10h8" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            }
                            {downloading === r.id ? 'Preparing...' : 'PDF'}
                          </button>
                          {downloadLabel(r) && <span style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>{downloadLabel(r)}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Mobile-only action row: score pill + full-width PDF + text View */}
                    <div className="rp-pitch-mobile-actions" style={{ display: 'none', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: sc, background: `${sc === 'var(--green)' ? 'oklch(0.55 0.17 155 / 0.1)' : sc === 'var(--amber)' ? 'oklch(0.60 0.16 80 / 0.1)' : 'oklch(0.65 0.2 30 / 0.1)'}`, padding: '3px 10px', borderRadius: 6, border: `1px solid ${sc === 'var(--green)' ? 'oklch(0.55 0.17 155 / 0.25)' : sc === 'var(--amber)' ? 'oklch(0.60 0.16 80 / 0.25)' : 'oklch(0.65 0.2 30 / 0.25)'}` }}>
                            {afterScore}% match
                          </span>
                          {improvement > 0 && (
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--green)', background: 'var(--green-dim)', border: '1px solid oklch(0.55 0.17 155 / 0.22)', borderRadius: 999, padding: '3px 8px' }}>
                              +{improvement}%
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <button
                            onClick={() => router.push(`/rolepitch/resume/${r.id}`)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', padding: '3px 0', fontFamily: 'var(--sans)', textDecoration: 'underline', textUnderlineOffset: 2 }}
                          >
                            View
                          </button>
                          <button
                            onClick={() => router.push(`/rolepitch/resume/${r.id}/edit`)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', padding: '3px 0', fontFamily: 'var(--sans)', textDecoration: 'underline', textUnderlineOffset: 2 }}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                      <button
                        className="rp-btn-primary"
                        onClick={() => handleDownload(r.id)}
                        disabled={downloading === r.id}
                        style={{ width: '100%', fontSize: 13, padding: '10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
                      >
                        {downloading === r.id
                          ? <div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid white', borderTopColor: 'transparent', animation: 'rp-spin 0.7s linear infinite' }} />
                          : <svg width="13" height="13" viewBox="0 0 12 12" fill="none"><path d="M6 8V2M3 5.5l3 3 3-3M2 10h8" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        }
                        {downloading === r.id ? 'Preparing PDF...' : 'Download PDF'}
                      </button>
                      {downloadLabel(r) && <div style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: 11 }}>{downloadLabel(r)}</div>}
                    </div>
                  </div>
                );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Critiques Tab ── */}
          {tab === 'critiques' && (
            <>
              {critiquesLoading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'rp-spin 0.7s linear infinite' }} />
                </div>
              )}
              {!critiquesLoading && critiques.length === 0 && (
                <div style={{ textAlign: 'center', padding: '80px 24px' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
                  <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>No roasts yet</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 28 }}>Get a free roast of your resume — no job link needed.</p>
                  <button className="rp-btn-primary" onClick={() => router.push('/rolepitch/critique')}>Roast my resume →</button>
                </div>
              )}
              {!critiquesLoading && critiques.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {critiques.map((c, i) => <CritiqueCard key={c.id} c={c} i={i} router={router} />)}
                  <div style={{ textAlign: 'center', paddingTop: 8 }}>
                    <button className="rp-btn-ghost" style={{ fontSize: 13 }} onClick={() => router.push('/rolepitch/critique')}>
                      + New roast
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showUpgrade && (
        <UpgradeModal
          trigger="manual"
          onClose={() => setShowUpgrade(false)}
          onSuccess={({ credits_added, new_balance }) => {
            setCredits(new_balance);
            setShowUpgrade(false);
          }}
        />
      )}

      {welcome && (
        <WelcomeModal
          granted={welcome.granted}
          total={welcome.total}
          onClose={() => setWelcome(null)}
          onTailor={() => { setWelcome(null); router.push('/rolepitch/start'); }}
          onCritique={() => { setWelcome(null); router.push('/rolepitch/critique'); }}
        />
      )}

      {downloadPrompt && (
        <DownloadEditPrompt
          resume={downloadPrompt}
          onClose={() => setDownloadPrompt(null)}
          onEdit={() => {
            const resumeId = downloadPrompt.id;
            setDownloadPrompt(null);
            router.push(`/rolepitch/resume/${resumeId}/edit`);
          }}
        />
      )}

      {accountSheet && (
        <AccountSheet
          user={user}
          credits={credits}
          planTier={planTier}
          onClose={() => setAccountSheet(false)}
          onSignOut={handleSignOut}
        />
      )}
    </>
  );
}

function AccountSheet({ user, credits, planTier, onClose, onSignOut }) {
  const email = user?.email || 'Signed in';
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Account"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 220,
        background: 'oklch(0 0 0 / 0.45)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 14,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(420px, 100%)',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: 18,
          boxShadow: '0 20px 60px oklch(0 0 0 / 0.24)',
          animation: 'rp-fadeUp 0.22s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-dim)', border: '1.5px solid var(--accent)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
            {(email || '?')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Account</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
          </div>
          <button onClick={onClose} aria-label="Close account menu" style={{ border: 'none', background: 'transparent', color: 'var(--text-faint)', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Credits</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 800 }}>{credits ?? '—'}</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Plan</div>
            <div style={{ fontSize: 15, fontWeight: 800, textTransform: 'capitalize' }}>{planTier || 'free'}</div>
          </div>
        </div>

        <button
          onClick={onSignOut}
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid oklch(0.65 0.2 30 / 0.25)',
            background: 'oklch(0.65 0.2 30 / 0.08)',
            color: 'oklch(0.55 0.18 30)',
            cursor: 'pointer',
            fontFamily: 'var(--sans)',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function DownloadEditPrompt({ resume, onClose, onEdit }) {
  useEffect(() => {
    const id = setTimeout(onClose, 9000);
    return () => clearTimeout(id);
  }, [onClose]);

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        right: 18,
        bottom: 18,
        zIndex: 180,
        width: 'min(380px, calc(100vw - 28px))',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: '0 16px 44px oklch(0 0 0 / 0.18)',
        padding: 16,
        animation: 'rp-fadeUp 0.25s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Review the PDF, then tweak it here</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {resume?.jd?.title || 'This resume'} is ready. If you spot a number, phrase, or bullet you want to change, use the editor and download the updated PDF.
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ border: 'none', background: 'transparent', color: 'var(--text-faint)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}
        >
          ×
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
        <button className="rp-btn-ghost" style={{ fontSize: 12, padding: '8px 12px' }} onClick={onClose}>Later</button>
        <button className="rp-btn-primary" style={{ fontSize: 12, padding: '8px 13px' }} onClick={onEdit}>Edit this resume</button>
      </div>
    </div>
  );
}

function WelcomeModal({ granted, total, onClose, onTailor, onCritique }) {
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
      aria-labelledby="rp-welcome-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'oklch(0 0 0 / 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, animation: 'rp-fadeUp 0.25s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rp-welcome-card"
        style={{
          background: 'var(--bg)', borderRadius: 16, padding: 28,
          maxWidth: 460, width: '100%',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 60px oklch(0 0 0 / 0.25)',
          animation: 'rp-fadeUp 0.35s ease',
          textAlign: 'center',
        }}
      >
        <style>{`
          @media (max-width: 480px) {
            .rp-welcome-card { padding: 22px 18px !important; }
            .rp-welcome-card h2 { font-size: 19px !important; }
            .rp-welcome-card .rp-welcome-icon { width: 52px !important; height: 52px !important; margin-bottom: 14px !important; }
            .rp-welcome-card .rp-welcome-icon svg { width: 26px !important; height: 26px !important; }
          }
        `}</style>
        <div className="rp-welcome-icon" style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'var(--green-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 18px',
        }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M8 16l5 5 11-11" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 id="rp-welcome-title" style={{
          fontSize: 22, fontWeight: 600, color: 'var(--text)',
          letterSpacing: '-0.02em', lineHeight: 1.25, margin: '0 0 10px',
        }}>
          You're in. {total} pitches added to your account.
        </h2>
        <p style={{
          fontSize: 14, lineHeight: 1.6, color: 'var(--text-muted)', margin: '0 0 8px',
        }}>
          {granted > 0
            ? <>5 free + <strong style={{ color: 'var(--text)' }}>{granted} bonus</strong> = <strong style={{ color: 'var(--green)' }}>{total} total</strong>. Time to put them to work.</>
            : <>You've got <strong style={{ color: 'var(--green)' }}>{total} free pitches</strong> ready to use.</>
          }
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 22px' }}>
          Pick a starting point — both are free.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={onTailor}
            style={{
              width: '100%', padding: '13px 18px', borderRadius: 10,
              background: 'var(--accent)', color: 'white', border: 'none',
              fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            Tailor my resume for a job →
          </button>
          <button
            onClick={onCritique}
            style={{
              width: '100%', padding: '12px 18px', borderRadius: 10,
              background: 'var(--surface)', color: 'var(--text)',
              border: '1px solid var(--border)',
              fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', cursor: 'pointer',
            }}
          >
            Roast my resume first
          </button>
        </div>
      </div>
    </div>
  );
}
