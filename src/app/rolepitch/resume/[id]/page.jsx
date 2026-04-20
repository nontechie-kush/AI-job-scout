'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

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
  .rp-page { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; -webkit-font-smoothing: antialiased; }
  .rp-btn-primary { background: var(--accent); color: white; border: none; cursor: pointer; padding: 11px 22px; border-radius: 9px; font-size: 14px; font-weight: 600; font-family: var(--sans); transition: all 0.15s; }
  .rp-btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
  .rp-btn-ghost { background: transparent; color: var(--text-muted); border: 1px solid var(--border); cursor: pointer; padding: 9px 18px; border-radius: 9px; font-size: 13px; font-weight: 500; font-family: var(--sans); transition: all 0.15s; }
  .rp-btn-ghost:hover { color: var(--text); }
  @keyframes rp-spin { to { transform: rotate(360deg); } }
  @keyframes rp-fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .rp-scroll::-webkit-scrollbar { width: 4px; }
  .rp-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
`;

function ScoreBar({ before, after }) {
  const diff = after - before;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 28, fontWeight: 700, color: 'var(--text-muted)' }}>{before}%</div>
        <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Before</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '0 8px' }}>
        <svg width="32" height="16" viewBox="0 0 32 16" fill="none">
          <path d="M2 8h28M22 2l8 6-8 6" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--green)' }}>+{diff}%</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 28, fontWeight: 700, color: 'var(--green)' }}>{after}%</div>
        <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>After</div>
      </div>
    </div>
  );
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ResumeDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('after');
  const [showAnswers, setShowAnswers] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const theme = localStorage.getItem('rp_theme') || 'light';
    document.documentElement.setAttribute('data-rp-theme', theme);

    fetch(`/api/rolepitch/result?tailored_resume_id=${id}`)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [id]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/rolepitch/download-pdf?tailored_resume_id=${id}`);
      if (!res.ok) throw new Error('failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rolepitch-${id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('PDF generation coming soon.');
    }
    setDownloading(false);
  };

  if (loading) return (
    <>
      <style>{CSS_VARS}</style>
      <div className="rp-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'rp-spin 0.7s linear infinite' }} />
      </div>
    </>
  );

  if (error || !data) return (
    <>
      <style>{CSS_VARS}</style>
      <div className="rp-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 32 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'oklch(0.75 0.15 30)', marginBottom: 16 }}>{error || 'Resume not found'}</p>
          <button className="rp-btn-ghost" onClick={() => router.push('/rolepitch/dashboard')}>← Dashboard</button>
        </div>
      </div>
    </>
  );

  const displayRole = data.bullets_by_role?.find(r => r.before?.length && r.after?.length) || data.bullets_by_role?.[0];
  const beforeScore = data.before_score;
  const afterScore = data.after_score;

  return (
    <>
      <style>{CSS_VARS}</style>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
      <div className="rp-page">
        {/* Nav */}
        <div style={{ padding: '16px 32px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10, backdropFilter: 'blur(12px)' }}>
          <button onClick={() => router.push('/rolepitch/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'var(--sans)', fontSize: 13, padding: 0 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10 2L4 7l6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            All pitches
          </button>
          <button
            className="rp-btn-primary"
            onClick={handleDownload}
            disabled={downloading}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px' }}
          >
            {downloading
              ? <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid white', borderTopColor: 'transparent', animation: 'rp-spin 0.7s linear infinite' }} />
              : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 9V2M4 6.5l3 3 3-3M2 12h10" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            }
            Download PDF
          </button>
        </div>

        <div style={{ maxWidth: 900, margin: '0 auto', padding: '36px 24px' }}>
          {/* Header */}
          <div style={{ marginBottom: 32, animation: 'rp-fadeUp 0.35s ease both' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Resume pitch</div>
            <h1 style={{ fontSize: 'clamp(22px,3vw,32px)', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 6 }}>
              {data.jd?.title || 'Untitled role'}
            </h1>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {data.jd?.company && <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{data.jd.company}</span>}
              <span style={{ fontSize: 12, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>{formatDate(new Date().toISOString())}</span>
            </div>
          </div>

          {/* Score + stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, marginBottom: 32, animation: 'rp-fadeUp 0.35s 0.05s ease both' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ScoreBar before={beforeScore} after={afterScore} />
              <div style={{ height: 1, background: 'var(--border-subtle)' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, textAlign: 'center' }}>
                {[
                  ['Highlights', `${data.stats?.achievements_used} of ${data.stats?.total_achievements}`],
                  ['Bullets', data.stats?.bullets_rewritten],
                  ['Layout', '✓'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700, color: String(v).includes('✓') ? 'var(--green)' : 'var(--text)' }}>{v}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 3 }}>{k}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Gap questions summary */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Gap context added</div>
                <button onClick={() => setShowAnswers(s => !s)} style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 500 }}>
                  {showAnswers ? 'Hide' : 'Show answers'}
                </button>
              </div>
              {showAnswers && data.gap_questions?.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.gap_questions.map((q, i) => (
                    <div key={i} style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--mono)', fontSize: 10, marginRight: 6 }}>Q{i + 1}</span>
                      {q.question}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6 }}>
                  {data.gap_questions?.length
                    ? `${data.gap_questions.length} gap questions were asked to improve context.`
                    : 'No gap questions recorded for this pitch.'}
                </p>
              )}
            </div>
          </div>

          {/* Before / After resume */}
          {displayRole && (
            <div style={{ animation: 'rp-fadeUp 0.35s 0.1s ease both' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 8, padding: 3, border: '1px solid var(--border-subtle)' }}>
                  {['before', 'after'].map(t => (
                    <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, background: tab === t ? (t === 'after' ? 'var(--green)' : 'var(--surface2)') : 'transparent', color: tab === t ? (t === 'after' ? 'white' : 'var(--text)') : 'var(--text-muted)', transition: 'all 0.2s' }}>
                      {t === 'after' ? 'After — tailored' : 'Before — original'}
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: 13, color: tab === 'after' ? 'var(--green)' : 'var(--text-faint)', fontWeight: tab === 'after' ? 500 : 400 }}>
                  {tab === 'after' ? `${data.stats?.bullets_rewritten} bullets rewritten` : 'generic, unoptimised'}
                </span>
              </div>

              <div style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 32, boxShadow: '0 4px 32px oklch(0 0 0 / 0.1)', border: tab === 'after' ? '1px solid oklch(0.72 0.17 155 / 0.25)' : '1px solid var(--border)', opacity: tab === 'before' ? 0.8 : 1, transition: 'all 0.3s' }}>
                {/* Fake resume header */}
                <div style={{ marginBottom: 24, paddingBottom: 18, borderBottom: '2px solid var(--border)' }}>
                  <div style={{ width: '50%', height: 11, background: tab === 'before' ? 'oklch(0.3 0 0 / 0.3)' : 'var(--text)', borderRadius: 3, marginBottom: 8 }} />
                  <div style={{ width: '30%', height: 7, background: 'var(--border)', borderRadius: 3 }} />
                </div>

                {/* Role heading */}
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 700, color: 'var(--resume-text)', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
                  {displayRole.company} — {displayRole.role}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(tab === 'after' ? displayRole.after : displayRole.before).map((text, i) => {
                    const isImproved = tab === 'after' && text !== displayRole.before[i];
                    return (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: isImproved ? 'oklch(0.72 0.17 155 / 0.06)' : 'transparent', border: isImproved ? '1px solid oklch(0.72 0.17 155 / 0.2)' : '1px solid transparent', borderRadius: 6, padding: isImproved ? '10px 12px' : '2px 0', transition: 'all 0.3s' }}>
                        <span style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 2, flexShrink: 0 }}>•</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, lineHeight: 1.75, color: tab === 'before' ? 'var(--text-muted)' : 'var(--resume-text)', fontFamily: 'Georgia, serif' }}>{text}</p>
                          {isImproved && <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 4, fontWeight: 700, letterSpacing: '0.05em' }}>↑ REWRITTEN FOR THIS ROLE</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Fake remaining content */}
                <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[85, 70, 78, 60].map((w, i) => <div key={i} style={{ height: 5, width: `${w}%`, background: 'var(--border)', borderRadius: 3, opacity: 0.4 }} />)}
                </div>
              </div>
            </div>
          )}

          {/* Re-run CTA */}
          <div style={{ marginTop: 32, padding: '20px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', animation: 'rp-fadeUp 0.35s 0.15s ease both' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>Want a better score?</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Run a fresh pitch for this role with updated context.</div>
            </div>
            <button className="rp-btn-ghost" onClick={() => router.push('/rolepitch/start')}>Start new pitch →</button>
          </div>
        </div>
      </div>
    </>
  );
}
