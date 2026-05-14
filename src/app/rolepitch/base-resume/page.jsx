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
    --green-dim: oklch(0.55 0.17 155 / 0.10);
    --amber: oklch(0.68 0.14 78);
    --text: oklch(0.16 0.03 248);
    --text-muted: oklch(0.44 0.04 248);
    --text-faint: oklch(0.62 0.03 248);
    --sans: 'DM Sans', sans-serif;
  }
  .br-page { min-height: 100vh; background: var(--bg); color: var(--text); font-family: var(--sans); -webkit-font-smoothing: antialiased; }
  .br-card { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 22px; }
  .br-btn-primary { background: var(--accent); color: white; border: none; border-radius: 10px; padding: 12px 18px; font-weight: 800; font-family: var(--sans); cursor: pointer; }
  .br-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .br-btn-ghost { background: transparent; color: var(--text-muted); border: 1px solid var(--border); border-radius: 10px; padding: 11px 16px; font-weight: 700; font-family: var(--sans); cursor: pointer; }
  .br-input { width: 100%; border: 1px solid var(--border); background: var(--bg); border-radius: 12px; padding: 14px; color: var(--text); font-family: var(--sans); font-size: 15px; line-height: 1.5; outline: none; }
  .br-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim); }
  .br-option { border: 1px solid var(--border); background: var(--bg); color: var(--text-muted); border-radius: 12px; padding: 13px 14px; cursor: pointer; font-family: var(--sans); font-weight: 800; text-align: left; }
  .br-option[data-active="true"] { border-color: var(--accent); color: var(--accent); background: var(--accent-dim); }
  @keyframes br-spin { to { transform: rotate(360deg); } }
  @media (max-width: 640px) {
    .br-shell { padding: 14px !important; }
    .br-card { padding: 17px !important; border-radius: 16px !important; }
    .br-actions { flex-direction: column !important; }
    .br-actions button { width: 100% !important; }
    .br-grid { grid-template-columns: 1fr !important; }
    .br-hero h1 { font-size: 32px !important; }
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

function Spinner({ color = 'white' }) {
  return <span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${color}`, borderTopColor: 'transparent', animation: 'br-spin 0.75s linear infinite', display: 'inline-block' }} />;
}

function MobileDesktopNudge() {
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };
  return (
    <div className="br-card br-mobile-nudge" style={{ display: 'none', marginBottom: 16, background: 'oklch(0.50 0.19 248 / 0.07)' }}>
      <style>{`@media (max-width: 640px) { .br-mobile-nudge { display: block !important; } }`}</style>
      <div style={{ fontWeight: 800, marginBottom: 5 }}>Best on desktop</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
        Updating your master resume works here, but reviewing sections and layout is easier on desktop web.
      </div>
      <button className="br-btn-ghost" onClick={copyLink} style={{ width: '100%', padding: '9px 12px', fontSize: 13 }}>
        {copied ? 'Desktop link copied' : 'Copy desktop link'}
      </button>
    </div>
  );
}

function ResumePreview({ resume }) {
  if (!resume) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 21, fontWeight: 900, letterSpacing: '-0.03em' }}>{resume.name || 'Unnamed resume'}</div>
        <div style={{ color: 'var(--text-muted)', marginTop: 3 }}>{resume.title || 'Resume'}</div>
      </div>
      {resume.summary && (
        <section>
          <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)', margin: '0 0 6px' }}>Summary</h3>
          <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.55 }}>{resume.summary}</p>
        </section>
      )}
      <section>
        <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)', margin: '0 0 8px' }}>Experience</h3>
        {(resume.experience || []).slice(0, 5).map((role, idx) => (
          <div key={`${role.company}-${idx}`} style={{ borderTop: idx ? '1px solid var(--border)' : 'none', paddingTop: idx ? 12 : 0, marginTop: idx ? 12 : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <strong>{role.title || 'Role'}{role.company ? `, ${role.company}` : ''}</strong>
              <span style={{ color: 'var(--text-faint)', fontSize: 13 }}>{[role.start_date, role.end_date || 'Present'].filter(Boolean).join(' - ')}</span>
            </div>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--text-muted)', lineHeight: 1.45 }}>
              {(role.bullets || []).slice(0, 4).map((b, i) => <li key={i}>{typeof b === 'string' ? b : b.text}</li>)}
            </ul>
          </div>
        ))}
      </section>
      {!!resume.skills?.length && (
        <section>
          <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)', margin: '0 0 8px' }}>Skills</h3>
          <div style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>{resume.skills.slice(0, 18).join(' · ')}</div>
        </section>
      )}
    </div>
  );
}

export default function BaseResumePage() {
  const router = useRouter();
  const fileRef = useRef(null);
  const [authReady, setAuthReady] = useState(false);
  const [baseResume, setBaseResume] = useState(null);
  const [resume, setResume] = useState(null);
  const [screen, setScreen] = useState('manager'); // manager | chat | upload | review | done
  const [file, setFile] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const [keepDesign, setKeepDesign] = useState('yes');
  const [pagePreference, setPagePreference] = useState('one_page');
  const [updateType, setUpdateType] = useState('new_role');
  const [messages, setMessages] = useState([]);
  const [userText, setUserText] = useState('');
  const [draft, setDraft] = useState(null);
  const [revisionText, setRevisionText] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        window.location.href = '/rolepitch/auth?redirect=/rolepitch/base-resume';
        return;
      }
      setAuthReady(true);
      fetch('/api/rolepitch/base-resume')
        .then(r => r.ok ? r.json() : { base_resume: null, resume: null })
        .then(d => {
          setBaseResume(d.base_resume || null);
          setResume(d.resume || null);
        })
        .catch(() => {});
    });
  }, []);

  const preferences = { keep_design: keepDesign, page_preference: pagePreference, update_type: updateType };

  const draftUpdate = async ({ extraMessage, useCurrentDraft = false } = {}) => {
    const content = (extraMessage ?? userText).trim();
    if (!content) {
      setError('Tell RolePitch what changed first.');
      return;
    }
    setPhase('drafting');
    setError('');
    const nextMessages = [...messages, { role: 'user', content }];
    try {
      const res = await fetch('/api/rolepitch/base-resume/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...preferences,
          messages: nextMessages,
          current_draft: useCurrentDraft ? draft?.resume : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || 'Could not draft your update.');

      const assistantMsg = data.assistant_note || 'I drafted an updated base resume for review.';
      setMessages([...nextMessages, { role: 'assistant', content: assistantMsg }]);
      setDraft(data);
      setUserText('');
      setRevisionText('');
      setScreen('review');
      track('rp_base_resume_draft_generated', preferences);
    } catch (e) {
      setError(e.message || 'Could not draft your update.');
    } finally {
      setPhase('idle');
    }
  };

  const saveDraft = async () => {
    if (!draft?.resume) return;
    setPhase('saving');
    setError('');
    try {
      const res = await fetch('/api/rolepitch/base-resume', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume: draft.resume,
          preferences,
          update_note: draft.assistant_note || '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || 'Could not save this base resume.');
      setBaseResume(data.base_resume || null);
      setResume(data.resume || draft.resume);
      setScreen('done');
      setDraft(null);
      track('rp_base_resume_updated', { source: 'chat', ...preferences });
    } catch (e) {
      setError(e.message || 'Could not save this base resume.');
    } finally {
      setPhase('idle');
    }
  };

  const parseAndSave = async () => {
    setPhase('saving');
    setError('');
    try {
      const fd = new FormData();
      if (!file) throw new Error('Choose a PDF first.');
      if (!file.name?.toLowerCase().endsWith('.pdf')) throw new Error('Upload a PDF so RolePitch can preserve the layout later.');
      fd.append('type', 'pdf');
      fd.append('file', file);

      const parseRes = await fetch('/api/rolepitch/parse-resume', { method: 'POST', body: fd });
      const parseData = await parseRes.json().catch(() => ({}));
      if (!parseRes.ok || parseData.error) throw new Error(parseData.error || 'Could not read this resume.');

      const saveRes = await fetch('/api/rolepitch/base-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parsed: parseData.parsed,
          source: parseData.source || 'pdf',
          pdf_path: parseData.pdf_path || null,
        }),
      });
      const saveData = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok || saveData.error) throw new Error(saveData.error || 'Could not save this as your base resume.');

      setBaseResume(saveData.base_resume || null);
      setResume(parseData.parsed || null);
      setScreen('done');
      track('rp_base_resume_updated', { source: 'pdf', has_layout: !!saveData.base_resume?.has_layout });
    } catch (e) {
      setError(e.message || 'Could not update your base resume.');
    } finally {
      setPhase('idle');
    }
  };

  if (!authReady) {
    return (
      <>
        <style>{CSS}</style>
        <div className="br-page" style={{ display: 'grid', placeItems: 'center' }}>
          <Spinner color="var(--accent)" />
        </div>
      </>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <div className="br-page">
        <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 5 }}>
          <div style={{ maxWidth: 1080, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <button onClick={() => screen === 'manager' ? router.push('/rolepitch/dashboard') : setScreen('manager')} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', padding: 0 }}>
              <span style={{ fontSize: 26, color: 'var(--text-muted)' }}>‹</span>
              <span style={{ fontWeight: 800, fontSize: 16 }}>Base resume</span>
            </button>
            <button className="br-btn-ghost" onClick={() => router.push('/rolepitch/start?fresh=1')}>New pitch</button>
          </div>
        </div>

        <main className="br-shell" style={{ maxWidth: 980, margin: '0 auto', padding: '34px 20px 56px' }}>
          <MobileDesktopNudge />

          <section className="br-hero" style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--accent)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Source of truth</div>
            <h1 style={{ fontSize: 'clamp(34px, 5vw, 56px)', lineHeight: 1.02, letterSpacing: '-0.055em', margin: '0 0 12px' }}>Update the resume RolePitch starts from</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 16, lineHeight: 1.65, margin: 0, maxWidth: 720 }}>
              Add a new company, role, or skill here first. Future pitches will tailor from this updated base. Existing tailored PDFs stay unchanged.
            </p>
          </section>

          <section className="br-card" style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Current base</div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{baseResume?.name || 'No base resume found'}</div>
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

          {screen === 'done' && (
            <section className="br-card" style={{ background: 'var(--green-dim)', borderColor: 'oklch(0.55 0.17 155 / 0.28)', textAlign: 'center' }}>
              <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'oklch(0.55 0.17 155 / 0.16)', display: 'grid', placeItems: 'center', color: 'var(--green)', fontSize: 28, margin: '0 auto 14px' }}>✓</div>
              <h2 style={{ fontSize: 24, margin: '0 0 8px', letterSpacing: '-0.03em' }}>Base resume updated</h2>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.55, margin: '0 auto 20px', maxWidth: 560 }}>
                Future pitches will use this version. Old tailored resumes stay exactly as they were.
              </p>
              <div className="br-actions" style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                <button className="br-btn-primary" onClick={() => router.push('/rolepitch/start?fresh=1')}>Create a new pitch</button>
                <button className="br-btn-ghost" onClick={() => setScreen('manager')}>Update again</button>
                <button className="br-btn-ghost" onClick={() => router.push('/rolepitch/dashboard')}>Dashboard</button>
              </div>
            </section>
          )}

          {screen === 'manager' && (
            <div className="br-grid" style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 18 }}>
              <section className="br-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Recommended</div>
                  <h2 style={{ margin: 0, fontSize: 25, letterSpacing: '-0.035em' }}>Update with AI chat</h2>
                  <p style={{ color: 'var(--text-muted)', lineHeight: 1.55, margin: '8px 0 0' }}>
                    Tell RolePitch what changed. It will draft the update, show you a review, and save only after you approve.
                  </p>
                </div>
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, color: 'var(--text-muted)', lineHeight: 1.55, fontSize: 14 }}>
                  Best for adding a new company, promotion, project, achievements, skills, or a sharper summary.
                </div>
                <button className="br-btn-primary" onClick={() => setScreen('chat')} disabled={!resume} style={{ width: 'fit-content' }}>
                  Update with AI chat
                </button>
                {!resume && <div style={{ color: 'var(--amber)', fontSize: 13 }}>Upload a base resume first, then you can edit it with chat.</div>}
              </section>

              <section className="br-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Replace file</div>
                  <h2 style={{ margin: 0, fontSize: 22, letterSpacing: '-0.03em' }}>Upload latest PDF</h2>
                  <p style={{ color: 'var(--text-muted)', lineHeight: 1.55, margin: '8px 0 0', fontSize: 14 }}>
                    Use this if you already fixed the resume outside RolePitch and want that file to become the new base.
                  </p>
                </div>
                <button className="br-btn-ghost" onClick={() => setScreen('upload')}>Replace with PDF</button>
              </section>
            </div>
          )}

          {screen === 'chat' && (
            <section className="br-card">
              <div style={{ display: 'grid', gap: 18 }}>
                <div>
                  <h2 style={{ fontSize: 26, margin: '0 0 6px', letterSpacing: '-0.035em' }}>What changed since your last resume?</h2>
                  <p style={{ color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>Write casually. Example: "I joined Noon as Senior PM in Jan 2026 and launched subscriptions, improving retention by 12%."</p>
                </div>

                <div className="br-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text-faint)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Design</div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      <button className="br-option" data-active={keepDesign === 'yes'} onClick={() => setKeepDesign('yes')}>Keep current design <span style={{ color: 'var(--green)' }}>(recommended)</span></button>
                      <button className="br-option" data-active={keepDesign === 'no'} onClick={() => setKeepDesign('no')}>Let RolePitch choose the best design</button>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text-faint)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Length</div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      <button className="br-option" data-active={pagePreference === 'one_page'} onClick={() => setPagePreference('one_page')}>Keep it to 1 page <span style={{ color: 'var(--green)' }}>(recommended)</span></button>
                      <button className="br-option" data-active={pagePreference === 'flexible'} onClick={() => setPagePreference('flexible')}>2 pages is okay if needed</button>
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text-faint)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Update type</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[
                      ['new_role', 'Add new role'],
                      ['current_role', 'Update current role'],
                      ['projects', 'Projects / wins'],
                      ['skills', 'Skills'],
                      ['summary', 'Summary'],
                      ['general', 'Other'],
                    ].map(([id, label]) => (
                      <button key={id} className="br-option" data-active={updateType === id} onClick={() => setUpdateType(id)} style={{ padding: '9px 12px', fontSize: 13 }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {keepDesign === 'no' && (
                  <div style={{ background: 'var(--accent-dim)', border: '1px solid oklch(0.50 0.19 248 / 0.22)', borderRadius: 12, padding: 12, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.45 }}>
                    RolePitch will choose a clean ATS-friendly design based on your seniority, industry, and resume length.
                  </div>
                )}

                <textarea
                  className="br-input"
                  rows={8}
                  value={userText}
                  onChange={e => setUserText(e.target.value)}
                  placeholder="Tell RolePitch what changed. Add dates, company, role, achievements, tools, metrics, or anything you want included."
                />
                {error && <ErrorBox message={error} />}
                <div className="br-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button className="br-btn-ghost" onClick={() => setScreen('manager')}>Cancel</button>
                  <button className="br-btn-primary" onClick={() => draftUpdate()} disabled={phase === 'drafting'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {phase === 'drafting' && <Spinner />}
                    {phase === 'drafting' ? 'Drafting...' : 'Draft update for review'}
                  </button>
                </div>
              </div>
            </section>
          )}

          {screen === 'review' && draft && (
            <section className="br-grid" style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 18 }}>
              <div className="br-card" style={{ alignSelf: 'start' }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Review before save</div>
                <h2 style={{ margin: '0 0 8px', letterSpacing: '-0.035em' }}>Draft update ready</h2>
                <p style={{ color: 'var(--text-muted)', lineHeight: 1.55, marginTop: 0 }}>{draft.assistant_note}</p>
                {!!draft.change_summary?.length && (
                  <>
                    <h3 style={{ fontSize: 13, marginTop: 18 }}>What changed</h3>
                    <ul style={{ paddingLeft: 18, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      {draft.change_summary.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  </>
                )}
                {!!draft.review_flags?.length && (
                  <div style={{ background: 'oklch(0.68 0.14 78 / 0.10)', border: '1px solid oklch(0.68 0.14 78 / 0.28)', borderRadius: 12, padding: 12, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.45, marginTop: 12 }}>
                    <strong style={{ color: 'var(--text)' }}>Review notes</strong>
                    <ul style={{ paddingLeft: 18, margin: '8px 0 0' }}>
                      {draft.review_flags.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  </div>
                )}
                {!!draft.follow_up_questions?.length && (
                  <div style={{ background: 'var(--accent-dim)', border: '1px solid oklch(0.50 0.19 248 / 0.22)', borderRadius: 12, padding: 12, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.45, marginTop: 12 }}>
                    <strong style={{ color: 'var(--text)' }}>Questions RolePitch still has</strong>
                    <ul style={{ paddingLeft: 18, margin: '8px 0 0' }}>
                      {draft.follow_up_questions.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  </div>
                )}
                <textarea
                  className="br-input"
                  rows={4}
                  value={revisionText}
                  onChange={e => setRevisionText(e.target.value)}
                  placeholder="Want changes? Say what to revise, then review again."
                  style={{ marginTop: 14 }}
                />
                {error && <ErrorBox message={error} />}
                <div className="br-actions" style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                  <button className="br-btn-primary" onClick={saveDraft} disabled={phase === 'saving'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {phase === 'saving' && <Spinner />}
                    {phase === 'saving' ? 'Saving...' : 'Apply update'}
                  </button>
                  <button className="br-btn-ghost" onClick={() => draftUpdate({ extraMessage: revisionText, useCurrentDraft: true })} disabled={phase === 'drafting' || !revisionText.trim()}>
                    {phase === 'drafting' ? 'Revising...' : 'Ask for changes'}
                  </button>
                  <button className="br-btn-ghost" onClick={() => setScreen('chat')}>Back</button>
                </div>
              </div>
              <div className="br-card" style={{ background: 'var(--bg)' }}>
                <ResumePreview resume={draft.resume} />
              </div>
            </section>
          )}

          {screen === 'upload' && (
            <section className="br-card">
              <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Upload latest PDF</div>
              <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: 16, padding: '42px 24px', textAlign: 'center', cursor: 'pointer', background: 'var(--bg)' }}>
                <input ref={fileRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] || null)} />
                <div style={{ fontSize: 34, marginBottom: 10 }}>↑</div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>{file ? file.name : 'Upload your latest resume'}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>This replaces the master resume used for future pitches.</div>
              </div>
              {error && <ErrorBox message={error} />}
              <div className="br-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button className="br-btn-ghost" onClick={() => setScreen('manager')}>Cancel</button>
                <button className="br-btn-primary" onClick={parseAndSave} disabled={phase === 'saving'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minWidth: 184 }}>
                  {phase === 'saving' && <Spinner />}
                  {phase === 'saving' ? 'Updating...' : 'Replace base resume'}
                </button>
              </div>
            </section>
          )}
        </main>
      </div>
    </>
  );
}

function ErrorBox({ message }) {
  if (!message) return null;
  return (
    <div style={{ marginTop: 14, background: 'oklch(0.65 0.2 30 / 0.08)', border: '1px solid oklch(0.65 0.2 30 / 0.24)', color: 'oklch(0.55 0.18 30)', borderRadius: 12, padding: 12, fontSize: 13 }}>
      {message}
    </div>
  );
}
