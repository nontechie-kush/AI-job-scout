/**
 * getAuthUser(supabase, request)
 *
 * Supports both auth methods:
 *   1. Cookie-based (web app, standard SSR)
 *   2. Bearer token (Chrome extension — has no cookies)
 *
 * Returns the Supabase user or null.
 */
export async function getAuthUser(supabase, request) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const { data: { user } } = await supabase.auth.getUser(token);
    return user;
  }
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
