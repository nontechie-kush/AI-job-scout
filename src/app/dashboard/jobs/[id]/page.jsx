'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ChevronLeft, MapPin, DollarSign, Clock, CheckCircle2, Zap,
  ExternalLink, Bookmark, AlertTriangle, ThumbsUp, X,
} from 'lucide-react';
import DismissSheet from '@/components/DismissSheet';
import PreApplySheet from '@/components/PreApplySheet';
import LaptopReminderSheet from '@/components/LaptopReminderSheet';

// ── Utilities ──────────────────────────────────────────────────

function companyColor(name) {
  const colors = [
    'bg-emerald-500', 'bg-blue-500', 'bg-teal-500', 'bg-amber-500',
    'bg-rose-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500',
  ];
  let hash = 0;
  for (const c of (name || '')) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

function formatSalary(min, max, currency) {
  if (!min && !max) return null;
  const fmt = (n) => n >= 100000 ? `${Math.round(n / 1000)}k` : `${n}`;
  const sym = currency === 'INR' ? '₹' : currency === 'GBP' ? '£' : '$';
  if (min && max) return `${sym}${fmt(min)}–${sym}${fmt(max)}`;
  if (min) return `${sym}${fmt(min)}+`;
  return `up to ${sym}${fmt(max)}`;
}

function postedAgo(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d} days ago`;
  if (d < 30) return `${Math.floor(d / 7)} weeks ago`;
  return `${Math.floor(d / 30)} months ago`;
}

// ── Culture Panel ──────────────────────────────────────────────

function CulturePanel({ intelligence }) {
  if (!intelligence) {
    return (
      <div className="card p-4">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Culture Read
        </p>
        <p className="text-sm text-gray-400 italic leading-relaxed">
          Pilot is still learning about this company. Check back soon.
        </p>
      </div>
    );
  }

  const {
    glassdoor_rating,
    ambitionbox_rating,
    culture_summary,
    top_positives,
    top_warnings,
    interview_process,
    hiring_velocity_30d,
  } = intelligence;

  const hasRatings = glassdoor_rating || ambitionbox_rating || hiring_velocity_30d != null;

  return (
    <div className="card p-4 space-y-4">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        Pilot&apos;s Read
      </p>

      {/* Ratings */}
      {hasRatings && (
        <div className="flex gap-3">
          {glassdoor_rating && (
            <div className="flex-1 rounded-xl bg-green-50 dark:bg-green-900/20 p-3 text-center">
              <p className="text-xl font-bold text-green-700 dark:text-green-400">{glassdoor_rating}</p>
              <p className="text-[10px] text-green-600 dark:text-green-500 font-medium mt-0.5">Glassdoor</p>
            </div>
          )}
          {ambitionbox_rating && (
            <div className="flex-1 rounded-xl bg-orange-50 dark:bg-orange-900/20 p-3 text-center">
              <p className="text-xl font-bold text-orange-700 dark:text-orange-400">{ambitionbox_rating}</p>
              <p className="text-[10px] text-orange-600 dark:text-orange-500 font-medium mt-0.5">AmbitionBox</p>
            </div>
          )}
          {hiring_velocity_30d != null && (
            <div className="flex-1 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 text-center">
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{hiring_velocity_30d}</p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-500 font-medium mt-0.5">Hires/30d</p>
            </div>
          )}
        </div>
      )}

      {/* Pilot's culture summary */}
      {culture_summary && (
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed italic">
          &ldquo;{culture_summary}&rdquo;
        </p>
      )}

      {/* Positives */}
      {top_positives?.length > 0 && (
        <div className="space-y-2">
          {top_positives.map((p, i) => (
            <div key={i} className="flex items-start gap-2">
              <ThumbsUp className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span className="text-sm text-gray-600 dark:text-gray-300">{p}</span>
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {top_warnings?.length > 0 && (
        <div className="space-y-2">
          {top_warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span className="text-sm text-gray-600 dark:text-gray-300">{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Interview process */}
      {interview_process && (
        <div className="pt-3 border-t border-gray-100 dark:border-slate-800">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
            Interview Process
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{interview_process}</p>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────

export default function JobDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [match, setMatch] = useState(null);
  const [intelligence, setIntelligence] = useState(undefined); // undefined=loading, null=none
  const [loadingMatch, setLoadingMatch] = useState(true);
  const [showDismiss, setShowDismiss] = useState(false);
  const [showPreApply, setShowPreApply] = useState(false);
  const [showLaptopReminder, setShowLaptopReminder] = useState(false);
  const [laptopReminderSaved, setLaptopReminderSaved] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [saved, setSaved] = useState(false);
  const [applied, setApplied] = useState(false);
  const [postApplyAction, setPostApplyAction] = useState(null); // null | 'applied' | 'later' | 'resume'
  const [fetchError, setFetchError] = useState(null);
  const [linkDead, setLinkDead] = useState(false);       // auto-detected dead link
  const [linkReportPending, setLinkReportPending] = useState(false); // awaiting confirm
  const [linkReported, setLinkReported] = useState(false); // user confirmed + reported

  useEffect(() => {
    setIsMobile(window.innerWidth < 1024);
  }, []);

  useEffect(() => {
    async function loadMatch() {
      setLoadingMatch(true);
      try {
        const res = await fetch(`/api/jobs/matches/${id}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          console.error('[job-detail] fetch failed', res.status, body);
          throw new Error(`HTTP ${res.status}: ${body.error || 'unknown'}`);
        }
        const data = await res.json();
        setMatch(data.match);
        setSaved(data.match.status === 'saved');
        setApplied(data.match.status === 'applied');
        // If already confirmed applied from a previous session, skip the picker
        if (data.match.status === 'applied') setPostApplyAction('applied');

        // Background link check — non-blocking, sets warning if 404/410
        if (data.match.jobs?.apply_url) {
          fetch(`/api/jobs/check-link?url=${encodeURIComponent(data.match.jobs.apply_url)}&match_id=${id}`)
            .then((r) => r.json())
            .then((d) => { if (!d.ok && d.reason !== 'timeout') setLinkDead(true); })
            .catch(() => {});
        }

        // Fetch intelligence in parallel (non-blocking)
        if (data.match.jobs?.company_domain) {
          fetch(`/api/jobs/intelligence?domain=${encodeURIComponent(data.match.jobs.company_domain)}`)
            .then((r) => r.json())
            .then((d) => setIntelligence(d.intelligence))
            .catch(() => setIntelligence(null));
        } else {
          setIntelligence(null);
        }
      } catch (err) {
        setMatch(null);
        setFetchError(err.message);
        setIntelligence(null);
      } finally {
        setLoadingMatch(false);
      }
    }
    loadMatch();
  }, [id]);

  const handleDismiss = async (matchId, reason) => {
    setShowDismiss(false);
    await fetch('/api/jobs/matches', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: matchId, status: 'dismissed', dismissed_reason: reason }),
    });
    router.back();
  };

  const handleSave = async () => {
    setSaved(true);
    await fetch('/api/jobs/matches', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: id, status: 'saved' }),
    });
  };

  // Portal jobs need desktop for best experience
  const PORTAL_TYPES = new Set(['greenhouse', 'lever', 'ashby', 'workday', 'taleo', 'external']);

  const handleApply = () => {
    if (!match?.jobs?.apply_url) return;
    // On mobile + portal job → intercept with laptop reminder
    if (isMobile && PORTAL_TYPES.has(match.jobs.apply_type)) {
      setShowLaptopReminder(true);
      return;
    }
    setShowPreApply(true);
  };

  const handleReportLink = async () => {
    if (!linkReportPending) {
      setLinkReportPending(true);
      return;
    }
    setLinkReported(true);
    await fetch('/api/jobs/report-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: id }),
    });
  };

  const handleApplied = async () => {
    setApplied(true);
    await fetch('/api/jobs/matches', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: id, status: 'applied' }),
    });
  };

  if (loadingMatch) {
    return (
      <div className="page-enter min-h-dvh bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-3">
        <span className="spinner w-7 h-7" />
        <p className="text-gray-400 text-sm">Loading job…</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3 px-6">
        <div className="text-4xl">🔍</div>
        <p className="text-gray-500 dark:text-gray-400">Job not found</p>
        {fetchError && <p className="text-xs text-red-400 text-center">{fetchError}</p>}
        <button
          onClick={() => router.back()}
          className="text-emerald-600 dark:text-emerald-400 text-sm font-medium"
        >
          Go back
        </button>
      </div>
    );
  }

  const job = match.jobs;
  const score = match.match_score;
  const scoreColor =
    score >= 90 ? 'text-emerald-600 dark:text-emerald-400' :
    score >= 80 ? 'text-blue-600 dark:text-blue-400' :
    'text-amber-600 dark:text-amber-400';
  const salary = formatSalary(job.salary_min, job.salary_max, job.salary_currency);
  const posted = postedAgo(job.posted_at);
  const isEasyApply = ['linkedin', 'greenhouse', 'lever', 'ashby'].includes(job.apply_type);

  return (
    <>
      <div className="page-enter min-h-dvh bg-gray-50 dark:bg-slate-950">
        {/* Top nav */}
        <div className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center justify-between px-5 pt-6 pb-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1 text-gray-600 dark:text-gray-400 font-medium text-sm"
            >
              <ChevronLeft className="w-5 h-5" /> Jobs
            </button>

            <div className="flex items-center gap-2">
              {/* Not for me */}
              <button
                onClick={() => setShowDismiss(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-sm text-gray-500 dark:text-gray-400 font-medium active:bg-gray-200 dark:active:bg-slate-700 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Not for me
              </button>
              {/* Save */}
              <button
                onClick={handleSave}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                  saved
                    ? 'bg-blue-100 dark:bg-blue-900/30'
                    : 'bg-gray-100 dark:bg-slate-800'
                }`}
              >
                <Bookmark
                  className={`w-4 h-4 transition-colors ${
                    saved
                      ? 'text-blue-600 dark:text-blue-400 fill-current'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Company hero */}
          <div className="px-5 pb-6">
            <div className="flex items-start gap-4">
              <div className={`w-14 h-14 rounded-2xl ${companyColor(job.company)} flex items-center justify-center text-white font-bold text-xl shrink-0`}>
                {(job.company || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-snug">{job.title}</h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{job.company}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {job.location && (
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <MapPin className="w-3 h-3" />
                      {job.location}
                    </div>
                  )}
                  {salary && (
                    <>
                      <span className="text-gray-300 dark:text-gray-600">·</span>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <DollarSign className="w-3 h-3" />
                        {salary}
                      </div>
                    </>
                  )}
                  {posted && (
                    <>
                      <span className="text-gray-300 dark:text-gray-600">·</span>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        {posted}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-5">
          {/* Match Score */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  AI Match Score
                </p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className={`text-4xl font-black ${scoreColor}`}>{score}%</span>
                  <span className="text-gray-400 text-sm">match</span>
                </div>
              </div>
              {/* Score ring */}
              <div className="relative w-16 h-16">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="6" className="text-gray-200 dark:text-slate-700" />
                  <motion.circle
                    cx="32" cy="32" r="26"
                    fill="none"
                    stroke="url(#scoreGrad)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={163}
                    initial={{ strokeDashoffset: 163 }}
                    animate={{ strokeDashoffset: 163 - (163 * score / 100) }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                  />
                  <defs>
                    <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#059669" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-emerald-500" />
                </div>
              </div>
            </div>

            {/* Match reasons */}
            {match.match_reasons?.length > 0 && (
              <div className="space-y-2">
                {match.match_reasons.map((reason, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">{reason}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Gaps */}
            {match.gap_analysis?.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Gaps to close</p>
                {match.gap_analysis.map((gap, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">{gap}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Culture panel — shows skeleton while loading */}
          {intelligence === undefined ? (
            <div className="card p-4 animate-pulse">
              <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-1/3 mb-4" />
              <div className="flex gap-3 mb-4">
                <div className="flex-1 h-16 bg-gray-200 dark:bg-slate-700 rounded-xl" />
                <div className="flex-1 h-16 bg-gray-200 dark:bg-slate-700 rounded-xl" />
              </div>
              <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-full mb-2" />
              <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-5/6" />
            </div>
          ) : (
            <CulturePanel intelligence={intelligence} />
          )}

          {/* Job description */}
          {job.description && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                About the Role
              </p>
              {job.source === 'naukri' && job.description.length < 200 ? (
                <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  <p>{job.description}</p>
                  <a
                    href={job.apply_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-3 text-emerald-600 dark:text-emerald-400 font-medium hover:underline"
                  >
                    Read full description on Naukri →
                  </a>
                </div>
              ) : (
                <div
                  className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-a:text-emerald-600 prose-ul:pl-4 prose-li:my-0.5"
                  dangerouslySetInnerHTML={{
                    __html: job.description.length > 3000
                      ? `${job.description.slice(0, 3000)}…`
                      : job.description,
                  }}
                />
              )}
            </div>
          )}

          {/* Details tags */}
          <div className="card p-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Details
            </p>
            <div className="flex flex-wrap gap-2">
              {job.remote_type && (
                <span className="tag-pill bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 capitalize">
                  {job.remote_type}
                </span>
              )}
              {job.company_stage && job.company_stage !== 'unknown' && (
                <span className="tag-pill bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 capitalize">
                  {job.company_stage.replace(/_/g, ' ')}
                </span>
              )}
              {job.department && (
                <span className="tag-pill bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300">
                  {job.department}
                </span>
              )}
              {isEasyApply && (
                <span className="tag-pill bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                  ⚡ {job.apply_type}
                </span>
              )}
              {job.repost_count > 0 && (
                <span className="tag-pill bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                  ↺ Reposted {job.repost_count}×
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Apply CTA */}
        <div className="px-5 pb-6">
          {/* Dead link warning (auto-detected) */}
          {linkDead && !linkReported && (
            <div className="mb-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Link may be expired</p>
                <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-0.5">Pilot detected this posting might be down. Try opening it anyway.</p>
              </div>
            </div>
          )}

          {/* Reported confirmation */}
          {linkReported && (
            <div className="mb-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Got it — won't show you this again.</p>
            </div>
          )}

          {applied && !postApplyAction ? (
            <div className="space-y-2">
              <p className="text-center text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                Did you finish applying?
              </p>
              <button
                onClick={() => {
                  setPostApplyAction('applied');
                  // Keep status as 'applied' in DB — already set
                }}
                className="w-full py-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-semibold text-sm flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Yes — tracking in pipeline
              </button>
              <button
                onClick={() => {
                  setPostApplyAction('resume');
                  setShowPreApply(true);
                }}
                className="w-full py-3.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 font-semibold text-sm flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Resume applying — open Pilot Kit
              </button>
              <button
                onClick={async () => {
                  setPostApplyAction('later');
                  await fetch('/api/jobs/matches', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ match_id: id, status: 'saved' }),
                  });
                }}
                className="w-full py-3.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 font-medium text-sm flex items-center justify-center gap-2"
              >
                <Bookmark className="w-4 h-4" />
                Apply later — save for now
              </button>
              <button
                onClick={() => setShowDismiss(true)}
                className="w-full py-2 text-xs text-gray-400 dark:text-gray-500"
              >
                Not relevant
              </button>
            </div>
          ) : postApplyAction === 'applied' ? (
            <div className="space-y-2">
              <div className="w-full py-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="w-5 h-5" />
                Applied — tracking in pipeline
              </div>
              <button
                onClick={() => setShowPreApply(true)}
                className="w-full py-2.5 text-sm text-emerald-600 dark:text-emerald-400 font-medium"
              >
                Reopen Pilot Kit
              </button>
            </div>
          ) : postApplyAction === 'later' ? (
            <div className="space-y-2">
              <div className="w-full py-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex items-center justify-center gap-2 text-blue-700 dark:text-blue-400 font-semibold text-sm">
                <Bookmark className="w-5 h-5" />
                Saved — come back when ready
              </div>
              <button
                onClick={handleApply}
                className="w-full py-2.5 text-sm text-emerald-600 dark:text-emerald-400 font-medium"
              >
                Ready to apply now?
              </button>
            </div>
          ) : laptopReminderSaved ? (
            <div className="w-full py-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex items-center justify-center gap-2 text-blue-700 dark:text-blue-400 font-semibold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              Saved — open on laptop to apply
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={handleApply}
                disabled={!job.apply_url}
                className="btn-gradient w-full py-4 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Zap className="w-4 h-4" /> Prepare &amp; Apply
              </button>
              {!linkReported && (
                <button
                  onClick={handleReportLink}
                  className={`w-full py-2 text-xs transition-colors ${
                    linkReportPending
                      ? 'text-red-500 dark:text-red-400 font-medium'
                      : 'text-gray-400 dark:text-gray-500 hover:text-red-400'
                  }`}
                >
                  {linkReportPending ? 'Tap again to confirm — this removes the job' : 'Link not working?'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dismiss sheet */}
      {showDismiss && (
        <DismissSheet
          matchId={id}
          onDismiss={handleDismiss}
          onClose={() => setShowDismiss(false)}
        />
      )}

      {/* Pre-apply sheet */}
      {showPreApply && (
        <PreApplySheet
          match={match}
          onClose={() => setShowPreApply(false)}
          onApplied={handleApplied}
        />
      )}

      {/* Laptop reminder intercept (mobile + portal jobs) */}
      {showLaptopReminder && (
        <LaptopReminderSheet
          match={match}
          onRemindSet={() => {
            setLaptopReminderSaved(true);
            setShowLaptopReminder(false);
          }}
          onContinueMobile={() => {
            setShowLaptopReminder(false);
            setShowPreApply(true);
          }}
          onClose={() => setShowLaptopReminder(false)}
        />
      )}
    </>
  );
}
