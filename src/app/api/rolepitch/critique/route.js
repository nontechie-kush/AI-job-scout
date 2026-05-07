/**
 * POST /api/rolepitch/critique
 *
 * Stateless resume critique — no auth required.
 * Extracts lead data (name/email/phone) passively from parsed resume.
 * Stores critique in rp_critiques table with 7-day expiry.
 *
 * Body: { parsed_resume, target_context }
 * Returns: { critique_id, critique }
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@/lib/supabase/service-client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function tolerantParse(text) {
  const clean = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  try { return JSON.parse(clean); } catch (err) { return { __parseError: err.message, __cleaned: clean }; }
}

function makeRid() {
  return `crit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function POST(request) {
  const rid = makeRid();
  const t0 = Date.now();
  console.log(`[rolepitch/critique ${rid}] START`);

  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      console.error(`[rolepitch/critique ${rid}] 400: invalid JSON`, { message: e.message });
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const { parsed_resume, target_context, pdf_path } = body;

    console.log(`[rolepitch/critique ${rid}] payload`, {
      has_parsed_resume: !!parsed_resume,
      experience_count: parsed_resume?.experience?.length || 0,
      total_bullets: (parsed_resume?.experience || []).reduce((s, r) => s + (r.bullets?.length || 0), 0),
      has_target: !!target_context,
      target_len: target_context?.length || 0,
      has_pdf_path: !!pdf_path,
    });

    if (!parsed_resume) {
      console.warn(`[rolepitch/critique ${rid}] 400: parsed_resume required`);
      return NextResponse.json({ error: 'parsed_resume required' }, { status: 400 });
    }

    const experiences = (parsed_resume.experience || []);
    const resumeText = experiences.map(role => {
      const bullets = (role.bullets || []).map(b => `  • ${typeof b === 'string' ? b : b.text}`).join('\n');
      return `${role.title} at ${role.company} (${role.start_date || '?'} – ${role.end_date || 'Present'})\n${bullets || '  (no bullets)'}`;
    }).join('\n\n');

    const targetLine = target_context
      ? `TARGET: ${target_context}`
      : 'TARGET: Not specified — critique for general professional roles';

    const prompt = `You are a ruthlessly honest resume coach. Critique this resume for the target below.

${targetLine}

RESUME:
Name: ${parsed_resume.name || ''}
Summary: ${parsed_resume.summary || '(none)'}
Skills: ${(parsed_resume.skills || []).join(', ') || '(none)'}

${resumeText}

Return ONLY valid JSON — no markdown, no explanation.

{
  "headline_verdict": "<one punchy sentence: what this resume's biggest problem is right now>",
  "sections": {
    "summary": { "score": <0-100>, "status": <"strong"|"weak"|"missing">, "feedback": "<2-3 sentences>", "rewrite": "<improved version or null>" },
    "bullets": { "score": <0-100>, "status": <"strong"|"weak"|"missing">, "feedback": "<2-3 sentences>", "examples": [ { "original": "<worst bullet>", "rewrite": "<better version>" }, { "original": "<second worst>", "rewrite": "<better version>" } ] },
    "skills": { "score": <0-100>, "status": <"strong"|"weak"|"missing">, "feedback": "<1-2 sentences>" },
    "structure": { "score": <0-100>, "status": <"strong"|"weak"|"missing">, "feedback": "<1-2 sentences>" },
    "impact": { "score": <0-100>, "status": <"strong"|"weak"|"missing">, "feedback": "<2-3 sentences about quantification and metrics>" }
  },
  "top_fixes": [
    "<Most critical fix — be specific, name the section and what to do>",
    "<Second fix>",
    "<Third fix>",
    "<Fourth fix>",
    "<Fifth fix>"
  ],
  "what_works": ["<one genuine strength>", "<another strength>"],
  "gap_to_target": "<1-2 sentences on what's missing vs their stated target, or 'Resume is reasonably aligned with your target' if context not given>"
}

SCORING RUBRIC — apply consistently:
- summary: 80+ = 2-3 lines, names role + 1-2 hard outcomes + domain. 60 = generic but on-topic. 40 = vague aspirational. 0 = missing.
- bullets: 80+ = every bullet leads with a verb AND has a quantified outcome. 60 = half quantified. 40 = mostly responsibilities, no metrics. 0 = no bullets.
- skills: 80+ = role-relevant, grouped, no fluff (no "MS Office"). 60 = mostly relevant, ungrouped. 40 = grab-bag. 0 = missing.
- structure: 80+ = clean reverse-chron, dates aligned, ≤2 pages, scannable. 60 = mostly clean. 40 = missing dates / wall of text. 0 = unreadable.
- impact: 80+ = numbers in 70%+ of bullets ($ revenue, % growth, # users, time saved). 60 = numbers in 30-50%. 40 = <30%. 0 = zero metrics.

OTHER RULES:
- Be direct and specific. Name actual bullet text, not vague advice.
- top_fixes: prioritized, most impactful first. Each under 20 words.
- bullet examples: pick the weakest bullets and show a 12-18 word rewrite with STAR structure.
- If summary is missing, score it 0 and write a suggested one in "rewrite".`;

    // Run critique + target inference in parallel — both use Haiku, both work off the same resume
    const inferPrompt = `Look at this candidate's resume and infer the most likely next role they're targeting (their natural next step, not what they did).

Name: ${parsed_resume.name || ''}
Current title: ${parsed_resume.title || ''}
Years experience: ${parsed_resume.years_exp || '?'}
Seniority: ${parsed_resume.seniority || '?'}
Skills: ${(parsed_resume.skills || []).join(', ')}
Recent companies: ${(parsed_resume.companies || []).slice(0, 4).join(', ')}
${target_context ? `User stated target: "${target_context}"` : 'User did not specify a target.'}

Resume bullets:
${resumeText}

Return ONLY valid JSON — no markdown, no explanation.

{
  "inferred_role": "<specific role title — what's their natural next step? e.g. 'Senior Product Manager', 'Sustainability Lead', 'Engineering Manager'>",
  "inferred_seniority": "<junior|mid|senior|lead|principal|executive>",
  "inferred_domain": "<industry/vertical/specialization — e.g. 'consumer fintech', 'climate tech', 'B2B SaaS'>",
  "confidence": "<high|medium|low>",
  "reasoning": "<1 sentence on why — base on trajectory, not generic advice>"
}

Rules:
- If user stated a target, RESPECT it: extract role/seniority/domain from their stated target. Set confidence="high".
- If no stated target: infer from trajectory. Look at last 1–2 roles, seniority progression, skills. The inferred role should be a natural step UP, not lateral repeat of current title.
- Confidence=high: clear trajectory, recent specialization. Medium: ambiguous but reasonable guess. Low: too generalist or contradictory signals.
- Be specific, not generic. "Senior PM in fintech" beats "Product Manager".`;

    console.log(`[rolepitch/critique ${rid}] anthropic — calling parallel critique + infer`, {
      model: 'claude-haiku-4-5-20251001',
      critique_prompt_chars: prompt.length,
      infer_prompt_chars: inferPrompt.length,
    });

    const tClaude0 = Date.now();
    let msg, inferMsg;
    try {
      [msg, inferMsg] = await Promise.all([
        anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          temperature: 0,
          messages: [{ role: 'user', content: prompt }],
        }),
        anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          temperature: 0,
          messages: [{ role: 'user', content: inferPrompt }],
        }),
      ]);
    } catch (sdkErr) {
      console.error(`[rolepitch/critique ${rid}] anthropic SDK error`, {
        elapsed_ms: Date.now() - tClaude0,
        name: sdkErr?.name,
        status: sdkErr?.status,
        message: sdkErr?.message,
        request_id: sdkErr?.request_id,
      });
      return NextResponse.json({ error: 'Hit a wall calling the model. Please retry.', rid }, { status: 502 });
    }

    const claudeMs = Date.now() - tClaude0;
    const critiqueRaw = msg?.content?.[0]?.text || '';
    const inferRaw = inferMsg?.content?.[0]?.text || '';
    console.log(`[rolepitch/critique ${rid}] anthropic returned`, {
      elapsed_ms: claudeMs,
      critique_stop: msg?.stop_reason,
      critique_output_tokens: msg?.usage?.output_tokens,
      critique_raw_len: critiqueRaw.length,
      infer_stop: inferMsg?.stop_reason,
      infer_output_tokens: inferMsg?.usage?.output_tokens,
      infer_raw_len: inferRaw.length,
    });

    const critique = tolerantParse(critiqueRaw);
    if (!critique || critique.__parseError) {
      console.error(`[rolepitch/critique ${rid}] critique PARSE FAILED`, {
        parse_error: critique?.__parseError,
        stop_reason: msg?.stop_reason,
        truncated: msg?.stop_reason === 'max_tokens',
        output_tokens: msg?.usage?.output_tokens,
        cleaned_head: critique?.__cleaned?.slice(0, 400),
        cleaned_tail: critique?.__cleaned ? critique.__cleaned.slice(-400) : null,
      });
      return NextResponse.json({ error: 'Failed to parse critique response', rid }, { status: 500 });
    }

    const inferredTarget = tolerantParse(inferRaw);
    if (inferredTarget && !inferredTarget.__parseError) {
      critique.inferred_target = inferredTarget;
      console.log(`[rolepitch/critique ${rid}] infer parsed OK`, {
        inferred_role: inferredTarget.inferred_role,
        confidence: inferredTarget.confidence,
      });
    } else {
      console.warn(`[rolepitch/critique ${rid}] infer parse FAILED — auto-tailor falls back to generic`, {
        parse_error: inferredTarget?.__parseError || 'null',
        stop_reason: inferMsg?.stop_reason,
      });
    }

    // Compute overall_score deterministically from section scores (weighted).
    // Bullets and impact carry the most weight — they're what recruiters actually read.
    const WEIGHTS = { bullets: 0.35, impact: 0.25, summary: 0.15, structure: 0.15, skills: 0.10 };
    const sections = critique.sections || {};
    let weightedSum = 0;
    let totalWeight = 0;
    for (const [key, weight] of Object.entries(WEIGHTS)) {
      const s = sections[key]?.score;
      if (typeof s === 'number' && s >= 0 && s <= 100) {
        weightedSum += s * weight;
        totalWeight += weight;
      }
    }
    const overall = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;
    critique.overall_score = overall;
    critique.score_label =
      overall < 50 ? 'Needs Work' :
      overall < 65 ? 'Getting There' :
      overall < 80 ? 'Strong' : 'Excellent';

    // Store in DB — passive lead capture from resume
    const supabase = createServiceClient();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const baseRow = {
      name: parsed_resume.name || null,
      email: parsed_resume.contact?.email || null,
      phone: parsed_resume.contact?.phone || null,
      target_context: target_context || null,
      critique_json: critique,
      expires_at: expiresAt,
      // Optional — only present when caller is the PDF upload path. Lets
      // claim-critique → auto-tailor run vision capture on the original PDF
      // so download-pdf can preserve the user's layout.
      pdf_path: pdf_path || null,
    };

    // Try with the new auto-tailor columns first; fall back if the schema migration
    // (sql/rp_critiques_auto_tailor.sql) hasn't been applied yet.
    let row = null;
    let dbError = null;
    {
      const fullInsert = await supabase
        .from('rp_critiques')
        .insert({
          ...baseRow,
          parsed_resume,
          inferred_target: critique.inferred_target || null,
        })
        .select('id')
        .single();
      if (fullInsert.error && /column .* does not exist/i.test(fullInsert.error.message)) {
        const fallback = await supabase
          .from('rp_critiques')
          .insert(baseRow)
          .select('id')
          .single();
        row = fallback.data;
        dbError = fallback.error;
      } else {
        row = fullInsert.data;
        dbError = fullInsert.error;
      }
    }

    if (dbError) {
      console.error(`[rolepitch/critique ${rid}] DB insert error — returning critique anyway`, {
        message: dbError.message,
        code: dbError.code,
        details: dbError.details,
        hint: dbError.hint,
      });
      // Still return critique even if DB fails — don't block user
      return NextResponse.json({ critique, critique_id: null });
    }

    console.log(`[rolepitch/critique ${rid}] DONE 200`, {
      total_ms: Date.now() - t0,
      critique_id: row.id,
      overall_score: critique.overall_score,
    });
    return NextResponse.json({ critique, critique_id: row.id });

  } catch (err) {
    console.error(`[rolepitch/critique ${rid}] UNCAUGHT 500`, {
      total_ms: Date.now() - t0,
      name: err?.name,
      message: err?.message,
      stack: err?.stack?.split('\n').slice(0, 6).join('\n'),
    });
    return NextResponse.json({ error: err.message, rid }, { status: 500 });
  }
}
