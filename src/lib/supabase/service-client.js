/**
 * Supabase service-role client — no next/headers dependency.
 * Safe to use in standalone Node.js scripts, GitHub Actions runners,
 * and any server-side context outside Next.js.
 *
 * For Next.js API routes + Server Components, use createServiceClient()
 * from @/lib/supabase/server (which also works there).
 */

import { createClient } from '@supabase/supabase-js';

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
