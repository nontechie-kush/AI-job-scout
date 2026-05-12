import { createClient } from '@supabase/supabase-js';

const TENANT_NAME = 'rolepitch';

let _client = null;
function client() {
  if (_client) return _client;
  const url = process.env.CONTENT_OS_SUPABASE_URL;
  const key = process.env.CONTENT_OS_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('CONTENT_OS_SUPABASE_URL / CONTENT_OS_SUPABASE_SERVICE_ROLE_KEY not configured');
  _client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _client;
}

let _tenantId = null;
async function getTenantId() {
  if (_tenantId) return _tenantId;
  const { data, error } = await client().from('tenants').select('id').eq('name', TENANT_NAME).single();
  if (error || !data) throw new Error('rolepitch tenant not found in Content-OS');
  _tenantId = data.id;
  return _tenantId;
}

const SELECT_FIELDS = [
  'id', 'title', 'subtitle', 'slug', 'meta_title', 'meta_description',
  'tags', 'primary_tag', 'illustration_idx', 'read_time',
  'featured', 'author_name', 'author_initial', 'author_color', 'author_role',
  'content', 'published_at', 'updated_at', 'sort_order',
].join(', ');

export async function listPublishedPosts() {
  try {
    const tenantId = await getTenantId();
    const { data, error } = await client()
      .from('content_inventory')
      .select(SELECT_FIELDS)
      .eq('tenant_id', tenantId)
      .eq('type', 'blog')
      .eq('status', 'published')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('published_at', { ascending: false, nullsFirst: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('[content-os] listPublishedPosts failed:', e.message);
    return [];
  }
}

export async function getPostBySlug(slug) {
  try {
    const tenantId = await getTenantId();
    const { data, error } = await client()
      .from('content_inventory')
      .select(SELECT_FIELDS)
      .eq('tenant_id', tenantId)
      .eq('type', 'blog')
      .eq('status', 'published')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  } catch (e) {
    console.error('[content-os] getPostBySlug failed:', e.message);
    return null;
  }
}
