/**
 * Supabase OAuth callback handler.
 * Exchanges the code from Google OAuth for a session.
 * Redirects to /onboarding for new users, /dashboard for returning users.
 *
 * GET /api/auth/callback?code=...&next=/dashboard
 *
 * IMPORTANT: cookies must be set on the redirect Response object directly,
 * not via next/headers cookieStore — a NextResponse.redirect() is a new
 * Response and won't inherit cookies set via cookieStore.set().
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    // Build the redirect response first so we can write cookies onto it directly
    const redirectResponse = NextResponse.redirect(`${origin}/onboarding`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            // Write session cookies onto the redirect response — this is the key fix.
            // If we used next/headers cookieStore.set() here, cookies would be lost
            // because NextResponse.redirect() creates a fresh Response object.
            cookiesToSet.forEach(({ name, value, options }) => {
              redirectResponse.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check onboarding status to decide where to redirect
      const { data: { user } } = await supabase.auth.getUser();
      const { data: userRow } = await supabase
        .from('users')
        .select('onboarding_completed')
        .eq('id', user?.id)
        .single();

      // RolePitch flow: source=rolepitch in next param → return to rolepitch start
      const isRolePitch = next.includes('source=rolepitch') || next.startsWith('/rolepitch');
      let destination;
      if (isRolePitch) {
        destination = next.startsWith('/') ? next : '/rolepitch/start';
      } else {
        destination = userRow?.onboarding_completed ? next : '/onboarding';
      }
      redirectResponse.headers.set('location', `${origin}${destination}`);
      return redirectResponse;
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=oauth_failed`);
}
