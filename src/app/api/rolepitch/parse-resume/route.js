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
import { mirrorToDraft } from '@/lib/rolepitch-draft';
import { createServiceClient } from '@/lib/supabase/service-client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Salvage truncated/malformed JSON from LLM output (unterminated string, missing braces).
function salvageJSON(raw) {
  if (!raw) return null;
  let s = raw.trim();
  const firstBrace = s.indexOf('{');
  if (firstBrace > 0) s = s.slice(firstBrace);

  // 1) Try as-is.
  try { return JSON.parse(s); } catch {}

  // 2) Walk the string tracking strings + bracket depth; close anything still open.
  let inStr = false, escape = false;
  const stack = [];
  let lastSafeEnd = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (c === '\\' && inStr) { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{' || c === '[') stack.push(c);
    else if (c === '}' || c === ']') {
      stack.pop();
      if (stack.length === 0) lastSafeEnd = i;
    }
  }

  // 2a) Truncated mid-string — close string, drop trailing partial key/value.
  if (inStr) s = s + '"';
  // Drop trailing comma + partial token after last full key:value.
  s = s.replace(/,\s*"[^"]*"\s*:\s*[^,}\]]*$/, '').replace(/,\s*$/, '');
  // Close remaining open brackets in reverse order.
  for (let i = stack.length - 1; i >= 0; i--) {
    s += stack[i] === '{' ? '}' : ']';
  }
  try { return JSON.parse(s); } catch {}

  // 3) Last resort: truncate to last cleanly-closed top-level object.
  if (lastSafeEnd > 0) {
    try { return JSON.parse(raw.slice(firstBrace > 0 ? firstBrace : 0, lastSafeEnd + 1)); } catch {}
  }
  return null;
}

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

function makeRid() {
  return `pr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function POST(request) {
  const rid = makeRid();
  const t0 = Date.now();
  console.log(`[rolepitch/parse-resume ${rid}] START`);

  try {
    const formData = await request.formData();
    const type = formData.get('type');
    const additionalContext = formData.get('additionalContext') || '';
    const draftId = formData.get('draft_id') || null;
    let textToParse = '';
    // Token returned to clients in the critique flow so they can attach
    // the stored PDF path to the rp_critiques row created in the next step.
    let parseToken = null;
    let pdfPath = null;

    // Map input type to the canonical profiles.source value (per CHECK constraint:
    // 'pdf' | 'website' | 'text' | 'linkedin_pdf' | 'image'). Caller passes this
    // forward to save-resume so the profile row records how the resume came in.
    const canonicalSource =
      type === 'pdf' ? 'pdf'
      : type === 'images' ? 'image'
      : type === 'links_only' ? 'website'
      : 'text'; // paste / text fallback

    console.log(`[rolepitch/parse-resume ${rid}] type=${type}`, {
      canonical_source: canonicalSource,
      has_file: !!formData.get('file'),
      has_text: !!formData.get('text'),
      additional_context_len: additionalContext?.length || 0,
    });

    if (type === 'pdf') {
      const file = formData.get('file');
      if (!file) {
        console.warn(`[rolepitch/parse-resume ${rid}] 400: no file in pdf type`);
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }
      console.log(`[rolepitch/parse-resume ${rid}] pdf input`, { size: file.size, name: file.name, mime: file.type });
      const buffer = Buffer.from(await file.arrayBuffer());
      let pdfData;
      try {
        pdfData = await pdfParse(buffer);
      } catch (pdfErr) {
        console.error(`[rolepitch/parse-resume ${rid}] pdf-parse failed`, { message: pdfErr.message, size: buffer.length });
        return NextResponse.json({ error: 'Could not read this PDF. It may be scanned/image-only — try uploading screenshots instead.' }, { status: 400 });
      }
      textToParse = pdfData.text;
      console.log(`[rolepitch/parse-resume ${rid}] pdf parsed`, { pages: pdfData.numpages, text_len: textToParse.length });

      // Store raw PDF to Supabase Storage — best-effort, non-blocking.
      // Two paths:
      //   draft_id present  → drafts/{draftId}/original.pdf  (mirrored to rp_drafts.pdf_path)
      //   draft_id missing  → critiques/{parse_token}/original.pdf  (returned in body for the
      //                       critique route to attach to rp_critiques.pdf_path)
      try {
        const storageScope = draftId ? `drafts/${draftId}` : null;
        if (!storageScope) {
          parseToken = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : `pt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
        }
        const storagePath = `${storageScope || `critiques/${parseToken}`}/original.pdf`;
        const service = createServiceClient();
        const { error: uploadErr } = await service.storage
          .from('resumes')
          .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true });
        if (uploadErr) {
          console.warn(`[rolepitch/parse-resume ${rid}] pdf storage upload failed (non-fatal)`, { message: uploadErr.message });
        } else {
          pdfPath = storagePath;
          console.log(`[rolepitch/parse-resume ${rid}] pdf stored`, { path: storagePath, scope: storageScope ? 'draft' : 'critique' });
          if (draftId) {
            await mirrorToDraft(draftId, { pdf_path: storagePath }, rid);
          }
        }
      } catch (storageErr) {
        console.warn(`[rolepitch/parse-resume ${rid}] pdf storage threw (non-fatal)`, { message: storageErr?.message });
      }

      // Append any extra files (additional PDFs)
      let idx = 0;
      while (formData.get(`extra_${idx}`)) {
        try {
          const extra = formData.get(`extra_${idx}`);
          const buf = Buffer.from(await extra.arrayBuffer());
          const extraData = await pdfParse(buf);
          textToParse += '\n\n' + extraData.text;
          console.log(`[rolepitch/parse-resume ${rid}] extra pdf #${idx} parsed`, { pages: extraData.numpages });
        } catch (extraErr) {
          console.warn(`[rolepitch/parse-resume ${rid}] extra pdf #${idx} failed`, { message: extraErr.message });
        }
        idx++;
      }
    } else if (type === 'images') {
      // Vision path — single call: send images + parse prompt together using Haiku (fast, vision-capable)
      const imageContents = [];
      let imgIdx = 0;
      while (formData.get(`image_${imgIdx}`)) {
        const img = formData.get(`image_${imgIdx}`);
        const buffer = Buffer.from(await img.arrayBuffer());
        const mediaType = (img.type && img.type.startsWith('image/')) ? img.type : 'image/jpeg';
        imageContents.push({
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') },
        });
        imgIdx++;
      }
      if (imageContents.length === 0) {
        console.warn(`[rolepitch/parse-resume ${rid}] 400: images type but no images`);
        return NextResponse.json({ error: 'No images provided' }, { status: 400 });
      }
      console.log(`[rolepitch/parse-resume ${rid}] vision call`, { image_count: imageContents.length });

      const tVision0 = Date.now();
      let visionMsg;
      try {
        visionMsg = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: [
              ...imageContents,
              { type: 'text', text: `These are screenshots of a resume. ${PARSE_PROMPT}` },
            ],
          }],
        });
      } catch (visionErr) {
        console.error(`[rolepitch/parse-resume ${rid}] vision SDK error`, {
          elapsed_ms: Date.now() - tVision0,
          name: visionErr?.name,
          status: visionErr?.status,
          message: visionErr?.message,
        });
        return NextResponse.json({ error: 'Hit a wall reading your screenshots. Please retry.' }, { status: 502 });
      }
      const visionRawText = visionMsg?.content?.[0]?.text || '';
      console.log(`[rolepitch/parse-resume ${rid}] vision returned`, {
        elapsed_ms: Date.now() - tVision0,
        stop_reason: visionMsg?.stop_reason,
        output_tokens: visionMsg?.usage?.output_tokens,
        raw_len: visionRawText.length,
      });
      const visionRaw = visionRawText.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      let visionParsed;
      try { visionParsed = JSON.parse(visionRaw); }
      catch (e) {
        console.warn(`[rolepitch/parse-resume ${rid}] vision JSON.parse failed, salvaging`, { message: e.message });
        visionParsed = salvageJSON(visionRaw);
      }
      if (!visionParsed) {
        console.error(`[rolepitch/parse-resume ${rid}] vision PARSE FAILED`, {
          stop_reason: visionMsg?.stop_reason,
          raw_head: visionRaw.slice(0, 400),
          raw_tail: visionRaw.slice(-400),
        });
        return NextResponse.json({ error: 'Couldn\'t read your resume cleanly. Try uploading again.', rid }, { status: 502 });
      }
      // Mirror to draft (best-effort; non-fatal)
      if (draftId) {
        await mirrorToDraft(draftId, {
          parsed_resume: visionParsed,
          parsed_source: canonicalSource,
          email: visionParsed?.contact?.email || null,
        }, rid);
      }
      console.log(`[rolepitch/parse-resume ${rid}] DONE 200 (vision)`, { total_ms: Date.now() - t0, draft_mirrored: !!draftId, parse_token: !!parseToken });
      return NextResponse.json({ parsed: visionParsed, detectedLinks: [], source: canonicalSource, parse_token: parseToken, pdf_path: pdfPath });
    } else if (type === 'paste' || type === 'text') {
      textToParse = formData.get('text') || '';
      console.log(`[rolepitch/parse-resume ${rid}] paste input`, { text_len: textToParse.length });
    } else if (type === 'links_only') {
      // Designer/portfolio-only path — no resume file
      textToParse = additionalContext;
      console.log(`[rolepitch/parse-resume ${rid}] links_only input`, { context_len: additionalContext?.length || 0 });
    } else {
      console.warn(`[rolepitch/parse-resume ${rid}] 400: invalid type`, { type });
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    if (!textToParse || textToParse.trim().length < 30) {
      console.warn(`[rolepitch/parse-resume ${rid}] 400: not enough content`, { len: textToParse?.length || 0 });
      return NextResponse.json({ error: 'Not enough content to parse' }, { status: 400 });
    }

    // Merge scraped context from links (capped to avoid token overflow)
    const fullText = additionalContext && type !== 'links_only'
      ? `${textToParse.slice(0, 10000)}\n\n${additionalContext.slice(0, 4000)}`
      : textToParse.slice(0, 14000);

    console.log(`[rolepitch/parse-resume ${rid}] anthropic.messages.create — calling`, {
      model: 'claude-opus-4-6',
      max_tokens: 8000,
      full_text_len: fullText.length,
    });

    const tClaude0 = Date.now();
    let message;
    try {
      message = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 8000,
        messages: [{ role: 'user', content: `${PARSE_PROMPT}\n\n---\n${fullText}\n---` }],
      });
    } catch (sdkErr) {
      console.error(`[rolepitch/parse-resume ${rid}] anthropic SDK error`, {
        elapsed_ms: Date.now() - tClaude0,
        name: sdkErr?.name,
        status: sdkErr?.status,
        message: sdkErr?.message,
        request_id: sdkErr?.request_id,
      });
      return NextResponse.json({ error: 'Hit a wall calling the parser. Please retry.', rid }, { status: 502 });
    }

    const rawText = message?.content?.[0]?.text || '';
    console.log(`[rolepitch/parse-resume ${rid}] anthropic returned`, {
      elapsed_ms: Date.now() - tClaude0,
      stop_reason: message?.stop_reason,
      input_tokens: message?.usage?.input_tokens,
      output_tokens: message?.usage?.output_tokens,
      raw_len: rawText.length,
    });

    const raw = rawText.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      console.warn(`[rolepitch/parse-resume ${rid}] JSON.parse failed, attempting salvage`, { message: parseErr.message });
      parsed = salvageJSON(raw);
      if (!parsed) {
        console.error(`[rolepitch/parse-resume ${rid}] PARSE FAILED (salvage too)`, {
          stop_reason: message?.stop_reason,
          truncated: message?.stop_reason === 'max_tokens',
          raw_len: raw.length,
          raw_head: raw.slice(0, 400),
          raw_tail: raw.slice(-400),
        });
        return NextResponse.json({ error: 'Couldn\'t read your resume cleanly. Try uploading again or pasting the text.', rid }, { status: 502 });
      }
      console.log(`[rolepitch/parse-resume ${rid}] salvaged JSON OK`);
    }

    console.log(`[rolepitch/parse-resume ${rid}] parsed`, {
      has_name: !!parsed?.name,
      experience_count: parsed?.experience?.length || 0,
      total_bullets: (parsed?.experience || []).reduce((s, r) => s + (r.bullets?.length || 0), 0),
      skills_count: parsed?.skills?.length || 0,
    });

    // Regex fallback for contact fields that pdf-parse misses from table/header layouts.
    // Claude extracts well from prose but table cells often become whitespace-mangled text.
    if (parsed && typeof parsed === 'object') {
      if (!parsed.contact) parsed.contact = {};

      // Phone: +91 XXXXXXXXXX  /  +1-XXX-XXX-XXXX  /  10-digit Indian numbers
      if (!parsed.contact.phone) {
        const phoneMatch = textToParse.match(
          /(?:\+\d{1,3}[\s\-]?)?(?:\(?\d{2,4}\)?[\s\-]?)?\d{3,5}[\s\-]?\d{4,5}/
        );
        if (phoneMatch) {
          const candidate = phoneMatch[0].replace(/\s+/g, '').trim();
          // Only accept if it looks like a real phone (7+ digits)
          if (candidate.replace(/\D/g, '').length >= 7) {
            parsed.contact.phone = candidate;
          }
        }
      }

      // LinkedIn: any linkedin.com/in/ URL in the raw text
      if (!parsed.contact.linkedin) {
        const liMatch = textToParse.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[^\s"'<>)\],]+/i)
          || textToParse.match(/linkedin\.com\/in\/[^\s"'<>)\],]+/i);
        if (liMatch) {
          parsed.contact.linkedin = liMatch[0].startsWith('http')
            ? liMatch[0]
            : `https://www.${liMatch[0]}`;
        }
      }

      // Email fallback (should rarely be needed but covers edge cases)
      if (!parsed.contact.email) {
        const emailMatch = textToParse.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) parsed.contact.email = emailMatch[0];
      }
    }

    // Auto-detect links in the resume text for the enrichment nudge
    const urlRegex = /https?:\/\/[^\s"'<>)\],]+/gi;
    const rawLinks = (textToParse.match(urlRegex) || []);
    const KNOWN_PROFILE_HOSTS = ['linkedin.com', 'github.com', 'huggingface.co', 'framer.com', 'behance.net', 'dribbble.com', 'notion.so', 'medium.com', 'substack.com'];
    const detectedLinks = [...new Set(rawLinks)]
      .filter(u => KNOWN_PROFILE_HOSTS.some(h => u.includes(h)))
      .slice(0, 5);

    // Mirror to draft (best-effort; non-fatal)
    if (draftId) {
      await mirrorToDraft(draftId, {
        parsed_resume: parsed,
        parsed_source: canonicalSource,
        email: parsed?.contact?.email || null,
      }, rid);
    }

    console.log(`[rolepitch/parse-resume ${rid}] DONE 200`, { total_ms: Date.now() - t0, detected_links: detectedLinks.length, draft_mirrored: !!draftId, parse_token: !!parseToken });
    return NextResponse.json({ parsed, detectedLinks, source: canonicalSource, parse_token: parseToken, pdf_path: pdfPath });
  } catch (err) {
    console.error(`[rolepitch/parse-resume ${rid}] UNCAUGHT 500`, {
      total_ms: Date.now() - t0,
      name: err?.name,
      message: err?.message,
      stack: err?.stack?.split('\n').slice(0, 6).join('\n'),
    });
    return NextResponse.json({ error: err.message, rid }, { status: 500 });
  }
}
