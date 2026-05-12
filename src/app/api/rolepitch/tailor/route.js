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
 *
 * Bullet QC: after the initial draft, runs 2–4 QC+refine cycles until all
 * bullets pass STAR framework + 18-word limit checks. Each cycle sends only
 * the failing bullets back to Claude with specific feedback.
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { mirrorToDraft } from '@/lib/rolepitch-draft';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function tolerantParse(text) {
  const clean = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  try { return JSON.parse(clean); } catch (err) { return { __parseError: err.message, __cleaned: clean }; }
}

// When Claude is cut off mid-JSON (stop_reason: max_tokens), close all open
// brackets/strings cleanly and accept whatever bullets we got. Returns null
// if the salvage still can't parse.
function salvageJSON(raw) {
  if (!raw) return null;
  let s = raw.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  const firstBrace = s.indexOf('{');
  if (firstBrace > 0) s = s.slice(firstBrace);

  // Walk the string tracking strings + bracket depth.
  let inStr = false, escape = false;
  const stack = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (c === '\\' && inStr) { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{' || c === '[') stack.push(c);
    else if (c === '}' || c === ']') stack.pop();
  }

  // Truncated mid-string — close it, then drop trailing partial token.
  if (inStr) s += '"';
  // Drop trailing `,` and any partial `"key": <partial-value>` after the last full element.
  s = s.replace(/,\s*"[^"]*"\s*:\s*[^,}\]]*$/, '');
  s = s.replace(/,\s*$/, '');
  // Close remaining open brackets in reverse.
  for (let i = stack.length - 1; i >= 0; i--) {
    s += stack[i] === '{' ? '}' : ']';
  }
  try { return JSON.parse(s); } catch { return null; }
}

// rid = short, monotonic-ish request id so a single tailor attempt can be
// traced across log lines. Console logs in Vercel don't auto-correlate.
function makeRid() {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Bullet QC ────────────────────────────────────────────────────────────────

const WORD_LIMIT = 18;
const QC_MIN_CYCLES = 2;
const QC_MAX_CYCLES = 4;

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const STRONG_VERBS = new Set([
  'led','built','drove','launched','reduced','grew','scaled','owned','shipped',
  'increased','designed','spearheaded','delivered','managed','developed','created',
  'established','streamlined','optimised','optimized','boosted','achieved','deployed',
  'implemented','pioneered','negotiated','secured','generated','transformed',
  'accelerated','consolidated','restructured','revamped','expanded','introduced',
]);

function checkBullet(bullet) {
  const text = (bullet.text || '').trim();
  const issues = [];

  // 1. Word limit
  const wc = countWords(text);
  if (wc > WORD_LIMIT) {
    issues.push(`TOO_LONG: ${wc} words (max ${WORD_LIMIT}). Must compress — remove filler prose, keep metrics.`);
  }

  // 2. Starts with a strong action verb
  const firstWord = text.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '') || '';
  if (!STRONG_VERBS.has(firstWord)) {
    issues.push(`WEAK_OPENING: starts with "${firstWord}" — must start with a strong past-tense action verb (Led, Built, Drove, Launched, etc.).`);
  }

  // 3. STAR: must contain a result/metric signal
  // Heuristic: has a number, % , "x" multiplier, or a named outcome keyword
  const hasMetric = /\d/.test(text) || /\b(revenue|growth|retention|conversion|engagement|cost|users|mrr|arr|uplift|reduction|increase|decrease|impact)\b/i.test(text);
  if (!hasMetric) {
    issues.push(`NO_OUTCOME: bullet has no measurable result or named business outcome. Add the metric/impact or name the specific outcome.`);
  }

  // 4. Passive / filler phrases
  const filler = /(responsible for|duties included|worked on|helped with|assisted in|supported the|was involved)/i;
  if (filler.test(text)) {
    issues.push(`PASSIVE_FILLER: contains passive phrasing — rewrite actively from the verb.`);
  }

  return { text, issues, pass: issues.length === 0, word_count: wc };
}

function auditBullets(experience) {
  const failing = [];
  for (const role of experience) {
    for (const bullet of (role.bullets || [])) {
      const result = checkBullet(bullet);
      if (!result.pass) {
        failing.push({
          company: role.company,
          role: role.title,
          original_text: bullet.text,
          original_field: bullet.original || '',
          issues: result.issues,
          word_count: result.word_count,
        });
      }
    }
  }
  return failing;
}

async function runQcCycles(experience, jdTitle, jdCompany, jdDesc, rid) {
  let current = experience;

  for (let cycle = 1; cycle <= QC_MAX_CYCLES; cycle++) {
    const failing = auditBullets(current);

    console.log(`[rolepitch/tailor ${rid}] QC cycle ${cycle}: ${failing.length} failing bullets`);

    // Exit after min cycles if everything passes OR ≥90% pass (good enough)
    const totalBullets = current.reduce((n, r) => n + (r.bullets?.length || 0), 0);
    if (cycle >= QC_MIN_CYCLES && (failing.length === 0 || failing.length <= Math.floor(totalBullets * 0.1))) break;

    // Build per-bullet feedback block
    const bulletList = failing.length > 0
      ? failing.map((f, i) => `Bullet ${i + 1} (${f.role} @ ${f.company}):
  Current: "${f.original_text}"
  Issues:
${f.issues.map(iss => `    - ${iss}`).join('\n')}
  Source: "${f.original_field}"`)
      : current.flatMap(role =>
          (role.bullets || []).map((b, i) => `Bullet ${i + 1} (${role.title} @ ${role.company}):
  Current: "${b.text}"
  Issues: [POLISH — check verb variety, tighten prose, ensure outcome-led]
  Source: "${b.original || ''}"`)
        );

    const refinePrompt = `You are a resume QC editor. Fix the bullets listed below for the role "${jdTitle}" at "${jdCompany}".

HARD RULES (non-negotiable):
- Each bullet MUST be ≤${WORD_LIMIT} words. Count carefully — over-budget = rejected.
- Must start with a strong past-tense action verb (Led, Built, Drove, Launched, Reduced, Grew, Scaled, Owned, Shipped, Increased, Designed, Delivered, etc.)
- Must follow STAR compressed into one line: Action + what + result/metric.
- Must include any metric from the source bullet verbatim. Never fabricate metrics.
- No passive phrases (responsible for, worked on, assisted in, supported the).
- No two consecutive bullets in the same role may start with the same verb.
- Every word must earn its place — cut filler, keep signal.

JD context (for keyword relevance): ${jdDesc.slice(0, 800)}

BULLETS TO FIX:
${bulletList.join('\n\n')}

Return ONLY a JSON array in the same order. No fences, no commentary.
[
  { "company": "company name", "role": "role title", "fixed_text": "the improved bullet" },
  ...
]`;

    let refineMsg;
    try {
      refineMsg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        temperature: 0.2,
        messages: [{ role: 'user', content: refinePrompt }],
      });
    } catch (e) {
      console.error(`[rolepitch/tailor ${rid}] QC cycle ${cycle} API error:`, e.message);
      break;
    }

    const rawFix = (refineMsg.content[0]?.text || '').trim()
      .replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    let fixes;
    try {
      fixes = JSON.parse(rawFix);
    } catch {
      console.warn(`[rolepitch/tailor ${rid}] QC cycle ${cycle} parse failed, stopping QC`);
      break;
    }

    if (!Array.isArray(fixes) || fixes.length === 0) break;

    if (failing.length > 0) {
      // Targeted fix: apply only to the failing bullets, matched by index
      // Build a lookup: failingIdx → fix, keyed by original_text to handle
      // the case where two roles share identical bullet text.
      const fixByOriginal = new Map(
        failing.map((f, i) => [f.original_text, fixes[i]?.fixed_text])
      );

      current = current.map(role => ({
        ...role,
        bullets: (role.bullets || []).map(bullet => {
          const fix = fixByOriginal.get(bullet.text);
          if (fix) {
            fixByOriginal.delete(bullet.text); // consume so duplicate texts get one fix each
            return { ...bullet, text: fix };
          }
          return bullet;
        }),
      }));
    } else {
      // Polish pass: replace all bullets in order
      let fixIdx = 0;
      current = current.map(role => ({
        ...role,
        bullets: (role.bullets || []).map(bullet => {
          const fix = fixes[fixIdx]?.fixed_text;
          fixIdx++;
          return fix ? { ...bullet, text: fix } : bullet;
        }),
      }));
    }
  }

  const finalFailing = auditBullets(current);
  console.log(`[rolepitch/tailor ${rid}] QC complete. Final failing: ${finalFailing.length}`);
  return current;
}

export async function POST(request) {
  const rid = makeRid();
  const t0 = Date.now();
  console.log(`[rolepitch/tailor ${rid}] START`, {
    ua: request.headers.get('user-agent')?.slice(0, 80) || null,
    ref: request.headers.get('referer') || null,
  });

  try {
    let body;
    try {
      body = await request.json();
    } catch (parseErr) {
      console.error(`[rolepitch/tailor ${rid}] 400: invalid JSON body`, { error: parseErr.message });
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const { parsed_resume, jd, context, draft_id: draftId } = body;

    console.log(`[rolepitch/tailor ${rid}] payload`, {
      has_parsed_resume: !!parsed_resume,
      experience_count: parsed_resume?.experience?.length || 0,
      total_bullets: (parsed_resume?.experience || []).reduce((s, r) => s + (r.bullets?.length || 0), 0),
      skills_count: parsed_resume?.skills?.length || 0,
      summary_len: parsed_resume?.summary?.length || 0,
      has_jd: !!jd,
      jd_title: jd?.title || null,
      jd_company: jd?.company || null,
      jd_desc_len: jd?.description?.length || 0,
      context_count: context?.length || 0,
    });

    if (!parsed_resume) {
      console.warn(`[rolepitch/tailor ${rid}] 400: missing parsed_resume`, { has_jd: !!jd?.description, jd_len: jd?.description?.length });
      return NextResponse.json({ error: 'We lost your resume — please upload it again to tailor for this job.' }, { status: 400 });
    }
    if (!jd?.description) {
      console.warn(`[rolepitch/tailor ${rid}] 400: missing jd.description`, { has_resume: !!parsed_resume });
      return NextResponse.json({ error: 'No job description provided. Paste the JD or enter a job URL to continue.' }, { status: 400 });
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
  "gap_questions": [
    "Conversational Pilot-voice question about gap 1 — specific to the actual gap topic, direct, no 'great!' or 'interesting!', 1-2 sentences max",
    "Conversational Pilot-voice question about gap 2",
    "Conversational Pilot-voice question about gap 3"
  ],
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
- gaps: list 2-4 specific things the JD wants that the profile doesn't clearly show. Name the actual skill/domain/tool.
- gap_questions: write exactly 3 questions, one per major gap. Each must:
  • Name the actual gap topic directly (e.g. "GRI reporting" not "experience")
  • Be direct and conversational — like a coach, not HR
  • Ask if they have ANY angle on this — even indirect, adjacent, or partial
  • Be 1-2 sentences. No "great!" or "interesting!" or preamble.
  • Example good: "The JD needs GRI framework experience — have you done any ESG disclosures, even partial, at Oriflame or EY?"
  • Example bad: "The JD wants demonstrated experience — have you touched this at all?"
- summary must use exact keywords from JD.`;

    const fullPrompt = prompt + contextSection;
    // 8000 covers ~50 bullets including the duplicated "original" text. Long
    // resumes still truncate; salvage path below recovers them.
    const MAX_TOKENS = 8000;
    console.log(`[rolepitch/tailor ${rid}] anthropic.messages.create — calling`, {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: MAX_TOKENS,
      prompt_chars: fullPrompt.length,
      mode: isLinksOnly ? 'GENERATE' : 'TAILOR',
    });

    const tClaude0 = Date.now();
    let msg;
    try {
      msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: MAX_TOKENS,
        temperature: 0.3,
        messages: [{ role: 'user', content: fullPrompt }],
      });
    } catch (claudeErr) {
      console.error(`[rolepitch/tailor ${rid}] anthropic SDK error`, {
        elapsed_ms: Date.now() - tClaude0,
        name: claudeErr?.name,
        status: claudeErr?.status,
        message: claudeErr?.message,
        type: claudeErr?.error?.type,
        request_id: claudeErr?.request_id,
      });
      return NextResponse.json({ error: 'Hit a wall calling the model. Please retry.', code: 'anthropic_error' }, { status: 502 });
    }

    const claudeMs = Date.now() - tClaude0;
    const rawText = msg?.content?.[0]?.text || '';
    console.log(`[rolepitch/tailor ${rid}] anthropic returned`, {
      elapsed_ms: claudeMs,
      stop_reason: msg?.stop_reason,
      input_tokens: msg?.usage?.input_tokens,
      output_tokens: msg?.usage?.output_tokens,
      content_blocks: msg?.content?.length || 0,
      first_block_type: msg?.content?.[0]?.type,
      raw_text_len: rawText.length,
      raw_text_head: rawText.slice(0, 200),
      raw_text_tail: rawText.length > 200 ? rawText.slice(-200) : null,
    });

    if (!rawText) {
      console.error(`[rolepitch/tailor ${rid}] empty response from model`, {
        stop_reason: msg?.stop_reason,
        content: JSON.stringify(msg?.content || []).slice(0, 500),
      });
      return NextResponse.json({ error: 'Model returned an empty response. Please retry.', code: 'empty_response' }, { status: 502 });
    }

    let parsed = tolerantParse(rawText);
    let salvaged = false;
    if (!parsed || parsed.__parseError) {
      // Try salvage — closes open brackets/strings, drops trailing partial token.
      const recovered = salvageJSON(rawText);
      if (recovered) {
        parsed = recovered;
        salvaged = true;
        const truncated = msg?.stop_reason === 'max_tokens';
        console.warn(`[rolepitch/tailor ${rid}] SALVAGED parse`, {
          stop_reason: msg?.stop_reason,
          truncated,
          output_tokens: msg?.usage?.output_tokens,
          max_tokens: MAX_TOKENS,
          experience_count: parsed?.experience?.length || 0,
          total_bullets: (parsed?.experience || []).reduce((s, r) => s + (r.bullets?.length || 0), 0),
        });
      }
    }
    if (!parsed || parsed.__parseError) {
      const truncated = msg?.stop_reason === 'max_tokens';
      console.error(`[rolepitch/tailor ${rid}] PARSE FAILED (salvage too)`, {
        parse_error: parsed?.__parseError || 'tolerantParse returned null',
        stop_reason: msg?.stop_reason,
        truncated,
        output_tokens: msg?.usage?.output_tokens,
        max_tokens: MAX_TOKENS,
        cleaned_head: parsed?.__cleaned?.slice(0, 400),
        cleaned_tail: parsed?.__cleaned ? parsed.__cleaned.slice(-400) : null,
        raw_full: rawText.length < 6000 ? rawText : `${rawText.slice(0, 3000)}…[TRUNCATED ${rawText.length - 6000} chars]…${rawText.slice(-3000)}`,
      });
      return NextResponse.json({
        error: truncated
          ? 'Your resume is unusually long — try removing your oldest role and retrying.'
          : 'Tailor model returned malformed output. Please retry.',
        code: truncated ? 'truncated' : 'parse_failed',
        rid,
      }, { status: 502 });
    }

    const result = parsed;
    if (salvaged) result.__salvaged = true;

    // Validate the shape — Claude sometimes returns valid JSON missing required fields.
    const validation = {
      has_experience: Array.isArray(result.experience),
      experience_count: result.experience?.length || 0,
      has_summary: typeof result.summary === 'string' && result.summary.length > 0,
      has_skills: Array.isArray(result.skills),
      has_before_score: typeof result.before_score === 'number',
      has_after_score: typeof result.after_score === 'number',
      gaps_count: Array.isArray(result.gaps) ? result.gaps.length : 0,
      gap_questions_count: Array.isArray(result.gap_questions) ? result.gap_questions.length : 0,
    };
    console.log(`[rolepitch/tailor ${rid}] parsed OK`, validation);

    if (!validation.has_experience || validation.experience_count === 0) {
      console.error(`[rolepitch/tailor ${rid}] response missing experience array`, {
        keys: Object.keys(result),
        result_head: JSON.stringify(result).slice(0, 800),
      });
    }

    // Build shaped experience first so QC runs on the final merged structure
    const shapedExperience = (result.experience || []).map((role, i) => {
      const orig = (parsed_resume.experience || [])[i] || {};
      return {
        title: role.title || orig.title,
        company: role.company || orig.company,
        start_date: orig.start_date || role.start_date || null,
        end_date: orig.end_date || role.end_date || null,
        bullets: role.bullets || [],
      };
    });

    // Run 2–4 QC+refine cycles on bullets (STAR + word-limit checks)
    const qcExperience = await runQcCycles(
      shapedExperience,
      jd.title || '',
      jd.company || '',
      jd.description || '',
      rid,
    );

    const responseBody = {
      tailored: {
        name: parsed_resume.name,
        contact: parsed_resume.contact || {},
        summary: result.summary || parsed_resume.summary || '',
        skills: result.skills || parsed_resume.skills || [],
        experience: qcExperience,
        education: parsed_resume.education_detail || [],
      },
      before_score: result.before_score || 55,
      after_score: result.after_score || 78,
      gaps: result.gaps || [],
      gap_questions: result.gap_questions || [],
    };

    // Mirror to draft (best-effort; non-fatal). Stores the FULL tailored object
    // + JD snapshot so claim-draft can reconstruct everything without the client.
    if (draftId) {
      await mirrorToDraft(draftId, {
        tailored: responseBody.tailored,
        before_score: responseBody.before_score,
        after_score: responseBody.after_score,
        gap_questions: responseBody.gap_questions,
        jd_snapshot: { title: jd.title || '', company: jd.company || '', description: jd.description },
      }, rid);
    }

    const totalMs = Date.now() - t0;
    console.log(`[rolepitch/tailor ${rid}] DONE 200`, { total_ms: totalMs, claude_ms: claudeMs, draft_mirrored: !!draftId });

    return NextResponse.json(responseBody);

  } catch (err) {
    console.error(`[rolepitch/tailor ${rid}] UNCAUGHT 500`, {
      total_ms: Date.now() - t0,
      name: err?.name,
      message: err?.message,
      stack: err?.stack?.split('\n').slice(0, 6).join('\n'),
    });
    return NextResponse.json({ error: err.message, rid }, { status: 500 });
  }
}
