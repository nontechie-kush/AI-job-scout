/**
 * POST /api/rolepitch/tailor
 *
 * Stateless resume tailor for RolePitch pre-login flow.
 * Takes parsed resume + JD inline — no DB, no auth required.
 *
 * Body:
 *   {
 *     parsed_resume: { name, experience[], skills[], summary, contact },
 *     jd: { title, company, description }
 *   }
 *
 * Returns:
 *   {
 *     tailored: {
 *       name, contact, summary, skills[],
 *       experience: [{ title, company, start_date, end_date, bullets: [{text, original}] }]
 *     },
 *     before_score: number,
 *     after_score: number,
 *     gaps: string[]
 *   }
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function tolerantParse(text) {
  const clean = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  try { return JSON.parse(clean); } catch { return {}; }
}

export async function POST(request) {
  try {
    const { parsed_resume, jd, context } = await request.json();

    if (!parsed_resume || !jd?.description) {
      return NextResponse.json({ error: 'parsed_resume and jd.description required' }, { status: 400 });
    }

    const contextSection = context?.length
      ? `\nCANDIDATE CONTEXT (from interview Q&A — use this to enrich bullets):\n${context.map(c => `Q: ${c.question}\nA: ${c.answer}`).join('\n\n')}`
      : '';

    const experiences = parsed_resume.experience || [];
    const isLinksOnly = experiences.length > 0 && experiences.every(r => (r.bullets || []).length === 0);

    const resumeText = experiences.map(role => {
      const bullets = (role.bullets || []).map(b => `  • ${typeof b === 'string' ? b : b.text}`).join('\n');
      const bulletSection = bullets || '  (no bullets — generate 3-4 based on role title and context)';
      return `${role.title} at ${role.company} (${role.start_date || '?'} – ${role.end_date || 'Present'})\n${bulletSection}`;
    }).join('\n\n');

    const bulletInstruction = isLinksOnly
      ? `BULLET RULES — GENERATE mode (no original bullets exist):
- Write 3-4 bullets per role based on the role title, company, and any context in the candidate profile.
- Use realistic achievements typical for this role level — do NOT fabricate specific metrics unless the profile provides them.
- Start each with a strong past-tense action verb.
- Keep each bullet 12-18 words. STAR structure: Action + what + outcome.
- Use keywords from the JD naturally.
- Set "original" field to "" (empty string) for all bullets.`
      : `BULLET RULES — TAILOR mode (rewrite existing bullets):
- Each bullet MUST be 12-18 words maximum. No exceptions.
- Start with a strong past-tense action verb (Led, Built, Drove, Launched, Reduced, Grew, Scaled, Owned, Shipped, Increased).
- Follow STAR structure compressed into one line: Action + what + result/metric.
- Include the metric from the original bullet if one exists. Never fabricate metrics.
- Use JD vocabulary naturally — do not force every JD keyword into every bullet.
- Never start two consecutive bullets with the same verb.
- Set "original" to the original bullet text verbatim.`;

    const prompt = `You are an expert resume writer. ${isLinksOnly ? 'Generate a tailored resume' : 'Tailor this resume'} for the job description below.

JOB: ${jd.title || 'Role'} at ${jd.company || 'Company'}
---
${jd.description.slice(0, 4000)}
---

CANDIDATE PROFILE:
Name: ${parsed_resume.name || ''}
Summary: ${parsed_resume.summary || ''}
Skills: ${(parsed_resume.skills || []).join(', ')}
Candidate edges: ${(parsed_resume.candidate_edges || []).join('; ')}

${resumeText}
---

Return ONLY valid JSON. No markdown, no explanation.

{
  "before_score": <integer 0-100: ${isLinksOnly ? 'estimated fit of raw profile before tailoring' : 'how well original resume matches JD'}>,
  "after_score": <integer 0-100: how well ${isLinksOnly ? 'generated' : 'tailored'} resume matches JD — must be higher than before_score>,
  "gaps": ["gap1", "gap2"],
  "summary": "2-3 sentence tailored professional summary using keywords from JD",
  "skills": ["updated skills list prioritizing JD keywords"],
  "experience": [
    {
      "title": "job title",
      "company": "company",
      "start_date": "YYYY-MM or null",
      "end_date": "YYYY-MM or null",
      "bullets": [
        {
          "text": "bullet text",
          "original": "original bullet or empty string"
        }
      ]
    }
  ]
}

${bulletInstruction}

OTHER RULES:
- Keep ALL roles. Do not drop any.
- Never fabricate companies or titles not in the profile.
- before_score and after_score must be realistic integers (before typically 40-70, after 65-90).
- gaps: list 2-4 things the JD wants that the profile doesn't clearly show.
- summary must use exact keywords from JD.`;

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt + contextSection }],
    });

    const result = tolerantParse(msg.content[0].text);

    return NextResponse.json({
      tailored: {
        name: parsed_resume.name,
        contact: parsed_resume.contact || {},
        summary: result.summary || parsed_resume.summary || '',
        skills: result.skills || parsed_resume.skills || [],
        experience: (result.experience || []).map((role, i) => {
          const orig = (parsed_resume.experience || [])[i] || {};
          return {
            title: role.title || orig.title,
            company: role.company || orig.company,
            start_date: orig.start_date || role.start_date || null,
            end_date: orig.end_date || role.end_date || null,
            bullets: role.bullets || [],
          };
        }),
        education: parsed_resume.education_detail || [],
      },
      before_score: result.before_score || 55,
      after_score: result.after_score || 78,
      gaps: result.gaps || [],
    });

  } catch (err) {
    console.error('[rolepitch/tailor]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
