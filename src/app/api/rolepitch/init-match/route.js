/**
 * POST /api/rolepitch/init-match
 *
 * Creates a job_descriptions row from a JD the user brings (URL or paste),
 * then returns a jd_id that the tailor pipeline can use instead of a
 * job_matches UUID. This is the RolePitch entry point — no job scraping,
 * no match scoring, no fake rows in job_matches.
 *
 * Body:
 *   { url?: string, title?: string, company?: string, description?: string }
 *
 *   Supply either:
 *     - url  → we call /api/fetch-jd to scrape it
 *     - title + description  → use as-is (paste mode)
 *
 * Returns:
 *   { jd_id, title, company, description, source }
 */

import { NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 35;

export async function POST(request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { url, title, company = '', description } = body;

    let jdTitle = title?.trim() || '';
    let jdCompany = company?.trim() || '';
    let jdDescription = description?.trim() || '';
    let source = 'pasted';

    // ── URL path: delegate to fetch-jd ───────────────────────────────
    if (url?.trim()) {
      const fetchRes = await fetch(new URL('/api/fetch-jd', request.url).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Forward cookies so the inner route can auth if needed
          cookie: request.headers.get('cookie') || '',
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!fetchRes.ok) {
        return NextResponse.json({ error: 'fetch-jd failed', source: 'needs_paste' }, { status: 502 });
      }

      const fetched = await fetchRes.json();

      if (fetched.source === 'needs_paste') {
        // Scrape failed — tell the client to fall back to paste mode
        return NextResponse.json({ source: 'needs_paste', reason: fetched.reason });
      }

      jdTitle = fetched.title || jdTitle;
      jdCompany = fetched.company || jdCompany;
      jdDescription = fetched.description || jdDescription;
      source = 'scraped';
    }

    // ── Validate we have something usable ────────────────────────────
    if (!jdDescription || jdDescription.length < 30) {
      return NextResponse.json(
        { error: 'Job description too short — paste the full JD' },
        { status: 400 },
      );
    }
    if (!jdTitle) {
      // Derive a rough title from first line of description
      jdTitle = jdDescription.split('\n')[0].slice(0, 80).trim() || 'Untitled Role';
    }

    // ── Insert job_descriptions row ───────────────────────────────────
    const { data: jd, error: insertErr } = await supabase
      .from('job_descriptions')
      .insert({
        user_id: user.id,
        title: jdTitle,
        company: jdCompany,
        description: jdDescription,
        source,
      })
      .select('id, title, company, description, source')
      .single();

    if (insertErr || !jd) {
      console.error('[rolepitch/init-match] insert error:', insertErr);
      return NextResponse.json({ error: 'Failed to save job description' }, { status: 500 });
    }

    return NextResponse.json({
      jd_id: jd.id,
      title: jd.title,
      company: jd.company,
      description: jd.description,
      source: jd.source,
    });

  } catch (err) {
    console.error('[rolepitch/init-match]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
