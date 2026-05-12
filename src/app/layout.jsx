import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import Providers from '@/components/Providers';
import { Analytics } from '@vercel/analytics/react';
import PostHogProvider from '@/components/PostHogProvider';

const GA_ID = 'G-S84XLE50EG';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'RolePitch — Your resume, tailored for every role.',
  description: 'Paste a job link. Pilot reads the JD, picks your strongest achievements, and rewrites your bullets to match — in under 60 seconds.',
  manifest: '/manifest.json',
  metadataBase: new URL('https://www.rolepitch.com'),
  alternates: { canonical: 'https://www.rolepitch.com/' },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RolePitch',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://www.rolepitch.com/',
    siteName: 'RolePitch',
    title: 'RolePitch — Your resume, pitched to every role.',
    description: 'Paste a job link. Get a tailored resume in 60 seconds.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'RolePitch — Your resume, pitched to every role.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RolePitch — Your resume, pitched to every role.',
    description: 'Paste a job link. Get a tailored resume in 60 seconds.',
    images: ['/og-image.png'],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // viewportFit=cover enables env(safe-area-inset-*) on notched iPhones
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
        <script dangerouslySetInnerHTML={{ __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { send_page_view: false });
          window.rp_track = function(event, props) {
            if (typeof gtag === 'undefined') return;
            gtag('event', event, props || {});
          };
        `}} />
      </head>
      <body className={`${inter.className} bg-gray-50 dark:bg-slate-950`}>
        <Providers>
          {children}
        </Providers>
        <Analytics />
        <Suspense fallback={null}>
          <PostHogProvider />
        </Suspense>
      </body>
    </html>
  );
}
