export const TAG_STYLES = {
  'Career Strategy': { tc: '#4f6ef7', tb: 'rgba(79,110,247,0.09)' },
  'Product':         { tc: '#22c55e', tb: 'rgba(34,197,94,0.09)' },
  'Job Search':      { tc: '#f59e0b', tb: 'rgba(245,158,11,0.09)' },
};

export const TAGS = ['All', 'Career Strategy', 'Product', 'Job Search'];

export function tagStyle(t) {
  return TAG_STYLES[t] || TAG_STYLES['Career Strategy'];
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
