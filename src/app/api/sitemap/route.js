import { listPublishedPosts } from '@/lib/content-os/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);

  let posts = [];
  try {
    posts = await listPublishedPosts();
  } catch {
    posts = [];
  }

  const staticUrls = [
    { loc: 'https://www.rolepitch.com/rolepitch', lastmod: today, changefreq: 'weekly', priority: '1.0' },
    { loc: 'https://www.rolepitch.com/rolepitch/critique', lastmod: today, changefreq: 'weekly', priority: '0.8' },
    { loc: 'https://www.rolepitch.com/rolepitch/start', lastmod: today, changefreq: 'monthly', priority: '0.7' },
    { loc: 'https://www.rolepitch.com/blog', lastmod: today, changefreq: 'daily', priority: '0.9' },
  ];

  const blogUrls = posts.map((p) => ({
    loc: `https://www.rolepitch.com/blog/${p.slug}`,
    lastmod: (p.published_at || p.updated_at || today).slice(0, 10),
    changefreq: 'monthly',
    priority: '0.7',
  }));

  const all = [...staticUrls, ...blogUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all.map((u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
