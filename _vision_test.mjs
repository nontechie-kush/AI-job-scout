import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'node:fs';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const imageData = readFileSync('/tmp/kush_hires-1.png').toString('base64');

const SYSTEM = `You are a senior front-end engineer recreating a resume from a screenshot as ONE complete HTML document.

OUTPUT RULES
- Output ONLY the HTML, starting with <!DOCTYPE html> and ending with </html>. No markdown fences. No commentary.
- Inline <style> in <head>. No external resources, no images, no @import, no fonts.googleapis.
- Preserve every word, number, punctuation, em-dash, arrow (\u2192), rupee symbol (\u20b9) EXACTLY as shown.

VISUAL FIDELITY (very important)
- Match font family: serif resumes use 'Times New Roman', Georgia, serif. Sans use -apple-system, 'Helvetica Neue', sans-serif.
- BOLD PRESERVATION: scan every word. If a word/phrase is visually heavier than its neighbors, wrap it in <strong>. When unsure, lean toward bolding metric numbers (e.g. "1.8x", "25% CTR uptick", "\u20b9350+ cr"), named features ("Partner Loyalty Program", "First Right of Refusal"), and key verbs that start bullets ("Increased", "Boosted", "Achieved", "Launched"). Section headers like EXPERIENCE / EDUCATION are always bold.
- ITALICS: subtitles like "Promoted from PM to SPM In 6 months" or company taglines in parentheses are italic — wrap in <em>.
- UNDERLINES: words explicitly underlined (links, sub-headings like "Product Growth – Partner Sales", "Retention -  Partner Loyalty Program") use <u> or text-decoration: underline.
- Match alignment: company name LEFT, location/dates RIGHT — use flexbox with justify-content: space-between on each row.
- Preserve bullet hierarchy: top-level bullets use \u2022 (filled disc), sub-bullets use \u25e6 (open circle) at deeper indent.
- If the original has a single thin black border around the whole page, recreate it with border: 1px solid #000 and inner padding.

PAGE FIT (critical — read carefully)
- Target ONE Letter page. @page { size: letter; margin: 0; } and use a single .page wrapper with padding: 0.5in (acts as the page margin).
- If the original has a border, put it on .page with: border: 1px solid #000. Border lives INSIDE the 0.5in padding so it appears as a framed page.
- Use 10.5pt body, line-height 1.25 as a starting point.
- CRITICAL: content must fill 90–100% of the printable area vertically. Estimate the content density: count roles, bullets, sections. If content is light (will leave bottom blank), INCREASE section margin-bottom (e.g. 12–16px) and bullet margin-bottom (4–6px) until it visually fills the page. If content is dense (would overflow to page 2), DECREASE to 4–8px section margin and 1–2px bullet margin, or drop body to 10pt. Never let content end before 85% of page height. Never let it spill to page 2.
- Section header (EXPERIENCE, EDUCATION) margin-top: 8–14px depending on density.
- DO NOT add any inner padding inside .page beyond the 0.5in. The border-to-text gap should look like a normal printed page (~0.4–0.5in).

SEMANTICS
- Use semantic tags: <header>, <section>, <h1>, <h2>, <h3>, <ul>, <li>, <p>, <strong>, <em>, <u>, <a>.
- Each job role is one <section> containing role header + <ul> of bullets.
- Sub-bullets are nested <ul> inside <li>.`;

const USER = `Recreate this resume as one complete printable HTML document. Match every bold word, every italic, every underline you see in the image.`;

const t0 = Date.now();
const resp = await client.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 16000,
  system: SYSTEM,
  messages: [{
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageData } },
      { type: 'text', text: USER },
    ],
  }],
});

const html = resp.content[0].text;
const cleaned = html.replace(/^\s*```html\s*\n/i, '').replace(/\n```\s*$/, '').trim();
writeFileSync('/tmp/kush_vision_v5.html', cleaned);
console.log('elapsed:', ((Date.now() - t0) / 1000).toFixed(1), 's');
console.log('html size:', html.length, 'bytes');
console.log('input tokens:', resp.usage.input_tokens, 'output tokens:', resp.usage.output_tokens);
const cost = (resp.usage.input_tokens * 3 + resp.usage.output_tokens * 15) / 1e6;
console.log('cost: $' + cost.toFixed(4));
console.log('strong tags:', (html.match(/<strong/g) || []).length);
console.log('em tags:', (html.match(/<em/g) || []).length);
console.log('u tags:', (html.match(/<u[> ]/g) || []).length);
