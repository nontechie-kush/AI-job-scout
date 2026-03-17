'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Home, Briefcase, Users, BarChart2, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import PushPrompt from '@/components/PushPrompt';

const navItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/dashboard/referrals', label: 'Referrals', icon: Users },
  { href: '/dashboard/tracker', label: 'Tracker', icon: BarChart2 },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
];

const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID;

// Push Supabase JWT to extension so it can authenticate API calls
async function pushTokenToExtension(supabase) {
  if (!EXTENSION_ID || typeof chrome === 'undefined' || !chrome.runtime) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    chrome.runtime.sendMessage(EXTENSION_ID, {
      type: 'PILOT_SET_TOKEN',
      token: session.access_token,
    });
  } catch {
    // Extension not installed — silently ignore
  }
}

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    pushTokenToExtension(supabase);
  }, []);

  if (!ready) return null;

  return (
    <div className="mobile-container">
    <div className="h-dvh bg-gray-50 dark:bg-slate-950 flex flex-col overflow-hidden" style={{ overscrollBehaviorY: 'none' }}>
      {/* Page content — bottom padding clears the nav + iPhone home-indicator */}
      <main
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
      >
        {children}
      </main>

      {/* Push permission prompt — shows after 3s if not yet subscribed */}
      <PushPrompt />

      {/* Bottom navigation */}
      <div className="bottom-nav-wrapper">
        <nav
          className="bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 px-1 pt-1"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
        >
          <div className="flex items-center justify-around">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive =
                href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(href);

              return (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-xl relative min-w-[56px]"
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-violet-50 dark:bg-violet-900/30 rounded-xl"
                      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    />
                  )}
                  <Icon
                    className={`relative w-5 h-5 transition-colors ${
                      isActive
                        ? 'text-violet-600 dark:text-violet-400'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                    strokeWidth={isActive ? 2.5 : 1.8}
                  />
                  <span
                    className={`relative text-[10px] font-medium transition-colors ${
                      isActive
                        ? 'text-violet-600 dark:text-violet-400'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
    </div>
  );
}
