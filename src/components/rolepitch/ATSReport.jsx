'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { track } from '@/components/PostHogProvider';
import { buildAtsReportViewModel, getAtsBand } from '@/lib/rolepitch/ats-report-view-model';

const ATS_REPORT_CSS = `
  :root {
    --paper: oklch(1 0 0);
    --amber: oklch(0.60 0.16 80);
    --amber-dim: oklch(0.60 0.16 80 / 0.10);
  }
  [data-rc-theme="dark"], [data-rp-theme="dark"] {
    --paper: oklch(0.99 0.003 248);
    --amber: oklch(0.78 0.16 80);
    --amber-dim: oklch(0.78 0.16 80 / 0.12);
  }
  .ats-page { color: var(--text); }
  .ats-page * { box-sizing: border-box; }
  .ats-body { max-width: 1080px; margin: 0 auto; padding: 0 0 118px; }
  .ats-section { scroll-margin-top: 84px; }
  .ats-section + .ats-section { margin-top: 32px; }
  .ats-eyebrow { display: flex; align-items: center; gap: 10px; font-family: var(--mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 11px; font-weight: 700; color: var(--text-muted); letter-spacing: .12em; text-transform: uppercase; }
  .ats-eyebrow .num { color: var(--accent); }
  .ats-eyebrow .dash { width: 18px; height: 1px; background: var(--border); }
  .ats-hero { display: grid; grid-template-columns: 180px minmax(0, 1fr) 320px; gap: 32px; align-items: center; padding: 32px 36px; background: var(--paper); border: 1px solid var(--border); border-radius: 18px; }
  .ats-hero h1 { font-size: clamp(22px, 3vw, 34px); line-height: 1.12; letter-spacing: -.035em; font-weight: 800; margin: 10px 0 0; max-width: 560px; }
  .ats-hero p { font-size: 15px; color: var(--text-muted); line-height: 1.55; margin: 10px 0 0; max-width: 560px; }
  .ats-target-chip { margin-top: 18px; display: inline-flex; align-items: center; gap: 9px; padding: 8px 12px 8px 9px; background: var(--surface); border: 1px solid var(--border); border-radius: 999px; font-size: 12.5px; color: var(--text-muted); max-width: 100%; }
  .ats-target-chip strong { color: var(--text); }
  .ats-metrics { display: flex; flex-direction: column; gap: 13px; }
  .ats-metric-row { display: grid; grid-template-columns: minmax(0, 1fr) 34px; gap: 10px; align-items: center; }
  .ats-bar { height: 4px; border-radius: 999px; background: var(--border-subtle); overflow: hidden; margin-top: 6px; }
  .ats-bar span { display: block; height: 100%; border-radius: inherit; }
  .ats-sec-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-bottom: 16px; }
  .ats-sec-head h2 { font-size: clamp(20px, 2.4vw, 27px); font-weight: 800; letter-spacing: -.03em; line-height: 1.16; margin: 10px 0 0; }
  .ats-sec-head p { font-size: 14px; color: var(--text-muted); line-height: 1.55; margin: 6px 0 0; max-width: 640px; }
  .ats-counter { font-family: var(--mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 11px; color: var(--text-faint); letter-spacing: .08em; white-space: nowrap; }
  .ats-blockers { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .ats-blocker { display: flex; flex-direction: column; gap: 10px; padding: 20px; background: var(--paper); border: 1px solid var(--border); border-radius: 14px; min-height: 220px; }
  .ats-severity { display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: 999px; font-family: var(--mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 10px; font-weight: 700; letter-spacing: .1em; }
  .ats-affected { font-family: var(--mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 11px; color: var(--text-muted); letter-spacing: .04em; background: transparent; border: none; cursor: pointer; padding: 5px 8px; margin: -5px -8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px; transition: color .15s, background .15s; }
  .ats-affected:hover { color: var(--accent); background: var(--accent-dim); }
  .ats-affected .arrow { opacity: 0; transform: translateX(-3px); transition: opacity .15s, transform .15s; }
  .ats-affected:hover .arrow { opacity: 1; transform: translateX(0); }
  .ats-proof-wrap { padding: 24px; background: var(--paper); border: 1px solid var(--border); border-radius: 16px; }
  .ats-before-after { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .ats-proof-card { padding: 16px; border-radius: 12px; }
  .ats-why { grid-column: 1 / -1; display: flex; gap: 10px; padding: 10px 14px; background: var(--surface); border: 1px solid var(--border-subtle); border-radius: 10px; }
  .ats-cta { padding: 28px 32px; background: linear-gradient(180deg, oklch(0.50 0.19 248 / .06), oklch(0.50 0.19 248 / .02)); border: 1px solid oklch(0.50 0.19 248 / .20); border-radius: 16px; display: flex; align-items: center; gap: 28px; flex-wrap: wrap; }
  .ats-cta-body { flex: 1; min-width: 260px; }
  .ats-cta h2 { font-size: clamp(19px, 2.2vw, 23px); font-weight: 800; letter-spacing: -.025em; line-height: 1.2; margin: 0; }
  .ats-cta p { font-size: 14px; color: var(--text-muted); margin: 8px 0 0; line-height: 1.55; max-width: 620px; }
  .ats-cta-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 7px; }
  .ats-btn-primary, .ats-btn-text, .ats-btn-outline { font-family: var(--sans); border-radius: 10px; cursor: pointer; font-weight: 700; transition: opacity .15s, background .15s, border-color .15s; }
  .ats-btn-primary { background: var(--accent); color: white; border: none; padding: 13px 24px; font-size: 14px; }
  .ats-btn-primary:hover { opacity: .9; }
  .ats-btn-text { color: var(--text-muted); background: transparent; border: none; padding: 7px 8px; font-size: 13px; }
  .ats-btn-outline { color: var(--accent); background: transparent; border: 1px solid var(--accent); padding: 11px 18px; font-size: 13px; }
  .ats-acc { display: flex; flex-direction: column; gap: 10px; }
  .ats-acc-row { background: var(--paper); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; transition: border-color .15s, box-shadow .15s; }
  .ats-acc-row.is-flash { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim); }
  .ats-acc-head { display: flex; align-items: center; gap: 12px; padding: 16px 20px; cursor: pointer; background: transparent; border: none; width: 100%; text-align: left; color: var(--text); }
  .ats-acc-head:hover { background: var(--surface); }
  .ats-acc-head .num { font-family: var(--mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 10.5px; font-weight: 700; color: var(--text-faint); letter-spacing: .1em; }
  .ats-acc-head .title { font-size: 15px; font-weight: 700; letter-spacing: -.01em; }
  .ats-acc-head .count { margin-left: 4px; font-size: 12px; color: var(--text-faint); font-family: var(--mono, ui-monospace, SFMono-Regular, Menlo, monospace); }
  .ats-acc-head .chev { margin-left: auto; color: var(--text-muted); transition: transform .2s; display: inline-flex; }
  .ats-acc-row.is-open .chev { transform: rotate(90deg); }
  .ats-acc-body { padding: 6px 20px 20px; border-top: 1px solid var(--border-subtle); animation: ats-rise .25s ease-out; }
  .ats-acc-body.collapsed { display: none; }
  .ats-rail { position: fixed; top: 50%; right: 32px; transform: translateY(-50%); z-index: 5; display: flex; flex-direction: column; gap: 14px; }
  .ats-rail-step { display: flex; align-items: center; gap: 10px; cursor: pointer; font-family: var(--mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 10.5px; font-weight: 700; color: var(--text-faint); letter-spacing: .10em; text-transform: uppercase; background: transparent; border: none; padding: 0; transition: color .15s; }
  .ats-rail-step .tick { width: 18px; height: 1px; background: var(--border); transition: background .15s, width .15s; }
  .ats-rail-step.active { color: var(--accent); }
  .ats-rail-step.active .tick { background: var(--accent); width: 28px; }
  .ats-mobile-sticky { position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; padding: 10px 14px calc(14px + env(safe-area-inset-bottom)); background: oklch(from var(--bg) l c h / .96); backdrop-filter: blur(10px); border-top: 1px solid var(--border); box-shadow: 0 -8px 24px oklch(0 0 0 / .05); display: none; }
  .ats-mobile-sticky .ats-btn-primary { width: 100%; padding: 14px 16px; }
  @keyframes ats-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @media (max-width: 1180px) { .ats-rail { display: none; } }
  @media (max-width: 980px) { .ats-hero { grid-template-columns: 150px minmax(0, 1fr); } .ats-metrics { display: none; } }
  @media (max-width: 900px) { .ats-blockers { grid-template-columns: 1fr; } }
  @media (max-width: 720px) {
    .ats-body { padding-bottom: 140px; }
    .ats-section + .ats-section { margin-top: 24px; }
    .ats-hero { grid-template-columns: 100px minmax(0, 1fr); gap: 16px; padding: 18px; border-radius: 14px; }
    .ats-hero p { display: none; }
    .ats-target-chip { margin-top: 10px; padding: 6px 9px; font-size: 11.5px; }
    .ats-sec-head { flex-direction: column; align-items: flex-start; gap: 4px; }
    .ats-counter { display: none; }
    .ats-proof-wrap { padding: 14px; border-radius: 12px; }
    .ats-before-after { grid-template-columns: 1fr; }
    .ats-why { grid-column: 1; }
    .ats-cta { padding: 18px; border-radius: 14px; }
    .ats-cta-actions { width: 100%; align-items: stretch; }
    .ats-mobile-sticky { display: block; }
  }
`;

function severityTone(level) {
  if (level === 'high') return { bg: 'var(--red-dim)', fg: 'var(--red)', border: 'oklch(0.60 0.18 28 / .30)', label: 'HIGH' };
  if (level === 'medium') return { bg: 'var(--amber-dim)', fg: 'var(--amber)', border: 'oklch(0.60 0.16 80 / .30)', label: 'MEDIUM' };
  return { bg: 'var(--surface)', fg: 'var(--text-muted)', border: 'var(--border)', label: 'LOW' };
}

function emph(text) {
  const parts = [];
  let last = 0;
  let k = 0;
  const re = /\*\*([^*]+)\*\*/g;
  let m;
  while ((m = re.exec(text || '')) !== null) {
    if (m.index > last) parts.push(String(text).slice(last, m.index));
    parts.push(<strong key={k++}>{m[1]}</strong>);
    last = m.index + m[0].length;
  }
  if (text && last < String(text).length) parts.push(String(text).slice(last));
  return parts;
}

function MetricBar({ score, color }) {
  return <div className="ats-bar"><span style={{ width: `${score}%`, background: color || getAtsBand(score).color }} /></div>;
}

function ScoreGauge({ score }) {
  const [shown, setShown] = useState(score);
  const band = getAtsBand(shown);
  const size = 148;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (shown / 100);

  useEffect(() => {
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) { setShown(score); return; }
    let raf;
    const start = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - start) / 900);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(score * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  return (
    <div aria-label={`ATS score ${score} out of 100, ${band.label.toLowerCase()}`} style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--border)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={band.color} strokeWidth={stroke} strokeLinecap="round" fill="none" strokeDasharray={`${dash} ${c - dash}`} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
        <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-.06em', color: 'var(--text)' }}>{shown}</div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)', fontFamily: 'var(--mono, monospace)', marginTop: 2 }}>/100</div>
        <div style={{ marginTop: 8, fontSize: 11, fontFamily: 'var(--mono, monospace)', fontWeight: 800, letterSpacing: '.12em', color: band.color }}>{band.label}</div>
      </div>
    </div>
  );
}

function StepEyebrow({ n, children }) {
  return <div className="ats-eyebrow"><span className="num">{String(n).padStart(2, '0')}</span><span className="dash" /><span>{children}</span></div>;
}

function SeverityPill({ level }) {
  const tone = severityTone(level);
  return <span className="ats-severity" style={{ background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}` }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />{tone.label}</span>;
}

function BlockerCard({ blocker, n, onOpen }) {
  return (
    <div className="ats-blocker">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontFamily: 'var(--mono, monospace)', fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '.10em' }}>BLOCKER {String(n).padStart(2, '0')}</div>
        <SeverityPill level={blocker.severity} />
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1.25 }}>{blocker.title}</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55 }}>{blocker.explanation}</div>
      <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px dashed var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button className="ats-affected" type="button" onClick={() => onOpen(blocker.affectedRowId, 'blocker_card')}><span className="arrow">→</span>{blocker.affected}</button>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>{blocker.meta}</div>
      </div>
    </div>
  );
}

function BeforeAfterPair({ proof }) {
  return (
    <div className="ats-before-after">
      <div className="ats-proof-card" style={{ background: 'oklch(0.60 0.18 28 / .06)', border: '1px solid oklch(0.60 0.18 28 / .18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
          <span style={{ fontFamily: 'var(--mono, monospace)', fontSize: 10.5, fontWeight: 800, letterSpacing: '.14em', color: 'var(--red)' }}>BEFORE</span>
          <span style={{ fontFamily: 'var(--mono, monospace)', fontSize: 10, color: 'var(--text-faint)', letterSpacing: '.06em' }}>YOUR RESUME</span>
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>{proof.before}</div>
      </div>
      <div className="ats-proof-card" style={{ background: 'oklch(0.55 0.17 155 / .07)', border: '1px solid oklch(0.55 0.17 155 / .22)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
          <span style={{ fontFamily: 'var(--mono, monospace)', fontSize: 10.5, fontWeight: 800, letterSpacing: '.14em', color: 'var(--green)' }}>AFTER</span>
          <span style={{ fontFamily: 'var(--mono, monospace)', fontSize: 10, color: 'var(--text-faint)', letterSpacing: '.06em' }}>ROLEPITCH REWRITE</span>
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>{emph(proof.after)}</div>
      </div>
      <div className="ats-why">
        <span style={{ flexShrink: 0, fontFamily: 'var(--mono, monospace)', fontSize: 10.5, fontWeight: 800, letterSpacing: '.10em', color: 'var(--accent)', paddingTop: 1 }}>WHY</span>
        <span style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55 }}>{proof.why}</span>
      </div>
    </div>
  );
}

function DetailRow({ id, eyebrow, title, count, open, flash, onToggle, children }) {
  return (
    <div className={`ats-acc-row ${open ? 'is-open' : ''} ${flash ? 'is-flash' : ''}`} id={`row-${id}`}>
      <button type="button" className="ats-acc-head" onClick={onToggle} aria-expanded={open}>
        <span className="num">{eyebrow}</span>
        <span className="title">{title}</span>
        {count && <span className="count">{count}</span>}
        <span className="chev">›</span>
      </button>
      <div className={`ats-acc-body ${open ? '' : 'collapsed'}`}>{children}</div>
    </div>
  );
}

function StepRail({ active, onJump }) {
  const steps = [['score', 'Score'], ['blockers', 'Blockers'], ['proof', 'Proof'], ['cta', 'Action'], ['detail', 'Detail']];
  return (
    <div className="ats-rail" aria-hidden="true">
      {steps.map(([id, label], index) => (
        <button key={id} type="button" className={`ats-rail-step ${active === id ? 'active' : ''}`} onClick={() => onJump(id)}>
          <span className="tick" />
          {String(index + 1).padStart(2, '0')} · {label}
        </button>
      ))}
    </div>
  );
}

function SectionScore({ section }) {
  const band = getAtsBand(section.score);
  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 7 }}>
        <strong style={{ fontSize: 14 }}>{section.name}</strong>
        <span style={{ fontSize: 13, fontWeight: 800, color: band.color }}>{section.score}/100</span>
      </div>
      <MetricBar score={section.score} color={band.color} />
      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, margin: '8px 0 0' }}>{section.feedback || section.note}</p>
    </div>
  );
}

export default function ATSReport({ critique, critiqueId, targetContext, createdAt, expiresAt, onTailor, shareUrl, onShare, isShared = false }) {
  const vm = useMemo(() => buildAtsReportViewModel({ critique, critiqueId, targetContext, createdAt, expiresAt }), [critique, critiqueId, targetContext, createdAt, expiresAt]);
  const [openRows, setOpenRows] = useState({ working: true, fixes: true, sections: false, summary: false, rewrites: false, gap: false });
  const [flashRow, setFlashRow] = useState(null);
  const [active, setActive] = useState('score');
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    track('ats_report_viewed', {
      critique_id: vm.id,
      score: vm.score,
      score_band: vm.band.label,
      has_target: !!vm.targetRole,
      target_fit_score: vm.targetFit?.score ?? null,
      source: isShared ? 'shared_report' : 'critique_flow',
    });
  }, [isShared, vm]);

  useEffect(() => {
    const ids = ['score', 'blockers', 'proof', 'cta', 'detail'];
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.dataset?.step) setActive(visible.target.dataset.step);
    }, { rootMargin: '-30% 0px -50% 0px', threshold: [0.1, 0.3, 0.6] });
    ids.forEach((id) => {
      const el = document.getElementById(`sec-${id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const jump = (id) => document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const openRow = (id, source = 'manual') => {
    setOpenRows((rows) => ({ ...rows, [id]: true }));
    setFlashRow(id);
    track(source === 'blocker_card' ? 'ats_blocker_clicked' : 'ats_detail_row_opened', {
      critique_id: vm.id,
      row_id: id,
      score: vm.score,
      score_band: vm.band.label,
    });
    setTimeout(() => document.getElementById(`row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
    setTimeout(() => setFlashRow(null), 1500);
  };
  const toggleRow = (id) => {
    const opened = !openRows[id];
    setOpenRows((rows) => ({ ...rows, [id]: opened }));
    track('ats_detail_row_opened', { critique_id: vm.id, row_id: id, score: vm.score, opened });
  };
  const tailor = (location) => {
    track('ats_fix_for_job_clicked', {
      critique_id: vm.id,
      score: vm.score,
      score_band: vm.band.label,
      has_target: !!vm.targetRole,
      target_fit_score: vm.targetFit?.score ?? null,
      cta_location: location,
      source: isShared ? 'shared_report' : 'critique_flow',
    });
    onTailor?.();
  };
  const continueReading = () => {
    track('ats_continue_reading_clicked', { critique_id: vm.id, score: vm.score });
    jump('detail');
  };

  return (
    <div className="ats-page">
      <style>{ATS_REPORT_CSS}</style>
      <StepRail active={active} onJump={jump} />
      <div className="ats-body">
        <section id="sec-score" data-step="score" className="ats-section">
          <div className="ats-hero">
            <ScoreGauge score={vm.score} />
            <div>
              <StepEyebrow n={1}>ATS Readiness · {vm.checkedLabel}</StepEyebrow>
              <h1>{vm.diagnosisShort}</h1>
              <p>{vm.diagnosisLong}</p>
              <div className="ats-target-chip">
                {vm.targetRole ? (
                  <>
                    <span style={{ fontFamily: 'var(--mono, monospace)', fontSize: 10, fontWeight: 800, color: 'var(--accent)', letterSpacing: '.08em' }}>TARGET</span>
                    <strong>{vm.targetRole.label}</strong>
                    {vm.targetFit && <span>· {vm.targetFit.score}/100</span>}
                  </>
                ) : (
                  <>
                    <span style={{ color: 'var(--amber)', fontWeight: 800 }}>No target role yet</span>
                    <span>Add a JD to see role-fit scoring</span>
                  </>
                )}
              </div>
            </div>
            <div className="ats-metrics">
              {vm.metrics.map((metric) => {
                const band = getAtsBand(metric.score);
                return (
                  <div key={metric.key} className="ats-metric-row">
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 800 }}>{metric.label}</span>
                      </div>
                      <MetricBar score={metric.score} color={band.color} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: band.color, textAlign: 'right' }}>{metric.score}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="sec-blockers" data-step="blockers" className="ats-section">
          <div className="ats-sec-head">
            <div>
              <StepEyebrow n={2}>{vm.variant === 'high-score' ? 'Opportunities' : 'Blockers'}</StepEyebrow>
              <h2>{vm.variant === 'high-score' ? 'The 3 ways to make it sharper' : 'The 3 things costing you callbacks'}</h2>
              <p>{vm.variant === 'high-score' ? 'Your resume is already strong. These are the highest-leverage refinements.' : 'You do not need to fix everything. Start with these.'}</p>
            </div>
            <div className="ats-counter">3 OF {vm.blockersTotal} ISSUES SHOWN</div>
          </div>
          <div className="ats-blockers">
            {vm.blockers.map((blocker, index) => <BlockerCard key={`${blocker.title}-${index}`} blocker={blocker} n={index + 1} onOpen={openRow} />)}
          </div>
        </section>

        <section id="sec-proof" data-step="proof" className="ats-section">
          <div className="ats-sec-head">
            <div>
              <StepEyebrow n={3}>Proof preview</StepEyebrow>
              <h2>Here’s what one fix looks like</h2>
              <p>{vm.proof.section}. Same story, stronger signal.</p>
            </div>
          </div>
          <div className="ats-proof-wrap"><BeforeAfterPair proof={vm.proof} /></div>
        </section>

        <section id="sec-cta" data-step="cta" className="ats-section">
          <div className="ats-cta">
            <div className="ats-cta-body">
              <StepEyebrow n={4}>Next step</StepEyebrow>
              <h2 style={{ marginTop: 10 }}>{vm.ctaHeading}</h2>
              <p>{vm.ctaBody}</p>
              {vm.ctaSubtext && <p style={{ color: 'var(--green)', fontWeight: 800 }}>✓ {vm.ctaSubtext}</p>}
            </div>
            <div className="ats-cta-actions">
              <button className="ats-btn-primary" type="button" onClick={() => tailor('conversion_band')}>{vm.ctaPrimary}</button>
              <button className="ats-btn-text" type="button" onClick={continueReading}>Continue reading report ↓</button>
            </div>
          </div>
        </section>

        <section id="sec-detail" data-step="detail" className="ats-section">
          <div className="ats-sec-head">
            <div>
              <StepEyebrow n={5}>The full report</StepEyebrow>
              <h2>Detailed breakdown</h2>
              <p>Click any row to expand. Everything below is reference — you do not need to read it to tailor your resume.</p>
            </div>
          </div>
          <div className="ats-acc">
            <DetailRow id="working" eyebrow="01" title="What’s working" count={`${vm.whatsWorking.length || 0}`} open={openRows.working} flash={flashRow === 'working'} onToggle={() => toggleRow('working')}>
              {(vm.whatsWorking.length ? vm.whatsWorking : ['RolePitch found enough signal to produce a focused ATS report.']).map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 9, marginBottom: 8 }}><span style={{ color: 'var(--green)', fontWeight: 900 }}>✓</span><span style={{ fontSize: 13, lineHeight: 1.55 }}>{item}</span></div>
              ))}
            </DetailRow>
            <DetailRow id="fixes" eyebrow="02" title="All top fixes" count={`${vm.topFixes.length || 0}`} open={openRows.fixes} flash={flashRow === 'fixes'} onToggle={() => toggleRow('fixes')}>
              {vm.topFixes.map((fix) => (
                <div key={fix.n} style={{ display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 11, alignItems: 'start', marginBottom: 12 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: fix.n === 1 ? 'var(--red-dim)' : 'var(--accent-dim)', color: fix.n === 1 ? 'var(--red)' : 'var(--accent)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 900 }}>{fix.n}</span>
                  <span style={{ fontSize: 13, lineHeight: 1.55 }}>{fix.detail}</span>
                  <span style={{ fontFamily: 'var(--mono, monospace)', fontSize: 10, color: 'var(--text-faint)' }}>{fix.effort}</span>
                </div>
              ))}
            </DetailRow>
            <DetailRow id="sections" eyebrow="03" title="Section breakdown" count={`${vm.sectionScores.length}`} open={openRows.sections} flash={flashRow === 'sections'} onToggle={() => toggleRow('sections')}>
              {vm.sectionScores.map((section) => <SectionScore key={section.key} section={section} />)}
            </DetailRow>
            <DetailRow id="summary" eyebrow="04" title="Summary detail" open={openRows.summary} flash={flashRow === 'summary'} onToggle={() => toggleRow('summary')}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65 }}>{vm.summaryFeedback || 'No separate summary note was generated.'}</p>
              {vm.summaryRewrite && <div style={{ marginTop: 12, padding: 14, background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, fontSize: 13, lineHeight: 1.65 }}>{vm.summaryRewrite}</div>}
            </DetailRow>
            <DetailRow id="rewrites" eyebrow="05" title="All bullet rewrites" count={`${vm.bulletRewrites.length}`} open={openRows.rewrites} flash={flashRow === 'rewrites'} onToggle={() => toggleRow('rewrites')}>
              {(vm.bulletRewrites.length ? vm.bulletRewrites : [{ before: vm.proof.before, after: vm.proof.after }]).map((pair, i) => <div key={i} style={{ marginBottom: i < vm.bulletRewrites.length - 1 ? 16 : 0 }}><BeforeAfterPair proof={{ before: pair.before, after: pair.after, why: '' }} /></div>)}
            </DetailRow>
            <DetailRow id="gap" eyebrow="06" title={vm.targetRole ? 'Gap to target role' : 'What is holding this resume back'} open={openRows.gap} flash={flashRow === 'gap'} onToggle={() => toggleRow('gap')}>
              <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text-muted)' }}>{vm.gapToTarget || vm.verdict}</p>
              {vm.summaryRewrite && <div style={{ marginTop: 12, padding: 14, background: 'var(--accent-dim)', border: '1px solid oklch(0.50 0.19 248 / .20)', borderRadius: 10, fontSize: 13, lineHeight: 1.65 }}>{vm.summaryRewrite}</div>}
            </DetailRow>
          </div>
        </section>

        {(shareUrl || onShare) && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
            {onShare && <button className="ats-btn-outline" type="button" onClick={() => { track('ats_share_clicked', { critique_id: vm.id, source: isShared ? 'shared_report' : 'critique_flow' }); onShare(); }}>Share report</button>}
            {shareUrl && <span style={{ fontSize: 12, color: 'var(--text-faint)', alignSelf: 'center' }}>Link expires in 7 days</span>}
          </div>
        )}
      </div>
      <div className="ats-mobile-sticky">
        <button className="ats-btn-primary" type="button" onClick={() => tailor('sticky_mobile')}>{vm.targetRole ? 'Fix these gaps for this role' : 'Fix this for a job'}</button>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>Paste JD → tailored PDF · 5 free pitches</div>
      </div>
    </div>
  );
}
