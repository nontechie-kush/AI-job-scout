export const metadata = {
  title: 'Free ATS Resume Checker — See Your Score in 60 Seconds',
  description:
    'Upload your resume and get a free ATS score with parseability, keyword, structure, and impact checks. No sign-up required.',
  alternates: {
    canonical: 'https://www.rolepitch.com/ats-checker',
  },
  openGraph: {
    title: 'Free ATS Resume Checker — RolePitch',
    description:
      'Check whether your resume can pass ATS screening. Get a score, top gaps, and a preview of how RolePitch can fix it for a job.',
    url: 'https://www.rolepitch.com/ats-checker',
    siteName: 'RolePitch',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free ATS Resume Checker — RolePitch',
    description:
      'Get a free ATS score with clear fixes for parseability, keywords, structure, and impact.',
  },
};

export default function ATSCheckerLayout({ children }) {
  return children;
}
