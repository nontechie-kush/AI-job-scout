/**
 * GET /api/gmail/auth
 *
 * Generates the Google OAuth consent URL for gmail.readonly scope.
 * Returns { url } — client redirects user to this URL.
 *
 * Requires GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI env vars.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOAuthUrl } from '@/lib/gmail/client';

export async function GET(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REDIRECT_URI) {
      return NextResponse.json(
        { error: 'Gmail OAuth not configured (missing env vars)' },
        { status: 503 },
      );
    }

    const url = getOAuthUrl(user.id);
    return NextResponse.json({ url });
  } catch (err) {
    console.error('[gmail/auth]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
