/**
 * POST /api/ai/resume-compose
 *
 * Body: {
 *   match_id: string,
 *   brief_id: string,
 *   selections: [{ company, role, atom_ids: [...] }]
 * }
 *
 * Pass 3 of the v2 pipeline. Rephrases selected atoms into resume bullets
 * with cited atom_ids. Runs validation: every numeric token in a bullet must
 * trace to a cited atom (or get rejected for retry).
 *
 * Single Opus call (the only one in the hot path). Cost ~3.5¢ per tailoring.
 *
 * Design: careerpilot-ai/docs/resume-tailor-v2.md (Pass 3 + validation)
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClientFromRequest } from '@/lib/supabase/server';
import { buildResumeComposePrompt } from '@/lib/ai/prompts/resume-compose';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function tolerantParse(rawText) {
  const stripped = rawText
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const first = stripped.indexOf('{');
    const last = stripped.lastIndexOf('}');
    if (first === -1 || last === -1 || last <= first) {
      throw new Error('Composition output unparseable');
    }
    return JSON.parse(stripped.slice(first, last + 1));
  }
}

// Extract numeric tokens we care about from a bullet.
// Catches: 1.8x, 25%, ₹350cr, $2M, 4, 100K, 5+, 10000
// Skips 4-digit years (2024).
// Unit list is closed so we don't accidentally swallow English words like "to" / "in"
// (e.g. "500 to 10,000" would otherwise become "500 to").
function extractNumericTokens(text) {
  const tokens = new Set();
  // Number with optional currency prefix and optional + suffix; trailing unit must be from a known set.
  const KNOWN_UNITS = '(?:%|x|X|k|K|m|M|b|B|cr|lakh|crore|crores|hr|hrs|day|days|wk|weeks|mo|months|yr|yrs)';
  const re = new RegExp(`([\\₹\\$€£]?\\d+(?:[\\.,]\\d+)?\\+?${KNOWN_UNITS}?)`, 'g');
  for (const match of text.matchAll(re)) {
    const tok = (match[1] || '').trim();
    if (!tok || !/\d/.test(tok)) continue;
    // Skip 4-digit years
    if (/^\d{4}$/.test(tok) && parseInt(tok, 10) >= 1990 && parseInt(tok, 10) <= 2100) continue;
    // Normalize comma-separated thousands ("10,000" → "10000") for matching against atoms
    tokens.add(tok.toLowerCase());
    const noComma = tok.toLowerCase().replace(/,/g, '');
    if (noComma !== tok.toLowerCase()) tokens.add(noComma);
  }
  return [...tokens];
}

// A token is "covered" if any of these pass:
//   - it appears in the atom's fact text (case-insensitive substring)
//   - its numeric core matches atom.metric.value (after stripping currency/unit/+/comma)
function isTokenCovered(token, atom) {
  const t = token.toLowerCase().replace(/\s/g, '');
  const fact = (atom.fact || '').toLowerCase().replace(/\s/g, '');
  if (fact.includes(t)) return true;

  // Reduce both sides to bare numbers and compare. Atoms carry the structured
  // value (e.g. 350) while bullet text uses display form (e.g. "₹350+ crore").
  const numericCore = t.replace(/[₹\$€£,+]/g, '').replace(/[a-z%]+$/i, '');
  if (atom.metric && atom.metric.value !== undefined) {
    const metricStr = String(atom.metric.value).toLowerCase();
    if (numericCore === metricStr) return true;
    if (numericCore && metricStr && (numericCore.includes(metricStr) || metricStr.includes(numericCore))) return true;
  }

  // Last resort: numeric core appears anywhere in the fact (catches numbers
  // expressed inline like "from 500 to 10,000" without a structured metric).
  if (numericCore && fact.replace(/,/g, '').includes(numericCore)) return true;

  return false;
}

function validateBullet(bullet, atomsById) {
  const issues = [];

  // 1. Cited atoms exist
  const cited = (bullet.cited_atom_ids || []).map((id) => atomsById.get(id));
  if (cited.some((a) => !a)) {
    issues.push('phantom_citation');
    return { ok: false, issues };
  }
  if (!cited.length) {
    issues.push('no_citations');
    return { ok: false, issues };
  }

  // 2. Numeric coverage
  const numbers = extractNumericTokens(bullet.text);
  for (const n of numbers) {
    const covered = cited.some((a) => isTokenCovered(n, a));
    if (!covered) {
      issues.push(`unsourced_number:${n}`);
    }
  }

  // 3. Word count (warn only, not reject — composition can be over-budget)
  const wordCount = bullet.text.trim().split(/\s+/).length;
  const overBudget = wordCount > 22;

  return {
    ok: issues.length === 0,
    issues,
    word_count: wordCount,
    over_budget: overBudget,
  };
}

export async function POST(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { match_id, brief_id, selections } = await request.json();
    if (!match_id || !brief_id || !Array.isArray(selections)) {
      return NextResponse.json(
        { error: 'match_id, brief_id, selections required' },
        { status: 400 },
      );
    }

    // Load brief
    const { data: brief } = await supabase
      .from('resume_story_briefs')
      .select('id, positioning, key_themes, caliber_signals')
      .eq('id', brief_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!brief) {
      return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
    }

    // Hydrate selected atoms (full fact + metric + tags)
    const allSelectedIds = selections.flatMap((s) => s.atom_ids || []);
    if (!allSelectedIds.length) {
      return NextResponse.json({ error: 'No atoms selected' }, { status: 400 });
    }

    const { data: atoms } = await supabase
      .from('user_experience_memory')
      .select('id, nugget_type, company, role, start_date, end_date, fact, metric, tags')
      .in('id', allSelectedIds)
      .eq('user_id', user.id);

    if (!atoms?.length) {
      return NextResponse.json({ error: 'Selected atoms not found' }, { status: 404 });
    }

    const atomsById = new Map(atoms.map((a) => [a.id, a]));

    // Build per-role groups in the order selections came in
    const roleGroups = selections
      .map((sel) => ({
        company: sel.company,
        role: sel.role,
        atoms: (sel.atom_ids || [])
          .map((id) => atomsById.get(id))
          .filter(Boolean)
          .map((a) => ({
            id: a.id,
            type: a.nugget_type,
            fact: a.fact,
            metric: a.metric,
            tags: a.tags,
            start_date: a.start_date,
            end_date: a.end_date,
          })),
      }))
      .filter((g) => g.atoms.length > 0);

    if (!roleGroups.length) {
      return NextResponse.json({ error: 'No valid role groups to compose' }, { status: 400 });
    }

    const { system, user: userPrompt } = buildResumeComposePrompt({
      brief,
      roleGroups,
    });

    const aiMessage = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 3000,
      temperature: 0.4,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });

    if (aiMessage.stop_reason === 'max_tokens') {
      console.warn('[resume-compose] hit max_tokens — composition truncated');
    }

    const parsed = tolerantParse(aiMessage.content[0].text.trim());
    if (!Array.isArray(parsed.bullets)) {
      console.error('[resume-compose] missing bullets', parsed);
      return NextResponse.json({ error: 'Composition output malformed' }, { status: 500 });
    }

    // Validate each bullet
    const validated = parsed.bullets.map((b) => {
      const v = validateBullet(b, atomsById);
      return {
        ...b,
        validation: v,
      };
    });

    const failed = validated.filter((b) => !b.validation.ok);
    const overBudget = validated.filter((b) => b.validation.over_budget);

    return NextResponse.json({
      brief_id: brief.id,
      bullets: validated,
      stats: {
        total_bullets: validated.length,
        failed_validation: failed.length,
        over_budget_count: overBudget.length,
      },
      failures: failed.map((b) => ({
        text: b.text,
        issues: b.validation.issues,
      })),
      tokens: aiMessage.usage,
    });
  } catch (err) {
    console.error('[resume-compose]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
