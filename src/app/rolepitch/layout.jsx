export const metadata = {
  metadataBase: new URL('https://www.rolepitch.com'),
  title: {
    default: 'RolePitch — Your resume, tailored for every role',
    template: '%s | RolePitch',
  },
  description:
    'Paste a job link. RolePitch reads the JD, picks your strongest achievements, and rewrites your resume bullets to match — in under 60 seconds. Free ATS score check included.',
  keywords: [
    'resume tailor',
    'resume tailoring',
    'AI resume',
    'resume for job description',
    'resume rewrite',
    'resume critique',
    'ATS score checker',
    'ATS resume checker',
    'ATS resume',
    'resume optimizer',
    'job application resume',
    'cover letter AI',
  ],
  authors: [{ name: 'RolePitch' }],
  creator: 'RolePitch',
  publisher: 'RolePitch',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://www.rolepitch.com/',
    siteName: 'RolePitch',
    title: 'RolePitch — Your resume, tailored for every role',
    description:
      'Paste a job link. RolePitch rewrites your resume bullets to match the JD — in under 60 seconds. Free ATS score check, no sign-up required.',
    images: [
      {
        url: '/icons/icon-512x512.png',
        width: 512,
        height: 512,
        alt: 'RolePitch logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RolePitch — Your resume, tailored for every role',
    description:
      'Paste a job link. Pilot rewrites your resume bullets to match the JD — in under 60 seconds.',
    images: ['/icons/icon-512x512.png'],
  },
  alternates: {
    canonical: 'https://www.rolepitch.com/',
  },
};

export default function RolePitchLayout({ children }) {
  return children;
}
