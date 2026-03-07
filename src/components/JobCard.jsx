'use client';

/**
 * JobCard — reusable job match card
 *
 * Props:
 *   match      — job_matches row with nested jobs object
 *   onDismiss  — called with matchId (opens DismissSheet)
 *   onSave     — called with matchId (save bookmark)
 *   showDismiss — show X button (default true)
 */

import Link from 'next/link';
import { motion } from 'framer-motion';
import { MapPin, X, Bookmark } from 'lucide-react';

// Deterministic color from company name
function companyColor(name) {
  const colors = [
    'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
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
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

const SOURCE_LABELS = {
  cutshort: 'Cutshort', greenhouse: 'Greenhouse', lever: 'Lever',
  ashby: 'Ashby', wellfound: 'Wellfound', yc: 'YC', naukri: 'Naukri',
  hirect: 'Hirect', arc: 'Arc', remotive: 'Remotive',
  topstartups: 'TopStartups', nextleap: 'NextLeap',
  instahyre: 'InstaHyre', iimjobs: 'IIMJobs', linkedin: 'LinkedIn',
};

export default function JobCard({ match, onDismiss, onSave, showDismiss = true, showSource = false }) {
  if (!match?.id || !match?.jobs) return null;
  const job = match.jobs;
  const score = match.match_score;
  const isNew = match.is_new;

  const scoreColor =
    score >= 90 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
    score >= 80 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
    score >= 70 ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400' :
    'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';

  const salary = formatSalary(job.salary_min, job.salary_max, job.salary_currency);
  const posted = postedAgo(job.posted_at);
  const remoteLabel = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' }[job.remote_type] || job.remote_type;
  const applyLabel = {
    greenhouse: 'Greenhouse', lever: 'Lever', ashby: 'Ashby',
    linkedin: 'Easy Apply', external: 'External',
  }[job.apply_type] || 'Apply';
  const isEasyApply = ['linkedin', 'greenhouse', 'lever', 'ashby'].includes(job.apply_type);

  return (
    <motion.div layout className="card p-4 relative group">
      {/* New badge */}
      {isNew && (
        <div className="absolute top-3 left-3 z-10">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-wide">
            <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
            New
          </span>
        </div>
      )}
      {/* Dismiss X */}
      {showDismiss && onDismiss && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(match.id); }}
          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity z-10"
          aria-label="Not for me"
        >
          <X className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
        </button>
      )}

      <Link href={`/dashboard/jobs/${match.id}`} className={`block active:scale-[0.98] transition-transform ${isNew ? 'pt-4' : ''}`}>
        <div className="flex items-start gap-3">
          {/* Company logo */}
          <div className={`w-11 h-11 rounded-xl ${companyColor(job.company)} flex items-center justify-center text-white font-bold text-base shrink-0`}>
            {(job.company || '?')[0].toUpperCase()}
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0 pr-8">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white text-sm leading-snug">{job.title}</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{job.company}</p>
              </div>
              <span className={`flex-shrink-0 match-badge ${scoreColor}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {score}%
              </span>
            </div>

            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{job.location || 'Location TBD'}</span>
              {salary && (
                <>
                  <span className="text-gray-300 dark:text-gray-600">·</span>
                  <span className="shrink-0">{salary}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {showSource && job.source && (
                <span className="tag-pill bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] py-0.5 font-semibold">
                  {SOURCE_LABELS[job.source] || job.source}
                </span>
              )}
              <span className="tag-pill bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 text-[10px] py-0.5">
                {remoteLabel}
              </span>
              {job.company_stage && job.company_stage !== 'unknown' && (
                <span className="tag-pill bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 text-[10px] py-0.5 capitalize">
                  {job.company_stage.replace(/_/g, ' ')}
                </span>
              )}
              <span className={`tag-pill text-[10px] py-0.5 ${
                isEasyApply
                  ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400'
              }`}>
                {isEasyApply ? '⚡ ' : ''}{applyLabel}
              </span>
              {match.status === 'saved' && (
                <span className="tag-pill bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] py-0.5">
                  ★ Saved
                </span>
              )}
              {match.status === 'applied' && (
                <span className="tag-pill bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] py-0.5">
                  ✓ Applied
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-slate-800">
          <span className="text-gray-400 text-xs">
            {posted && `Posted ${posted}`}
            {job.repost_count > 0 && ` · reposted ${job.repost_count}×`}
          </span>
          <span className="text-violet-600 dark:text-violet-400 text-xs font-medium">View details →</span>
        </div>
      </Link>
    </motion.div>
  );
}
