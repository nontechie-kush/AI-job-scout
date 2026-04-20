/**
 * Next.js Middleware — runs on every request before rendering.
 *
 * Responsibilities:
 * 1. Refresh Supabase session cookie (keeps users logged in)
 * 2. Protect /dashboard routes — redirect to /auth/login if no session
 * 3. Redirect logged-in users away from /auth pages
 * 4. Protect /api/cron routes with CRON_SECRET header
 */
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

const ROLEPITCH_HOSTS = ['rolepitch.com', 'www.rolepitch.com'];

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') || '';
  const isRolePitch = ROLEPITCH_HOSTS.some(h => host === h || host.startsWith(h));

  // ── RolePitch hostname routing ──────────────────────────────────
  // rolepitch.com/ → rewrite to /rolepitch
  // rolepitch.com/start → rewrite to /rolepitch/start
  // rolepitch.com/api/* → pass through without rewriting
  if (isRolePitch && !pathname.startsWith('/api') && !pathname.startsWith('/auth')) {
    const rpPath = pathname === '/' ? '/rolepitch' : `/rolepitch${pathname}`;
    const url = request.nextUrl.clone();
    url.pathname = rpPath;
    return NextResponse.rewrite(url);
  }

  // ── Protect cron endpoints ──────────────────────────────────────
  if (pathname.startsWith('/api/cron')) {
    const secret = request.headers.get('x-cron-secret');
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // ── Supabase session refresh ────────────────────────────────────
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh session — with timeout so DNS issues don't hang every request
  let user = null;
  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 500)),
    ]);
    user = result?.data?.user ?? null;
  } catch {
    // Supabase unreachable — skip auth guards, allow page to load
    return supabaseResponse;
  }

  // ── Route guards ────────────────────────────────────────────────
  const isDashboard = pathname.startsWith('/dashboard');
  const isAuth = pathname.startsWith('/auth');

  if (isDashboard && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  if (isAuth && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
