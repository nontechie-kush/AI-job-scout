export const dynamic = 'force-dynamic';

export async function GET() {
  const txt = `User-agent: *
Allow: /
Allow: /ats-checker
Allow: /critique
Allow: /blog
Allow: /blog/
Disallow: /start
Disallow: /rolepitch/start
Disallow: /rolepitch/auth
Disallow: /rolepitch/dashboard
Disallow: /rolepitch/base-resume
Disallow: /rolepitch/tailoring
Disallow: /rolepitch/resume/
Disallow: /rolepitch/report/
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
