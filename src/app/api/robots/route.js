export const dynamic = 'force-dynamic';

export async function GET() {
  const txt = `User-agent: *
Allow: /rolepitch
Allow: /rolepitch/
Allow: /rolepitch/critique
Allow: /rolepitch/start
Allow: /rolepitch/report/
Disallow: /dashboard/
Disallow: /api/
Disallow: /onboarding/
Disallow: /auth/

Sitemap: https://www.rolepitch.com/sitemap.xml
`;

  return new Response(txt, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
