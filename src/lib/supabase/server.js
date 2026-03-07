/**
 * Supabase server client.
 * Use this in Server Components, API Routes, and middleware.
 * Reads/writes cookies for session management.
 *
 * Input:  Next.js cookies() from 'next/headers'
 * Output: Supabase client with the user's session context
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll called from a Server Component — safe to ignore.
            // Middleware handles session refresh.
          }
        },
      },
    },
  );
}

/**
 * Service-role client for privileged operations (cron jobs, admin).
 * NEVER expose this to the client. Server-side only.
 */
export function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      auth: { persistSession: false },
    },
  );
}
