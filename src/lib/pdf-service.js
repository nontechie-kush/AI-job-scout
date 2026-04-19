/**
 * Thin client for the self-hosted PDF service (Hetzner CX23).
 *
 * Two endpoints:
 *   POST /html-to-pdf  — JSON { html, format? } → application/pdf bytes
 *   POST /pdf-to-png   — multipart file → { png_base64, page_count }
 *
 * Both require the x-pdf-secret header. Configured via:
 *   PDF_SERVICE_URL    e.g. http://178.104.202.198:8080  (later: https://pdf.yourdomain.com)
 *   PDF_SERVICE_SECRET 64-char hex
 */

const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL;
const PDF_SERVICE_SECRET = process.env.PDF_SERVICE_SECRET;

function assertConfigured() {
  if (!PDF_SERVICE_URL || !PDF_SERVICE_SECRET) {
    throw new Error('PDF_SERVICE_URL and PDF_SERVICE_SECRET env vars required');
  }
}

/**
 * Render HTML to a PDF Buffer via Puppeteer on the pdf-service.
 * @param {string} html - complete HTML document (must include <!DOCTYPE html>)
 * @param {object} opts
 * @param {string} [opts.format='Letter'] - 'Letter' or 'A4'
 * @returns {Promise<Buffer>}
 */
export async function htmlToPdf(html, { format = 'Letter' } = {}) {
  assertConfigured();
  const res = await fetch(`${PDF_SERVICE_URL}/html-to-pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-pdf-secret': PDF_SERVICE_SECRET,
    },
    body: JSON.stringify({ html, format }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`pdf-service /html-to-pdf ${res.status}: ${text.slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
