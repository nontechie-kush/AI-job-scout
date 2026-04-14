'use client';

/**
 * ResumeNudge — inline card on the job detail page.
 *
 * Calls /api/ai/resume-gap-analysis in the background (non-blocking).
 * Shows a compact nudge if resume strength < 85.
 * Hides itself if resume is already strong or already tailored.
 *
 * Props:
 *   matchId   — UUID of the job match
 *   onTailor  — () => void — opens ResumeTailorSheet
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';

export default function ResumeNudge({ matchId, onTailor }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!matchId) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/ai/resume-gap-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ match_id: matchId }),
        });

        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        if (!cancelled) setAnalysis(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [matchId]);

  // Don't render if: loading error, resume is strong enough, or already tailored
  if (error) return null;
  if (!loading && analysis?.resume_strength >= 85) return null;
  if (!loading && analysis?.already_tailored) {
    return (
      <div className="card p-4 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Resume tailored for this role
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Your custom version is ready in the Pilot Kit.
          </p>
        </div>
      </div>
    );
  }

  // Loading state — tell user what's happening
  if (loading) {
    return (
      <div className="card p-4 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-emerald-500 animate-spin shrink-0" />
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Pilot is rating your resume for this role
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Checking how well your profile matches...
          </p>
        </div>
      </div>
    );
  }

  const strength = analysis?.resume_strength || 0;
  const nudgeMessage = analysis?.nudge_message || 'Your resume could be stronger for this role.';

  // Color based on strength
  const strengthColor = strength >= 70
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-500 dark:text-red-400';

  const bgColor = strength >= 70
    ? 'bg-amber-50 dark:bg-amber-900/15 border-amber-200 dark:border-amber-800/40'
    : 'bg-red-50 dark:bg-red-900/15 border-red-200 dark:border-red-800/40';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`card p-4 border ${bgColor}`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <FileText className={`w-5 h-5 ${strengthColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Resume Strength
            </p>
            <span className={`text-sm font-bold ${strengthColor}`}>
              {strength}%
            </span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            {nudgeMessage}
          </p>
          <button
            onClick={onTailor}
            className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
          >
            Tailor Resume
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
