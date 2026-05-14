'use client';

/**
 * /rolepitch/critique
 *
 * Free ATS score check flow — no auth required.
 * Steps: upload → target context → generating → report + upsell
 */

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { track } from '@/components/PostHogProvider';

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
  .rc-ats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  .rc-score-orbit { width: 132px; height: 132px; border-radius: 999px; display: grid; place-items: center; box-shadow: inset 0 0 0 1px oklch(0 0 0 / 0.04); }
  .rc-score-core { width: 104px; height: 104px; border-radius: 999px; background: var(--surface); display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 14px 32px oklch(0 0 0 / 0.08); }
  @media (max-width: 640px) {
    .rc-card { padding: 24px 20px; }
    .rc-ats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .rc-score-orbit { width: 112px; height: 112px; }
    .rc-score-core { width: 88px; height: 88px; }
  }
`;

const PILOT_LINES = [
  'Reading your resume…',
  'Checking ATS parseability…',
  'Scoring keywords and impact…',
  'Finding recruiter skim risks…',
  'Building your ATS report…',
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
        <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 1, color }}>{score}</span>
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
        <span style={{ fontSize: 12, fontWeight: 800, color: scoreColor(score), fontFamily: 'var(--sans)' }}>{score}</span>
      </div>
      <div className="rc-section-score">
        <div className="rc-section-score-fill" style={{ width: `${score}%`, background: scoreColor(score) }} />
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.45, margin: '8px 0 0' }}>{driver.note}</p>
    </div>
  );
}

const COUNTDOWN_SECS = 10;
const MAX_IMG_PX = 1600;
const IMG_QUALITY = 0.75;
// Vercel serverless body limit is 4.5MB. We cap raw file inputs at 10MB (large images
// get compressed below) and reject the upload if compressed total still exceeds 4MB.
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

async function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_IMG_PX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', IMG_QUALITY);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// ── Step 1: Upload ────────────────────────────────────────────────────────────
function StepUpload({ onParsed }) {
  const [phase, setPhase] = useState('idle'); // idle | staged | parsing | error
  const [errorMsg, setErrorMsg] = useState('');
  const [drag, setDrag] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [urlMode, setUrlMode] = useState(false);
  const [urlText, setUrlText] = useState('');
  // Multi-file staging
  const [stagedFiles, setStagedFiles] = useState([]); // [{ name, file|null, type:'file'|'image' }]
  const [countdown, setCountdown] = useState(COUNTDOWN_SECS);
  const countdownRef = useRef(null);
  // Two inputs each, one per type. Mixed accept on Android forces the
  // generic Files picker (multi-select requires long-press on Pixel),
  // while pure image/* opens the Photos picker with clean tap-to-select.
  const photoRef = useRef();
  const docRef = useRef();
  const morePhotoRef = useRef();
  const moreDocRef = useRef();

  const startCountdown = () => {
    setCountdown(COUNTDOWN_SECS);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(countdownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // Auto-submit when countdown hits 0
  useEffect(() => {
    if (countdown === 0 && phase === 'staged' && stagedFiles.length > 0) {
      submitFiles();
    }
  }, [countdown]);

  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  const addFiles = async (newFiles) => {
    const raw = Array.from(newFiles);
    const oversized = raw.find(f => f.size > MAX_FILE_BYTES);
    if (oversized) {
      setErrorMsg(`"${oversized.name}" is over 10MB. Compress or screenshot the relevant pages and try again.`);
      setPhase('error');
      return;
    }
    const entries = await Promise.all(raw.map(async f => {
      const isImage = f.type.startsWith('image/');
      const file = isImage ? await compressImage(f) : f;
      return { name: f.name, file, type: isImage ? 'image' : 'file' };
    }));
    const nextTotal = [...stagedFiles, ...entries].reduce((s, e) => s + (e.file?.size || 0), 0);
    if (nextTotal > MAX_TOTAL_BYTES) {
      setErrorMsg(`Combined files exceed ${Math.round(MAX_TOTAL_BYTES / 1024 / 1024)}MB after compression. Drop one and try again.`);
      setPhase('error');
      return;
    }
    setStagedFiles(prev => [...prev, ...entries]);
    setPhase('staged');
    setErrorMsg('');
    startCountdown();
  };

  const removeFile = (idx) => {
    setStagedFiles(prev => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length === 0) { setPhase('idle'); if (countdownRef.current) clearInterval(countdownRef.current); }
      else startCountdown();
      return next;
    });
  };

  const cancelCountdown = () => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    setCountdown(COUNTDOWN_SECS);
  };

  const submitFiles = async () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setPhase('parsing');
    setErrorMsg('');
    try {
      const fd = new FormData();
      const hasImages = stagedFiles.some(f => f.type === 'image');
      const hasPdf = stagedFiles.some(f => f.name?.toLowerCase().endsWith('.pdf'));

      if (hasPdf && !hasImages) {
        fd.append('type', 'pdf');
        fd.append('file', stagedFiles[0].file);
        stagedFiles.slice(1).forEach((f, i) => fd.append(`extra_${i}`, f.file));
      } else {
        fd.append('type', 'images');
        stagedFiles.forEach((f, i) => fd.append(`image_${i}`, f.file));
      }

      const res = await fetch('/api/rolepitch/parse-resume', { method: 'POST', body: fd });

      // Guard against non-JSON responses (e.g. 413 payload too large)
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); }
      catch { throw new Error(res.status === 413 ? 'Files too large — try fewer screenshots or a PDF' : `Server error (${res.status})`); }

      if (!res.ok || data.error) throw new Error(data.error || 'Parse failed');
      onParsed(data.parsed, data.pdf_path || null);
    } catch (e) {
      setErrorMsg(e.message);
      setPhase('error');
      setStagedFiles([]);
    }
  };

  const parseFormData = async (fd) => {
    const res = await fetch('/api/rolepitch/parse-resume', { method: 'POST', body: fd });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error(`Server error (${res.status})`); }
    if (!res.ok || data.error) throw new Error(data.error || 'Parse failed');
    return data;
  };

  const handlePaste = async () => {
    if (!pasteText.trim()) return;
    setPhase('parsing');
    const fd = new FormData();
    fd.append('type', 'paste');
    fd.append('text', pasteText.trim());
    try { const data = await parseFormData(fd); onParsed(data.parsed, data.pdf_path || null); }
    catch (e) { setErrorMsg(e.message); setPhase('error'); }
  };

  const handleUrl = async () => {
    if (!urlText.trim()) return;
    setPhase('parsing');
    const fd = new FormData();
    fd.append('type', 'url');
    fd.append('url', urlText.trim());
    try { const data = await parseFormData(fd); onParsed(data.parsed, data.pdf_path || null); }
    catch (e) { setErrorMsg(e.message); setPhase('error'); }
  };

  // Countdown ring progress (0–1)
  const ringProgress = countdown / COUNTDOWN_SECS;
  const R = 18;
  const circ = 2 * Math.PI * R;

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
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6 }}>Check your ATS score</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>PDF, screenshots, link, or paste — RolePitch will score ATS readiness and show the exact fixes.</p>
        <p style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.5, marginTop: 6 }}>
          Not sure if your resume will pass ATS screening?{' '}
          <a href="/blog/why-your-resume-gets-rejected-by-ats-and-exactly-how-to-fix-it-for-remote-first-companies" style={{ color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: 2 }}>
            Learn how ATS systems actually score resumes →
          </a>
        </p>
      </div>

      {!pasteMode && !urlMode && phase !== 'staged' && (
        <>
          <div
            className={`rc-upload-zone${drag ? ' drag' : ''}`}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
            onClick={() => photoRef.current?.click()}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }}>
              <path d="M10 22H8a6 6 0 010-12h1M22 22h2a6 6 0 000-12h-1M16 22V10M12 14l4-4 4 4" stroke="var(--text)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Drop screenshots here, or pick below</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Multiple files supported</div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 500, color: 'var(--text)' }}
            >
              <span style={{ fontSize: 18 }}>🖼️</span>
              Add screenshots
            </button>
            <button
              type="button"
              onClick={() => docRef.current?.click()}
              style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 500, color: 'var(--text)' }}
            >
              <span style={{ fontSize: 18 }}>📎</span>
              Add PDF
            </button>
          </div>
          <input ref={photoRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
          <input ref={docRef} type="file" accept="application/pdf,.pdf" multiple style={{ display: 'none' }} onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
        </>
      )}

      {/* Staged files + countdown */}
      {phase === 'staged' && (
        <div>
          {/* File list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {stagedFiles.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 12px' }}>
                <span style={{ fontSize: 16 }}>{f.type === 'image' ? '🖼️' : '📄'}</span>
                <span style={{ fontSize: 13, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <button onClick={() => removeFile(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 16, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>

          {/* Countdown + actions */}
          <div style={{ background: 'var(--accent-dim)', border: '1px solid oklch(0.50 0.19 248 / 0.2)', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            {/* Countdown ring */}
            <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
              <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="22" cy="22" r={R} fill="none" stroke="var(--border)" strokeWidth="3" />
                <circle
                  cx="22" cy="22" r={R} fill="none"
                  stroke="var(--accent)" strokeWidth="3"
                  strokeDasharray={circ}
                  strokeDashoffset={circ * (1 - ringProgress)}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.9s linear' }}
                />
              </svg>
              <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{countdown}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                Submitting in {countdown}s…
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {stagedFiles.length} file{stagedFiles.length > 1 ? 's' : ''} ready · add more or submit now
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="rc-btn-primary" onClick={submitFiles} style={{ flex: 1 }}>
              Analyse now →
            </button>
            <button
              onClick={() => {
                // Pause countdown while picker is open. If user picks files, addFiles
                // restarts it. If user cancels the picker (no onChange), focus returns
                // to the window — restart the countdown so the staged files still ship.
                cancelCountdown();
                const onFocusBack = () => {
                  window.removeEventListener('focus', onFocusBack);
                  setTimeout(() => { if (!countdownRef.current) startCountdown(); }, 200);
                };
                window.addEventListener('focus', onFocusBack);
                morePhotoRef.current?.click();
              }}
              style={{ fontSize: 13, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              + Screenshots
            </button>
            <button
              onClick={() => {
                cancelCountdown();
                const onFocusBack = () => {
                  window.removeEventListener('focus', onFocusBack);
                  setTimeout(() => { if (!countdownRef.current) startCountdown(); }, 200);
                };
                window.addEventListener('focus', onFocusBack);
                moreDocRef.current?.click();
              }}
              style={{ fontSize: 13, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              + PDF
            </button>
            <input ref={morePhotoRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
            <input ref={moreDocRef} type="file" accept="application/pdf,.pdf" multiple style={{ display: 'none' }} onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
          </div>
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

      {phase !== 'staged' && !pasteMode && !urlMode && (
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
          Add a target role if you want keyword and fit scoring. Skip for a general ATS readiness check.
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
          Check ATS score →
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

  const handleTailor = async () => {
    // Persist to BOTH storages so start page (localStorage) + auth page can read it.
    const patch = { parsedResume, critiqueId, fromCritique: true };
    try {
      const sExist = JSON.parse(sessionStorage.getItem('rp_session') || '{}');
      sessionStorage.setItem('rp_session', JSON.stringify({ ...sExist, ...patch }));
    } catch {}
    try {
      const lExist = JSON.parse(localStorage.getItem('rp_session') || '{}');
      localStorage.setItem('rp_session', JSON.stringify({ ...lExist, ...patch }));
    } catch {}

    // If already signed in, skip the auth round-trip — claim and go straight
    // to tailoring. Otherwise fall through to OAuth.
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        if (critiqueId) {
          await fetch('/api/rolepitch/claim-critique', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ critique_id: critiqueId }),
          }).catch(() => {});
          router.push(`/rolepitch/tailoring?critique_id=${encodeURIComponent(critiqueId)}`);
          return;
        }
        router.push('/rolepitch/start?step=0&source=critique');
        return;
      }
    } catch (e) {
      console.error('[handleTailor] session check failed:', e);
    }

    router.push('/rolepitch/auth?source=critique&step=0');
  };

  const s = critique.sections || {};
  const overallScore = critique.overall_score || 0;
  const drivers = atsDrivers(critique);
  const hasTarget = !!targetContext;
  const targetFit = targetFitFor(critique, hasTarget);
  const verdict = critique.ats_report?.diagnosis || critique.headline_verdict;
  const primaryLabel = critique.ats_report?.label || scoreLabel(overallScore);

  return (
    <div style={{ animation: 'rc-fadeUp 0.4s ease both' }}>
      {/* Score header */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
            <ScoreRing score={overallScore} label={primaryLabel} />
            <div style={{ maxWidth: 380 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-faint)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>ATS Readiness Score</div>
              <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.12, margin: 0 }}>
                {hasTarget ? 'Your resume is readable. Now make it unmistakably relevant.' : 'Your ATS report is ready.'}
              </h2>
              {targetFit && (
                <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'baseline', gap: 8, background: 'var(--bg)', border: '1px solid var(--border-subtle)', borderRadius: 999, padding: '7px 11px' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Target fit</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: scoreColor(targetFit.score) }}>{targetFit.score}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>/100</span>
                </div>
              )}
            </div>
          </div>
          {shareUrl && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
              <button onClick={handleCopy} style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid oklch(0.50 0.19 248 / 0.2)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontFamily: 'var(--sans)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M5 3H3a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1V8M8 1h4m0 0v4m0-4L5.5 7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {copied ? 'Copied!' : 'Copy report link'}
              </button>
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Link expires in 7 days</div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--bg)', borderRadius: 10, borderLeft: '3px solid var(--accent)' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0, lineHeight: 1.5 }}>"{verdict}"</p>
        </div>

        <div className="rc-ats-grid" style={{ marginTop: 18 }}>
          {drivers.map(driver => <AtsDriverCard key={driver.key} driver={driver} />)}
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
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>{hasTarget ? 'Gap to your target' : 'What is holding this resume back'}</div>
          <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>{critique.gap_to_target}</p>
        </div>
      )}

      {/* Upsell — tailor flow */}
      <div style={{ background: 'linear-gradient(135deg, oklch(0.50 0.19 248 / 0.08) 0%, oklch(0.55 0.17 155 / 0.08) 100%)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>{hasTarget ? 'Ready to close the gap?' : 'Want RolePitch to fix this for a real job?'}</div>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' }}>
          {hasTarget
            ? 'Generate a tailored resume that rewrites the weak bullets for this exact role and exports a PDF in 60 seconds.'
            : 'Paste a job link next. RolePitch will turn this diagnosis into a tailored resume with rewritten bullets and a PDF.'}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="rc-btn-primary" onClick={handleTailor} style={{ padding: '13px 28px', fontSize: 15 }}>
            {hasTarget ? 'Generate tailored resume →' : 'Tailor for a job — free →'}
          </button>
          {shareUrl && (
            <button className="rc-btn-outline" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Share report'}
            </button>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 12 }}>5 free pitches · no credit card</div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
function CritiqueInner() {
  const router = useRouter();
  const [step, setStep] = useState('upload'); // upload | target | generating | report
  const [parsedResume, setParsedResume] = useState(null);
  const [pdfPath, setPdfPath] = useState(null);
  const [critique, setCritique] = useState(null);
  const [critiqueId, setCritiqueId] = useState(null);
  const [targetContext, setTargetContext] = useState('');

  useEffect(() => {
    const theme = localStorage.getItem('rp_theme') || 'light';
    document.documentElement.setAttribute('data-rc-theme', theme);
  }, []);

  const handleParsed = (parsed, parsePdfPath) => {
    setParsedResume(parsed);
    if (parsePdfPath) setPdfPath(parsePdfPath);
    setStep('target');
  };

  const [critiqueError, setCritiqueError] = useState('');

  const handleTarget = async (context) => {
    setTargetContext(context);
    setCritiqueError('');
    setStep('generating');
    track('rp_ats_score_started', {
      has_target: !!context,
      target_len: context?.length || 0,
      experience_count: parsedResume?.experience?.length || 0,
    });
    track('rp_resume_roast_started', {
      has_target: !!context,
      target_len: context?.length || 0,
      experience_count: parsedResume?.experience?.length || 0,
    });

    // Client-side timeout — if the function hangs past 70s, abort and surface
    // a real error instead of leaving the user staring at a spinner forever.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 70000);

    try {
      console.log('[critique-page] POST /api/rolepitch/critique', { has_target: !!context, target_len: context?.length || 0, experience_count: parsedResume?.experience?.length || 0 });
      const res = await fetch('/api/rolepitch/critique', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsed_resume: parsedResume, target_context: context, pdf_path: pdfPath }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        console.error('[critique-page] critique API failed', { status: res.status, error: data?.error, rid: data?.rid });
        throw new Error(data?.error || `ATS score check failed (HTTP ${res.status})${data?.rid ? ` · ref ${data.rid}` : ''}`);
      }
      setCritique(data.critique);
      setCritiqueId(data.critique_id);
      track('rp_ats_score_completed', {
        critique_id: data.critique_id || null,
        overall_score: data.critique?.overall_score ?? null,
        target_fit_score: data.critique?.target_fit?.score ?? null,
        has_target: !!context,
      });
      track('rp_resume_roast_completed', {
        critique_id: data.critique_id || null,
        overall_score: data.critique?.overall_score ?? null,
        has_target: !!context,
      });
      setStep('report');
    } catch (e) {
      clearTimeout(timeoutId);
      const msg = e.name === 'AbortError'
        ? 'Took too long — the model is overloaded. Try again in a moment.'
        : e.message || 'ATS score check failed — please retry.';
      console.error('[critique-page] caught error', { name: e.name, message: e.message });
      setCritiqueError(msg);
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
