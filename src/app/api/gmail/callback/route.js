/**
 * GET /api/gmail/callback?code=...&state=...
 *
 * OAuth callback — exchanges authorization code for tokens,
 * stores them in gmail_tokens table (service role only, no RLS).
 *
 * state = userId (set during /api/gmail/auth redirect).
 * Redirects to /dashboard/tracker on success, /dashboard/profile on error.
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { exchangeCode } from '@/lib/gmail/client';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const userId = searchParams.get('state');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  // User denied access
  if (error || !code || !userId) {
    console.error('[gmail/callback] OAuth error or missing params:', error);
    return NextResponse.redirect(`${appUrl}/dashboard/tracker?gmail=denied`);
  }

  try {
    const tokens = await exchangeCode(code);
    // tokens: { access_token, refresh_token, expires_in, scope, token_type }

    if (!tokens.refresh_token) {
      // This can happen if the user has already authorized and 'prompt=consent' wasn't enforced
      console.error('[gmail/callback] No refresh_token returned');
      return NextResponse.redirect(`${appUrl}/dashboard/tracker?gmail=error`);
    }

    const supabase = createServiceClient();
    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Upsert — one row per user
    const { error: dbError } = await supabase
      .from('gmail_tokens')
      .upsert(
        {
          user_id: userId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expiry: tokenExpiry,
          scope: tokens.scope,
          connected_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

    if (dbError) throw dbError;

    console.log(`[gmail/callback] Gmail connected for user ${userId}`);
    return NextResponse.redirect(`${appUrl}/dashboard/tracker?gmail=connected`);
  } catch (err) {
    console.error('[gmail/callback]', err);
    return NextResponse.redirect(`${appUrl}/dashboard/tracker?gmail=error`);
  }
}
