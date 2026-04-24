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
    .rp-nav { padding: 14px 16px !important; }
    .rp-nav-label { display: none !important; }
    .rp-nav-memory { display: none !important; }
    .rp-btn-ghost { padding: 8px 12px !important; font-size: 12px !important; }
    .rp-btn-primary { padding: 8px 14px !important; font-size: 12px !important; }
    .rp-card { padding: 16px !important; }
    .rp-card-row { flex-direction: column !important; gap: 12px !important; }
    .rp-card-meta { flex-direction: row !important; align-items: center !important; gap: 8px !important; }
    .rp-card-stats { display: none !important; }
    .rp-card-actions { width: 100% !important; justify-content: stretch !important; }
    .rp-card-actions button { flex: 1 !important; }
    .rp-card-score { flex-shrink: 0; }
  }
`;

function ScorePill({ before, after }) {
  const diff = after - before;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-faint)' }}>{before}%</span>
      <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M2 5h10M8 1l4 4-4 4" stroke="var(--accent)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{after}%</span>
      <span style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'var(--mono)' }}>+{diff}%</span>
    </div>
  );
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
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
  const daysLeft = Math.max(0, Math.ceil((expiresAt - Date.now()) / 86400000));

  const handleTailor = () => {
    // Store parsed resume from critique into session for tailor flow
    try {
      const existing = JSON.parse(sessionStorage.getItem('rp_session') || '{}');
      sessionStorage.setItem('rp_session', JSON.stringify({ ...existing, critiqueId: c.id, fromCritique: true }));
    } catch {}
    router.push('/rolepitch/start?step=2&source=critique');
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
            {formatDate(c.created_at)} · {daysLeft}d left
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

  const fetchCredits = () => {
    fetch('/api/rolepitch/credits')
      .then(r => r.json())
      .then(d => { setCredits(d.pitch_credits ?? 10); setPlanTier(d.plan_tier ?? 'free'); })
      .catch(() => {});
  };

  useEffect(() => {
    const theme = localStorage.getItem('rp_theme') || 'light';
    document.documentElement.setAttribute('data-rp-theme', theme);

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => { setUser(user); if (user) fetchCredits(); });

    // If coming from critique flow, default to critiques tab
    try {
      const session = JSON.parse(sessionStorage.getItem('rp_session') || '{}');
      if (session.fromCritique) { setTab('critiques'); sessionStorage.removeItem('rp_session'); }
    } catch {}

    fetch('/api/rolepitch/my-resumes')
      .then(r => {
        if (r.status === 401) { window.location.href = '/rolepitch/auth?step=7&source=rolepitch'; return null; }
        return r.json();
      })
      .then(data => {
        if (!data) return;
        if (data.error) { setError(data.error); setLoading(false); return; }
        setResumes(data.resumes || []);
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });

    fetch('/api/rolepitch/my-critiques')
      .then(r => r.ok ? r.json() : { critiques: [] })
      .then(data => { setCritiques(data.critiques || []); setCritiquesLoading(false); })
      .catch(() => setCritiquesLoading(false));
  }, []);

  const handleDownload = async (resumeId) => {
    setDownloading(resumeId);
    const resume = resumes.find(r => r.id === resumeId);
    track('rp_pdf_downloaded', { resume_id: resumeId, jd_title: resume?.jd?.title, jd_company: resume?.jd?.company });
    window.open(`/api/rolepitch/download-pdf?tailored_resume_id=${resumeId}`, '_blank');
    setDownloading(null);
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
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: credits <= 2 ? 'oklch(0.65 0.2 30 / 0.1)' : 'var(--surface)', border: `1px solid ${credits <= 2 ? 'oklch(0.65 0.2 30 / 0.4)' : 'var(--border)'}`, borderRadius: 20, padding: '4px 12px 4px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: credits <= 2 ? 'oklch(0.65 0.2 30)' : 'var(--text-muted)', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
              >
                <span style={{ fontSize: 14 }}>🎯</span>
                {credits} pitch{credits !== 1 ? 'es' : ''} left
                {credits <= 2 && <span style={{ marginLeft: 2, fontSize: 10 }}>· Top up</span>}
              </button>
            )}
            {user && (
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent-dim)', border: '1.5px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                {(user.email || '?')[0].toUpperCase()}
              </div>
            )}
            <button className="rp-btn-ghost rp-nav-memory" onClick={() => router.push('/rolepitch/dashboard/memory')} style={{ fontSize: 12, padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
              🧠 <span className="rp-nav-label">Memory</span>
            </button>
            <button className="rp-btn-ghost" onClick={() => router.push('/rolepitch/start')} style={{ fontSize: 12, padding: '7px 12px', whiteSpace: 'nowrap' }}>
              + New pitch
            </button>
            {user && (
              <button className="rp-btn-ghost rp-nav-label" onClick={handleSignOut} style={{ fontSize: 12, padding: '7px 12px', color: 'var(--text-faint)' }}>
                Sign out
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px' }}>
          <div style={{ marginBottom: 28, animation: 'rp-fadeUp 0.4s ease both' }}>
            <h1 style={{ fontSize: 'clamp(24px, 3vw, 34px)', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 20 }}>Your vault</h1>
            {/* Tab switcher */}
            <div style={{ display: 'flex', gap: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 3, width: 'fit-content' }}>
              {[
                { id: 'pitches', label: 'Pitches', count: resumes.length },
                { id: 'critiques', label: 'Resume Critiques', count: critiques.length },
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {resumes.map((r, i) => {
                const color = companyColor(r.jd.company);
                return (
                  <div key={r.id} className="rp-card" style={{ animation: `rp-fadeUp 0.35s ${i * 0.05}s ease both` }}>
                    {/* Top row: avatar + title + score */}
                    <div className="rp-card-row" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: color + '22', border: `1.5px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color }}>{companyInitials(r.jd.company)}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.jd.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {r.jd.company && <span>{r.jd.company} · </span>}
                          <span>{formatDate(r.created_at)}</span>
                        </div>
                      </div>
                      <div className="rp-card-score" style={{ flexShrink: 0 }}>
                        <ScorePill before={r.before_score} after={r.after_score} />
                      </div>
                    </div>

                    {/* Bottom row: stats + actions */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
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
                      <div className="rp-card-actions" style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button
                        className="rp-btn-ghost"
                        onClick={() => router.push(`/rolepitch/resume/${r.id}`)}
                        style={{ fontSize: 12, padding: '7px 14px' }}
                      >
                        View
                      </button>
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
                        PDF
                      </button>
                    </div>
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
                  <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>No critiques yet</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 28 }}>Get a free critique of your resume — no job link needed.</p>
                  <button className="rp-btn-primary" onClick={() => router.push('/rolepitch/critique')}>Critique my resume →</button>
                </div>
              )}
              {!critiquesLoading && critiques.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {critiques.map((c, i) => <CritiqueCard key={c.id} c={c} i={i} router={router} />)}
                  <div style={{ textAlign: 'center', paddingTop: 8 }}>
                    <button className="rp-btn-ghost" style={{ fontSize: 13 }} onClick={() => router.push('/rolepitch/critique')}>
                      + New critique
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
    </>
  );
}
