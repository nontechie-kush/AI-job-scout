'use client';

/**
 * DismissSheet — bottom sheet reason picker for "Not for me"
 *
 * Uses createPortal to render at document.body level — bypasses
 * CSS transform on .page-enter which breaks fixed positioning.
 *
 * Props:
 *   matchId    — the match ID to dismiss
 *   onDismiss  — (matchId, reason?) → void — called when user picks a reason
 *   onClose    — called when user closes without picking
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

const REASONS = [
  { id: 'not_interested', label: "Just not feeling it" },
  { id: 'too_senior', label: "Too senior for me right now" },
  { id: 'too_junior', label: "Too junior" },
  { id: 'wrong_industry', label: "Wrong industry" },
  { id: 'wrong_company', label: "Not this company" },
  { id: 'location', label: "Location doesn't work" },
  { id: 'already_applied', label: "Already applied elsewhere" },
];

export default function DismissSheet({ matchId, onDismiss, onClose }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        className="relative z-10 bg-white dark:bg-slate-900 rounded-t-2xl px-5 pt-5"
        style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom, 32px))' }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Not for me</p>
            <p className="font-semibold text-gray-900 dark:text-white text-sm mt-0.5">What's off about it?</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="space-y-2">
          {REASONS.map((reason) => (
            <button
              key={reason.id}
              onClick={() => onDismiss(matchId, reason.id)}
              className="w-full text-left px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-800 text-sm font-medium text-gray-700 dark:text-gray-200 active:bg-gray-100 dark:active:bg-slate-700 transition-colors"
            >
              {reason.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => onDismiss(matchId)}
          className="mt-3 w-full text-center py-3 text-sm text-gray-400 dark:text-gray-500"
        >
          Skip without a reason
        </button>
      </motion.div>
    </div>,
    document.body
  );
}
