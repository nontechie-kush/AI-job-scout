/**
 * Deterministic renderer for manually edited RolePitch resumes.
 *
 * The initial tailor can use AI to preserve the user's original layout. Once a
 * user edits the resume manually, the edited JSON is the source of truth and
 * must be rendered exactly. Do not route this path through an LLM.
 */

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function textWithBreaks(value) {
  return esc(value).replace(/\n/g, '<br />');
}

function formatDate(value, fallback = '') {
  if (!value) return fallback;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(trimmed)) return trimmed;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function dateRange(item) {
  const start = formatDate(item?.start_date);
  const end = item?.end_date ? formatDate(item.end_date) : 'Present';
  if (!start && !end) return '';
  if (!start) return end;
  return `${start} - ${end}`;
}

function normalizeBullet(bullet) {
  if (typeof bullet === 'string') return bullet;
  return bullet?.text || '';
}

function nonEmpty(items) {
  return (items || []).filter((item) => String(item || '').trim());
}

function contactItems(contact = {}) {
  return nonEmpty([
    contact.email,
    contact.linkedin,
    contact.phone,
    contact.location,
  ]);
}

function renderExperience(experience = []) {
  return experience.map((role) => {
    const bullets = (role.bullets || []).map(normalizeBullet).filter((text) => text.trim());
    const title = role.title || role.role || '';
    const company = role.company || '';
    const location = role.location || '';
    const dates = dateRange(role);
    return `<article class="role">
      <div class="role-row">
        <div class="role-main">
          ${company ? `<div class="company">${esc(company)}</div>` : ''}
          ${title ? `<div class="title">${esc(title)}</div>` : ''}
        </div>
        <div class="role-meta">
          ${location ? `<div>${esc(location)}</div>` : ''}
          ${dates ? `<div>${esc(dates)}</div>` : ''}
        </div>
      </div>
      ${bullets.length ? `<ul>${bullets.map((text) => `<li>${textWithBreaks(text)}</li>`).join('')}</ul>` : ''}
    </article>`;
  }).join('');
}

function renderEducation(education = []) {
  return education.map((item) => {
    const degree = item.degree || item.course || '';
    const institution = item.institution || item.school || item.university || '';
    const location = item.location || '';
    const dates = dateRange(item);
    return `<article class="edu">
      <div class="role-row">
        <div>
          ${institution ? `<div class="company">${esc(institution)}</div>` : ''}
          ${degree ? `<div class="title">${esc(degree)}</div>` : ''}
        </div>
        <div class="role-meta">
          ${location ? `<div>${esc(location)}</div>` : ''}
          ${dates ? `<div>${esc(dates)}</div>` : ''}
        </div>
      </div>
    </article>`;
  }).join('');
}

export function renderEditedResumeHtml({ resume, jobTitle = '' }) {
  const name = resume?.name || '';
  const contact = resume?.contact || {};
  const headline = resume?.title || resume?.headline || jobTitle || '';
  const contactHtml = contactItems(contact).map((item) => `<span>${esc(item)}</span>`).join('<span class="sep">|</span>');
  const summary = resume?.summary || '';
  const experience = resume?.experience || [];
  const education = resume?.education || [];
  const skills = resume?.skills || [];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title> </title>
<style>
  *,*::before,*::after{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#fff;color:#111}
  body{font-family:"Times New Roman",Times,serif;font-size:10.4pt;line-height:1.22}
  .page{width:8.5in;min-height:11in;margin:0 auto;padding:.46in .52in;background:#fff}
  header{text-align:center;margin-bottom:10px}
  h1{font-size:19pt;line-height:1.05;margin:0 0 4px;font-weight:700;letter-spacing:0}
  .headline,.contact{font-size:9.4pt;line-height:1.2}
  .contact{display:flex;justify-content:center;flex-wrap:wrap;gap:4px 6px}
  .sep{color:#555}
  h2{text-align:center;font-size:12pt;line-height:1;margin:10px 0 7px;font-weight:700;text-transform:uppercase;letter-spacing:.02em}
  .summary{margin:0 0 7px;text-align:left}
  .role,.edu{margin-bottom:5px;break-inside:avoid}
  .role-row{display:grid;grid-template-columns:minmax(0,1fr) 1.55in;gap:10px;align-items:start}
  .company,.title,.role-meta{font-weight:700}
  .role-meta{text-align:right}
  ul{margin:2px 0 0 18px;padding:0}
  li{margin:0 0 2px;padding-left:1px}
  .skills{margin-top:2px;text-align:left}
  .skills span{font-weight:700}
  @page{size:letter;margin:0}
  @media print{body{background:#fff}.page{width:auto;min-height:auto;margin:0;padding:.46in .52in}}
</style>
</head>
<body>
<main class="page">
  <header>
    ${name ? `<h1>${esc(name)}</h1>` : ''}
    ${headline ? `<div class="headline">${esc(headline)}</div>` : ''}
    ${contactHtml ? `<div class="contact">${contactHtml}</div>` : ''}
  </header>
  ${summary ? `<section><p class="summary">${textWithBreaks(summary)}</p></section>` : ''}
  ${experience.length ? `<section><h2>Experience</h2>${renderExperience(experience)}</section>` : ''}
  ${education.length ? `<section><h2>Education</h2>${renderEducation(education)}</section>` : ''}
  ${skills.length ? `<section><h2>Skills</h2><div class="skills">${skills.map((skill) => `<span>${esc(skill)}</span>`).join(' &bull; ')}</div></section>` : ''}
</main>
<script>window.addEventListener('load',function(){document.title=' ';setTimeout(function(){window.print();},400);});</script>
</body>
</html>`;
}
