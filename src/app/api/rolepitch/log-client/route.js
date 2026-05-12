/**
 * POST /api/rolepitch/log-client
 *
 * Lightweight client-event log sink. Browser uses navigator.sendBeacon to fire
 * diagnostic events here; the route just console.logs them so they land in
 * Vercel runtime logs alongside server-side trace lines.
 *
 * Deliberately NOT auth-gated: anonymous flows (parse, critique, tailor) need
 * to log too. Body is bounded to avoid log spam.
 *
 * Body: { event: string, diag: object }
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 4096;

export async function POST(request) {
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      console.warn('[rolepitch/log-client] oversized body dropped', { len: text.length });
      return NextResponse.json({ ok: false, reason: 'oversized' }, { status: 413 });
    }
    let payload = null;
    try { payload = JSON.parse(text); } catch {
      console.warn('[rolepitch/log-client] non-JSON body', { sample: text.slice(0, 200) });
      return NextResponse.json({ ok: false, reason: 'invalid_json' }, { status: 400 });
    }
    const event = String(payload?.event || 'unknown').slice(0, 64);
    const diag = payload?.diag && typeof payload.diag === 'object' ? payload.diag : {};
    const ua = request.headers.get('user-agent')?.slice(0, 120) || null;
    const ref = request.headers.get('referer')?.slice(0, 200) || null;
    console.log(`[client-log ${event}]`, { ua, ref, ...diag });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[rolepitch/log-client] error', { message: err?.message });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
