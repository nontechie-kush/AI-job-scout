/**
 * POST /api/rolepitch/parse-resume
 *
 * Unauthenticated resume parser for RolePitch flow (pre-login step 1).
 * Parses PDF/text and returns structured JSON without saving to DB.
 *
 * Accepts multipart/form-data:
 *   type: 'pdf' | 'paste'
 *   file: File   (pdf)
 *   text: string (paste)
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import pdfParse from 'pdf-parse';

export const dynamic = 'force-dynamic';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PARSE_PROMPT = `You are parsing a candidate resume to extract structured data for a resume tailoring tool.

Return ONLY a valid JSON object — no markdown, no explanation, no code fences. Just raw JSON.

{
  "name": "full name or null",
  "title": "most recent job title",
  "years_exp": <integer: total years of relevant professional experience>,
  "seniority": "junior | mid | senior | lead | principal | executive",
  "skills": ["up to 10 most relevant skills"],
  "companies": ["companies worked at, most recent first"],
  "education": "highest degree + institution, or null",
  "candidate_edges": ["1-3 specific competitive advantages — concrete, never generic"],
  "keywords": ["15-20 keywords for job matching"],
  "contact": {
    "email": "email or null",
    "phone": "phone or null",
    "location": "city/country or null",
    "linkedin": "linkedin URL or null"
  },
  "experience": [
    {
      "title": "job title",
      "company": "company name",
      "location": "city or null",
      "start_date": "YYYY-MM or null",
      "end_date": "YYYY-MM or null (null = present)",
      "bullets": [{"text": "achievement bullet", "type": "achievement|skill|metric|context"}]
    }
  ],
  "education_detail": [
    {
      "degree": "degree name",
      "institution": "school name",
      "start_date": "YYYY-MM or null",
      "end_date": "YYYY-MM or null"
    }
  ],
  "summary": "2-3 sentence professional summary based on their background"
}

Rules:
- Be accurate. Use null for missing fields, never fabricate.
- candidate_edges must be genuinely specific and interview-ready.
- Classify each bullet as: achievement (measurable outcome), skill (demonstrates a capability), metric (quantified result), or context (background/team info).`;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const type = formData.get('type');
    const additionalContext = formData.get('additionalContext') || '';
    let textToParse = '';

    if (type === 'pdf') {
      const file = formData.get('file');
      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      const buffer = Buffer.from(await file.arrayBuffer());
      const pdfData = await pdfParse(buffer);
      textToParse = pdfData.text;
    } else if (type === 'paste' || type === 'text') {
      textToParse = formData.get('text') || '';
    } else if (type === 'links_only') {
      // Designer/portfolio-only path — no resume file
      textToParse = additionalContext;
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    if (!textToParse || textToParse.trim().length < 30) {
      return NextResponse.json({ error: 'Not enough content to parse' }, { status: 400 });
    }

    // Merge scraped context from links (capped to avoid token overflow)
    const fullText = additionalContext && type !== 'links_only'
      ? `${textToParse.slice(0, 10000)}\n\n${additionalContext.slice(0, 4000)}`
      : textToParse.slice(0, 14000);

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: `${PARSE_PROMPT}\n\n---\n${fullText}\n---` }],
    });

    const raw = message.content[0].text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const parsed = JSON.parse(raw);

    // Auto-detect links in the resume text for the enrichment nudge
    const urlRegex = /https?:\/\/[^\s"'<>)\],]+/gi;
    const rawLinks = (textToParse.match(urlRegex) || []);
    const KNOWN_PROFILE_HOSTS = ['linkedin.com', 'github.com', 'huggingface.co', 'framer.com', 'behance.net', 'dribbble.com', 'notion.so', 'medium.com', 'substack.com'];
    const detectedLinks = [...new Set(rawLinks)]
      .filter(u => KNOWN_PROFILE_HOSTS.some(h => u.includes(h)))
      .slice(0, 5);

    return NextResponse.json({ parsed, detectedLinks });
  } catch (err) {
    console.error('[rolepitch/parse-resume]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
