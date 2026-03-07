/**
 * Supabase browser client.
 * Use this in Client Components ('use client').
 * Creates one instance per browser session via singleton pattern.
 */
import { createBrowserClient } from '@supabase/ssr';

let client;

export function createClient() {
  if (client) return client;
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return client;
}
