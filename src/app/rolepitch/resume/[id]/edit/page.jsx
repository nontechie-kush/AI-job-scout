'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const CSS = `
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
    --red: oklch(0.60 0.18 28);
    --red-dim: oklch(0.60 0.18 28 / 0.10);
    --text: oklch(0.16 0.03 248);
    --text-muted: oklch(0.44 0.04 248);
    --text-faint: oklch(0.62 0.03 248);
    --paper: oklch(1 0 0);
    --mono: 'JetBrains Mono', monospace;
    --sans: 'DM Sans', sans-serif;
  }
  .rp-editor { min-height: 100vh; background: var(--bg); color: var(--text); font-family: var(--sans); -webkit-font-smoothing: antialiased; }
  .rp-editor * { box-sizing: border-box; }
  .rp-top { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 13px 22px; background: oklch(0.98 0.006 248 / 0.94); border-bottom: 1px solid var(--border-subtle); backdrop-filter: blur(14px); }
  .rp-title-wrap { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .rp-back { background: transparent; border: none; color: var(--text-muted); cursor: pointer; font: inherit; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; padding: 8px 9px; border-radius: 8px; }
  .rp-back:hover { background: var(--surface); color: var(--text); }
  .rp-job-icon { width: 28px; height: 28px; border-radius: 7px; background: oklch(0.55 0.17 30 / 0.12); border: 1px solid oklch(0.55 0.17 30 / 0.3); color: oklch(0.55 0.17 30); display: flex; align-items: center; justify-content: center; font: 700 11px var(--mono); flex-shrink: 0; }
  .rp-h1 { font-size: 13.5px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rp-sub { font-size: 12px; color: var(--text-muted); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rp-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .rp-btn-primary, .rp-btn-secondary, .rp-btn-text, .rp-btn-danger { font-family: var(--sans); border-radius: 9px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 7px; font-weight: 600; transition: opacity .15s, background .15s, border-color .15s; }
  .rp-btn-primary { background: var(--accent); color: white; border: none; padding: 10px 16px; font-size: 13px; min-height: 38px; }
  .rp-btn-primary:hover { opacity: .9; }
  .rp-btn-primary:disabled { opacity: .5; cursor: not-allowed; }
  .rp-btn-secondary { background: var(--paper); color: var(--text); border: 1px solid var(--border); padding: 9px 14px; font-size: 13px; min-height: 38px; }
  .rp-btn-secondary:hover { background: var(--surface); border-color: oklch(0.75 0.02 248); }
  .rp-btn-text { background: transparent; border: none; color: var(--text-muted); padding: 8px 10px; font-size: 13px; }
  .rp-btn-text:hover { background: var(--surface); color: var(--text); }
  .rp-btn-danger { background: var(--red); color: white; border: none; padding: 10px 16px; font-size: 13px; }
  .rp-status { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted); padding: 4px 9px; border-radius: 999px; background: var(--surface); border: 1px solid var(--border-subtle); font-weight: 600; }
  .rp-status.saved { color: var(--green); background: var(--green-dim); border-color: oklch(0.55 0.17 155 / 0.25); }
  .rp-status.dirty { color: var(--amber); background: var(--amber-dim); border-color: oklch(0.60 0.16 80 / 0.25); }
  .rp-status.error { color: var(--red); background: var(--red-dim); border-color: oklch(0.60 0.18 28 / 0.25); }
  .rp-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .rp-main { display: grid; grid-template-columns: 220px minmax(0, 1fr) 520px; min-height: calc(100vh - 66px); }
  .rp-rail { border-right: 1px solid var(--border-subtle); padding: 20px 14px; display: flex; flex-direction: column; gap: 2px; }
  .rp-rail-label { font-size: 10.5px; font-weight: 700; color: var(--text-faint); letter-spacing: .08em; text-transform: uppercase; padding: 0 10px 8px; }
  .rp-rail button { border: none; background: transparent; color: var(--text); text-align: left; padding: 8px 10px; border-radius: 7px; font: 600 13px var(--sans); cursor: pointer; display: flex; align-items: center; justify-content: space-between; }
  .rp-rail button.active { background: var(--accent-dim); color: var(--accent); }
  .rp-help { margin-top: auto; border-top: 1px solid var(--border-subtle); padding: 12px 10px; color: var(--text-faint); font-size: 11.5px; line-height: 1.5; }
  .rp-editor-pane { padding: 24px 28px 110px; overflow-y: auto; }
  .rp-preview-pane { border-left: 1px solid var(--border-subtle); background: var(--surface); display: flex; flex-direction: column; min-width: 0; }
  .rp-preview-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 18px; border-bottom: 1px solid var(--border-subtle); }
  .rp-preview-scroll { padding: 24px 26px; overflow-y: auto; display: flex; justify-content: center; }
  .rp-section-title { font-size: 18px; font-weight: 700; letter-spacing: -.02em; margin: 0; }
  .rp-section-sub { color: var(--text-muted); font-size: 12.5px; margin: 4px 0 0; line-height: 1.5; }
  .rp-card { background: var(--paper); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-top: 16px; }
  .rp-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .rp-field { display: block; }
  .rp-label { display: block; color: var(--text-muted); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 6px; }
  .rp-input, .rp-textarea { width: 100%; border: 1px solid var(--border); border-radius: 8px; background: var(--paper); color: var(--text); font: 14px var(--sans); outline: none; padding: 10px 12px; }
  .rp-textarea { min-height: 120px; line-height: 1.55; resize: vertical; overflow: hidden; }
  .rp-textarea-large { min-height: 220px; }
  .rp-input:focus, .rp-textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim); }
  .rp-input.error { border-color: var(--red); }
  .rp-error-text { margin-top: 5px; color: var(--red); font-size: 11.5px; font-weight: 600; }
  .rp-role { background: var(--paper); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-top: 14px; }
  .rp-role-head { display: grid; grid-template-columns: 1.2fr 1.2fr .9fr .9fr; gap: 10px; margin-bottom: 14px; }
  .rp-bullets { display: flex; flex-direction: column; gap: 8px; }
  .rp-bullet { display: flex; gap: 8px; border: 1px solid var(--border); border-radius: 10px; padding: 10px 10px; background: var(--paper); }
  .rp-bullet-num { color: var(--text-faint); font: 600 12px var(--mono); padding-top: 8px; width: 22px; flex-shrink: 0; }
  .rp-bullet textarea { border: none; outline: none; background: transparent; color: var(--text); resize: vertical; width: 100%; min-height: 78px; line-height: 1.55; font: 13.5px var(--sans); overflow: hidden; }
  .rp-bullet-actions { display: flex; align-items: flex-start; }
  .rp-warning { display: flex; align-items: flex-start; gap: 10px; background: var(--amber-dim); border: 1px solid oklch(0.60 0.16 80 / 0.3); color: var(--text); border-radius: 11px; padding: 12px 14px; font-size: 13px; line-height: 1.5; margin-bottom: 14px; }
  .rp-alert { display: flex; align-items: flex-start; gap: 10px; background: var(--red-dim); border: 1px solid oklch(0.60 0.18 28 / 0.3); border-radius: 11px; padding: 12px 14px; margin-bottom: 14px; font-size: 13px; line-height: 1.5; }
  .rp-skills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .rp-chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border); background: var(--paper); border-radius: 999px; padding: 6px 9px 6px 11px; font-size: 12.5px; font-weight: 600; }
  .rp-paper { width: 440px; min-height: 620px; background: white; color: oklch(0.2 0.02 248); border: 1px solid var(--border); border-radius: 6px; box-shadow: 0 12px 38px oklch(0 0 0 / 0.08); padding: 28px 32px; font-family: Georgia, serif; }
  .rp-paper h2 { font-size: 22px; text-align: center; margin: 0 0 4px; letter-spacing: -.01em; }
  .rp-paper-contact { font-size: 9.5px; text-align: center; color: oklch(0.42 0.02 248); margin-bottom: 12px; }
  .rp-paper-sec { margin-top: 12px; }
  .rp-paper-sec-title { font-size: 10px; font-weight: 700; text-transform: uppercase; border-bottom: 1px solid oklch(0.55 0.02 248); padding-bottom: 3px; margin-bottom: 6px; letter-spacing: .05em; }
  .rp-paper p, .rp-paper li { font-size: 10px; line-height: 1.55; margin: 0 0 4px; }
  .rp-paper-role { margin-bottom: 8px; }
  .rp-paper-role-row { display: flex; justify-content: space-between; gap: 10px; font-size: 10.5px; font-weight: 700; }
  .rp-paper ul { margin: 4px 0 0; padding-left: 14px; }
  .rp-mobile-tabs, .rp-mobile-bottom { display: none; }
  .rp-modal-backdrop { position: fixed; inset: 0; z-index: 50; background: oklch(0 0 0 / .45); display: flex; align-items: center; justify-content: center; padding: 20px; }
  .rp-modal { width: min(420px, 100%); background: var(--bg); border: 1px solid var(--border); border-radius: 14px; padding: 22px; box-shadow: 0 20px 60px oklch(0 0 0 / .25); }
  @keyframes rp-spin { to { transform: rotate(360deg); } }
  .rp-spinner { width: 14px; height: 14px; border-radius: 50%; border: 2px solid currentColor; border-top-color: transparent; animation: rp-spin .75s linear infinite; display: inline-block; }
  .rp-skeleton { background: linear-gradient(90deg, var(--surface), var(--surface2), var(--surface)); background-size: 200% 100%; animation: rp-shimmer 1.2s linear infinite; border-radius: 10px; }
  @keyframes rp-shimmer { to { background-position: -200% 0; } }
  @media (max-width: 900px) {
    .rp-top { padding: 8px 14px 10px; }
    .rp-back span, .rp-job-icon, .rp-actions .rp-status, .rp-actions .rp-btn-secondary, .rp-actions .rp-btn-primary, .rp-actions .rp-btn-text { display: none; }
    .rp-main { display: block; min-height: auto; }
    .rp-rail { display: none; }
    .rp-mobile-tabs { display: flex; padding: 10px 14px 0; gap: 4px; }
    .rp-mobile-tabs button { flex: 1; border: 1px solid transparent; border-radius: 8px; padding: 9px 0; background: transparent; color: var(--text-muted); font: 700 13px var(--sans); }
    .rp-mobile-tabs button.active { background: var(--paper); color: var(--text); border-color: var(--border); }
    .rp-editor-pane { display: block; padding: 14px 14px 132px; }
    .rp-preview-pane { display: none; border-left: none; min-height: calc(100vh - 104px); }
    .rp-editor.mobile-preview .rp-editor-pane { display: none; }
    .rp-editor.mobile-preview .rp-preview-pane { display: flex; }
    .rp-preview-scroll { padding: 14px 14px 112px; background: var(--surface); }
    .rp-paper { width: 100%; max-width: 440px; transform-origin: top center; padding: 22px 24px; }
    .rp-role-head, .rp-grid { grid-template-columns: 1fr; }
    .rp-section-title { font-size: 17px; }
    .rp-card, .rp-role { padding: 18px 16px !important; }
    .rp-input, .rp-textarea, .rp-bullet textarea { font-size: 16px; }
    .rp-textarea { min-height: 260px; }
    .rp-textarea-large { min-height: min(420px, 48vh); }
    .rp-bullet { padding: 12px 10px; }
    .rp-bullet textarea { min-height: 150px; }
    .rp-mobile-bottom { display: block; position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; padding: 11px 14px calc(14px + env(safe-area-inset-bottom)); background: oklch(0.98 0.006 248 / .96); border-top: 1px solid var(--border-subtle); backdrop-filter: blur(12px); }
    .rp-mobile-bottom .rp-btn-primary { width: 100%; min-height: 48px; font-size: 14px; }
    .rp-mobile-hint { text-align: center; color: var(--text-muted); font-size: 11.5px; margin-bottom: 8px; }
  }
`;

const blankRole = () => ({ title: '', company: '', location: '', start_date: '', end_date: '', bullets: [{ text: '', type: 'achievement' }] });
const blankEducation = () => ({ degree: '', institution: '', location: '', start_date: '', end_date: '' });

function icon(name) {
  const paths = {
    back: <path d="M10 2L4 7l6 5" />,
    download: <><path d="M7 9V2" /><path d="M4 6.5l3 3 3-3" /><path d="M2 12h10" /></>,
    check: <path d="M3 7l3 3 5-7" />,
    plus: <><path d="M7 3v8" /><path d="M3 7h8" /></>,
    trash: <><path d="M2 4h10" /><path d="M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1" /><path d="M3.5 4l.5 8a1 1 0 001 1h4a1 1 0 001-1l.5-8" /></>,
  };
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</g></svg>;
}

function companyInitials(company) {
  return (company || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatDateRange(role) {
  return [role.start_date, role.end_date].filter(Boolean).join(' - ');
}

function textRows(text, charsPerLine, minRows, maxRows) {
  const lines = String(text || '').split('\n');
  const visualRows = lines.reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
  return Math.min(maxRows, Math.max(minRows, visualRows + 1));
}

function summaryRows(text) {
  return textRows(text, 42, 8, 18);
}

function bulletRows(text) {
  return textRows(text, 44, 5, 12);
}

function editVersionLabel(data) {
  if (!data?.has_edits || !data?.edited_at) return '';
  const time = new Date(data.edited_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return `Edit ${data.edit_count || 1} · ${time}`;
}

function normalizeForState(resume) {
  return {
    name: resume?.name || '',
    title: resume?.title || '',
    contact: resume?.contact || {},
    summary: resume?.summary || '',
    experience: Array.isArray(resume?.experience) && resume.experience.length ? resume.experience : [blankRole()],
    education: Array.isArray(resume?.education) ? resume.education : [],
    skills: Array.isArray(resume?.skills) ? resume.skills : [],
    before_score: resume?.before_score,
    after_score: resume?.after_score,
    highlights_used: resume?.highlights_used,
    bullets_rewritten: resume?.bullets_rewritten,
  };
}

function trimResume(resume) {
  return {
    ...resume,
    contact: Object.fromEntries(Object.entries(resume.contact || {}).filter(([, v]) => String(v || '').trim())),
    experience: (resume.experience || []).map((role) => ({
      ...role,
      title: role.title || '',
      company: role.company || '',
      location: role.location || '',
      start_date: role.start_date || null,
      end_date: role.end_date || null,
      bullets: (role.bullets || []).map((b) => ({ ...b, text: (b.text || '').trim() })).filter((b) => b.text),
    })).filter((role) => role.title || role.company || role.bullets.length),
    education: (resume.education || []).filter((ed) => ed.degree || ed.institution),
    skills: (resume.skills || []).map((s) => s.trim()).filter(Boolean),
  };
}

function ResumePreview({ resume }) {
  const contact = resume.contact || {};
  const contactLine = [contact.location, contact.phone, contact.email, contact.linkedin].filter(Boolean).join(' | ');
  return (
    <div className="rp-paper">
      <h2>{resume.name || 'Your Name'}</h2>
      <div className="rp-paper-contact">{contactLine}</div>
      <PaperSection title="Professional Summary">
        <p>{resume.summary || 'Your tailored summary will appear here.'}</p>
      </PaperSection>
      <PaperSection title="Experience">
        {(resume.experience || []).map((role, idx) => (
          <div className="rp-paper-role" key={idx}>
            <div className="rp-paper-role-row">
              <span>{[role.title, role.company].filter(Boolean).join(', ') || 'Role'}</span>
              <span>{formatDateRange(role)}</span>
            </div>
            {role.location && <p style={{ fontWeight: 700, textAlign: 'right' }}>{role.location}</p>}
            <ul>{(role.bullets || []).map((b, i) => <li key={i}>{b.text}</li>)}</ul>
          </div>
        ))}
      </PaperSection>
      <PaperSection title="Professional Skills">
        <p>{(resume.skills || []).join(' · ')}</p>
      </PaperSection>
      {!!resume.education?.length && (
        <PaperSection title="Education">
          {resume.education.map((ed, i) => (
            <p key={i}><strong>{ed.degree}</strong>{ed.institution ? `, ${ed.institution}` : ''}</p>
          ))}
        </PaperSection>
      )}
    </div>
  );
}

function PaperSection({ title, children }) {
  return <div className="rp-paper-sec"><div className="rp-paper-sec-title">{title}</div>{children}</div>;
}

export default function ResumeEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [data, setData] = useState(null);
  const [resume, setResume] = useState(null);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [status, setStatus] = useState('pristine');
  const [downloading, setDownloading] = useState(false);
  const [active, setActive] = useState('experience');
  const [mobileTab, setMobileTab] = useState('edit');
  const [showDiscard, setShowDiscard] = useState(false);

  const dirty = resume && savedSnapshot && JSON.stringify(resume) !== savedSnapshot;
  const storageKey = `rp_editor_pending_${id}`;

  useEffect(() => {
    const theme = localStorage.getItem('rp_theme') || 'light';
    document.documentElement.setAttribute('data-rp-theme', theme);
    fetch(`/api/rolepitch/tailored/${id}/edited`)
      .then(r => {
        if (r.status === 401) { window.location.href = `/rolepitch/auth?redirect=${encodeURIComponent(`/rolepitch/resume/${id}/edit`)}`; return null; }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        if (d.error) throw new Error(d.error);
        const normalized = normalizeForState(d.resume);
        let pendingResume = null;
        try {
          const pending = localStorage.getItem(storageKey);
          pendingResume = pending ? normalizeForState(JSON.parse(pending)) : null;
        } catch {
          localStorage.removeItem(storageKey);
        }
        const nextResume = pendingResume || normalized;
        setData(d);
        setResume(nextResume);
        setSavedSnapshot(JSON.stringify(normalized));
        setStatus(pendingResume ? 'dirty' : 'pristine');
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [id, storageKey]);

  useEffect(() => {
    if (!resume) return;
    if (!dirty) {
      localStorage.removeItem(storageKey);
      return;
    }
    localStorage.setItem(storageKey, JSON.stringify(resume));
  }, [resume, dirty, storageKey]);

  useEffect(() => {
    const handler = (e) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const currentStatus = status === 'saving' ? 'saving' : saveError ? 'error' : dirty ? 'dirty' : status === 'saved' ? 'saved' : 'pristine';
  const roleLabel = [data?.jd?.title, data?.jd?.company].filter(Boolean).join(' · ') || 'Tailored resume';
  const versionLabel = editVersionLabel(data);

  const validation = useMemo(() => {
    if (!resume) return null;
    if (!resume.name?.trim()) return 'Name is required.';
    const invalidRole = (resume.experience || []).find((role) => !role.title?.trim() && (role.company || role.bullets?.length));
    if (invalidRole) return 'Role title is required.';
    return null;
  }, [resume]);

  const mutateResume = (updater) => {
    setSaveError('');
    if (status !== 'saving') setStatus('dirty');
    setResume(updater);
  };

  const update = (patch) => mutateResume((r) => ({ ...r, ...patch }));
  const updateContact = (key, value) => mutateResume((r) => ({ ...r, contact: { ...(r.contact || {}), [key]: value } }));
  const updateRole = (idx, patch) => mutateResume((r) => ({ ...r, experience: r.experience.map((role, i) => i === idx ? { ...role, ...patch } : role) }));
  const updateBullet = (roleIdx, bulletIdx, text) => mutateResume((r) => ({
    ...r,
    experience: r.experience.map((role, i) => i === roleIdx ? {
      ...role,
      bullets: role.bullets.map((b, j) => j === bulletIdx ? { ...b, text } : b),
    } : role),
  }));

  const save = async () => {
    if (validation) return;
    setStatus('saving');
    setSaveError('');
    try {
      const payload = trimResume(resume);
      const res = await fetch(`/api/rolepitch/tailored/${id}/edited`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume: payload }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || json.error || 'Could not save edits');
      const normalized = normalizeForState(json.resume);
      setResume(normalized);
      setSavedSnapshot(JSON.stringify(normalized));
      setData((d) => ({ ...d, updated_at: json.updated_at, edited_at: json.edited_at, edit_count: json.edit_count, has_edits: true }));
      localStorage.removeItem(storageKey);
      setStatus('saved');
    } catch (e) {
      setSaveError(e.message);
      setStatus('error');
    }
  };

  const download = async () => {
    setDownloading(true);
    setSaveError('');
    try {
      const res = await fetch(`/api/rolepitch/download-pdf?tailored_resume_id=${id}`, {
        headers: { Accept: 'text/html,application/json' },
      });

      if (res.redirected && res.url.includes('/rolepitch/start')) {
        window.location.href = res.url;
        return;
      }

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || json.error || 'Could not prepare PDF');
      }

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
    } catch (e) {
      setSaveError(e.message || 'Could not prepare PDF');
    } finally {
      setDownloading(false);
    }
  };

  const handleBack = () => {
    if (dirty) setShowDiscard(true);
    else router.push('/rolepitch/dashboard');
  };

  if (loading) return <><style>{CSS}</style><LoadingEditor /></>;
  if (error || !resume) return <><style>{CSS}</style><div className="rp-editor" style={{ display: 'grid', placeItems: 'center', padding: 24 }}><div style={{ textAlign: 'center' }}><p style={{ color: 'var(--red)' }}>{error || 'Resume not found'}</p><button className="rp-btn-secondary" onClick={() => router.push('/rolepitch/dashboard')}>Back to dashboard</button></div></div></>;

  return (
    <>
      <style>{CSS}</style>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
      <div className={`rp-editor ${mobileTab === 'preview' ? 'mobile-preview' : ''}`}>
        <div className="rp-top">
          <div className="rp-title-wrap">
            <button className="rp-back" onClick={handleBack}>{icon('back')}<span>All pitches</span></button>
            <div className="rp-job-icon">{companyInitials(data?.jd?.company)}</div>
            <div style={{ minWidth: 0 }}>
              <div className="rp-h1">Edit your tailored resume</div>
              <div className="rp-sub">{versionLabel ? `${versionLabel} · ${roleLabel}` : roleLabel}</div>
            </div>
          </div>
          <div className="rp-actions">
            <StatusPill state={currentStatus} />
            <button className="rp-btn-text" onClick={handleBack}>Cancel</button>
            {(currentStatus === 'pristine' || currentStatus === 'dirty' || currentStatus === 'saving') && <button className="rp-btn-secondary" onClick={download} disabled={downloading}>{downloading ? <span className="rp-spinner" /> : icon('download')} {downloading ? 'Preparing PDF...' : 'Download current PDF'}</button>}
            {currentStatus !== 'pristine' && (
              <button className="rp-btn-primary" onClick={currentStatus === 'saved' ? download : save} disabled={downloading || currentStatus === 'saving' || !!validation || (currentStatus !== 'saved' && data.migration_required)}>
                {currentStatus === 'saving' || downloading ? <span className="rp-spinner" /> : currentStatus === 'saved' ? icon('download') : icon('check')}
                {downloading ? 'Preparing PDF...' : currentStatus === 'saved' ? 'Download updated PDF' : currentStatus === 'error' ? 'Retry save' : currentStatus === 'saving' ? 'Saving...' : 'Save changes'}
              </button>
            )}
          </div>
        </div>

        <div className="rp-mobile-tabs">
          <button className={mobileTab === 'edit' ? 'active' : ''} onClick={() => setMobileTab('edit')}>Edit</button>
          <button className={mobileTab === 'preview' ? 'active' : ''} onClick={() => setMobileTab('preview')}>Preview</button>
        </div>

        <div className="rp-main">
          <aside className="rp-rail">
            <div className="rp-rail-label">Sections</div>
            {['header', 'summary', 'experience', 'skills', 'education'].map((key) => (
              <button key={key} className={active === key ? 'active' : ''} onClick={() => setActive(key)}>
                <span>{sectionLabel(key)}</span>{dirty && <span className="rp-dot" style={{ color: 'var(--amber)' }} />}
              </button>
            ))}
            <div className="rp-help"><strong style={{ color: 'var(--text-muted)' }}>Layout preserved</strong><br />Metrics and key outcomes are auto-formatted after save.</div>
          </aside>

          <main className="rp-editor-pane">
            {versionLabel && !dirty && (
              <div className="rp-warning" style={{ background: 'var(--green-dim)', borderColor: 'oklch(0.55 0.17 155 / 0.28)' }}>
                <strong>{versionLabel}</strong><span>This saved edit is the version used by Download current PDF.</span>
              </div>
            )}
            {!data.layout_available && <LayoutWarning />}
            {data.migration_required && <div className="rp-alert"><strong>Editor setup is pending.</strong><span>The resume can be viewed, but saving edits needs the production database migration.</span></div>}
            {saveError && <div className="rp-alert"><strong>Couldn&apos;t save that.</strong><span>Your edits are still here. {saveError}</span></div>}
            {validation && <div className="rp-warning">{validation}</div>}
            <SectionTabs active={active} setActive={setActive} />
            {active === 'header' && <HeaderSection resume={resume} update={update} updateContact={updateContact} />}
            {active === 'summary' && <SummarySection resume={resume} update={update} />}
            {active === 'experience' && <ExperienceSection resume={resume} updateRole={updateRole} updateBullet={updateBullet} setResume={mutateResume} />}
            {active === 'skills' && <SkillsSection resume={resume} update={update} />}
            {active === 'education' && <EducationSection resume={resume} setResume={mutateResume} />}
          </main>

          <aside className="rp-preview-pane">
            <div className="rp-preview-head">
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>{dirty ? 'Preview · last unsaved edits' : 'Preview · saved version'}</div>
              {dirty && <span className="rp-status dirty">Save to rebuild PDF</span>}
            </div>
            <div className="rp-preview-scroll"><ResumePreview resume={resume} /></div>
          </aside>
        </div>

        <div className="rp-mobile-bottom">
          <div className="rp-mobile-hint">{downloading ? 'Keeping this page open while the PDF is prepared' : currentStatus === 'pristine' ? (versionLabel || 'Tap a section to make edits') : currentStatus === 'dirty' ? 'Save before downloading the updated PDF' : versionLabel}</div>
          <button className="rp-btn-primary" onClick={currentStatus === 'dirty' || currentStatus === 'error' ? save : download} disabled={downloading || currentStatus === 'saving' || ((currentStatus === 'dirty' || currentStatus === 'error') && (!!validation || data.migration_required))}>
            {currentStatus === 'saving' || downloading ? <span className="rp-spinner" /> : currentStatus === 'dirty' || currentStatus === 'error' ? icon('check') : icon('download')}
            {downloading ? 'Preparing PDF...' : currentStatus === 'dirty' ? 'Save changes' : currentStatus === 'error' ? 'Retry save' : currentStatus === 'saving' ? 'Saving...' : currentStatus === 'saved' ? 'Download updated PDF' : 'Download current PDF'}
          </button>
        </div>
      </div>

      {showDiscard && (
        <div className="rp-modal-backdrop">
          <div className="rp-modal">
            <h3 style={{ margin: 0, fontSize: 17 }}>Discard your edits?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.55 }}>Leaving now will throw away your unsaved changes.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button className="rp-btn-secondary" onClick={() => setShowDiscard(false)}>Keep editing</button>
              <button className="rp-btn-danger" onClick={() => router.push('/rolepitch/dashboard')}>Discard</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function sectionLabel(key) {
  return { header: 'Header & contact', summary: 'Summary', experience: 'Experience', skills: 'Skills', education: 'Education' }[key];
}

function StatusPill({ state }) {
  if (state === 'saved') return <span className="rp-status saved">{icon('check')} Saved</span>;
  if (state === 'dirty') return <span className="rp-status dirty"><span className="rp-dot" /> Unsaved changes</span>;
  if (state === 'error') return <span className="rp-status error">Save failed</span>;
  if (state === 'saving') return <span className="rp-status"><span className="rp-spinner" /> Saving...</span>;
  return <span className="rp-status"><span className="rp-dot" /> No changes yet</span>;
}

function SectionTabs({ active, setActive }) {
  const keys = ['header', 'summary', 'experience', 'skills', 'education'];
  return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>{keys.map(k => <button key={k} className={active === k ? 'rp-btn-primary' : 'rp-btn-secondary'} onClick={() => setActive(k)}>{sectionLabel(k)}</button>)}</div>;
}

function HeaderSection({ resume, update, updateContact }) {
  return (
    <section>
      <h2 className="rp-section-title">Header & contact</h2>
      <p className="rp-section-sub">Name, title, and contact details shown at the top of the resume.</p>
      <div className="rp-card rp-grid">
        <Field label="Name" value={resume.name} onChange={(v) => update({ name: v })} required />
        <Field label="Headline" value={resume.title} onChange={(v) => update({ title: v })} />
        <Field label="Location" value={resume.contact?.location || ''} onChange={(v) => updateContact('location', v)} />
        <Field label="Phone" value={resume.contact?.phone || ''} onChange={(v) => updateContact('phone', v)} />
        <Field label="Email" value={resume.contact?.email || ''} onChange={(v) => updateContact('email', v)} />
        <Field label="LinkedIn / portfolio" value={resume.contact?.linkedin || ''} onChange={(v) => updateContact('linkedin', v)} />
      </div>
    </section>
  );
}

function SummarySection({ resume, update }) {
  return (
    <section>
      <h2 className="rp-section-title">Summary</h2>
      <p className="rp-section-sub">Keep it tight. Long summaries may push content to another line.</p>
      <div className="rp-card">
        <label className="rp-field"><span className="rp-label">Professional summary</span><textarea className="rp-textarea rp-textarea-large" value={resume.summary} onChange={(e) => update({ summary: e.target.value })} rows={summaryRows(resume.summary)} /></label>
      </div>
    </section>
  );
}

function ExperienceSection({ resume, updateRole, updateBullet, setResume }) {
  const addRole = () => setResume((r) => ({ ...r, experience: [...r.experience, blankRole()] }));
  const removeRole = (idx) => setResume((r) => ({ ...r, experience: r.experience.filter((_, i) => i !== idx) }));
  const addBullet = (idx) => setResume((r) => ({ ...r, experience: r.experience.map((role, i) => i === idx ? { ...role, bullets: [...(role.bullets || []), { text: '', type: 'achievement' }] } : role) }));
  const removeBullet = (roleIdx, bulletIdx) => setResume((r) => ({ ...r, experience: r.experience.map((role, i) => i === roleIdx ? { ...role, bullets: role.bullets.filter((_, j) => j !== bulletIdx) } : role) }));
  return (
    <section>
      <h2 className="rp-section-title">Experience</h2>
      <p className="rp-section-sub">Edit in plain text. Metrics and key outcomes are auto-formatted after save.</p>
      {resume.experience.map((role, idx) => (
        <div className="rp-role" key={idx}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
            <strong style={{ fontSize: 14 }}>Role {idx + 1}</strong>
            {resume.experience.length > 1 && <button className="rp-btn-text" onClick={() => removeRole(idx)}>{icon('trash')} Remove role</button>}
          </div>
          <div className="rp-role-head">
            <Field label="Role" value={role.title || ''} onChange={(v) => updateRole(idx, { title: v })} required />
            <Field label="Company" value={role.company || ''} onChange={(v) => updateRole(idx, { company: v })} />
            <Field label="Location" value={role.location || ''} onChange={(v) => updateRole(idx, { location: v })} />
            <Field label="Dates" value={formatDateRange(role)} onChange={(v) => {
              const [start, end] = v.split(/\s+-\s+|\s+to\s+/i);
              updateRole(idx, { start_date: start || v, end_date: end || '' });
            }} />
          </div>
          <span className="rp-label">Bullets · {(role.bullets || []).length}</span>
          <div className="rp-bullets">
            {(role.bullets || []).map((bullet, bIdx) => (
              <div className="rp-bullet" key={bIdx}>
                <div className="rp-bullet-num">{bIdx + 1}</div>
                <textarea value={bullet.text || ''} onChange={(e) => updateBullet(idx, bIdx, e.target.value)} rows={bulletRows(bullet.text)} />
                <div className="rp-bullet-actions"><button className="rp-btn-text" title="Delete bullet" onClick={() => removeBullet(idx, bIdx)}>{icon('trash')}</button></div>
              </div>
            ))}
          </div>
          <button className="rp-btn-secondary" style={{ marginTop: 10 }} onClick={() => addBullet(idx)}>{icon('plus')} Add bullet</button>
        </div>
      ))}
      <button className="rp-btn-secondary" style={{ marginTop: 14 }} onClick={addRole}>{icon('plus')} Add another role</button>
    </section>
  );
}

function SkillsSection({ resume, update }) {
  const [draft, setDraft] = useState('');
  const addSkill = () => {
    const value = draft.trim();
    if (!value) return;
    update({ skills: [...(resume.skills || []), value] });
    setDraft('');
  };
  return (
    <section>
      <h2 className="rp-section-title">Skills</h2>
      <p className="rp-section-sub">Add or remove skills that should appear on this resume.</p>
      <div className="rp-card">
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="rp-input" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addSkill(); }} placeholder="Add skill" />
          <button className="rp-btn-secondary" onClick={addSkill}>{icon('plus')} Add</button>
        </div>
        <div className="rp-skills">{(resume.skills || []).map((s, i) => <span className="rp-chip" key={`${s}-${i}`}>{s}<button className="rp-btn-text" style={{ padding: 0 }} onClick={() => update({ skills: resume.skills.filter((_, idx) => idx !== i) })}>×</button></span>)}</div>
      </div>
    </section>
  );
}

function EducationSection({ resume, setResume }) {
  const updateEd = (idx, patch) => setResume((r) => ({ ...r, education: r.education.map((ed, i) => i === idx ? { ...ed, ...patch } : ed) }));
  return (
    <section>
      <h2 className="rp-section-title">Education</h2>
      <p className="rp-section-sub">Edit education details or add another entry.</p>
      {(resume.education || []).map((ed, idx) => (
        <div className="rp-card rp-grid" key={idx}>
          <Field label="Degree" value={ed.degree || ''} onChange={(v) => updateEd(idx, { degree: v })} />
          <Field label="Institution" value={ed.institution || ''} onChange={(v) => updateEd(idx, { institution: v })} />
          <Field label="Location" value={ed.location || ''} onChange={(v) => updateEd(idx, { location: v })} />
          <Field label="Dates" value={[ed.start_date, ed.end_date].filter(Boolean).join(' - ')} onChange={(v) => updateEd(idx, { start_date: v, end_date: '' })} />
        </div>
      ))}
      <button className="rp-btn-secondary" style={{ marginTop: 14 }} onClick={() => setResume((r) => ({ ...r, education: [...(r.education || []), blankEducation()] }))}>{icon('plus')} Add education</button>
    </section>
  );
}

function Field({ label, value, onChange, required }) {
  const showError = required && !String(value || '').trim();
  return <label className="rp-field"><span className="rp-label">{label}</span><input className={`rp-input ${showError ? 'error' : ''}`} value={value || ''} onChange={(e) => onChange(e.target.value)} />{showError && <span className="rp-error-text">{label} is required</span>}</label>;
}

function LayoutWarning() {
  return <div className="rp-warning"><strong>To keep your original layout, re-upload your CV.</strong><span>Edits will save, but rebuilding a layout-preserved PDF needs the original resume layout.</span></div>;
}

function LoadingEditor() {
  return <div className="rp-editor"><div className="rp-top"><div className="rp-skeleton" style={{ width: 240, height: 28 }} /><div className="rp-skeleton" style={{ width: 220, height: 34 }} /></div><div className="rp-main"><div className="rp-rail"><div className="rp-skeleton" style={{ height: 280 }} /></div><div className="rp-editor-pane"><div className="rp-skeleton" style={{ height: 34, width: 260, marginBottom: 18 }} /><div className="rp-skeleton" style={{ height: 420 }} /></div><div className="rp-preview-pane"><div className="rp-preview-scroll"><div className="rp-skeleton" style={{ width: 420, height: 620 }} /></div></div></div></div>;
}
