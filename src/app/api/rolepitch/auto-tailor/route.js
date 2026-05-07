/**
 * POST /api/rolepitch/auto-tailor
 *
 * Post-signup auto-tailor: takes a critique_id (claimed to the now-signed-in user),
 * builds a synthetic JD from the user's stated target_context OR the inferred_target
 * we computed during critique, runs tailor, saves to tailored_resumes, returns the id.
 *
 * No credit deduction — this is the welcome gift after sign-up.
 *
 * Body: { critique_id, mode?: 'target'|'inferred'|'generic' }
 *   - 'target'  → use user's stated target_context (highest signal)
 *   - 'inferred'→ use inferred_target from resume (medium signal)
 *   - 'generic' → use candidate's current title (lowest signal — fallback)
 *   - omitted   → auto-pick: target_context if set, else inferred_target if confidence!='low', else generic
 *
 * Returns: { tailored_resume_id, used: { mode, label } }
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service-client';
import { pdfToVisionHtml } from '@/lib/ai/vision-to-html';
import { renderTailoredHtml } from '@/lib/ai/render-tailored-html';
import { buildFastHtml } from '@/lib/ai/build-fast-html';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// SDK default timeout is 10min; route maxDuration is 60s. Cap the SDK call at
// 50s so we have ~10s of headroom to format the response or surface a 504-ish
// error, rather than letting Vercel hard-kill the function mid-write.
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 50000,
  maxRetries: 2,
});

function tolerantParse(text) {
  const clean = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  try { return JSON.parse(clean); } catch (err) { return { __parseError: err.message, __cleaned: clean }; }
}

// Recovers truncated JSON when stop_reason === 'max_tokens'. Closes open
// strings/brackets and drops the trailing partial token.
function salvageJSON(raw) {
  if (!raw) return null;
  let s = raw.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  const firstBrace = s.indexOf('{');
  if (firstBrace > 0) s = s.slice(firstBrace);
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
  if (inStr) s += '"';
  s = s.replace(/,\s*"[^"]*"\s*:\s*[^,}\]]*$/, '');
  s = s.replace(/,\s*$/, '');
  for (let i = stack.length - 1; i >= 0; i--) {
    s += stack[i] === '{' ? '}' : ']';
  }
  try { return JSON.parse(s); } catch { return null; }
}

function makeRid() {
  return `at_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function buildSyntheticJD({ role, seniority, domain, candidateTitle }) {
  const seniorityWord = seniority && seniority !== '?' ? seniority : 'mid-to-senior';
  const finalRole = role || candidateTitle || 'Professional';
  const finalDomain = domain ? ` in ${domain}` : '';

  return {
    title: finalRole,
    company: 'Target Role',
    description: `We are hiring a ${seniorityWord} ${finalRole}${finalDomain}.

You will own outcomes that matter. We're looking for someone who has shipped work in this space, can lead through ambiguity, and writes results in numbers — not adjectives.

What we expect:
• Demonstrated ${seniorityWord}-level ownership of ${finalRole.toLowerCase()} responsibilities${finalDomain}.
• Track record of measurable impact: revenue, growth, efficiency, retention, or scale.
• Strong cross-functional collaboration — engineering, design, business, ops as needed.
• Ability to communicate strategy crisply and drive execution end-to-end.
• Comfort with both data and judgment calls.

Nice to have:
• Background${finalDomain || ''} or in adjacent domains where the playbook transfers.
• Experience scaling teams or processes through multiple stages of growth.
• A bias toward shipping over discussing.

This is a tailored synthesis of your target trajectory, not a real posting. We use it to surface the strongest version of your story for the kind of role you're heading toward.`,
  };
}

export async function POST(request) {
  const rid = makeRid();
  const t0 = Date.now();
  console.log(`[rolepitch/auto-tailor ${rid}] START`, {
    has_auth: !!request.headers.get('authorization'),
    ua: request.headers.get('user-agent')?.slice(0, 80) || null,
  });

  try {
    const supabaseUser = await createClientFromRequest(request);
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr) {
      console.error(`[rolepitch/auto-tailor ${rid}] auth.getUser error`, { message: userErr.message });
    }
    if (!user) {
      console.warn(`[rolepitch/auto-tailor ${rid}] 401: no user`, { auth_err: userErr?.message || null });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log(`[rolepitch/auto-tailor ${rid}] user`, { user_id: user.id, email: user.email });

    const { critique_id, mode } = await request.json().catch((e) => {
      console.error(`[rolepitch/auto-tailor ${rid}] body parse error`, { message: e?.message });
      return {};
    });
    if (!critique_id) {
      console.warn(`[rolepitch/auto-tailor ${rid}] 400: critique_id required`, { mode });
      return NextResponse.json({ error: 'critique_id required' }, { status: 400 });
    }
    console.log(`[rolepitch/auto-tailor ${rid}] payload`, { critique_id, mode: mode || null });

    const service = createServiceClient();

    // Fetch the critique row — must already be claimed to this user
    const { data: critique, error: critErr } = await service
      .from('rp_critiques')
      .select('id, user_id, target_context, parsed_resume, inferred_target, critique_json, name')
      .eq('id', critique_id)
      .maybeSingle();

    if (critErr || !critique) {
      console.warn(`[rolepitch/auto-tailor ${rid}] 404: critique not found`, { critique_id, db_err: critErr?.message || null });
      return NextResponse.json({ error: 'Critique not found' }, { status: 404 });
    }
    if (critique.user_id !== user.id) {
      console.warn(`[rolepitch/auto-tailor ${rid}] 403: critique user mismatch`, { critique_user: critique.user_id, request_user: user.id });
      return NextResponse.json({ error: 'Not your critique' }, { status: 403 });
    }
    if (!critique.parsed_resume) {
      console.warn(`[rolepitch/auto-tailor ${rid}] 422: critique has no parsed_resume`, { critique_id });
      return NextResponse.json({ error: 'No resume in critique row — re-upload required' }, { status: 422 });
    }
    console.log(`[rolepitch/auto-tailor ${rid}] critique loaded`, {
      target_context: critique.target_context || null,
      has_inferred: !!critique.inferred_target,
      experience_count: critique.parsed_resume?.experience?.length || 0,
      total_bullets: (critique.parsed_resume?.experience || []).reduce((s, r) => s + (r.bullets?.length || 0), 0),
    });

    // Idempotency: a critique can only spawn one auto-tailored resume. Repeat calls
    // with the same critique_id return the existing row instead of generating a new
    // one — prevents abuse of this credit-free endpoint.
    const { data: existing } = await service
      .from('tailored_resumes')
      .select('id, tailored_version')
      .eq('user_id', user.id)
      .eq('tailored_version->>source_critique_id', critique_id)
      .maybeSingle();

    if (existing?.id) {
      console.log(`[rolepitch/auto-tailor ${rid}] CACHED 200`, { tailored_resume_id: existing.id, total_ms: Date.now() - t0 });
      return NextResponse.json({
        tailored_resume_id: existing.id,
        used: {
          mode: existing.tailored_version?.source_mode || 'cached',
          label: existing.tailored_version?.source_label || '',
        },
        cached: true,
      });
    }

    const parsed = critique.parsed_resume;
    const inferred = critique.inferred_target || critique.critique_json?.inferred_target || null;
    const targetContext = critique.target_context || null;

    // Decide the source of truth for the synthetic JD
    let usedMode = mode;
    if (!usedMode) {
      if (targetContext) usedMode = 'target';
      else if (inferred && inferred.confidence !== 'low') usedMode = 'inferred';
      else usedMode = 'generic';
    }

    let jdInput;
    let usedLabel;
    if (usedMode === 'target' && targetContext) {
      jdInput = { role: targetContext, seniority: inferred?.inferred_seniority, domain: inferred?.inferred_domain, candidateTitle: parsed.title };
      usedLabel = targetContext;
    } else if (usedMode === 'inferred' && inferred?.inferred_role) {
      jdInput = { role: inferred.inferred_role, seniority: inferred.inferred_seniority, domain: inferred.inferred_domain, candidateTitle: parsed.title };
      usedLabel = inferred.inferred_role;
    } else {
      jdInput = { role: parsed.title || 'Professional', seniority: parsed.seniority, domain: null, candidateTitle: parsed.title };
      usedLabel = parsed.title || 'your current role';
      usedMode = 'generic';
    }

    const jd = buildSyntheticJD(jdInput);

    // Inline tailor — same logic as /api/rolepitch/tailor but without the route boundary
    const experiences = parsed.experience || [];
    const isLinksOnly = experiences.length > 0 && experiences.every(r => (r.bullets || []).length === 0);
    const resumeText = experiences.map(role => {
      const bullets = (role.bullets || []).map(b => `  • ${typeof b === 'string' ? b : b.text}`).join('\n');
      const bulletSection = bullets || '  (no bullets — generate 3-4 based on role title)';
      return `${role.title} at ${role.company} (${role.start_date || '?'} – ${role.end_date || 'Present'})\n${bulletSection}`;
    }).join('\n\n');

    const bulletInstruction = isLinksOnly
      ? `BULLET RULES — GENERATE mode:
- Write 3-4 bullets per role based on title + company.
- Use realistic achievements typical for this role level — never fabricate specific metrics.
- Start with strong past-tense action verb. 12-18 words. STAR structure.
- Set "original" to "" for all bullets.`
      : `BULLET RULES — TAILOR mode:
- Each bullet 12-18 words max.
- Strong past-tense action verb (Led, Built, Drove, Launched, Reduced, Grew, Scaled, Owned, Shipped).
- Compress STAR into one line: Action + what + result/metric.
- Keep metrics from original. Never fabricate.
- Use JD vocabulary naturally. Never start two bullets with same verb.
- Set "original" to original bullet text verbatim.`;

    const prompt = `You are an expert resume writer. ${isLinksOnly ? 'Generate' : 'Tailor'} this resume for the target role below.

TARGET: ${jd.title}
---
${jd.description}
---

CANDIDATE PROFILE:
Name: ${parsed.name || ''}
Summary: ${parsed.summary || ''}
Skills: ${(parsed.skills || []).join(', ')}

${resumeText}
---

Return ONLY valid JSON. No markdown, no explanation.

{
  "before_score": <int 40-65: how well original resume matches target before tailoring>,
  "after_score": <int 70-92: how well tailored version matches — MUST be at least 12 points higher than before_score>,
  "gaps": ["gap1", "gap2"],
  "summary": "2-3 sentence tailored summary using target keywords",
  "skills": ["prioritized skills list"],
  "experience": [
    {
      "title": "job title",
      "company": "company",
      "start_date": "YYYY-MM or null",
      "end_date": "YYYY-MM or null",
      "bullets": [{ "text": "bullet text", "original": "original bullet or empty string" }]
    }
  ]
}

${bulletInstruction}

OTHER RULES:
- Keep ALL roles. Never drop any.
- Never fabricate companies or titles.
- before_score: realistic 40-70. after_score: 65-90.
- gaps: 2-4 specific things target wants that profile doesn't show clearly.`;

    // 8000 covers ~50 bullets including duplicated "original" text. Long
    // resumes still truncate; salvage path below recovers them.
    const MAX_TOKENS = 8000;
    console.log(`[rolepitch/auto-tailor ${rid}] anthropic.messages.create — calling`, {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: MAX_TOKENS,
      prompt_chars: prompt.length,
      mode: isLinksOnly ? 'GENERATE' : 'TAILOR',
      used_mode: usedMode,
    });

    const tClaude0 = Date.now();
    let msg;
    try {
      msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: MAX_TOKENS,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      });
    } catch (err) {
      const status = err?.status;
      console.error(`[rolepitch/auto-tailor ${rid}] anthropic SDK error`, {
        elapsed_ms: Date.now() - tClaude0,
        name: err?.name,
        status,
        message: err?.message,
        type: err?.error?.type,
        request_id: err?.request_id,
      });
      if (status === 529 || status === 503) {
        return NextResponse.json({ error: 'Anthropic is overloaded right now. Try again in a moment.', retryable: true }, { status: 503 });
      }
      if (status === 408 || err?.name === 'APIConnectionTimeoutError') {
        return NextResponse.json({ error: 'Tailor took too long. Try again — usually faster on the second pass.', retryable: true }, { status: 504 });
      }
      if (status === 429) {
        return NextResponse.json({ error: 'Rate limited by Anthropic. Try again in 30 seconds.', retryable: true }, { status: 429 });
      }
      throw err;
    }

    const claudeMs = Date.now() - tClaude0;
    const rawText = msg?.content?.[0]?.text || '';
    console.log(`[rolepitch/auto-tailor ${rid}] anthropic returned`, {
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
      console.error(`[rolepitch/auto-tailor ${rid}] empty model response`, {
        stop_reason: msg?.stop_reason,
        content: JSON.stringify(msg?.content || []).slice(0, 500),
      });
      return NextResponse.json({ error: 'Model returned an empty response. Please retry.', code: 'empty_response' }, { status: 502 });
    }

    let parsedRes = tolerantParse(rawText);
    let salvaged = false;
    if (!parsedRes || parsedRes.__parseError) {
      const recovered = salvageJSON(rawText);
      if (recovered) {
        parsedRes = recovered;
        salvaged = true;
        console.warn(`[rolepitch/auto-tailor ${rid}] SALVAGED parse`, {
          stop_reason: msg?.stop_reason,
          truncated: msg?.stop_reason === 'max_tokens',
          output_tokens: msg?.usage?.output_tokens,
          max_tokens: MAX_TOKENS,
          experience_count: parsedRes?.experience?.length || 0,
          total_bullets: (parsedRes?.experience || []).reduce((s, r) => s + (r.bullets?.length || 0), 0),
        });
      }
    }
    if (!parsedRes || parsedRes.__parseError) {
      const truncated = msg?.stop_reason === 'max_tokens';
      console.error(`[rolepitch/auto-tailor ${rid}] PARSE FAILED (salvage too)`, {
        parse_error: parsedRes?.__parseError || 'tolerantParse returned null',
        stop_reason: msg?.stop_reason,
        truncated,
        output_tokens: msg?.usage?.output_tokens,
        max_tokens: MAX_TOKENS,
        cleaned_head: parsedRes?.__cleaned?.slice(0, 400),
        cleaned_tail: parsedRes?.__cleaned ? parsedRes.__cleaned.slice(-400) : null,
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

    const result = parsedRes;
    if (salvaged) result.__salvaged = true;
    console.log(`[rolepitch/auto-tailor ${rid}] parsed OK`, {
      experience_count: result.experience?.length || 0,
      has_summary: !!result.summary,
      skills_count: result.skills?.length || 0,
      gaps_count: result.gaps?.length || 0,
      before_score: result.before_score,
      after_score: result.after_score,
    });

    const tailoredVersion = {
      name: parsed.name,
      title: result.experience?.[0]?.title || parsed.title || '',
      contact: parsed.contact || {},
      summary: result.summary || parsed.summary || '',
      skills: result.skills || parsed.skills || [],
      experience: (result.experience || []).map((role, i) => {
        const orig = (parsed.experience || [])[i] || {};
        return {
          title: role.title || orig.title,
          company: role.company || orig.company,
          start_date: orig.start_date || role.start_date || null,
          end_date: orig.end_date || role.end_date || null,
          bullets: role.bullets || [],
        };
      }),
      education: parsed.education_detail || parsed.education || [],
    };

    let beforeScore = result.before_score || 55;
    let afterScore = result.after_score || 78;
    // Guard: ensure a meaningful uplift (model occasionally ignores instructions).
    // If after <= before+8, push after up to before+12 (capped at 92).
    if (afterScore - beforeScore < 8) {
      afterScore = Math.min(beforeScore + 12, 92);
    }
    const highlightsUsed = (tailoredVersion.experience || []).reduce((s, r) => s + (r.bullets || []).length, 0);

    // Build base structured_resume (same shape save-resume builds)
    const structured_resume = {
      name: parsed.name,
      title: parsed.title || '',
      contact: parsed.contact || {},
      summary: parsed.summary || '',
      experience: (parsed.experience || []).map(role => ({
        title: role.title,
        company: role.company,
        location: role.location || '',
        start_date: role.start_date || null,
        end_date: role.end_date || null,
        bullets: (role.bullets || []).map(b => ({
          text: typeof b === 'string' ? b : b.text,
          type: typeof b === 'string' ? 'achievement' : (b.type || 'achievement'),
        })),
      })),
      education: (parsed.education_detail || parsed.education || []).map(ed => ({
        degree: ed.degree,
        institution: ed.institution,
        start_date: ed.start_date || null,
        end_date: ed.end_date || null,
      })),
      skills: parsed.skills || [],
    };

    // Save profile if user doesn't already have one (this is the welcome flow)
    const { data: existingProfile } = await supabaseUser
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existingProfile) {
      // Critique flow doesn't track the original input type — 'text' is a safe
      // default since most critique submissions are pastes. profiles.source
      // CHECK constraint requires: pdf | website | text | linkedin_pdf | image.
      const { error: profErr } = await supabaseUser.from('profiles').insert({
        user_id: user.id,
        raw_text: '',
        source: 'text',
        parsed_json: parsed,
        structured_resume,
        parsed_at: new Date().toISOString(),
        claude_model: 'claude-opus-4-6',
      });
      if (profErr) {
        console.error(`[rolepitch/auto-tailor ${rid}] profile insert error`, {
          message: profErr.message,
          code: profErr.code,
          details: profErr.details,
          hint: profErr.hint,
        });
      } else {
        console.log(`[rolepitch/auto-tailor ${rid}] profile inserted`);
      }
    } else {
      console.log(`[rolepitch/auto-tailor ${rid}] profile already exists — skipped insert`);
    }

    // Insert synthetic JD
    const { data: jdRow, error: jdErr } = await supabaseUser
      .from('job_descriptions')
      .insert({
        user_id: user.id,
        title: jd.title,
        company: jd.company,
        description: jd.description,
        source: 'pasted',
      })
      .select('id')
      .single();

    if (jdErr || !jdRow) {
      console.error(`[rolepitch/auto-tailor ${rid}] jd insert error`, {
        message: jdErr?.message,
        code: jdErr?.code,
        details: jdErr?.details,
        hint: jdErr?.hint,
        no_row: !jdRow,
      });
      return NextResponse.json({ error: `Failed to save target context: ${jdErr?.message || 'unknown'}` }, { status: 500 });
    }
    console.log(`[rolepitch/auto-tailor ${rid}] jd inserted`, { jd_id: jdRow.id });

    // Insert tailored_resume — NO credit deduction (welcome gift)
    const { data: trRow, error: trErr } = await supabaseUser
      .from('tailored_resumes')
      .insert({
        user_id: user.id,
        jd_id: jdRow.id,
        base_version: structured_resume,
        tailored_version: {
          ...tailoredVersion,
          before_score: beforeScore,
          after_score: afterScore,
          highlights_used: highlightsUsed,
          bullets_rewritten: highlightsUsed,
          auto_tailored: true,
          source_mode: usedMode,
          source_label: usedLabel,
          source_critique_id: critique_id,
        },
        pipeline_version: 'rolepitch-auto-v1',
        resume_strength: beforeScore,
      })
      .select('id')
      .single();

    if (trErr || !trRow) {
      console.error(`[rolepitch/auto-tailor ${rid}] tailored_resume insert error`, {
        message: trErr?.message,
        code: trErr?.code,
        details: trErr?.details,
        hint: trErr?.hint,
        no_row: !trRow,
      });
      return NextResponse.json({ error: `Failed to save tailored resume: ${trErr?.message || 'unknown'}` }, { status: 500 });
    }

    // Vision capture + tailored_html pre-render — runs only when the user
    // arrived via the PDF upload path (rp_critiques.pdf_path was set). All
    // failures are non-fatal: download-pdf renders on demand if these miss.
    let visionHtml = null;
    let visionPageCount = 1;
    {
      const service = createServiceClient();
      // Re-read the critique row to get pdf_path (claim-critique already
      // mirrored to profiles, but we want fresh state in case ordering varied).
      const { data: critRow } = await service
        .from('rp_critiques')
        .select('pdf_path')
        .eq('id', critique_id)
        .maybeSingle();
      const pdfPath = critRow?.pdf_path || null;

      // Pull whatever original_html the profile already has (e.g. previous
      // pitch ran vision). Avoids re-running Gemini on every auto-tailor.
      const { data: prof } = await service
        .from('profiles')
        .select('original_html, original_page_count')
        .eq('user_id', user.id)
        .order('parsed_at', { ascending: false })
        .maybeSingle();
      if (prof?.original_html) {
        visionHtml = prof.original_html;
        visionPageCount = prof.original_page_count || 1;
      } else if (pdfPath) {
        try {
          const { data: pdfBlob } = await service.storage.from('resumes').download(pdfPath);
          if (pdfBlob) {
            const buffer = Buffer.from(await pdfBlob.arrayBuffer());
            const { html, pageCount } = await pdfToVisionHtml(buffer);
            visionHtml = html;
            visionPageCount = pageCount;
            await service.from('profiles').update({
              original_html: html,
              original_page_count: pageCount,
              original_pdf_path: pdfPath,
            }).eq('user_id', user.id);
            console.log(`[rolepitch/auto-tailor ${rid}] vision capture complete`, { pageCount });
          }
        } catch (e) {
          console.warn(`[rolepitch/auto-tailor ${rid}] vision capture failed (non-fatal)`, { message: e?.message });
        }
      }

      try {
        const mergedResume = {
          name: tailoredVersion.name || structured_resume?.name || '',
          contact: tailoredVersion.contact || structured_resume?.contact || {},
          summary: tailoredVersion.summary || '',
          experience: tailoredVersion.experience || [],
          education: tailoredVersion.education || [],
          skills: tailoredVersion.skills || [],
        };
        const finalHtml = await renderTailoredHtml({
          originalHtml: visionHtml,
          pageCount: visionPageCount,
          mergedResume,
          jobContext: {
            title: jd.title || '',
            company: jd.company || '',
            description: (jd.description || '').slice(0, 3000),
          },
          buildFastHtml,
        });
        await service
          .from('tailored_resumes')
          .update({ tailored_html: finalHtml })
          .eq('id', trRow.id);
        console.log(`[rolepitch/auto-tailor ${rid}] pre-rendered tailored_html`, { len: finalHtml.length, used_vision: !!visionHtml });
      } catch (e) {
        console.warn(`[rolepitch/auto-tailor ${rid}] pre-render failed (non-fatal)`, { message: e?.message });
      }
    }

    console.log(`[rolepitch/auto-tailor ${rid}] DONE 200`, {
      tailored_resume_id: trRow.id,
      used_mode: usedMode,
      total_ms: Date.now() - t0,
    });

    return NextResponse.json({
      tailored_resume_id: trRow.id,
      used: { mode: usedMode, label: usedLabel },
    });

  } catch (err) {
    console.error(`[rolepitch/auto-tailor ${rid}] UNCAUGHT 500`, {
      total_ms: Date.now() - t0,
      name: err?.name,
      message: err?.message,
      stack: err?.stack?.split('\n').slice(0, 6).join('\n'),
    });
    return NextResponse.json({ error: err.message, rid }, { status: 500 });
  }
}
