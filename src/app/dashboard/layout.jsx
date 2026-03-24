'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Home, Briefcase, Users, BarChart2, User, Moon, Sun } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import useStore from '@/store/useStore';
import PushPrompt from '@/components/PushPrompt';

const navItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/dashboard/referrals', label: 'Outreach', icon: Users },
  { href: '/dashboard/tracker', label: 'Tracker', icon: BarChart2 },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
];

const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID;

// Secondary token push to extension via onAuthStateChange.
// The extension reads cookies directly (primary), this is a bonus signal.
function pushTokenToExtension(supabase) {
  if (!EXTENSION_ID || typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    if (!session?.access_token) return;
    try {
      chrome.runtime.sendMessage(EXTENSION_ID, {
        type: 'PILOT_SET_TOKEN',
        token: session.access_token,
        refresh_token: session.refresh_token || '',
      }, () => { void chrome.runtime?.lastError; });
    } catch { /* extension not installed */ }
    subscription.unsubscribe();
  });

  return subscription;
}

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const darkMode = useStore((s) => s.darkMode);
  const toggleDarkMode = useStore((s) => s.toggleDarkMode);

  useEffect(() => {
    setReady(true);
    const subscription = pushTokenToExtension(supabase);
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setUserEmail(data.user.email);
    });
    return () => subscription?.unsubscribe();
  }, []);

  if (!ready) return null;

  return (
    <div className="flex min-h-dvh bg-gray-50 dark:bg-slate-950">
      {/* ── Sidebar ── */}
      <aside className="dashboard-sidebar bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col">
        {/* Logo */}
        <div className="px-6 pt-7 pb-5">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="text-lg font-semibold text-gray-900 dark:text-white">CareerPilot</span>
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl relative text-sm font-medium transition-colors"
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-pill"
                    className="absolute inset-0 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl"
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                  />
                )}
                <Icon
                  className={`relative w-5 h-5 transition-colors ${
                    isActive
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                <span
                  className={`relative transition-colors ${
                    isActive
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom section: dark mode + user */}
        <div className="px-4 pb-5 space-y-3 border-t border-gray-100 dark:border-slate-800 pt-4">
          <button
            onClick={toggleDarkMode}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <span>{darkMode ? 'Light mode' : 'Dark mode'}</span>
          </button>
          {userEmail && (
            <p className="px-3 text-xs text-gray-400 dark:text-gray-500 truncate">{userEmail}</p>
          )}
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="dashboard-main">
        <main className="dashboard-content">
          {children}
        </main>
      </div>

      {/* Push permission prompt */}
      <PushPrompt />
    </div>
  );
}
