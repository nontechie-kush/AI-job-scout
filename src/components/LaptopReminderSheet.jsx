'use client';

/**
 * LaptopReminderSheet
 *
 * Shown on mobile when user taps Apply on a portal job (Greenhouse, Lever, etc.)
 * Intercepts the apply flow and offers two paths:
 *   1. "Remind me on laptop" — saves remind_on_desktop flag → user applies from desktop later
 *   2. "Continue on mobile" — falls through to PreApplySheet (mobile kit)
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Laptop, CheckCircle2, X, Smartphone } from 'lucide-react';

const PORTAL_LABELS = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  workday: 'Workday',
  taleo: 'Taleo',
  external: 'this portal',
};

export default function LaptopReminderSheet({ match, onRemindSet, onContinueMobile, onClose }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const job = match?.jobs;
  const portalLabel = PORTAL_LABELS[job?.apply_type] || 'this portal';

  const handleRemind = async () => {
    setSaving(true);
    try {
      await fetch('/api/jobs/matches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: match.id, remind_on_desktop: true }),
      });
      setSaved(true);
      // Auto-close after 1.8s
      setTimeout(() => onClose(), 1800);
    } catch {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col justify-end"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />

        {/* Sheet */}
        <motion.div
          className="relative bg-white dark:bg-slate-900 rounded-t-3xl px-5 pt-5 pb-10 safe-bottom shadow-xl"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        >
          {/* Drag handle */}
          <div className="w-10 h-1 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-5" />

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>

          {saved ? (
            /* ── Success state ── */
            <div className="flex flex-col items-center text-center py-4 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-white text-lg">Reminder saved</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Open CareerPilot on your laptop — this job will be waiting at the top.
                </p>
              </div>
            </div>
          ) : (
            /* ── Default state ── */
            <>
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                  <Laptop className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-white text-base leading-snug">
                    Better on laptop
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                    {portalLabel} forms are 3× faster with Pilot's desktop kit — cover letter ready, fields pre-filled, one tab.
                  </p>
                </div>
              </div>

              {/* Job context */}
              {job?.title && (
                <div className="mb-5 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800">
                  <p className="text-xs text-gray-400 dark:text-gray-500">Saved for</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5">
                    {job.title}
                    {job.company ? ` · ${job.company}` : ''}
                  </p>
                </div>
              )}

              <div className="space-y-2.5">
                {/* Primary */}
                <button
                  onClick={handleRemind}
                  disabled={saving}
                  className="w-full py-4 rounded-xl bg-blue-600 text-white font-semibold text-sm flex items-center justify-center gap-2 active:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {saving ? (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <Laptop className="w-4 h-4" />
                  )}
                  Remind me when I open my laptop
                </button>

                {/* Secondary */}
                <button
                  onClick={onContinueMobile}
                  className="w-full py-3.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-medium text-sm flex items-center justify-center gap-2 active:bg-gray-200 dark:active:bg-slate-700 transition-colors"
                >
                  <Smartphone className="w-4 h-4 text-gray-400" />
                  Continue on mobile anyway
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
