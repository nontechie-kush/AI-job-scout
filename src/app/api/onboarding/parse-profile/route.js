/**
 * POST /api/onboarding/parse-profile
 *
 * Accepts multipart/form-data:
 *   type: 'pdf' | 'website' | 'paste'
 *   file: File             (pdf)
 *   url: string            (website)
 *   text: string           (paste)
 *
 * Returns JSON:
 *   { name, title, years_exp, seniority, skills[], companies[], education, strongest_card, keywords[] }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PARSE_PROMPT = `You are parsing a candidate resume or professional profile to extract structured data.

Return ONLY a valid JSON object — no markdown, no explanation, no code fences. Just raw JSON.

{
  "name": "full name or null",
  "title": "most recent job title or the most fitting target title based on experience",
  "years_exp": <integer: total years of relevant professional experience>,
  "seniority": "junior | mid | senior | lead | principal | executive",
  "skills": ["array of up to 10 most relevant technical and professional skills"],
  "companies": ["companies worked at, most recent first"],
  "education": "highest degree + institution, or null",
  "strongest_card": "one specific sentence — this candidate's single biggest differentiator. Make it concrete and specific to this person, never generic.",
  "keywords": ["15-20 keywords for job matching — mix of skills, domains, tools, and role types"]
}

Rules:
- Be accurate. If something is not clear, use null — do not fabricate.
- "strongest_card" must be genuinely specific. Never write "experienced professional with proven track record."
- "skills" must be actual skills — not job duties.
- years_exp: estimate conservatively from what's available.`;

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const type = formData.get('type');
    let textToParse = '';

    if (type === 'pdf' || type === 'docx') {
      const file = formData.get('file');
      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Detect format by MIME type or filename extension
      const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        || (file.name || '').toLowerCase().endsWith('.docx');

      if (isDocx) {
        const result = await mammoth.extractRawText({ buffer });
        textToParse = result.value;
      } else {
        const pdfData = await pdfParse(buffer);
        textToParse = pdfData.text;
      }
    } else if (type === 'website') {
      const url = formData.get('url');
      if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 });

      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CareerPilot/1.0)' },
        signal: AbortSignal.timeout(8000),
      });
      const html = await res.text();

      const { load } = await import('cheerio');
      const $ = load(html);
      $('script, style, nav, footer, header, [aria-hidden="true"]').remove();
      textToParse = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 8000);
    } else if (type === 'paste' || type === 'text') {
      textToParse = formData.get('text') || '';
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    if (!textToParse || textToParse.trim().length < 30) {
      return NextResponse.json({ error: 'Not enough content to parse' }, { status: 400 });
    }

    // Call Claude
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `${PARSE_PROMPT}\n\n---\n${textToParse.slice(0, 12000)}\n---`,
        },
      ],
    });

    const raw = message.content[0].text.trim();
    // Strip markdown code fences if model wraps output anyway
    const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const parsed = JSON.parse(jsonStr);

    // Persist to profiles table (select → update or insert, avoids unique constraint dependency)
    const profileData = {
      user_id: user.id,
      raw_text: textToParse.slice(0, 20000),
      source: (type === 'pdf' || type === 'docx') ? 'pdf' : type === 'website' ? 'website' : 'text',
      parsed_json: parsed,
      parsed_at: new Date().toISOString(),
      claude_model: 'claude-opus-4-6',
    };

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    const { error: saveError } = existing
      ? await supabase.from('profiles').update(profileData).eq('user_id', user.id)
      : await supabase.from('profiles').insert(profileData);

    if (saveError) {
      console.error('[parse-profile] DB save failed:', saveError.message);
      throw new Error(`Profile save failed: ${saveError.message}`);
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('[parse-profile]', err);
    return NextResponse.json({ error: 'Parse failed. Try again.' }, { status: 500 });
  }
}
