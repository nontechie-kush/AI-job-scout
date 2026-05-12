/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['pdf-parse', 'mammoth', '@react-pdf/renderer'],
  async redirects() {
    return [
      {
        source: '/blog/why-your-resume-gets-rejected-by-ats-and-exactly-how-to-fix-it-for-remote-first-',
        destination: '/blog/why-your-resume-gets-rejected-by-ats-and-exactly-how-to-fix-it-for-remote-first-companies',
        permanent: true,
      },
      {
        source: '/blog/the-skill-translation-framework-how-to-reframe-your-previous-role-for-a-complete',
        destination: '/blog/the-skill-translation-framework-how-to-reframe-your-previous-role-for-a-completely-different-industry',
        permanent: true,
      },
      {
        source: '/blog/the-side-hustle-problem-when-your-freelance-work-makes-your-full-time-job-look-b',
        destination: '/blog/the-side-hustle-problem-when-your-freelance-work-makes-your-full-time-job-look-boring',
        permanent: true,
      },
      {
        source: '/blog/ai-isn-t-taking-your-job-the-same-panic-happened-in-2000-2008-and-2016-and-peopl',
        destination: '/blog/ai-isn-t-taking-your-job-the-same-panic-happened-in-2000-2008-and-2016-and-people-still-got-hired',
        permanent: true,
      },
      {
        source: '/blog/the-ai-glossary-every-mid-career-professional-needs-to-survive-board-meetings-wi',
        destination: '/blog/the-ai-glossary-every-mid-career-professional-needs-to-survive-board-meetings-without-pretending-to-understand',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
