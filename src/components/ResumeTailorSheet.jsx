'use client';

/**
 * ResumeTailorSheet — full-screen bottom sheet for resume tailoring (v2 pipeline).
 *
 * Stages:
 *   'v2'    — TailorV2Review: narration → reuse offer OR brief + per-role bullets + PDF CTA
 *   'ready' — PDF download + done
 *
 * Props:
 *   match       — full match object (match.jobs.*, match.id, etc.)
 *   onClose     — () => void
 *   entryPoint  — 'job_page' | 'profile_page'
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, ChevronLeft, Download, CheckCircle2 } from 'lucide-react';
import TailorV2Review from '@/components/TailorV2Review';

// ── Stage: Ready ────────────────────────────────────────────────

function ReadyStage({ pdfUrl, onClose, entryPoint }) {
  return (
    <div className="px-5 py-8 flex flex-col items-center text-center space-y-5">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <CheckCircle2 className="w-16 h-16 text-emerald-500" />
      </motion.div>

      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Resume ready</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Your tailored resume is ready to download.
        </p>
      </div>

      {pdfUrl && (
        <a
          href={pdfUrl}
          download="resume-tailored.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-gradient w-full py-3.5 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" /> Download PDF
        </a>
      )}

      {entryPoint === 'job_page' && (
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
        >
          Back to application
        </button>
      )}
    </div>
  );
}

// ── Main Sheet ──────────────────────────────────────────────────

export default function ResumeTailorSheet({ match, onClose, entryPoint = 'job_page' }) {
  const [stage, setStage] = useState('v2');
  const [pdfUrl, setPdfUrl] = useState(null);
  const [baseResume, setBaseResume] = useState(null);

  const matchId = match?.id;

  // Load base structured_resume for before/after diff in the review
  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;
    fetch('/api/ai/resume-structure', { method: 'POST' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!cancelled && d?.structured_resume) setBaseResume(d.structured_resume); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [matchId]);

  const stageTitles = {
    v2: 'Tailored Resume',
    ready: 'Resume Ready',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 250 }}
        className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            {stage === 'ready' && (
              <button
                onClick={() => setStage('v2')}
                className="p-1 -ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {stageTitles[stage]}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Job context banner */}
        {match?.jobs && stage !== 'ready' && (
          <div className="px-5 py-2.5 bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Tailoring for:{' '}
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {match.jobs.title} at {match.jobs.company}
              </span>
            </p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {stage === 'v2' && (
            <TailorV2Review
              matchId={matchId}
              baseResume={baseResume}
              onPdfReady={(url) => {
                setPdfUrl(url);
                setStage('ready');
              }}
            />
          )}

          {stage === 'ready' && (
            <ReadyStage
              pdfUrl={pdfUrl}
              onClose={onClose}
              entryPoint={entryPoint}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
