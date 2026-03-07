'use client';

import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Globe, ArrowLeft } from 'lucide-react';
import { useJobs } from '@/hooks/useJobs';
import JobCard from '@/components/JobCard';
import DismissSheet from '@/components/DismissSheet';

// Cohort tabs — replaces old New/Saved/Applied with score-based buckets
const COHORT_TABS = [
  { id: 'excellent', label: 'Excellent', status: 'pending', minScore: 75, maxScore: null },
  { id: 'good',      label: 'Good',      status: 'pending', minScore: 50, maxScore: 74  },
  { id: 'others',    label: 'Others',    status: 'pending', minScore: 0,  maxScore: 49  },
  { id: 'saved',     label: 'Saved',     status: 'saved',   minScore: 0,  maxScore: null },
  { id: 'applied',   label: 'Applied',   status: 'applied', minScore: 0,  maxScore: null },
];

const TAB_ACTIVE_CLASS = {
  excellent: 'bg-violet-600 text-white border-violet-600',
  good:      'bg-blue-600 text-white border-blue-600',
  others:    'bg-gray-600 text-white border-gray-600',
  saved:     'bg-blue-600 text-white border-blue-600',
  applied:   'bg-emerald-600 text-white border-emerald-600',
};

const REMOTE_FILTERS = [
  { id: 'remote', label: 'Remote' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'onsite', label: 'On-site' },
];

export default function JobsPage() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [cohortTab, setCohortTab] = useState(() => {
    const tab = searchParams.get('tab');
    return COHORT_TABS.some(t => t.id === tab) ? tab : 'excellent';
  });
  const [remoteFilter, setRemoteFilter] = useState('all');
  const [dismissTarget, setDismissTarget] = useState(null);
  const [freeWorld, setFreeWorld] = useState(() => searchParams.get('freeworld') === 'true');

  const activeTab = COHORT_TABS.find((t) => t.id === cohortTab);

  const { matches: allMatches, total, excellentCount, goodCount, othersCount, loading, error, dismiss, save } = useJobs({
    status: freeWorld ? 'all' : activeTab.status,
    limit: 200,
    minScore: freeWorld ? 0 : activeTab.minScore,
  });

  const filtered = useMemo(() => {
    let base = freeWorld
      ? allMatches.filter((m) => m.status !== 'dismissed')
      : activeTab.maxScore !== null
        ? allMatches.filter((m) => m.match_score <= activeTab.maxScore)
        : allMatches;

    return base.filter((m) => {
      const job = m.jobs;
      const matchSearch =
        !search ||
        job.title.toLowerCase().includes(search.toLowerCase()) ||
        job.company.toLowerCase().includes(search.toLowerCase());
      const matchRemote = remoteFilter === 'all' || job.remote_type === remoteFilter;
      return matchSearch && matchRemote;
    });
  }, [allMatches, search, remoteFilter, freeWorld, activeTab]);

  const handleDismiss = useCallback((matchId, reason) => {
    dismiss(matchId, reason);
    setDismissTarget(null);
  }, [dismiss]);

  const enterFreeWorld = () => { setSearch(''); setRemoteFilter('all'); setFreeWorld(true); };
  const exitFreeWorld  = () => { setSearch(''); setRemoteFilter('all'); setFreeWorld(false); };

  // Cohort count for active tab badge
  const cohortCount = {
    excellent: excellentCount,
    good: goodCount,
    others: othersCount,
    saved: total,
    applied: total,
  }[cohortTab];

  // Header subtitle per cohort
  const headerSubtitle = (() => {
    if (loading) return null;
    if (cohortTab === 'excellent') return excellentCount > 0 ? `${excellentCount} excellent · ≥75% match` : '0 excellent · Pilot scanning';
    if (cohortTab === 'good')      return `${goodCount} good · 50–74% match`;
    if (cohortTab === 'others')    return `${othersCount} others · below 50%`;
    if (cohortTab === 'saved')     return `${total} saved`;
    if (cohortTab === 'applied')   return `${total} applied`;
  })();

  return (
    <div className="page-enter">
      <AnimatePresence mode="wait">

        {/* ── FREE WORLD MODE ── */}
        {freeWorld && (
          <motion.div key="freeworld" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="px-5 header-safe-top pb-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/40 sticky top-0 z-20">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={exitFreeWorld}
                  className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 text-sm font-semibold"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Pilot&apos;s picks
                </button>
                <span className="text-amber-600 dark:text-amber-500 text-xs font-medium bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
                  Unfiltered
                </span>
              </div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                All {loading ? '…' : filtered.length} jobs Pilot found
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
                Every source. Every score. Pilot&apos;s ranked list is behind the arrow.
              </p>
              <div className="relative mt-3 mb-2">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search all jobs, companies…" className="input-field pl-10" />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-none">
                {REMOTE_FILTERS.map((rf) => (
                  <button key={rf.id} onClick={() => setRemoteFilter(remoteFilter === rf.id ? 'all' : rf.id)}
                    className={`shrink-0 tag-pill text-xs py-1.5 border transition-all ${remoteFilter === rf.id ? 'bg-amber-600 text-white border-amber-600' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700'}`}>
                    {rf.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              {loading ? (
                [1,2,3,4,5].map((i) => <SkeletonCard key={i} />)
              ) : filtered.length === 0 ? (
                <div className="text-center py-16"><p className="text-gray-400 text-sm">No jobs match your search.</p></div>
              ) : (
                <>
                  <p className="text-gray-400 text-xs">{filtered.length} job{filtered.length !== 1 ? 's' : ''}{search ? ` matching "${search}"` : ' · score shows fit with your profile'}</p>
                  <div className="space-y-3">
                    {filtered.map((match) => (
                      <JobCard key={match.id} match={match} onDismiss={() => setDismissTarget(match.id)} onSave={() => save(match.id)} showSource />
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* ── COHORT MODE (default) ── */}
        {!freeWorld && (
          <motion.div key="cohort" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Sticky header */}
            <div className="px-5 header-safe-top pb-3 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 sticky top-0 z-20">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">Job Matches</h1>
                  {headerSubtitle && (
                    <p className="text-xs text-gray-400 mt-0.5">{headerSubtitle}</p>
                  )}
                </div>
                <button
                  onClick={enterFreeWorld}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 px-3 py-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <Globe className="w-3.5 h-3.5" />
                  Explore all
                </button>
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search jobs, companies…" className="input-field pl-10" />
              </div>

              {/* Cohort tabs + remote filters */}
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-none">
                {COHORT_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => { setCohortTab(tab.id); setSearch(''); setRemoteFilter('all'); }}
                    className={`shrink-0 tag-pill text-xs py-1.5 border transition-all ${
                      cohortTab === tab.id
                        ? TAB_ACTIVE_CLASS[tab.id]
                        : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700'
                    }`}
                  >
                    {tab.label}
                    {/* count badge on cohort tabs */}
                    {tab.id === 'excellent' && excellentCount > 0 && cohortTab !== 'excellent' && (
                      <span className="ml-1 text-[9px] bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 px-1 rounded-full">{excellentCount}</span>
                    )}
                    {tab.id === 'good' && goodCount > 0 && cohortTab !== 'good' && (
                      <span className="ml-1 text-[9px] bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1 rounded-full">{goodCount}</span>
                    )}
                  </button>
                ))}
                <span className="shrink-0 w-px bg-gray-200 dark:bg-slate-700 mx-0.5" />
                {REMOTE_FILTERS.map((rf) => (
                  <button
                    key={rf.id}
                    onClick={() => setRemoteFilter(remoteFilter === rf.id ? 'all' : rf.id)}
                    className={`shrink-0 tag-pill text-xs py-1.5 border transition-all ${
                      remoteFilter === rf.id
                        ? 'bg-gray-500 text-white border-gray-500'
                        : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700'
                    }`}
                  >
                    {rf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Results */}
            <div className="px-5 py-4 space-y-3">
              {error ? (
                <div className="text-center py-16">
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Hit a wall — not you, it&apos;s the network. Retry in a sec.</p>
                </div>
              ) : loading ? (
                [1,2,3,4,5].map((i) => <SkeletonCard key={i} />)
              ) : filtered.length === 0 ? (
                <EmptyState cohortTab={cohortTab} goodCount={goodCount} enterFreeWorld={enterFreeWorld} setCohortTab={setCohortTab} />
              ) : (
                <>
                  <p className="text-gray-400 text-xs">
                    {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                    {search ? ` for "${search}"` : ''}
                    {!search && cohortTab === 'excellent' && ' · ≥75% match'}
                    {!search && cohortTab === 'good'      && ' · 50–74% match'}
                    {!search && cohortTab === 'others'    && ' · below 50%'}
                  </p>
                  <div className="space-y-3">
                    {filtered.map((match) => (
                      <JobCard
                        key={match.id}
                        match={match}
                        onDismiss={() => setDismissTarget(match.id)}
                        onSave={() => save(match.id)}
                      />
                    ))}
                  </div>
                  {(cohortTab === 'excellent' || cohortTab === 'good') && filtered.length > 0 && (
                    <button
                      onClick={enterFreeWorld}
                      className="w-full py-3 text-center text-xs text-gray-400 dark:text-gray-500 flex items-center justify-center gap-1.5 mt-2"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      Explore all jobs Pilot found
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {dismissTarget && (
        <DismissSheet matchId={dismissTarget} onDismiss={handleDismiss} onClose={() => setDismissTarget(null)} />
      )}
    </div>
  );
}

// ── Skeleton ────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="card p-4 animate-pulse">
      <div className="flex gap-3">
        <div className="w-11 h-11 rounded-xl bg-gray-200 dark:bg-slate-700 shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4" />
          <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-1/2" />
          <div className="flex gap-1.5 mt-1">
            <div className="h-5 bg-gray-200 dark:bg-slate-700 rounded-full w-14" />
            <div className="h-5 bg-gray-200 dark:bg-slate-700 rounded-full w-10" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Empty states per cohort ─────────────────────────────────────

function EmptyState({ cohortTab, goodCount, enterFreeWorld, setCohortTab }) {
  if (cohortTab === 'excellent') return (
    <div className="text-center py-16">
      <div className="text-4xl mb-3">⏳</div>
      <p className="text-gray-700 dark:text-gray-300 font-semibold">No excellent matches yet</p>
      <p className="text-gray-400 text-sm mt-1">Pilot is scanning. Excellent fits (≥75%) appear within the hour.</p>
      {goodCount > 0 && (
        <button
          onClick={() => setCohortTab('good')}
          className="mt-4 text-xs text-blue-500 dark:text-blue-400 underline underline-offset-2"
        >
          See {goodCount} good matches →
        </button>
      )}
    </div>
  );

  if (cohortTab === 'good') return (
    <div className="text-center py-16">
      <div className="text-4xl mb-3">🔍</div>
      <p className="text-gray-700 dark:text-gray-300 font-semibold">No good matches yet</p>
      <p className="text-gray-400 text-sm mt-1">Pilot hasn&apos;t found 50–74% fits yet. Check Others or explore all.</p>
      <button
        onClick={enterFreeWorld}
        className="mt-4 flex items-center gap-1.5 mx-auto text-xs text-gray-500 dark:text-gray-400 underline underline-offset-2"
      >
        <Globe className="w-3 h-3" />
        Explore all jobs
      </button>
    </div>
  );

  if (cohortTab === 'others') return (
    <div className="text-center py-16">
      <div className="text-4xl mb-3">✨</div>
      <p className="text-gray-700 dark:text-gray-300 font-semibold">Nothing below 50%</p>
      <p className="text-gray-400 text-sm mt-1">All scored jobs rank above 50% — strong signal.</p>
    </div>
  );

  return (
    <div className="text-center py-16">
      <div className="text-4xl mb-3">🔍</div>
      <p className="text-gray-500 dark:text-gray-400 font-medium">Nothing here</p>
      <p className="text-gray-400 text-sm mt-1">Try a different filter.</p>
    </div>
  );
}
