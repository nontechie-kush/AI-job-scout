/**
 * Generic clean Georgia-serif resume template.
 * Used when the user has no original_html (links-only flow, or pre-vision users).
 */

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(d) {
  if (!d) return 'Present';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function safeFilename(name, role) {
  const sanitize = str => (str || '').replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_');
  return [sanitize(name), sanitize(role)].filter(Boolean).join('_') || 'Resume';
}

export function buildFastHtml(resume, jdTitle) {
  const name = esc(resume.name || '');
  const email = esc(resume.contact?.email || '');
  const phone = esc(resume.contact?.phone || '');
  const location = esc(resume.contact?.location || '');
  const linkedin = resume.contact?.linkedin || '';
  const summary = esc(resume.summary || '');

  const experienceHtml = (resume.experience || []).map(role => {
    const bullets = (role.bullets || []).map(b => `<li>${esc(b.text || b)}</li>`).join('');
    return `<div class="role">
      <div class="role-header">
        <div><span class="role-title">${esc(role.title || '')}</span>${role.company ? `<span class="role-company"> · ${esc(role.company)}</span>` : ''}</div>
        <div class="role-dates">${formatDate(role.start_date)} – ${formatDate(role.end_date)}</div>
      </div>
      <ul class="bullets">${bullets}</ul>
    </div>`;
  }).join('');

  const educationHtml = (resume.education || []).map(ed => `<div class="role">
    <div class="role-header">
      <div><span class="role-title">${esc(ed.degree || ed.institution || '')}</span>${ed.institution && ed.degree ? `<span class="role-company"> · ${esc(ed.institution)}</span>` : ''}</div>
      <div class="role-dates">${formatDate(ed.start_date)} – ${formatDate(ed.end_date)}</div>
    </div>
  </div>`).join('');

  const skillsHtml = (resume.skills || []).length
    ? `<div class="skills">${(resume.skills || []).map(s => `<span class="skill-tag">${esc(s)}</span>`).join('')}</div>`
    : '';

  const filename = safeFilename(resume.name, jdTitle);

  // <title> blank so the browser's print header doesn't show "Resume_Foo_Bar"
  // Filename is set via Content-Disposition on the response, not <title>.
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title> </title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Georgia',serif;font-size:11pt;color:#111;background:white;max-width:760px;margin:0 auto;padding:36px 40px}
  h1{font-size:22pt;font-weight:700;letter-spacing:-0.02em;margin-bottom:2px;text-align:center}
  .contact{font-family:Arial,sans-serif;font-size:9pt;color:#555;margin-bottom:18px;display:flex;gap:16px;flex-wrap:wrap;justify-content:center}
  .summary{font-size:10.5pt;line-height:1.65;color:#333;margin-bottom:22px;padding-bottom:18px;border-bottom:1.5px solid #ddd}
  h2{font-family:Arial,sans-serif;font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin-bottom:12px;margin-top:22px;padding-bottom:4px;border-bottom:1px solid #eee}
  .role{margin-bottom:16px}
  .role-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px}
  .role-title{font-weight:700;font-size:11pt}
  .role-company{font-size:10.5pt;color:#444}
  .role-dates{font-family:Arial,sans-serif;font-size:9pt;color:#888;white-space:nowrap}
  .bullets{padding-left:18px;margin-top:6px}
  .bullets li{font-size:10.5pt;line-height:1.65;margin-bottom:4px;color:#222}
  .skills{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
  .skill-tag{font-family:Arial,sans-serif;font-size:9pt;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:4px;padding:2px 8px;color:#444}
  @media print{body{padding:18mm 15mm;max-width:100%}@page{size:letter;margin:0}}
</style>
</head>
<body>
  <h1>${name}</h1>
  <div class="contact">
    ${email ? `<span>${email}</span>` : ''}
    ${linkedin ? `<span><a href="${esc(linkedin)}" style="color:#555;text-decoration:none;">LinkedIn</a></span>` : ''}
    ${phone ? `<span>${phone}</span>` : ''}
    ${location ? `<span>${location}</span>` : ''}
  </div>
  ${summary ? `<div class="summary">${summary}</div>` : ''}
  ${(resume.experience || []).length ? `<h2>Experience</h2>${experienceHtml}` : ''}
  ${(resume.education || []).length ? `<h2>Education</h2>${educationHtml}` : ''}
  ${(resume.skills || []).length ? `<h2>Skills</h2>${skillsHtml}` : ''}
<script>window.addEventListener('load',function(){document.title=' ';setTimeout(function(){window.print();},400);});</script>
</body>
</html>`;
}
