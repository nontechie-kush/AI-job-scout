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

function makeSafeFilename(name, role) {
  const sanitize = str => (str || '').replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_');
  const namePart = sanitize(name);
  const rolePart = sanitize(role);
  return [namePart, rolePart].filter(Boolean).join('_') || 'Resume';
}

function buildHtml(resume, jdTitle, jdCompany, filename) {
  const name = esc(resume.name || '');
  const tagline = esc(resume.title || resume.tagline || '');
  const email = esc(resume.contact?.email || '');
  const phone = esc(resume.contact?.phone || '');
  const location = esc(resume.contact?.location || '');
  const linkedin = resume.contact?.linkedin || '';
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
<title>${esc(filename)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Georgia', serif; font-size: 11pt; color: #111; background: white; max-width: 760px; margin: 0 auto; padding: 36px 40px; }
  h1 { font-size: 22pt; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 2px; text-align: center; }
  .tagline { font-family: Arial, sans-serif; font-size: 9.5pt; color: #444; margin-bottom: 6px; text-align: center; }
  .contact { font-family: Arial, sans-serif; font-size: 9pt; color: #555; margin-bottom: 18px; display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; }
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
  ${tagline ? `<div class="tagline">${tagline}</div>` : ''}
  <div class="contact">
    ${email ? `<span>${email}</span>` : ''}
    ${linkedin ? `<span><a href="${esc(linkedin)}" style="color:#555;text-decoration:none;">LinkedIn</a></span>` : ''}
    ${phone ? `<span>${phone}</span>` : ''}
    ${location ? `<span>${location}</span>` : ''}
  </div>
  ${tailoredFor}
  ${summary ? `<div class="summary">${summary}</div>` : ''}
  ${(resume.experience || []).length ? `<h2>Experience</h2>${experienceHtml}` : ''}
  ${(resume.education || []).length ? `<h2>Education</h2>${educationHtml}` : ''}
  ${(resume.skills || []).length ? `<h2>Skills</h2>${skillsHtml}` : ''}
<script>
  window.addEventListener('load', function() {
    document.title = ${JSON.stringify(filename)};
    setTimeout(function() { window.print(); }, 400);
  });
</script>
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
      .select('tailored_version, base_version, jd_id, match_id')
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

    const tv = tr.tailored_version || {};
    const bv = tr.base_version || {};

    // Fetch profile as final fallback for name/contact
    let profileName = '', profileContact = {};
    if (!tv.name && !bv.name) {
      const { data: prof } = await supabase.from('profiles').select('structured_resume').eq('user_id', user.id).maybeSingle();
      profileName = prof?.structured_resume?.name || '';
      profileContact = prof?.structured_resume?.contact || {};
    }

    // Merge: tailored_version fields take priority, fall back to base_version, then profile
    const resume = {
      name: tv.name || bv.name || profileName,
      contact: (tv.contact && Object.keys(tv.contact).length > 0) ? tv.contact : (bv.contact && Object.keys(bv.contact).length > 0 ? bv.contact : profileContact),
      summary: tv.summary || bv.summary || '',
      experience: tv.experience || bv.experience || [],
      education: tv.education || bv.education || [],
      skills: tv.skills || bv.skills || [],
    };

    const filename = makeSafeFilename(resume.name, jdTitle);
    const html = buildHtml(resume, jdTitle, jdCompany, filename);
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${filename}.pdf"`,
      },
    });
  } catch (err) {
    console.error('[download-pdf]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
