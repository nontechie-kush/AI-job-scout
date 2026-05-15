import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service-client';
import { buildStructuredResume } from '@/lib/rolepitch/resume';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function extractJson(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/```json|```/g, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try { return JSON.parse(cleaned.slice(first, last + 1)); } catch {}
  }
  return null;
}

function resumeForPrompt(profile) {
  const parsed = profile?.parsed_json || {};
  const structured = profile?.structured_resume || {};
  const base = Object.keys(structured).length ? structured : parsed;
  return buildStructuredResume(base);
}

function mergeDraftResume(proposed, fallback) {
  const draft = buildStructuredResume(proposed || {});
  const base = buildStructuredResume(fallback || {});
  const draftContact = draft.contact || {};
  const baseContact = base.contact || {};

  return {
    ...draft,
    name: draft.name || base.name || '',
    title: draft.title || draft.experience?.[0]?.title || base.title || base.experience?.[0]?.title || '',
    contact: {
      ...baseContact,
      ...Object.fromEntries(
        Object.entries(draftContact).filter(([, value]) => value !== undefined && value !== null && value !== '')
      ),
    },
    summary: draft.summary || base.summary || '',
    experience: draft.experience?.length ? draft.experience : base.experience || [],
    education: draft.education?.length ? draft.education : base.education || [],
    skills: draft.skills?.length ? draft.skills : base.skills || [],
  };
}

function normalizeMessages(messages = []) {
  return messages
    .filter(m => m && typeof m.content === 'string' && m.content.trim())
    .slice(-10)
    .map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content.trim().slice(0, 5000),
    }));
}

export async function POST(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const service = createServiceClient();
    const { data: profile, error } = await service
      .from('profiles')
      .select('id, parsed_json, structured_resume, original_html, original_pdf_path, parsed_at')
      .eq('user_id', user.id)
      .order('parsed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!profile) return NextResponse.json({ error: 'No base resume found' }, { status: 404 });

    const currentResume = body.current_draft && typeof body.current_draft === 'object'
      ? buildStructuredResume(body.current_draft)
      : resumeForPrompt(profile);

    const messages = normalizeMessages(body.messages);
    const preferences = {
      keep_design: body.keep_design !== 'no',
      page_preference: body.page_preference === 'flexible' ? 'flexible' : 'one_page',
      update_type: body.update_type || 'general',
    };

    if (!messages.length) {
      return NextResponse.json({ error: 'Tell RolePitch what changed first.' }, { status: 400 });
    }

    const prompt = `You update a user's master/base resume for RolePitch.

Return ONLY valid JSON with this shape:
{
  "resume": {
    "name": "",
    "title": "",
    "contact": {"email": "", "phone": "", "location": "", "linkedin": ""},
    "summary": "",
    "experience": [
      {
        "title": "",
        "company": "",
        "location": "",
        "start_date": "YYYY-MM or null",
        "end_date": "YYYY-MM or null",
        "bullets": [{"text": "", "type": "achievement|skill|metric|context"}]
      }
    ],
    "education": [{"degree": "", "institution": "", "location": "", "start_date": null, "end_date": null}],
    "skills": []
  },
  "assistant_note": "short human note explaining what changed",
  "change_summary": ["3-6 concise bullets of what changed"],
  "review_flags": ["0-4 risks, tradeoffs, or missing details for the user to review"],
  "follow_up_questions": ["0-3 questions only if needed before final save"]
}

Rules:
- Preserve truthful facts. Never invent companies, dates, schools, percentages, revenue, team size, or tools.
- If the user gives vague achievements, write strong but metric-safe bullets without fake numbers.
- If page_preference is one_page, keep the resume tight. Prefer strengthening the newest/current role and compressing older roles.
- If keep_design is true, avoid major section sprawl and warn if added content may affect layout.
- If keep_design is false, you may optimize for an ATS-friendly layout, but still return the same structured JSON.
- Keep contact/name from the current resume unless the user explicitly changes them.
- Always return the user's name, title/headline, contact, summary, education, and skills. Do not omit fields just because they did not change.
- Keep output globally usable for US, UAE, India, and remote roles. Avoid country-specific assumptions.
- The user's latest instruction wins, but retain useful content from the current resume.

Preferences:
${JSON.stringify(preferences, null, 2)}

Current resume:
${JSON.stringify(currentResume, null, 2)}

Conversation:
${JSON.stringify(messages, null, 2)}`;

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8000,
      temperature: 0.25,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = msg.content?.[0]?.text || '';
    const parsed = extractJson(raw);
    if (!parsed?.resume) {
      console.error('[rolepitch/base-resume/draft] parse failed', { raw: raw.slice(0, 500) });
      return NextResponse.json({ error: 'Could not draft the update. Try adding a little more detail.' }, { status: 502 });
    }

    const mergedResume = mergeDraftResume(parsed.resume, currentResume);

    return NextResponse.json({
      ok: true,
      resume: mergedResume,
      assistant_note: parsed.assistant_note || 'I drafted an updated base resume for review.',
      change_summary: Array.isArray(parsed.change_summary) ? parsed.change_summary.slice(0, 8) : [],
      review_flags: Array.isArray(parsed.review_flags) ? parsed.review_flags.slice(0, 6) : [],
      follow_up_questions: Array.isArray(parsed.follow_up_questions) ? parsed.follow_up_questions.slice(0, 4) : [],
    });
  } catch (err) {
    console.error('[rolepitch/base-resume/draft]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
