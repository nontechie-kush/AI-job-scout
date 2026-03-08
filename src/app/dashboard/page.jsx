'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight, TrendingUp, ArrowRight, Moon, Sun, Users, Laptop } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useJobs } from '@/hooks/useJobs';
import { usePipeline } from '@/hooks/usePipeline';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import useStore from '@/store/useStore';
import JobCard from '@/components/JobCard';
import DismissSheet from '@/components/DismissSheet';
import JobSearchTitlesModal from '@/components/JobSearchTitlesModal';

// ── Pilot Scan Card — 4 cohort tiles ───────────────────────────

function ScanCard({ newCount, excellentCount, goodCount, othersCount, loading, onUpdateSearch }) {
  if (loading) {
    return (
      <div className="card overflow-hidden animate-pulse">
        <div className="bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-3 h-11" />
        <div className="p-4 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-gray-200 dark:bg-slate-700 h-16" />
            <div className="rounded-xl bg-gray-200 dark:bg-slate-700 h-16" />
            <div className="rounded-xl bg-gray-200 dark:bg-slate-700 h-16" />
            <div className="rounded-xl bg-gray-200 dark:bg-slate-700 h-16" />
          </div>
        </div>
      </div>
    );
  }

  const hasAny = excellentCount + goodCount + othersCount > 0;
  const hasNew = newCount > 0;

  const narration = (() => {
    if (!hasAny) return '"Building your list. Takes 1–2 minutes — page updates automatically."';
    if (excellentCount > 0 && hasNew)
      return `"${newCount} fresh excellent or good ${newCount === 1 ? 'match' : 'matches'} since your last visit. ${excellentCount} excellent — apply today."`;
    if (excellentCount > 0)
      return `"${excellentCount} excellent ${excellentCount === 1 ? 'fit' : 'fits'}. The noise — filtered out."`;
    if (goodCount > 0)
      return `"${goodCount} good matches. No excellent fits yet — Pilot keeps scanning. DMs move the needle faster."`;
    return `"${othersCount} ranked. Nothing strong yet — DMs are your move today."`;
  })();

  return (
    <div className="card overflow-hidden">
      <div className="bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="text-white text-sm font-semibold">
            {hasAny ? 'Pilot scanned' : 'Pilot is scanning'}
          </span>
        </div>
        <span className="text-white/70 text-xs">
          {hasAny ? 'Results ready' : 'Working on it…'}
        </span>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 gap-2">
          {/* New Today */}
          <Link href="/dashboard/jobs" className="rounded-xl p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 active:scale-[0.97] transition-transform block">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">New Today</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{hasNew ? newCount : '—'}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">since last visit</p>
          </Link>

          {/* Excellent */}
          <Link href="/dashboard/jobs?tab=excellent" className={`rounded-xl p-3 active:scale-[0.97] transition-transform block ${excellentCount > 0 ? 'bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800/30' : 'bg-gray-50 dark:bg-slate-800'}`}>
            <span className="text-[10px] font-semibold text-violet-500 dark:text-violet-400 uppercase tracking-wider">Excellent</span>
            <p className={`text-2xl font-bold mt-1 ${excellentCount > 0 ? 'text-violet-700 dark:text-violet-300' : 'text-gray-400 dark:text-gray-600'}`}>
              {excellentCount || '—'}
            </p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">≥75% match</p>
          </Link>

          {/* Good */}
          <Link href="/dashboard/jobs?tab=good" className={`rounded-xl p-3 active:scale-[0.97] transition-transform block ${goodCount > 0 ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30' : 'bg-gray-50 dark:bg-slate-800'}`}>
            <span className="text-[10px] font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wider">Good</span>
            <p className={`text-2xl font-bold mt-1 ${goodCount > 0 ? 'text-blue-700 dark:text-blue-300' : 'text-gray-400 dark:text-gray-600'}`}>
              {goodCount || '—'}
            </p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">50–74% match</p>
          </Link>

          {/* All Jobs — unfiltered view */}
          <Link href="/dashboard/jobs?freeworld=true" className="rounded-xl p-3 bg-gray-50 dark:bg-slate-800 active:scale-[0.97] transition-transform block">
            <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">All Jobs</span>
            <p className="text-2xl font-bold mt-1 text-gray-400 dark:text-gray-500">
              {othersCount || '—'}
            </p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">&lt;50% match</p>
          </Link>
        </div>

        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 italic leading-relaxed">
          {narration}
        </p>

        {hasAny && (
          <button
            onClick={onUpdateSearch}
            className="mt-2 text-[11px] text-violet-500 dark:text-violet-400 underline underline-offset-2 text-left"
          >
            Seeing wrong roles? Update search →
          </button>
        )}
      </div>
    </div>
  );
}

// ── Laptop Reminders banner (desktop only) ──────────────────────

function LaptopReminders({ reminders }) {
  if (!reminders?.length) return null;
  const titles = reminders.slice(0, 2).map(r => r.jobs?.title).filter(Boolean);
  return (
    <div className="card p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-100 dark:border-blue-800/40">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
          <Laptop className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 dark:text-white text-sm">
            {reminders.length} job{reminders.length > 1 ? 's' : ''} saved for laptop
          </p>
          {titles.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              {titles.join(' · ')}
            </p>
          )}
        </div>
        <Link
          href="/dashboard/jobs"
          className="shrink-0 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold"
        >
          Apply now
        </Link>
      </div>
    </div>
  );
}

// ── Referral nudge card ─────────────────────────────────────────

function ReferralNudge() {
  return (
    <Link href="/dashboard/referrals">
      <div className="card p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-100 dark:border-blue-800/40 active:scale-[0.98] transition-transform">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white text-sm">Referrals move faster</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
              No excellent fits yet. Pilot picked recruiters who place roles like yours — a DM today beats waiting.
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        </div>
      </div>
    </Link>
  );
}

// ── Loading skeleton for job cards ─────────────────────────────

function JobSkeleton() {
  return (
    <div className="card p-4 animate-pulse">
      <div className="flex gap-3">
        <div className="w-11 h-11 rounded-xl bg-gray-200 dark:bg-slate-700 shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4" />
          <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-1/2" />
          <div className="flex gap-1.5 mt-2">
            <div className="h-5 bg-gray-200 dark:bg-slate-700 rounded-full w-14" />
            <div className="h-5 bg-gray-200 dark:bg-slate-700 rounded-full w-10" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Animation variants ─────────────────────────────────────────

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };

// ── Page ───────────────────────────────────────────────────────

export default function HomePage() {
  const { toggleDarkMode, darkMode } = useStore();
  const supabase = createClient();
  const [userName, setUserName] = useState('');
  const [dismissTarget, setDismissTarget] = useState(null);

  const [laptopReminders, setLaptopReminders] = useState([]);
  const [isDesktop, setIsDesktop] = useState(false);
  const [showUpdateSearch, setShowUpdateSearch] = useState(false);

  // Detect desktop + fetch laptop reminders
  useEffect(() => {
    const desktop = window.innerWidth >= 1024;
    setIsDesktop(desktop);
    if (!desktop) return;
    fetch('/api/jobs/matches?remind_on_desktop=true&limit=10')
      .then(r => r.json())
      .then(d => setLaptopReminders(d.matches || []))
      .catch(() => {});
  }, []);

  const { matches, total, newCount, excellentCount, goodCount, othersCount, loading: jobsLoading, dismiss, refresh } = useJobs({
    status: 'pending',
    limit: 10, // fetch 10 — enough to cover 2+1 selection across all cohorts
  });
  const { total: pipelineTotal } = usePipeline();
  const { pullY, refreshing, progress } = usePullToRefresh(refresh);

  // No excellent fits: jobs exist but none ≥75%
  const noExcellent = !jobsLoading && total > 0 && excellentCount === 0;

  // Auto-poll every 15s while no matches — stops once jobs arrive
  const pollRef = useRef(null);
  useEffect(() => {
    if (jobsLoading) return;
    if (matches.length > 0) {
      clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(refresh, 15000);
    return () => clearInterval(pollRef.current);
  }, [jobsLoading, matches.length, refresh]);

  // Home card selection:
  // 1. New excellent/good exist → top 2 excellent + 1 newest new match
  // 2. No new → top 3 from excellent+good combined
  // 3. No excellent or good → top 3 others
  const homeCards = (() => {
    if (!matches.length) return [];

    const excellent = matches.filter((m) => m.match_score >= 75);
    const good = matches.filter((m) => m.match_score >= 50 && m.match_score < 75);
    const others = matches.filter((m) => m.match_score < 50);
    const newGoodOrExcellent = matches.filter((m) => m.is_new);

    if (newGoodOrExcellent.length > 0) {
      const top2exc = excellent.slice(0, 2);
      const newest = [...newGoodOrExcellent].sort(
        (a, b) => new Date(b.scored_at || 0) - new Date(a.scored_at || 0)
      )[0];
      const newestInTop2 = top2exc.some((m) => m.id === newest.id);
      if (!newestInTop2) return [...top2exc, newest].slice(0, 3);
      return excellent.slice(0, 3);
    }

    const goodOrExcellent = [...excellent, ...good]; // already score-sorted since matches is sorted DESC
    if (goodOrExcellent.length > 0) return goodOrExcellent.slice(0, 3);
    return others.slice(0, 3);
  })();

  // Section label based on cohort
  const sectionLabel = (() => {
    if (jobsLoading || total === 0) return 'New Matches';
    if (excellentCount > 0) return 'New Matches';
    if (goodCount > 0) return 'Good Matches';
    return 'While Pilot Scans';
  })();

  const sectionSubtitle = (() => {
    if (jobsLoading || total === 0) return null;
    if (excellentCount > 0) return (
      <>
        <span className="text-violet-600 dark:text-violet-400 font-semibold">{excellentCount} excellent</span>
        {goodCount > 0 && <span className="text-blue-500 font-semibold"> · {goodCount} good</span>}
        {newCount > 0 && <span className="text-emerald-500 font-semibold"> · {newCount} new</span>}
      </>
    );
    if (goodCount > 0) return (
      <span className="text-blue-500 dark:text-blue-400 font-semibold">{goodCount} good matches · no excellent yet</span>
    );
    return <span className="text-amber-600 dark:text-amber-400 font-semibold">No strong fits yet · {othersCount} ranked</span>;
  })();

  // Get user display name
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const name = user.user_metadata?.name || user.user_metadata?.full_name || '';
      setUserName(name.split(' ')[0] || user.email?.split('@')[0] || '');
    });
  }, []);

  const handleDismiss = useCallback((matchId, reason) => {
    dismiss(matchId, reason);
    setDismissTarget(null);
  }, [dismiss]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Hey' : 'Evening';

  return (
    <div className="page-enter">
      {/* Pull-to-refresh indicator */}
      {(pullY > 0 || refreshing) && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center transition-all"
          style={{ height: refreshing ? 48 : pullY * 0.75, overflow: 'hidden' }}
        >
          <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
            {refreshing ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg
                className="w-4 h-4 transition-transform"
                style={{ transform: `rotate(${progress * 180}deg)` }}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              >
                <path d="M19 9l-7 7-7-7" />
              </svg>
            )}
            <span className="text-xs font-medium">
              {refreshing ? 'Refreshing…' : progress >= 1 ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-5 header-safe-top pb-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{greeting},</p>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white capitalize">
              {userName || '—'}
            </h1>
          </div>
          <button
            onClick={toggleDarkMode}
            className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center"
          >
            {darkMode
              ? <Sun className="w-4 h-4 text-amber-400" />
              : <Moon className="w-4 h-4 text-gray-500" />}
          </button>
        </div>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="px-5 py-5 space-y-6"
      >
        {/* ── 0. Laptop reminders (desktop only) ── */}
        {isDesktop && laptopReminders.length > 0 && (
          <motion.section variants={item}>
            <LaptopReminders reminders={laptopReminders} />
          </motion.section>
        )}

        {/* ── 1. Pilot Scan Card ── */}
        <motion.section variants={item}>
          <ScanCard
            newCount={newCount}
            excellentCount={excellentCount}
            goodCount={goodCount}
            othersCount={othersCount}
            loading={jobsLoading}
            onUpdateSearch={() => setShowUpdateSearch(true)}
          />
        </motion.section>

        {/* ── 2. Jobs / Referral pivot ── */}
        <motion.section variants={item}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-bold text-gray-900 dark:text-white">{sectionLabel}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sectionSubtitle}</p>
            </div>
            <Link
              href="/dashboard/jobs"
              className="flex items-center gap-1 text-violet-600 dark:text-violet-400 text-sm font-medium"
            >
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {jobsLoading ? (
              [1, 2, 3].map((i) => <JobSkeleton key={i} />)
            ) : matches.length === 0 ? (
              <div className="card p-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-violet-500 animate-ping" />
                  <span className="w-2 h-2 rounded-full bg-violet-500 animate-ping [animation-delay:0.2s]" />
                  <span className="w-2 h-2 rounded-full bg-violet-500 animate-ping [animation-delay:0.4s]" />
                </div>
                <p className="font-semibold text-gray-700 dark:text-gray-300 text-sm">Pilot is scanning</p>
                <p className="text-gray-400 text-xs mt-1">
                  Usually takes 1–2 minutes. Page updates automatically.
                </p>
              </div>
            ) : (
              <>
                {/* Referral nudge when no excellent fits */}
                {noExcellent && <ReferralNudge />}

                {noExcellent && goodCount === 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 px-1 pt-1">
                    Stretch shots — apply if any feel right
                  </p>
                )}
                {homeCards.map((match) => (
                  <JobCard
                    key={match.id}
                    match={match}
                    onDismiss={() => setDismissTarget(match.id)}
                  />
                ))}
              </>
            )}
          </div>
        </motion.section>

        {/* ── 3. Pipeline ── */}
        <motion.section variants={item}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <h2 className="font-bold text-gray-900 dark:text-white">Your Progress</h2>
          </div>
          <Link href="/dashboard/tracker">
            <div className="card p-4 flex items-center justify-between active:scale-[0.98] transition-transform">
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">View Full Pipeline</p>
                <p className="text-xs text-gray-400 mt-0.5">{pipelineTotal} applications being tracked</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </div>
          </Link>
        </motion.section>

        {/* ── 4. Pilot line ── */}
        <motion.section variants={item}>
          <div className={`card p-4 bg-gradient-to-br ${
            noExcellent
              ? 'from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-100 dark:border-amber-800/50'
              : 'from-violet-50 to-blue-50 dark:from-violet-900/20 dark:to-blue-900/20 border-violet-100 dark:border-violet-800/50'
          }`}>
            <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
              noExcellent ? 'text-amber-600 dark:text-amber-400' : 'text-violet-600 dark:text-violet-400'
            }`}>
              Pilot
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {noExcellent
                ? 'No excellent fits today. Send 2 DMs\u2014that\u2019s your move. I\u2019ll keep scanning.'
                : 'Do 3 things today. That\u2019s it. I\u2019ll handle the research, the sorting, the noise.'}
            </p>
          </div>
        </motion.section>

        <div className="pb-2" />
      </motion.div>

      {/* Dismiss reason sheet */}
      {dismissTarget && (
        <DismissSheet
          matchId={dismissTarget}
          onDismiss={handleDismiss}
          onClose={() => setDismissTarget(null)}
        />
      )}

      {/* Update job search titles modal */}
      {showUpdateSearch && (
        <JobSearchTitlesModal
          onClose={() => setShowUpdateSearch(false)}
          onSaved={() => setShowUpdateSearch(false)}
        />
      )}
    </div>
  );
}
