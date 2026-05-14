'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { track } from '@/components/PostHogProvider';

const CSS = `
  :root {
    --bg: oklch(0.98 0.006 248);
    --surface: oklch(0.955 0.009 248);
    --surface2: oklch(0.93 0.012 248);
    --border: oklch(0.86 0.015 248);
    --accent: oklch(0.50 0.19 248);
    --accent-dim: oklch(0.50 0.19 248 / 0.10);
    --green: oklch(0.55 0.17 155);
    --text: oklch(0.16 0.03 248);
    --text-muted: oklch(0.44 0.04 248);
    --text-faint: oklch(0.62 0.03 248);
    --sans: 'DM Sans', sans-serif;
  }
  .br-page { min-height: 100vh; background: var(--bg); color: var(--text); font-family: var(--sans); -webkit-font-smoothing: antialiased; }
  .br-btn-primary { background: var(--accent); color: white; border: none; border-radius: 10px; padding: 12px 18px; font-weight: 800; font-family: var(--sans); cursor: pointer; }
  .br-btn-ghost { background: transparent; color: var(--text-muted); border: 1px solid var(--border); border-radius: 10px; padding: 11px 16px; font-weight: 700; font-family: var(--sans); cursor: pointer; }
  .br-input { width: 100%; border: 1px solid var(--border); background: var(--bg); border-radius: 12px; padding: 14px; color: var(--text); font-family: var(--sans); font-size: 15px; line-height: 1.5; outline: none; }
  .br-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim); }
  @keyframes br-spin { to { transform: rotate(360deg); } }
  @media (max-width: 640px) {
    .br-shell { padding: 14px !important; }
    .br-card { padding: 18px !important; }
    .br-actions { flex-direction: column !important; }
    .br-actions button { width: 100% !important; }
  }
`;

function sourceLabel(source) {
  if (source === 'pdf') return 'PDF';
  if (source === 'image') return 'screenshots';
  if (source === 'website') return 'links';
  return 'text';
}

function formatDate(iso) {
  if (!iso) return 'Not uploaded yet';
  return new Date(iso).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function BaseResumePage() {
  const router = useRouter();
  const fileRef = useRef(null);
  const [authReady, setAuthReady] = useState(false);
  const [baseResume, setBaseResume] = useState(null);
  const [mode, setMode] = useState('upload');
  const [file, setFile] = useState(null);
  const [pasteText, setPasteText] = useState('');
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        window.location.href = '/rolepitch/auth?redirect=/rolepitch/base-resume';
        return;
      }
      setAuthReady(true);
      fetch('/api/rolepitch/base-resume')
        .then(r => r.ok ? r.json() : { base_resume: null })
        .then(d => setBaseResume(d.base_resume || null))
        .catch(() => {});
    });
  }, []);

  const parseAndSave = async () => {
    setPhase('saving');
    setError('');
    try {
      const fd = new FormData();
      if (mode === 'paste') {
        if (!pasteText.trim()) throw new Error('Paste your resume text first.');
        fd.append('type', 'paste');
        fd.append('text', pasteText.trim());
      } else {
        if (!file) throw new Error('Choose a PDF first.');
        if (!file.name?.toLowerCase().endsWith('.pdf')) throw new Error('Upload a PDF so RolePitch can preserve the layout later.');
        fd.append('type', 'pdf');
        fd.append('file', file);
      }

      const parseRes = await fetch('/api/rolepitch/parse-resume', { method: 'POST', body: fd });
      const parseData = await parseRes.json().catch(() => ({}));
      if (!parseRes.ok || parseData.error) throw new Error(parseData.error || 'Could not read this resume.');

      const saveRes = await fetch('/api/rolepitch/base-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parsed: parseData.parsed,
          source: parseData.source || (mode === 'paste' ? 'text' : 'pdf'),
          pdf_path: parseData.pdf_path || null,
        }),
      });
      const saveData = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok || saveData.error) throw new Error(saveData.error || 'Could not save this as your base resume.');

      setBaseResume(saveData.base_resume || null);
      setPhase('done');
      track('rp_base_resume_updated', {
        source: saveData.base_resume?.source || parseData.source || mode,
        has_layout: !!saveData.base_resume?.has_layout,
      });
    } catch (e) {
      setError(e.message || 'Could not update your base resume.');
      setPhase('idle');
    }
  };

  if (!authReady) {
    return (
      <>
        <style>{CSS}</style>
        <div className="br-page" style={{ display: 'grid', placeItems: 'center' }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'br-spin 0.75s linear infinite' }} />
        </div>
      </>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div className="br-page">
        <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 5 }}>
          <div style={{ maxWidth: 920, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <button onClick={() => router.push('/rolepitch/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', padding: 0 }}>
              <span style={{ fontSize: 26, color: 'var(--text-muted)' }}>‹</span>
              <span style={{ fontWeight: 800, fontSize: 16 }}>Base resume</span>
            </button>
            <button className="br-btn-ghost" onClick={() => router.push('/rolepitch/start?fresh=1')}>New pitch</button>
          </div>
        </div>

        <main className="br-shell" style={{ maxWidth: 820, margin: '0 auto', padding: '34px 20px 56px' }}>
          <section style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Source of truth</div>
            <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', lineHeight: 1.05, letterSpacing: '-0.04em', margin: '0 0 12px' }}>Update the resume RolePitch starts from</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 16, lineHeight: 1.65, margin: 0, maxWidth: 660 }}>
              Add a new company, role, or skill here first. Future pitches will tailor from this updated PDF. Existing tailored PDFs stay unchanged.
            </p>
          </section>

          <section className="br-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 22, marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Current base</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{baseResume?.name || 'No base resume found'}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
                  {baseResume
                    ? `${baseResume.title || 'Resume'}${baseResume.company ? ` at ${baseResume.company}` : ''}`
                    : 'Upload one now so future tailoring has a clean source.'}
                </div>
              </div>
              <div style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: 13 }}>
                <div>{formatDate(baseResume?.parsed_at)}</div>
                {baseResume?.source && <div style={{ marginTop: 4 }}>From {sourceLabel(baseResume.source)}</div>}
              </div>
            </div>
          </section>

          {phase === 'done' ? (
            <section className="br-card" style={{ background: 'oklch(0.55 0.17 155 / 0.10)', border: '1px solid oklch(0.55 0.17 155 / 0.28)', borderRadius: 18, padding: 24, textAlign: 'center' }}>
              <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'oklch(0.55 0.17 155 / 0.16)', display: 'grid', placeItems: 'center', color: 'var(--green)', fontSize: 28, margin: '0 auto 14px' }}>✓</div>
              <h2 style={{ fontSize: 24, margin: '0 0 8px', letterSpacing: '-0.03em' }}>Base resume updated</h2>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.55, margin: '0 auto 20px', maxWidth: 520 }}>
                Future tailoring will use this version. You can now create a pitch for the next role from the updated resume.
              </p>
              <div className="br-actions" style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                <button className="br-btn-primary" onClick={() => router.push('/rolepitch/start?fresh=1')}>Create a new pitch →</button>
                <button className="br-btn-ghost" onClick={() => router.push('/rolepitch/dashboard')}>Back to dashboard</button>
              </div>
            </section>
          ) : (
            <section className="br-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Upload latest PDF
              </div>

              {mode === 'upload' ? (
                <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: 16, padding: '42px 24px', textAlign: 'center', cursor: 'pointer', background: 'var(--bg)' }}>
                  <input ref={fileRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] || null)} />
                  <div style={{ fontSize: 34, marginBottom: 10 }}>↑</div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{file ? file.name : 'Upload your latest resume'}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>Use a PDF so future downloads can keep your layout.</div>
                </div>
              ) : (
                <textarea
                  className="br-input"
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  rows={10}
                  placeholder="Paste your full updated resume here..."
                />
              )}

              {error && <div style={{ marginTop: 14, background: 'oklch(0.65 0.2 30 / 0.08)', border: '1px solid oklch(0.65 0.2 30 / 0.24)', color: 'oklch(0.55 0.18 30)', borderRadius: 12, padding: 12, fontSize: 13 }}>{error}</div>}

              <div className="br-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button className="br-btn-ghost" onClick={() => router.push('/rolepitch/dashboard')}>Cancel</button>
                <button className="br-btn-primary" onClick={parseAndSave} disabled={phase === 'saving'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minWidth: 184 }}>
                  {phase === 'saving' && <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid white', borderTopColor: 'transparent', animation: 'br-spin 0.75s linear infinite' }} />}
                  {phase === 'saving' ? 'Updating...' : 'Update base resume'}
                </button>
              </div>
            </section>
          )}
        </main>
      </div>
    </>
  );
}
