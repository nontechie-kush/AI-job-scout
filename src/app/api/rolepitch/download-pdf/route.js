/**
 * GET /api/rolepitch/download-pdf?tailored_resume_id=xxx
 *
 * Returns an HTML file the browser can print-to-PDF.
 * Content-Disposition: attachment triggers the save dialog.
 * No external PDF library — the browser does the rendering.
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(d) {
  if (!d) return 'Present';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function buildHtml(resume, jdTitle, jdCompany) {
  const name = esc(resume.name || 'Your Name');
  const email = esc(resume.contact?.email || '');
  const phone = esc(resume.contact?.phone || '');
  const location = esc(resume.contact?.location || '');
  const summary = esc(resume.summary || '');

  const experienceHtml = (resume.experience || []).map(role => {
    const bullets = (role.bullets || []).map(b =>
      `<li>${esc(b.text || b)}</li>`
    ).join('');
    return `
      <div class="role">
        <div class="role-header">
          <div>
            <span class="role-title">${esc(role.title || '')}</span>
            ${role.company ? `<span class="role-company"> · ${esc(role.company)}</span>` : ''}
          </div>
          <div class="role-dates">${formatDate(role.start_date)} – ${formatDate(role.end_date)}</div>
        </div>
        ${role.location ? `<div class="role-loc">${esc(role.location)}</div>` : ''}
        <ul class="bullets">${bullets}</ul>
      </div>
    `;
  }).join('');

  const educationHtml = (resume.education || []).map(ed => `
    <div class="role">
      <div class="role-header">
        <div>
          <span class="role-title">${esc(ed.degree || ed.institution || '')}</span>
          ${ed.institution && ed.degree ? `<span class="role-company"> · ${esc(ed.institution)}</span>` : ''}
        </div>
        <div class="role-dates">${formatDate(ed.start_date)} – ${formatDate(ed.end_date)}</div>
      </div>
    </div>
  `).join('');

  const skillsHtml = (resume.skills || []).length
    ? `<div class="skills">${(resume.skills || []).map(s => `<span class="skill-tag">${esc(s)}</span>`).join('')}</div>`
    : '';

  const tailoredFor = jdTitle ? `<div class="tailored-badge">Tailored for: ${esc(jdTitle)}${jdCompany ? ' · ' + esc(jdCompany) : ''}</div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${name} — Resume</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Georgia', serif; font-size: 11pt; color: #111; background: white; max-width: 760px; margin: 0 auto; padding: 36px 40px; }
  h1 { font-size: 22pt; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 4px; }
  .contact { font-family: Arial, sans-serif; font-size: 9pt; color: #555; margin-bottom: 18px; display: flex; gap: 16px; flex-wrap: wrap; }
  .contact span::before { content: ''; }
  .tailored-badge { font-family: Arial, sans-serif; font-size: 8pt; color: #4f6ef7; background: #eef1ff; border: 1px solid #c7d0ff; border-radius: 4px; padding: 3px 8px; display: inline-block; margin-bottom: 18px; }
  .summary { font-size: 10.5pt; line-height: 1.65; color: #333; margin-bottom: 22px; padding-bottom: 18px; border-bottom: 1.5px solid #ddd; }
  h2 { font-family: Arial, sans-serif; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #888; margin-bottom: 12px; margin-top: 22px; padding-bottom: 4px; border-bottom: 1px solid #eee; }
  .role { margin-bottom: 16px; }
  .role-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; }
  .role-title { font-weight: 700; font-size: 11pt; }
  .role-company { font-size: 10.5pt; color: #444; }
  .role-dates { font-family: Arial, sans-serif; font-size: 9pt; color: #888; white-space: nowrap; }
  .role-loc { font-family: Arial, sans-serif; font-size: 9pt; color: #aaa; margin-bottom: 6px; }
  .bullets { padding-left: 18px; margin-top: 6px; }
  .bullets li { font-size: 10.5pt; line-height: 1.65; margin-bottom: 4px; color: #222; }
  .skills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
  .skill-tag { font-family: Arial, sans-serif; font-size: 9pt; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; padding: 2px 8px; color: #444; }
  @media print {
    body { padding: 20px 28px; max-width: 100%; }
    @page { margin: 18mm 15mm; }
  }
</style>
</head>
<body>
  <h1>${name}</h1>
  <div class="contact">
    ${email ? `<span>${email}</span>` : ''}
    ${phone ? `<span>${phone}</span>` : ''}
    ${location ? `<span>${location}</span>` : ''}
  </div>
  ${tailoredFor}
  ${summary ? `<div class="summary">${summary}</div>` : ''}
  ${(resume.experience || []).length ? `<h2>Experience</h2>${experienceHtml}` : ''}
  ${(resume.education || []).length ? `<h2>Education</h2>${educationHtml}` : ''}
  ${(resume.skills || []).length ? `<h2>Skills</h2>${skillsHtml}` : ''}
</body>
</html>`;
}

export async function GET(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const tailoredResumeId = searchParams.get('tailored_resume_id');
    if (!tailoredResumeId) return NextResponse.json({ error: 'tailored_resume_id required' }, { status: 400 });

    const { data: tr, error } = await supabase
      .from('tailored_resumes')
      .select('tailored_version, jd_id, match_id')
      .eq('id', tailoredResumeId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !tr) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let jdTitle = '', jdCompany = '';
    if (tr.jd_id) {
      const { data: jd } = await supabase.from('job_descriptions').select('title, company').eq('id', tr.jd_id).maybeSingle();
      jdTitle = jd?.title || '';
      jdCompany = jd?.company || '';
    }

    const resume = tr.tailored_version || {};
    const html = buildHtml(resume, jdTitle, jdCompany);
    const filename = `rolepitch-${jdTitle ? jdTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase() : tailoredResumeId.slice(0, 8)}.html`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('[download-pdf]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
