/**
 * Supabase OAuth callback handler.
 * Exchanges the code from Google OAuth for a session.
 * Redirects to /onboarding for new users, /dashboard for returning users.
 *
 * GET /api/auth/callback?code=...&next=/dashboard
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check onboarding status
      const { data: { user } } = await supabase.auth.getUser();
      const { data: userRow } = await supabase
        .from('users')
        .select('onboarding_completed')
        .eq('id', user.id)
        .single();

      const destination = userRow?.onboarding_completed ? next : '/onboarding';
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  // Auth error — redirect to login with error param
  return NextResponse.redirect(`${origin}/auth/login?error=oauth_failed`);
}
