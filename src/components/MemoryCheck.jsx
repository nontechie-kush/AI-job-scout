'use client';

/**
 * MemoryCheck — "Pilot is checking what I already know" stage.
 *
 * Calls /api/ai/resume-memory-check once on mount.
 * Reveals results gap-by-gap with staggered timing so the user sees the
 * reasoning as it happens (perceived, not real-time — the backend returns
 * everything at once, we stage the reveal for feel).
 *
 * Props:
 *   tailoredResumeId — UUID
 *   onComplete       — (result) => void — called after reveal animation ends
 *                       result = { gaps, coverage, coverage_ratio, all_covered }
 *   onError          — (err) => void
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, CheckCircle2, HelpCircle, Loader2, Sparkles,
} from 'lucide-react';

const REVEAL_DELAY_MS = 700;    // between each gap reveal
const FINAL_HOLD_MS = 900;      // pause on summary before firing onComplete

export default function MemoryCheck({ tailoredResumeId, onComplete, onError }) {
  const [result, setResult] = useState(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const hasRunRef = useRef(false);

  // Fetch memory check on mount
  useEffect(() => {
    if (hasRunRef.current || !tailoredResumeId) return;
    hasRunRef.current = true;

    (async () => {
      try {
        const res = await fetch('/api/ai/resume-memory-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tailored_resume_id: tailoredResumeId }),
        });
        if (!res.ok) throw new Error('Memory check failed');
        const data = await res.json();
        setResult(data);
      } catch (err) {
        console.error('[MemoryCheck]', err);
        setFetchError(err.message);
        onError?.(err);
      }
    })();
  }, [tailoredResumeId, onError]);

  // Staged reveal once result arrives
  useEffect(() => {
    if (!result?.gaps) return;
    if (result.gaps.length === 0) {
      // No gaps — skip straight to complete
      const t = setTimeout(() => onComplete?.(result), 600);
      return () => clearTimeout(t);
    }

    const timers = [];
    result.gaps.forEach((_, i) => {
      timers.push(setTimeout(() => setRevealedCount(i + 1), REVEAL_DELAY_MS * (i + 1)));
    });
    // Summary card
    timers.push(setTimeout(() => setSummaryVisible(true), REVEAL_DELAY_MS * result.gaps.length + 300));
    // Fire onComplete
    timers.push(
      setTimeout(
        () => onComplete?.(result),
        REVEAL_DELAY_MS * result.gaps.length + 300 + FINAL_HOLD_MS,
      ),
    );

    return () => timers.forEach(clearTimeout);
  }, [result, onComplete]);

  if (fetchError) {
    return (
      <div className="px-5 py-12 text-center">
        <p className="text-sm text-red-500">Couldn&apos;t check memory: {fetchError}</p>
        <button
          onClick={() => onComplete?.({ all_covered: false, coverage: [], gaps: [] })}
          className="mt-3 text-sm text-emerald-600 dark:text-emerald-400 font-medium"
        >
          Continue to chat →
        </button>
      </div>
    );
  }

  // Initial loading
  if (!result) {
    return (
      <div className="px-5 py-12 flex flex-col items-center gap-3">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <Brain className="w-8 h-8 text-emerald-500" />
        </motion.div>
        <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
          Checking what I already know about you…
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs text-center">
          Pilot is scanning your experience memory to see which gaps it can answer without asking.
        </p>
      </div>
    );
  }

  const { gaps, coverage, total_nuggets_checked = 0 } = result;
  const coveredCount = coverage.filter((c) => c.covered).length;

  return (
    <div className="px-5 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="mt-0.5"
        >
          <Brain className="w-6 h-6 text-emerald-500" />
        </motion.div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            Scanning your experience memory
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {total_nuggets_checked > 0
              ? `Cross-referencing ${total_nuggets_checked} fact${total_nuggets_checked !== 1 ? 's' : ''} I've learned about you.`
              : `No prior memory yet — this will be our first session.`}
          </p>
        </div>
      </div>

      {/* Per-gap reveal */}
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {gaps.slice(0, revealedCount).map((gap, i) => {
            const cov = coverage[i];
            const covered = cov?.covered;
            const evidence = cov?.evidence || [];

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className={`rounded-xl border overflow-hidden ${
                  covered
                    ? 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/60 dark:bg-emerald-900/10'
                    : 'border-amber-200 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-900/10'
                }`}
              >
                <div className="p-3">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 shrink-0">
                      {covered ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">
                        Gap: <span className="text-gray-700 dark:text-gray-300">{gap.gap}</span>
                      </p>
                      {covered ? (
                        <>
                          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            ✓ Got it covered
                          </p>
                          {evidence.slice(0, 1).map((e) => (
                            <p key={e.id} className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                              From memory: {e.fact}
                            </p>
                          ))}
                        </>
                      ) : (
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                          Need to ask you about this
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Summary */}
      <AnimatePresence>
        {summaryVisible && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-4 p-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-emerald-200/50 dark:border-emerald-800/30"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {coveredCount === gaps.length && gaps.length > 0
                  ? `All ${gaps.length} gap${gaps.length !== 1 ? 's' : ''} covered from memory`
                  : coveredCount > 0
                    ? `${coveredCount} of ${gaps.length} covered — just ${gaps.length - coveredCount} question${gaps.length - coveredCount !== 1 ? 's' : ''} left`
                    : `Let's get to work — I'll ask you about each gap`}
              </p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {coveredCount === gaps.length && gaps.length > 0
                ? 'Jumping straight to proposed changes.'
                : 'Opening chat next…'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading indicator while revealing */}
      {revealedCount < gaps.length && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
          <p className="text-xs text-gray-400">Scanning…</p>
        </div>
      )}
    </div>
  );
}
