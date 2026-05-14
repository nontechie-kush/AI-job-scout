'use client';

import { useState, useRef } from 'react';

const CSS = `
  :root {
    --bg: oklch(0.98 0.006 248); --surface: oklch(0.955 0.009 248); --border: oklch(0.86 0.015 248);
    --border-subtle: oklch(0.91 0.01 248); --accent: oklch(0.50 0.19 248); --accent-dim: oklch(0.50 0.19 248 / 0.10);
    --green: oklch(0.55 0.17 155); --green-dim: oklch(0.55 0.17 155 / 0.10);
    --red: oklch(0.58 0.19 25); --red-dim: oklch(0.58 0.19 25 / 0.10);
    --yellow: oklch(0.70 0.16 80); --yellow-dim: oklch(0.70 0.16 80 / 0.10);
    --text: oklch(0.16 0.03 248); --text-muted: oklch(0.44 0.04 248); --text-faint: oklch(0.62 0.03 248);
    --sans: 'DM Sans', sans-serif;
  }
  @keyframes rc-fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes rc-spin { to { transform: rotate(360deg); } }
  .rc-root { font-family: var(--sans); background: var(--bg); color: var(--text); min-height: 100vh; -webkit-font-smoothing: antialiased; }
  .rc-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 24px; margin-bottom: 16px; animation: rc-fadeUp 0.4s ease both; }
  .rc-section-score { height: 4px; border-radius: 2px; background: var(--border); overflow: hidden; margin-top: 6px; }
  .rc-section-score-fill { height: 100%; border-radius: 2px; transition: width 1s ease; }
  .rc-ats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 18px; }
  .rc-score-orbit { width: 126px; height: 126px; border-radius: 999px; display: grid; place-items: center; box-shadow: inset 0 0 0 1px oklch(0 0 0 / 0.04); }
  .rc-score-core { width: 98px; height: 98px; border-radius: 999px; background: var(--surface); display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 14px 32px oklch(0 0 0 / 0.08); }
  @media (max-width: 640px) {
    .rc-ats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .rc-score-orbit { width: 112px; height: 112px; }
    .rc-score-core { width: 88px; height: 88px; }
  }
  .rc-btn-primary { background: var(--accent); color: white; border: none; border-radius: 10px; padding: 12px 22px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: var(--sans); transition: all 0.15s; }
  .rc-btn-primary:hover { opacity: 0.88; }
  .rc-btn-outline { background: transparent; color: var(--accent); border: 1px solid var(--accent); border-radius: 10px; padding: 11px 22px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: var(--sans); transition: all 0.15s; }
  .rc-btn-outline:hover { background: var(--accent-dim); }
  @media print {
    .no-print { display: none !important; }
    .rc-root { padding: 0 !important; }
  }
`;

function scoreColor(score) {
  if (score >= 75) return 'oklch(0.55 0.17 155)';
  if (score >= 50) return 'oklch(0.70 0.16 80)';
  return 'oklch(0.58 0.19 25)';
}

function scoreLabel(score) {
  if (score >= 82) return 'ATS-safe';
  if (score >= 68) return 'Strong';
  if (score >= 52) return 'Needs targeting';
  return 'Likely filtered';
}

function getDriverValue(driver, fallback) {
  if (typeof driver === 'number') return { score: driver };
  return driver || { score: fallback };
}

function atsDrivers(critique) {
  const s = critique.sections || {};
  const overall = critique.overall_score || 50;
  const drivers = critique.ats_report?.drivers || {};
  return [
    {
      key: 'parseability',
      ...getDriverValue(drivers.parseability, s.structure?.score ?? overall),
      label: drivers.parseability?.label || 'Parseability',
      note: drivers.parseability?.note || 'Can ATS systems read your sections and dates?',
    },
    {
      key: 'keywords',
      ...getDriverValue(drivers.keywords, Math.round(((s.skills?.score ?? overall) + (s.summary?.score ?? overall)) / 2)),
      label: drivers.keywords?.label || 'Keyword signal',
      note: drivers.keywords?.note || 'Does the resume carry searchable role language?',
    },
    {
      key: 'impact',
      ...getDriverValue(drivers.impact, s.impact?.score ?? overall),
      label: drivers.impact?.label || 'Impact proof',
      note: drivers.impact?.note || 'Metrics, outcomes, and business value.',
    },
    {
      key: 'structure',
      ...getDriverValue(drivers.structure, s.structure?.score ?? overall),
      label: drivers.structure?.label || 'Scan structure',
      note: drivers.structure?.note || 'Order, density, and recruiter skim speed.',
    },
  ];
}

function targetFitFor(critique, hasTarget) {
  if (!hasTarget) return null;
  if (critique.target_fit?.score != null) return critique.target_fit;
  const s = critique.sections || {};
  const overall = critique.overall_score || 50;
  const score = Math.max(0, Math.min(100, Math.round(
    (overall * 0.45) +
    ((s.skills?.score ?? overall) * 0.22) +
    ((s.summary?.score ?? overall) * 0.18) +
    ((s.bullets?.score ?? overall) * 0.15)
  )));
  return { score, label: scoreLabel(score), feedback: critique.gap_to_target || '' };
}

function ScoreRing({ score, label }) {
  const color = scoreColor(score);
  return (
    <div className="rc-score-orbit" style={{ background: `conic-gradient(${color} ${score * 3.6}deg, var(--border) 0deg)` }}>
      <div className="rc-score-core">
        <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 1, color }}>{score}</span>
        <span style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 700 }}>/100</span>
        <span style={{ fontSize: 10, color, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 5 }}>{label}</span>
      </div>
    </div>
  );
}

function AtsDriverCard({ driver }) {
  const score = Math.max(0, Math.min(100, Number(driver.score) || 0));
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>{driver.label}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: scoreColor(score) }}>{score}</span>
      </div>
      <div className="rc-section-score">
        <div className="rc-section-score-fill" style={{ width: `${score}%`, background: scoreColor(score) }} />
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.45, margin: '8px 0 0' }}>{driver.note}</p>
    </div>
  );
}

function statusColor(status) {
  if (status === 'strong') return 'oklch(0.55 0.17 155)';
  if (status === 'weak') return 'oklch(0.58 0.19 25)';
  return 'oklch(0.62 0.03 248)';
}

function statusBg(status) {
  if (status === 'strong') return 'oklch(0.55 0.17 155 / 0.10)';
  if (status === 'weak') return 'oklch(0.58 0.19 25 / 0.10)';
  return 'oklch(0.50 0.19 248 / 0.10)';
}

function statusIcon(status) {
  if (status === 'strong') return '✓';
  if (status === 'weak') return '✗';
  return '~';
}

function SectionRow({ label, data }) {
  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 20, height: 20, borderRadius: 5, background: statusBg(data.status), color: statusColor(data.status), fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{statusIcon(data.status)}</span>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor(data.score) }}>{data.score}/100</span>
      </div>
      <div className="rc-section-score">
        <div className="rc-section-score-fill" style={{ width: `${data.score}%`, background: scoreColor(data.score) }} />
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 8, marginBottom: 0 }}>{data.feedback}</p>
    </div>
  );
}

export default function ReportClient({ row }) {
  const critique = row.critique_json;
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const reportRef = useRef();

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const expiresDate = new Date(row.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API blocked (insecure origin, denied permission, iframe).
      // Don't claim success — surface the URL so the user can copy manually.
      window.prompt('Copy this link', shareUrl);
    }
  };

  const handlePrint = () => window.print();

  const s = critique.sections || {};
  const overallScore = critique.overall_score || 0;
  const drivers = atsDrivers(critique);
  const hasTarget = !!row.target_context;
  const targetFit = targetFitFor(critique, hasTarget);
  const verdict = critique.ats_report?.diagnosis || critique.headline_verdict;
  const primaryLabel = critique.ats_report?.label || scoreLabel(overallScore);

  return (
    <>
      <style>{CSS}</style>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div className="rc-root" style={{ padding: '24px 16px' }}>
        {/* Nav */}
        <div className="no-print" style={{ maxWidth: 680, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <a href="/rolepitch" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--text)' }}>
            <div style={{ width: 26, height: 26, background: 'var(--accent)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M2 7h7M2 11h9" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em' }}>RolePitch</span>
          </a>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handlePrint} className="rc-btn-outline" style={{ padding: '8px 14px', fontSize: 13 }}>
              Save as PDF
            </button>
            <button onClick={handleCopy} className="rc-btn-primary" style={{ padding: '8px 14px', fontSize: 13 }}>
              {copied ? 'Copied!' : 'Share link'}
            </button>
          </div>
        </div>

        <div style={{ maxWidth: 680, margin: '0 auto' }} ref={reportRef}>
          {/* Header */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 4 }}>
              ATS resume report{row.name ? ` for ${row.name}` : ''}{row.target_context ? ` · targeting: ${row.target_context}` : ''} · expires {expiresDate}
            </div>
          </div>

          {/* Score */}
          <div className="rc-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <ScoreRing score={overallScore} label={primaryLabel} />
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-faint)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>ATS Readiness Score</div>
                <h1 style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.035em', margin: 0 }}>
                  {hasTarget ? 'Readable. Now prove role fit.' : 'ATS readiness report'}
                </h1>
                {targetFit && (
                  <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'baseline', gap: 8, background: 'var(--bg)', border: '1px solid var(--border-subtle)', borderRadius: 999, padding: '7px 11px' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Target fit</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: scoreColor(targetFit.score) }}>{targetFit.score}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>/100</span>
                  </div>
                )}
              </div>
            </div>
            <div style={{ marginTop: 18, padding: '12px 16px', background: 'var(--bg)', borderRadius: 10, borderLeft: '3px solid var(--accent)' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0, lineHeight: 1.5 }}>"{verdict}"</p>
            </div>
            <div className="rc-ats-grid">
              {drivers.map(driver => <AtsDriverCard key={driver.key} driver={driver} />)}
            </div>
          </div>

          {/* What works */}
          {(critique.what_works || []).length > 0 && (
            <div className="rc-card" style={{ background: 'oklch(0.55 0.17 155 / 0.06)', borderColor: 'oklch(0.55 0.17 155 / 0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>What's working</div>
              {critique.what_works.map((w, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: i < critique.what_works.length - 1 ? 6 : 0 }}>
                  <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Top fixes */}
          <div className="rc-card">
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Top fixes — prioritized</div>
            {(critique.top_fixes || []).map((fix, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: i < critique.top_fixes.length - 1 ? 12 : 0 }}>
                <span style={{ width: 20, height: 20, borderRadius: 5, background: i === 0 ? 'oklch(0.58 0.19 25 / 0.12)' : 'var(--accent-dim)', color: i === 0 ? 'var(--red)' : 'var(--accent)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text)' }}>{fix}</span>
              </div>
            ))}
          </div>

          {/* Section breakdown */}
          <div className="rc-card">
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Section breakdown</div>
            {s.summary && <SectionRow label="Summary" data={s.summary} />}
            {s.bullets && <SectionRow label="Bullet points" data={s.bullets} />}
            {s.skills && <SectionRow label="Skills" data={s.skills} />}
            {s.structure && <SectionRow label="Structure" data={s.structure} />}
            {s.impact && <SectionRow label="Impact & metrics" data={s.impact} />}
          </div>

          {/* Before → After */}
          {s.bullets?.examples?.length > 0 && (
            <div className="rc-card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Bullet rewrites — before → after</div>
              {s.bullets.examples.map((ex, i) => (
                <div key={i} style={{ marginBottom: i < s.bullets.examples.length - 1 ? 18 : 0 }}>
                  <div style={{ background: 'oklch(0.58 0.19 25 / 0.08)', border: '1px solid oklch(0.58 0.19 25 / 0.15)', borderRadius: 8, padding: '10px 14px', marginBottom: 5 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--red)', letterSpacing: '0.06em', marginBottom: 4 }}>BEFORE</div>
                    <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{ex.original}</div>
                  </div>
                  <div style={{ background: 'oklch(0.55 0.17 155 / 0.08)', border: '1px solid oklch(0.55 0.17 155 / 0.2)', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--green)', letterSpacing: '0.06em', marginBottom: 4 }}>AFTER</div>
                    <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{ex.rewrite}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Summary rewrite */}
          {s.summary?.rewrite && (
            <div className="rc-card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Suggested summary</div>
              <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.65, margin: 0 }}>{s.summary.rewrite}</p>
            </div>
          )}

          {/* Gap to target */}
          {critique.gap_to_target && (
            <div className="rc-card" style={{ background: 'var(--accent-dim)', borderColor: 'oklch(0.50 0.19 248 / 0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>{hasTarget ? 'Gap to target' : 'What is holding this resume back'}</div>
              <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>{critique.gap_to_target}</p>
            </div>
          )}

          {/* Footer upsell */}
          <div className="no-print" style={{ background: 'linear-gradient(135deg, oklch(0.50 0.19 248 / 0.08), oklch(0.55 0.17 155 / 0.08))', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 24px', textAlign: 'center', marginTop: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>{hasTarget ? 'Ready to close the gap?' : 'Want RolePitch to fix this for a real job?'}</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 20, maxWidth: 380, margin: '0 auto 20px' }}>
              {hasTarget
                ? 'Generate a tailored resume that rewrites weak bullets for this exact role and exports a PDF.'
                : 'Paste a job link next. RolePitch will turn this report into a tailored resume and PDF.'}
            </p>
            <a href="/rolepitch/start" className="rc-btn-primary" style={{ display: 'inline-block', textDecoration: 'none', padding: '13px 28px', fontSize: 14 }}>
              {hasTarget ? 'Generate tailored resume →' : 'Tailor for a job — free →'}
            </a>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 10 }}>5 free pitches · no credit card</div>
          </div>

          {/* Print footer */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 24, paddingTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Generated by RolePitch · rolepitch.com</span>
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Expires {expiresDate}</span>
          </div>
        </div>
      </div>
    </>
  );
}
