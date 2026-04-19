/**
 * Convert a resume PDF buffer to clean, semantic HTML using Claude vision.
 *
 * Pipeline:
 *   PDF buffer → render first page to PNG (300 DPI) via pdf-service
 *   PNG → Claude Sonnet 4.6 vision → semantic HTML
 *   Strip markdown fences → return { html, pageCount }
 *
 * Falls back to a generic-template HTML built from parsed_json when no PDF
 * is available (existing users without their original upload on disk).
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VISION_SYSTEM = `You are a senior front-end engineer recreating a resume from a screenshot as ONE complete HTML document.

OUTPUT RULES
- Output ONLY the HTML, starting with <!DOCTYPE html> and ending with </html>. No markdown fences. No commentary.
- Inline <style> in <head>. No external resources, no images, no @import, no fonts.googleapis.
- Preserve every word, number, punctuation, em-dash, arrow (→), rupee symbol (₹) EXACTLY as shown.

VISUAL FIDELITY
- Match font family: serif resumes use 'Times New Roman', Georgia, serif. Sans use -apple-system, 'Helvetica Neue', sans-serif.
- BOLD PRESERVATION: scan every word. If a word/phrase is visually heavier than its neighbors, wrap it in <strong>. Lean toward bolding metric numbers (e.g. "1.8x", "25% CTR uptick"), named features ("Partner Loyalty Program"), and key bullet-starting verbs ("Increased", "Boosted", "Achieved", "Launched"). Section headers are always bold.
- ITALICS: subtitles like "Promoted from PM to SPM" or company taglines in parentheses use <em>.
- UNDERLINES: explicitly underlined words (links, sub-headings) use <u>.
- ALIGNMENT: company name LEFT, location/dates RIGHT — use flexbox with justify-content: space-between.
- BULLET HIERARCHY: top-level uses •, sub-bullets use ◦ at deeper indent.
- If the original has a single thin black border, recreate with border: 1px solid #000.

PAGE FIT
- @page { size: letter; margin: 0; }. Use a single .page wrapper with padding: 0.5in (acts as the page margin).
- Border (if present) sits on .page so it appears as a framed page.
- Match the source's visual density: similar font size (9.5–10.5pt), similar spacing.
- Output must fit in approximately the SAME number of pages as the source. Do not over-tighten or over-loosen.

SEMANTICS
- Use semantic tags: <header>, <section>, <h1>, <h2>, <h3>, <ul>, <li>, <p>, <strong>, <em>, <u>, <a>.
- Each job role is one <section> with role header + <ul> of bullets.
- Sub-bullets are nested <ul> inside <li>.`;

const FALLBACK_SYSTEM = `You are a senior front-end engineer building a clean, professional resume from structured data.

Output ONE complete HTML document starting with <!DOCTYPE html> and ending with </html>. No markdown fences. No commentary.
Inline <style>. No external resources. Use 'Times New Roman', Georgia, serif. 10.5pt body, 1.25 line-height.
@page { size: letter; margin: 0; }. Use a .page wrapper with padding: 0.5in and a thin black border.
Layout: centered name + contact, EXPERIENCE section with each role as company/title left, dates right (flexbox).
Bullets use • markers. Use <strong> for metric numbers (e.g. "1.8x", "25% growth") and key feature names.
Use <em> for role taglines (e.g. "Promoted from PM to SPM"). Sections: EXPERIENCE, EDUCATION, SKILLS (if present).
Output must fit on ONE printed Letter page.`;

const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL;
const PDF_SERVICE_SECRET = process.env.PDF_SERVICE_SECRET;

/**
 * Render a PDF's first page to a PNG buffer at 300 DPI by calling the
 * self-hosted pdf-service /pdf-to-png endpoint.
 *
 * If that endpoint isn't available (older deploys), we fall back to sending
 * the PDF bytes inline to Claude — vision can read PDFs directly.
 */
async function pdfToPng(pdfBuffer) {
  if (!PDF_SERVICE_URL || !PDF_SERVICE_SECRET) {
    throw new Error('PDF_SERVICE_URL and PDF_SERVICE_SECRET required');
  }
  const form = new FormData();
  form.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), 'in.pdf');
  const res = await fetch(`${PDF_SERVICE_URL}/pdf-to-png`, {
    method: 'POST',
    headers: { 'x-pdf-secret': PDF_SERVICE_SECRET },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`pdf-service /pdf-to-png ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return {
    png: Buffer.from(data.png_base64, 'base64'),
    pageCount: data.page_count,
  };
}

function stripFences(html) {
  return html
    .replace(/^\s*```(?:html)?\s*\n/i, '')
    .replace(/\n```\s*$/, '')
    .trim();
}

/**
 * Generate semantic HTML from a resume PDF buffer using vision.
 * Returns { html, pageCount }.
 */
export async function pdfToVisionHtml(pdfBuffer) {
  const { png, pageCount } = await pdfToPng(pdfBuffer);

  const resp = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 16000,
    system: VISION_SYSTEM + `\n\nThe source PDF is ${pageCount} page(s). Match this in your output.`,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: png.toString('base64') } },
        { type: 'text', text: `Recreate this resume as one complete printable HTML document. Match every bold, italic, underline you see.` },
      ],
    }],
  });

  return {
    html: stripFences(resp.content[0].text),
    pageCount,
  };
}

/**
 * Fallback: build HTML from structured JSON when the original PDF isn't
 * available (existing users who onboarded before vision capture existed).
 * Result is a clean generic template, not pixel-identical to original.
 */
export async function jsonToFallbackHtml(parsedJson, structuredResume) {
  const payload = {
    name: parsedJson?.name || '',
    title: parsedJson?.title || '',
    education: parsedJson?.education || '',
    skills: parsedJson?.skills || [],
    structured: structuredResume || null,
  };

  const resp = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 12000,
    system: FALLBACK_SYSTEM,
    messages: [{
      role: 'user',
      content: `Build a clean, professional resume HTML from this candidate data:\n\n${JSON.stringify(payload, null, 2)}`,
    }],
  });

  return {
    html: stripFences(resp.content[0].text),
    pageCount: 1,
  };
}
