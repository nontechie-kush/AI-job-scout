import { DM_Sans, DM_Serif_Display, JetBrains_Mono } from 'next/font/google';
import './blog.css';

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['300', '400', '500', '600'], style: ['normal', 'italic'], variable: '--font-dm-sans' });
const dmSerif = DM_Serif_Display({ subsets: ['latin'], weight: ['400'], style: ['normal', 'italic'], variable: '--font-dm-serif' });
const jet = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-jet' });

export const metadata = {
  title: { default: 'Blog — RolePitch', template: '%s | RolePitch Blog' },
  description: 'Career insights, without the fluff. Data-backed strategies for job seekers who are serious about standing out.',
};

export default function BlogLayout({ children }) {
  return (
    <div className={`${dmSans.variable} ${dmSerif.variable} ${jet.variable} rp-blog`}>
      {children}
    </div>
  );
}
