'use client';

/**
 * /rolepitch/critique
 *
 * Free resume critique flow — no auth required.
 * Steps: upload → target context → generating → report + upsell
 */

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';

const CSS = `
  :root {
    --bg: oklch(0.98 0.006 248);
    --surface: oklch(0.955 0.009 248);
    --border: oklch(0.86 0.015 248);
    --border-subtle: oklch(0.91 0.01 248);
    --accent: oklch(0.50 0.19 248);
    --accent-dim: oklch(0.50 0.19 248 / 0.10);
    --accent-hover: oklch(0.44 0.19 248);
    --green: oklch(0.55 0.17 155);
    --green-dim: oklch(0.55 0.17 155 / 0.10);
    --red: oklch(0.58 0.19 25);
    --red-dim: oklch(0.58 0.19 25 / 0.10);
    --yellow: oklch(0.70 0.16 80);
    --yellow-dim: oklch(0.70 0.16 80 / 0.10);
    --text: oklch(0.16 0.03 248);
    --text-muted: oklch(0.44 0.04 248);
    --text-faint: oklch(0.62 0.03 248);
    --sans: 'DM Sans', sans-serif;
  }
  [data-rc-theme="dark"] {
    --bg: oklch(0.11 0.03 248);
    --surface: oklch(0.155 0.035 248);
    --border: oklch(0.26 0.04 248);
    --border-subtle: oklch(0.195 0.03 248);
    --accent: oklch(0.62 0.19 248);
    --accent-dim: oklch(0.62 0.19 248 / 0.12);
    --accent-hover: oklch(0.68 0.19 248);
    --green: oklch(0.72 0.17 155);
    --green-dim: oklch(0.72 0.17 155 / 0.12);
    --red: oklch(0.72 0.19 25);
    --red-dim: oklch(0.72 0.19 25 / 0.12);
    --yellow: oklch(0.82 0.16 80);
    --yellow-dim: oklch(0.82 0.16 80 / 0.12);
    --text: oklch(0.94 0.01 248);
    --text-muted: oklch(0.58 0.04 248);
    --text-faint: oklch(0.38 0.03 248);
  }
  @keyframes rc-spin { to { transform: rotate(360deg); } }
  @keyframes rc-fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes rc-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
  @keyframes rc-score-fill { from { width: 0%; } to { width: var(--target-w); } }
  .rc-root { font-family: var(--sans); background: var(--bg); color: var(--text); min-height: 100vh; -webkit-font-smoothing: antialiased; }
  .rc-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 32px 28px; animation: rc-fadeUp 0.35s ease both; }
  .rc-upload-zone { border: 2px dashed var(--border); border-radius: 12px; padding: 36px 24px; text-align: center; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
  .rc-upload-zone:hover, .rc-upload-zone.drag { border-color: var(--accent); background: var(--accent-dim); }
  .rc-btn-primary { background: var(--accent); color: white; border: none; border-radius: 10px; padding: 12px 24px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: var(--sans); transition: all 0.15s; letter-spacing: -0.01em; }
  .rc-btn-primary:hover { background: var(--accent-hover); transform: translateY(-1px); }
  .rc-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .rc-btn-outline { background: transparent; color: var(--accent); border: 1px solid var(--accent); border-radius: 10px; padding: 12px 24px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: var(--sans); transition: all 0.15s; letter-spacing: -0.01em; }
  .rc-btn-outline:hover { background: var(--accent-dim); }
  .rc-textarea { width: 100%; border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; font-size: 14px; font-family: var(--sans); background: var(--bg); color: var(--text); resize: none; outline: none; transition: border-color 0.15s; box-sizing: border-box; }
  .rc-textarea:focus { border-color: var(--accent); }
  .rc-section-score { height: 4px; border-radius: 2px; background: var(--border); overflow: hidden; margin-top: 6px; }
  .rc-section-score-fill { height: 100%; border-radius: 2px; transition: width 1s ease; }
`;

const PILOT_LINES = [
  'Reading your resume…',
  'Checking bullet strength…',
  'Scoring impact and metrics…',
  'Identifying the weak spots…',
  'Writing your critique…',
];

function statusColor(status) {
  if (status === 'strong') return 'var(--green)';
  if (status === 'weak') return 'var(--red)';
  return 'var(--text-faint)';
}

function statusBg(status) {
  if (status === 'strong') return 'var(--green-dim)';
  if (status === 'weak') return 'var(--red-dim)';
  return 'var(--accent-dim)';
}

function statusIcon(status) {
  if (status === 'strong') return '✓';
  if (status === 'weak') return '✗';
  return '~';
}

function scoreColor(score) {
  if (score >= 75) return 'var(--green)';
  if (score >= 50) return 'var(--yellow)';
  return 'var(--red)';
}

// ── Step 1: Upload ────────────────────────────────────────────────────────────
function StepUpload({ onParsed }) {
  const [phase, setPhase] = useState('idle'); // idle | parsing | error
  const [errorMsg, setErrorMsg] = useState('');
  const [drag, setDrag] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [urlMode, setUrlMode] = useState(false);
  const [urlText, setUrlText] = useState('');
  const fileRef = useRef();

  const parse = async (formData) => {
    setPhase('parsing');
    setErrorMsg('');
    try {
      const res = await fetch('/api/rolepitch/parse-resume', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Parse failed');
      onParsed(data.parsed);
    } catch (e) {
      setErrorMsg(e.message);
      setPhase('error');
    }
  };

  const handleFile = (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('type', 'pdf');
    fd.append('file', file);
    parse(fd);
  };

  const handlePaste = () => {
    if (!pasteText.trim()) return;
    const fd = new FormData();
    fd.append('type', 'paste');
    fd.append('text', pasteText.trim());
    parse(fd);
  };

  const handleUrl = () => {
    if (!urlText.trim()) return;
    const fd = new FormData();
    fd.append('type', 'url');
    fd.append('url', urlText.trim());
    parse(fd);
  };

  if (phase === 'parsing') return (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'rc-spin 0.8s linear infinite', margin: '0 auto 20px' }} />
      <div style={{ fontWeight: 600, fontSize: 15 }}>Reading your resume…</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Pilot is extracting your experience</div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6 }}>Upload your resume</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>PDF, link, or paste — Pilot will read it and give you a brutally honest critique.</p>
      </div>

      {!pasteMode && !urlMode && (
        <div
          className={`rc-upload-zone${drag ? ' drag' : ''}`}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }}>
            <path d="M10 22H8a6 6 0 010-12h1M22 22h2a6 6 0 000-12h-1M16 22V10M12 14l4-4 4 4" stroke="var(--text)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Drop your resume PDF here</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>or click to browse</div>
        </div>
      )}

      {pasteMode && (
        <div>
          <textarea
            className="rc-textarea"
            rows={8}
            placeholder="Paste your resume text here…"
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="rc-btn-primary" onClick={handlePaste} disabled={!pasteText.trim()}>Analyse →</button>
            <button className="rc-btn-outline" onClick={() => setPasteMode(false)}>Back</button>
          </div>
        </div>
      )}

      {urlMode && (
        <div>
          <input
            style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', fontSize: 14, fontFamily: 'var(--sans)', background: 'var(--bg)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
            placeholder="https://linkedin.com/in/yourname or portfolio URL"
            value={urlText}
            onChange={e => setUrlText(e.target.value)}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="rc-btn-primary" onClick={handleUrl} disabled={!urlText.trim()}>Analyse →</button>
            <button className="rc-btn-outline" onClick={() => setUrlMode(false)}>Back</button>
          </div>
        </div>
      )}

      {!pasteMode && !urlMode && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'center' }}>
          <button onClick={() => setUrlMode(true)} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--sans)' }}>Use a link instead</button>
          <button onClick={() => setPasteMode(true)} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--sans)' }}>Paste text</button>
        </div>
      )}

      {phase === 'error' && (
        <p style={{ fontSize: 13, color: 'var(--red)', marginTop: 14, textAlign: 'center' }}>{errorMsg || 'Something went wrong — try again'}</p>
      )}
    </div>
  );
}

// ── Step 2: Target Context ────────────────────────────────────────────────────
function StepTarget({ onSubmit }) {
  const [context, setContext] = useState('');

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6 }}>What are you aiming for?</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          The more specific you are, the sharper the critique. Skip if you just want a general review.
        </p>
      </div>

      <textarea
        className="rc-textarea"
        rows={4}
        placeholder={'e.g. "Staff accountant at a private company in Southern California"\nor "Senior product manager at a Series B fintech startup"'}
        value={context}
        onChange={e => setContext(e.target.value)}
        autoFocus
      />

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button className="rc-btn-primary" onClick={() => onSubmit(context.trim())}>
          Critique my resume →
        </button>
        <button className="rc-btn-outline" onClick={() => onSubmit('')}>
          Skip — general review
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Generating ────────────────────────────────────────────────────────
function StepGenerating() {
  const [lineIdx, setLineIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setLineIdx(i => (i + 1) % PILOT_LINES.length), 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'rc-spin 0.8s linear infinite', margin: '0 auto 24px' }} />
      <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em', marginBottom: 8 }}>Pilot is reading your resume</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', animation: 'rc-pulse 1.8s ease infinite', minHeight: 20 }}>{PILOT_LINES[lineIdx]}</div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 20 }}>Usually takes 10–20 seconds</div>
    </div>
  );
}

// ── Step 4: Report ────────────────────────────────────────────────────────────
function SectionRow({ label, data }) {
  return (
    <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 22, height: 22, borderRadius: 6, background: statusBg(data.status), color: statusColor(data.status), fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{statusIcon(data.status)}</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(data.score) }}>{data.score}/100</span>
      </div>
      <div className="rc-section-score">
        <div className="rc-section-score-fill" style={{ width: `${data.score}%`, background: scoreColor(data.score) }} />
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 8, marginBottom: 0 }}>{data.feedback}</p>
    </div>
  );
}

function StepReport({ critique, critiqueId, parsedResume, targetContext, router }) {
  const shareUrl = critiqueId ? `${typeof window !== 'undefined' ? window.location.origin : ''}/rolepitch/report/${critiqueId}` : null;
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTailor = () => {
    // Save critique context to session so auth page + dashboard can pick it up
    try {
      const existing = JSON.parse(sessionStorage.getItem('rp_session') || '{}');
      sessionStorage.setItem('rp_session', JSON.stringify({
        ...existing,
        parsedResume,
        critiqueId,
        fromCritique: true,
      }));
    } catch {}
    // Send to auth — after sign-in lands on dashboard where critique will be visible
    router.push('/rolepitch/auth?source=critique&redirect=/rolepitch/dashboard');
  };

  const s = critique.sections || {};
  const overallScore = critique.overall_score || 0;

  return (
    <div style={{ animation: 'rc-fadeUp 0.4s ease both' }}>
      {/* Score header */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Resume score</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 52, fontWeight: 700, letterSpacing: '-0.04em', color: scoreColor(overallScore), lineHeight: 1 }}>{overallScore}</span>
              <span style={{ fontSize: 18, color: 'var(--text-faint)', fontWeight: 500 }}>/100</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: scoreColor(overallScore), background: `${scoreColor(overallScore)}18`, padding: '3px 10px', borderRadius: 20 }}>{critique.score_label}</span>
            </div>
          </div>
          {shareUrl && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
              <button onClick={handleCopy} style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid oklch(0.50 0.19 248 / 0.2)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontFamily: 'var(--sans)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M5 3H3a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1V8M8 1h4m0 0v4m0-4L5.5 7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {copied ? 'Copied!' : 'Copy share link'}
              </button>
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Link expires in 7 days</div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--bg)', borderRadius: 10, borderLeft: '3px solid var(--accent)' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0, lineHeight: 1.5 }}>"{critique.headline_verdict}"</p>
        </div>
      </div>

      {/* What works */}
      {(critique.what_works || []).length > 0 && (
        <div style={{ background: 'var(--green-dim)', border: '1px solid oklch(0.55 0.17 155 / 0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>What's working</div>
          {critique.what_works.map((w, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: i < critique.what_works.length - 1 ? 6 : 0 }}>
              <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>✓</span>
              <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Top 5 fixes */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px', marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>Top fixes — prioritized</div>
        {(critique.top_fixes || []).map((fix, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: i < (critique.top_fixes.length - 1) ? 14 : 0 }}>
            <span style={{ width: 22, height: 22, borderRadius: 6, background: i === 0 ? 'var(--red-dim)' : 'var(--accent-dim)', color: i === 0 ? 'var(--red)' : 'var(--accent)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
            <span style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text)' }}>{fix}</span>
          </div>
        ))}
      </div>

      {/* Section breakdown */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px', marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Section breakdown</div>
        {s.summary && <SectionRow label="Summary" data={s.summary} />}
        {s.bullets && <SectionRow label="Bullet points" data={s.bullets} />}
        {s.skills && <SectionRow label="Skills" data={s.skills} />}
        {s.structure && <SectionRow label="Structure" data={s.structure} />}
        {s.impact && <SectionRow label="Impact & metrics" data={s.impact} />}
      </div>

      {/* Before → After bullet rewrites */}
      {s.bullets?.examples?.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px', marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>Bullet rewrites — before → after</div>
          {s.bullets.examples.map((ex, i) => (
            <div key={i} style={{ marginBottom: i < s.bullets.examples.length - 1 ? 20 : 0 }}>
              <div style={{ background: 'var(--red-dim)', border: '1px solid oklch(0.58 0.19 25 / 0.15)', borderRadius: 8, padding: '10px 14px', marginBottom: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--red)', letterSpacing: '0.06em', marginBottom: 4 }}>BEFORE</div>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{ex.original}</div>
              </div>
              <div style={{ background: 'var(--green-dim)', border: '1px solid oklch(0.55 0.17 155 / 0.2)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', letterSpacing: '0.06em', marginBottom: 4 }}>AFTER</div>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{ex.rewrite}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary rewrite if suggested */}
      {s.summary?.rewrite && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px', marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Suggested summary rewrite</div>
          <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.65, margin: 0 }}>{s.summary.rewrite}</p>
        </div>
      )}

      {/* Gap to target */}
      {critique.gap_to_target && (
        <div style={{ background: 'var(--accent-dim)', border: '1px solid oklch(0.50 0.19 248 / 0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Gap to your target</div>
          <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>{critique.gap_to_target}</p>
        </div>
      )}

      {/* Upsell — tailor flow */}
      <div style={{ background: 'linear-gradient(135deg, oklch(0.50 0.19 248 / 0.08) 0%, oklch(0.55 0.17 155 / 0.08) 100%)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>Want a tailored version for a specific job?</div>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' }}>
          Pilot will take your resume, match it to the job description, rewrite every bullet, and generate a PDF — in 60 seconds.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="rc-btn-primary" onClick={handleTailor} style={{ padding: '13px 28px', fontSize: 15 }}>
            Tailor my resume — free →
          </button>
          {shareUrl && (
            <button className="rc-btn-outline" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Share this critique'}
            </button>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 12 }}>10 free pitches · no credit card</div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
function CritiqueInner() {
  const router = useRouter();
  const [step, setStep] = useState('upload'); // upload | target | generating | report
  const [parsedResume, setParsedResume] = useState(null);
  const [critique, setCritique] = useState(null);
  const [critiqueId, setCritiqueId] = useState(null);
  const [targetContext, setTargetContext] = useState('');

  useEffect(() => {
    const theme = localStorage.getItem('rp_theme') || 'light';
    document.documentElement.setAttribute('data-rc-theme', theme);
  }, []);

  const handleParsed = (parsed) => {
    setParsedResume(parsed);
    setStep('target');
  };

  const handleTarget = async (context) => {
    setTargetContext(context);
    setStep('generating');

    try {
      const res = await fetch('/api/rolepitch/critique', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsed_resume: parsedResume, target_context: context }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Critique failed');
      setCritique(data.critique);
      setCritiqueId(data.critique_id);
      setStep('report');
    } catch (e) {
      // On failure go back to target step with error — for now just go back
      setStep('target');
    }
  };

  return (
    <div className="rc-root" style={{ padding: '24px 16px', minHeight: '100vh' }}>
      {/* Nav */}
      <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <a href="/rolepitch" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--text)' }}>
          <div style={{ width: 26, height: 26, background: 'var(--accent)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M2 7h7M2 11h9" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em' }}>RolePitch</span>
        </a>
        {step !== 'upload' && step !== 'generating' && (
          <button onClick={() => setStep(step === 'report' ? 'target' : 'upload')} style={{ fontSize: 13, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--sans)' }}>← Back</button>
        )}
      </div>

      {/* Step indicator */}
      {step !== 'generating' && step !== 'report' && (
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', gap: 6, marginBottom: 24 }}>
          {['upload', 'target'].map((s, i) => (
            <div key={s} style={{ height: 3, borderRadius: 2, flex: 1, background: step === s || (i === 0 && step !== 'upload') ? 'var(--accent)' : 'var(--border)' }} />
          ))}
        </div>
      )}

      <div style={{ maxWidth: step === 'report' ? 680 : 520, margin: '0 auto' }}>
        {step === 'upload' && (
          <div className="rc-card"><StepUpload onParsed={handleParsed} /></div>
        )}
        {step === 'target' && (
          <div className="rc-card"><StepTarget onSubmit={handleTarget} /></div>
        )}
        {step === 'generating' && (
          <div className="rc-card"><StepGenerating /></div>
        )}
        {step === 'report' && critique && (
          <StepReport
            critique={critique}
            critiqueId={critiqueId}
            parsedResume={parsedResume}
            targetContext={targetContext}
            router={router}
          />
        )}
      </div>

      {step !== 'report' && (
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Free · No account needed · Report expires in 7 days</span>
        </div>
      )}
    </div>
  );
}

export default function CritiquePage() {
  return (
    <>
      <style>{CSS}</style>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <Suspense fallback={null}>
        <CritiqueInner />
      </Suspense>
    </>
  );
}
