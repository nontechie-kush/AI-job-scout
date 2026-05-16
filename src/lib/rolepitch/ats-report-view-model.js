export function getAtsBand(score) {
  if (score >= 85) return { label: 'EXCELLENT', tone: 'good', color: 'var(--green)', dim: 'var(--green-dim)' };
  if (score >= 70) return { label: 'STRONG', tone: 'good', color: 'var(--green)', dim: 'var(--green-dim)' };
  if (score >= 55) return { label: 'FAIR', tone: 'mid', color: 'var(--amber)', dim: 'var(--amber-dim)' };
  return { label: 'WEAK', tone: 'low', color: 'var(--red)', dim: 'var(--red-dim)' };
}

function clampScore(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function stripQuotes(value) {
  return String(value || '').trim().replace(/^["']|["']$/g, '');
}

function targetFromContext(targetContext) {
  const raw = stripQuotes(targetContext);
  if (!raw) return null;
  const atMatch = raw.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
  if (atMatch) {
    return {
      title: stripQuotes(atMatch[1]),
      company: stripQuotes(atMatch[2]),
      label: `${stripQuotes(atMatch[1])} @ ${stripQuotes(atMatch[2])}`,
    };
  }
  return { title: raw, company: '', label: raw };
}

function sectionStatus(score) {
  if (score < 55) return 'high';
  if (score < 70) return 'medium';
  return 'low';
}

function sectionTitle(key, hasTarget) {
  const titles = {
    summary: hasTarget ? 'Summary misses role signal' : 'Summary is not specific enough',
    bullets: 'Bullets need sharper outcomes',
    skills: hasTarget ? 'Keywords are not aligned yet' : 'Skills need stronger grouping',
    structure: 'Structure slows the scan',
    impact: 'Impact proof is buried',
  };
  return titles[key] || 'Signal needs work';
}

function affectedLabel(key) {
  const labels = {
    summary: 'Summary',
    bullets: 'Bullet rewrites',
    skills: 'Skills',
    structure: 'Section breakdown',
    impact: 'Impact & metrics',
  };
  return labels[key] || 'Full report';
}

function affectedRowId(key) {
  if (key === 'summary') return 'summary';
  if (key === 'bullets' || key === 'impact') return 'rewrites';
  if (key === 'skills' || key === 'structure') return 'sections';
  return 'fixes';
}

function countMeta(key, data) {
  if (key === 'bullets') return `${data.examples?.length || 0} rewrites ready`;
  if (key === 'summary' && data.rewrite) return 'Rewrite ready';
  if (key === 'skills') return 'Keyword signal';
  if (key === 'impact') return 'Metrics hierarchy';
  return `${clampScore(data.score, 0)}/100`;
}

function buildDrivers(critique, hasTarget) {
  const sections = critique.sections || {};
  const overall = clampScore(critique.overall_score, 50);
  const drivers = critique.ats_report?.drivers || {};
  const fallback = {
    parseability: { score: sections.structure?.score ?? overall, label: 'Parseability', note: 'Can hiring systems read sections, dates, roles, and contact details cleanly?' },
    keywords: { score: Math.round(((sections.skills?.score ?? overall) + (sections.summary?.score ?? overall)) / 2), label: hasTarget ? 'Target keywords' : 'Keyword signal', note: hasTarget ? 'How clearly your resume reflects the target role language.' : 'How searchable your skills and role language are.' },
    impact: { score: sections.impact?.score ?? overall, label: 'Impact proof', note: 'Metrics, outcomes, scope, and business value inside bullets.' },
    structure: { score: sections.structure?.score ?? overall, label: 'Scan structure', note: 'Reverse chronology, bullet density, section order, and skim speed.' },
  };
  return Object.keys(fallback).map((key) => {
    const driver = typeof drivers[key] === 'number' ? { score: drivers[key] } : (drivers[key] || {});
    return {
      key,
      score: clampScore(driver.score, fallback[key].score),
      label: driver.label || fallback[key].label,
      note: driver.note || fallback[key].note,
    };
  });
}

function buildBlockers(critique, hasTarget, highScore) {
  const sections = critique.sections || {};
  const rows = Object.entries(sections)
    .filter(([, data]) => data && typeof data.score === 'number')
    .map(([key, data]) => ({
      severity: highScore ? 'low' : sectionStatus(data.score),
      title: highScore ? `${affectedLabel(key)} can get sharper` : sectionTitle(key, hasTarget),
      explanation: data.feedback || 'RolePitch found a fix that can make this resume easier to scan and match.',
      affected: affectedLabel(key),
      affectedRowId: affectedRowId(key),
      meta: countMeta(key, data),
      score: clampScore(data.score, 0),
    }))
    .sort((a, b) => a.score - b.score);

  const blockers = rows.slice(0, 3);
  const fixes = critique.top_fixes || [];
  while (blockers.length < 3 && fixes[blockers.length]) {
    blockers.push({
      severity: highScore ? 'low' : blockers.length === 0 ? 'high' : 'medium',
      title: `Fix ${blockers.length + 1}`,
      explanation: fixes[blockers.length],
      affected: 'All top fixes',
      affectedRowId: 'fixes',
      meta: 'Recommended',
      score: 50,
    });
  }
  return blockers;
}

function boldMetric(text) {
  return String(text || '').replace(/(\$?\d+(?:\.\d+)?\s?(?:%|x|k|K|m|M|cr|Cr|crore|hours|users|months|days)?)/g, '**$1**');
}

function buildProof(critique) {
  const examples = critique.sections?.bullets?.examples || [];
  const first = examples.find((ex) => ex?.original && ex?.rewrite) || examples[0];
  if (first?.rewrite) {
    return {
      section: 'Bullet rewrite',
      before: first.original || 'A bullet without a clear outcome.',
      after: boldMetric(first.rewrite),
      why: 'RolePitch keeps the core story, upgrades the action verb, and pulls the measurable outcome into view.',
    };
  }
  const rewrite = critique.sections?.summary?.rewrite;
  if (rewrite) {
    return {
      section: 'Summary rewrite',
      before: critique.sections?.summary?.feedback || 'The current summary is not carrying the strongest signal.',
      after: boldMetric(rewrite),
      why: 'The rewrite leads with role, scope, and proof so ATS and recruiters see the fit faster.',
    };
  }
  return {
    section: 'Top fix',
    before: critique.top_fixes?.[0] || 'Your resume has a fixable ATS gap.',
    after: boldMetric(critique.gap_to_target || critique.headline_verdict || 'RolePitch can turn this into a targeted, recruiter-ready version.'),
    why: 'The goal is to make the strongest evidence visible in the first scan.',
  };
}

function heroCopy(score, hasTarget) {
  if (!hasTarget) return {
    short: 'Solid foundation. Needs a role to aim at.',
    long: 'Your resume can be checked for ATS readability, but the strongest score lift comes after matching it to a specific job.',
  };
  if (score < 50) return {
    short: 'Strong story. The format is hiding it from ATS.',
    long: 'The content may be useful, but the parser and recruiter scan are not seeing the best proof quickly enough.',
  };
  if (score >= 85) return {
    short: 'Your resume is strong. Tailoring will make it sharper.',
    long: 'The base is healthy. A role-specific version can still improve keyword match and proof hierarchy.',
  };
  return {
    short: 'Readable, but not role-ready yet.',
    long: 'Your resume can be parsed, but your strongest proof is not visible fast enough for this role.',
  };
}

export function buildAtsReportViewModel({ critique, critiqueId, targetContext, createdAt, expiresAt, expired = false }) {
  const score = clampScore(critique?.overall_score, 0);
  const hasTarget = !!stripQuotes(targetContext);
  const highScore = score >= 85;
  const band = getAtsBand(score);
  const targetRole = targetFromContext(targetContext);
  const targetFit = hasTarget && critique?.target_fit?.score != null
    ? { ...critique.target_fit, score: clampScore(critique.target_fit.score, score) }
    : null;
  const copy = heroCopy(score, hasTarget);

  const sections = critique?.sections || {};
  const sectionScores = [
    ['summary', 'Summary'],
    ['bullets', 'Bullet points'],
    ['skills', 'Skills'],
    ['structure', 'Structure'],
    ['impact', 'Impact & metrics'],
  ].filter(([key]) => sections[key]).map(([key, name]) => ({ key, name, ...sections[key], score: clampScore(sections[key].score, score) }));

  return {
    id: critiqueId || null,
    expired,
    score,
    band,
    variant: expired ? 'expired' : !hasTarget ? 'no-target' : score < 50 ? 'low-score' : highScore ? 'high-score' : 'targeted',
    diagnosisShort: critique?.ats_report?.diagnosis ? copy.short : copy.short,
    diagnosisLong: copy.long,
    verdict: critique?.ats_report?.diagnosis || critique?.headline_verdict || copy.long,
    targetRole,
    targetFit,
    checkedLabel: createdAt ? `Checked ${new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Checked just now',
    expiresLabel: expiresAt ? new Date(expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
    metrics: buildDrivers(critique || {}, hasTarget),
    blockers: buildBlockers(critique || {}, hasTarget, highScore),
    blockersTotal: Math.max((critique?.top_fixes || []).length, buildBlockers(critique || {}, hasTarget, highScore).length),
    proof: buildProof(critique || {}),
    whatsWorking: critique?.what_works || [],
    topFixes: (critique?.top_fixes || []).map((fix, index) => ({
      n: index + 1,
      title: fix,
      detail: fix,
      effort: index < 2 ? '5 min' : '2 min',
    })),
    sectionScores,
    bulletRewrites: (sections.bullets?.examples || []).filter((ex) => ex?.rewrite).map((ex) => ({
      before: ex.original || '',
      after: ex.rewrite || '',
    })),
    summaryRewrite: sections.summary?.rewrite || '',
    summaryFeedback: sections.summary?.feedback || '',
    gapToTarget: critique?.gap_to_target || '',
    ctaPrimary: hasTarget ? 'Fix these gaps for this role →' : 'Fix this for a job →',
    ctaHeading: hasTarget && targetRole
      ? `Want RolePitch to fix this for ${targetRole.label}?`
      : 'Want RolePitch to fix this for a real job?',
    ctaBody: hasTarget
      ? 'Generate a tailored resume that rewrites the weak bullets for this exact role and exports a PDF in 60 seconds.'
      : 'Paste a job link next. RolePitch will turn this diagnosis into a tailored resume with rewritten bullets and a PDF.',
    ctaSubtext: score < 50 ? 'Good news: every issue we flagged is fixable in under 15 minutes.' : '',
  };
}
