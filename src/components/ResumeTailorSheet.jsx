'use client';

/**
 * ResumeTailorSheet — full-screen bottom sheet for resume tailoring.
 *
 * Stages:
 *   'analysis'       — Gap analysis results: strength score, strong/weak bullets, missing signals
 *   'memory-check'   — Pilot scans user_experience_memory for coverage (NEW)
 *   'propose-direct' — All gaps covered from memory → accept/edit cards (NEW)
 *   'chat'           — Conversational Q&A (partial or no memory coverage)
 *   'review'         — Full tailored resume with changes highlighted
 *   'generating'     — PDF generation spinner
 *   'ready'          — PDF download + PilotLearned card
 *
 * Props:
 *   match       — full match object (match.jobs.*, match.id, etc.)
 *   onClose     — () => void
 *   entryPoint  — 'job_page' | 'profile_page'
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Zap, ChevronLeft, FileText, Download, CheckCircle2,
  AlertTriangle, ArrowRight, Loader2,
} from 'lucide-react';
import ResumeChat from '@/components/ResumeChat';
import MemoryCheck from '@/components/MemoryCheck';
import ProposeDirect from '@/components/ProposeDirect';
import PilotLearned from '@/components/PilotLearned';

// ── Stage: Analysis ─────────────────────────────────────────────

function AnalysisStage({ analysis, onFix, onSkipToReview }) {
  const strength = analysis?.resume_strength || 0;
  const strongCount = (analysis?.strong_bullets || []).length;
  const gapCount = (analysis?.missing_signals || []).length;
  const weakCount = (analysis?.weak_bullets || []).length;

  const ringColor = strength >= 80 ? '#10b981' : strength >= 60 ? '#f59e0b' : '#ef4444';
  const circumference = 2 * Math.PI * 40;

  return (
    <div className="px-5 py-6 space-y-5">
      {/* Strength ring */}
      <div className="flex flex-col items-center">
        <div className="relative w-28 h-28">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor"
              strokeWidth="8" className="text-gray-200 dark:text-slate-700" />
            <motion.circle
              cx="50" cy="50" r="40" fill="none"
              stroke={ringColor} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference - (circumference * strength / 100) }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-gray-900 dark:text-white">{strength}%</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">strength</span>
          </div>
        </div>

        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 text-center max-w-xs leading-relaxed">
          {analysis?.nudge_message || 'Analyzing your resume for this role...'}
        </p>

        {analysis?.confidence === 'low' && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            Limited job description — basic analysis
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-900/15 rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{strongCount}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Strong</div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/15 rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{weakCount}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Weak</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/15 rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-red-500 dark:text-red-400">{gapCount}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Missing</div>
        </div>
      </div>

      {/* Missing signals list */}
      {analysis?.missing_signals?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Gaps to close
          </p>
          {analysis.missing_signals.map((signal, i) => (
            <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-200">{signal.gap}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{signal.suggestion}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reorder suggestions */}
      {analysis?.reorder_suggestions?.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Layout tips
          </p>
          {analysis.reorder_suggestions.map((tip, i) => (
            <p key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1.5">
              <ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-blue-500" />
              {tip}
            </p>
          ))}
        </div>
      )}

      {/* CTAs */}
      <div className="space-y-2 pt-2">
        {(gapCount > 0 || weakCount > 0) && (
          <button
            onClick={onFix}
            className="btn-gradient w-full py-3.5 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" /> Let&apos;s fix this
          </button>
        )}
        <button
          onClick={onSkipToReview}
          className="w-full py-3 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
        >
          {strength >= 80 ? 'Looks good — generate PDF' : 'Skip — just generate PDF'}
        </button>
      </div>
    </div>
  );
}

// ── Stage: Review ───────────────────────────────────────────────

function ReviewStage({ tailoredVersion, changes, onGeneratePdf, loading }) {
  const experience = tailoredVersion?.experience || [];
  const changedBulletIds = new Set(
    (Array.isArray(changes) ? changes : [])
      .map((c) => c.bullet_id)
      .filter(Boolean)
  );

  return (
    <div className="px-5 py-6 space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <FileText className="w-4 h-4 text-gray-500" />
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Tailored Resume Preview
        </p>
      </div>

      {/* Summary */}
      {tailoredVersion?.summary && (
        <div className="card p-3">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Summary</p>
          <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
            {tailoredVersion.summary}
          </p>
        </div>
      )}

      {/* Experience */}
      {experience.map((exp) => (
        <div key={exp.id} className="card p-3">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {exp.title} <span className="font-normal text-gray-500">at {exp.company}</span>
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {exp.start_date} – {exp.end_date || 'present'}
          </p>
          <ul className="mt-2 space-y-1.5">
            {(exp.bullets || []).map((bullet) => (
              <li
                key={bullet.id}
                className={`text-sm leading-relaxed pl-3 border-l-2 ${
                  changedBulletIds.has(bullet.id)
                    ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10 text-gray-800 dark:text-gray-200'
                    : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {bullet.text}
                {changedBulletIds.has(bullet.id) && (
                  <span className="ml-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    updated
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* Skills */}
      {tailoredVersion?.skills && (
        <div className="card p-3">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Skills</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              ...(tailoredVersion.skills.technical || []),
              ...(tailoredVersion.skills.domain || []),
              ...(tailoredVersion.skills.tools || []),
            ].map((skill) => (
              <span key={skill} className="tag-pill bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 text-xs">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Generate PDF */}
      <button
        onClick={onGeneratePdf}
        disabled={loading}
        className="btn-gradient w-full py-3.5 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Generating...
          </>
        ) : (
          <>
            <FileText className="w-4 h-4" /> Generate PDF
          </>
        )}
      </button>
    </div>
  );
}

// ── Stage: Ready ────────────────────────────────────────────────

function ReadyStage({ pdfUrl, onClose, entryPoint, conversationId }) {
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
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          Resume ready
        </h3>
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

      {/* "Pilot got smarter" learned-nuggets card */}
      <PilotLearned conversationId={conversationId} />

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
  const [stage, setStage] = useState('analysis');
  const [analysis, setAnalysis] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(true);
  const [tailoredResumeId, setTailoredResumeId] = useState(null);
  const [tailoredVersion, setTailoredVersion] = useState(null);
  const [changes, setChanges] = useState([]);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState(null);
  const [memoryResult, setMemoryResult] = useState(null);
  const [conversationId, setConversationId] = useState(null);

  const matchId = match?.id;

  // Load gap analysis on mount
  useEffect(() => {
    if (!matchId) return;

    (async () => {
      try {
        const res = await fetch('/api/ai/resume-gap-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ match_id: matchId }),
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        setAnalysis(data);

        if (data.tailored_resume_id) {
          setTailoredResumeId(data.tailored_resume_id);
        }
      } catch (err) {
        console.error('[ResumeTailorSheet] gap analysis failed:', err);
      } finally {
        setLoadingAnalysis(false);
      }
    })();
  }, [matchId]);

  // User clicks "Let's fix this" — kick off memory check first
  async function handleStartFix() {
    try {
      // Ensure structured_resume exists
      const structRes = await fetch('/api/ai/resume-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!structRes.ok) throw new Error('Failed');
      const { structured_resume } = await structRes.json();
      setTailoredVersion(structured_resume);

      // Ensure tailored_resumes record exists (gap analysis already created one,
      // but if not, create it now)
      if (!tailoredResumeId) {
        const initRes = await fetch('/api/ai/resume-tailor-init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            match_id: matchId,
            structured_resume,
            resume_strength: analysis?.resume_strength,
          }),
        });

        if (initRes.ok) {
          const { id } = await initRes.json();
          setTailoredResumeId(id);
        }
      }
    } catch (err) {
      console.error('[ResumeTailorSheet] init error:', err);
    }

    // Always run memory-check next
    setStage('memory-check');
  }

  // Called when MemoryCheck finishes its reveal animation
  function handleMemoryCheckComplete(result) {
    setMemoryResult(result);

    // All gaps covered → jump to propose-direct (skip chat)
    if (result?.all_covered && result.gaps?.length > 0) {
      setStage('propose-direct');
    } else {
      // Partial or no coverage → open chat (which already injects nuggets into prompt)
      setStage('chat');
    }
  }

  async function handleSkipToReview() {
    if (!tailoredVersion) {
      try {
        const structRes = await fetch('/api/ai/resume-structure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (structRes.ok) {
          const { structured_resume } = await structRes.json();
          setTailoredVersion(structured_resume);
        }
      } catch {}
    }
    setStage('review');
  }

  async function handleMoveToReview() {
    // Fetch latest tailored_version from DB (includes all accepted changes)
    if (tailoredResumeId) {
      try {
        const res = await fetch('/api/ai/resume-tailor-init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            match_id: matchId,
            structured_resume: tailoredVersion,
          }),
        });
        // The init endpoint returns existing record if it exists
        // But we need to fetch the actual updated tailored_version
        // Let's fetch it directly
      } catch {}
    }
    setStage('review');
  }

  async function handleGeneratePdf() {
    if (!tailoredResumeId) {
      setError('No tailored resume to generate. Try again.');
      return;
    }

    setPdfLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/resume-generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tailored_resume_id: tailoredResumeId,
          template: 'clean',
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'PDF generation failed');
      }

      const data = await res.json();
      setPdfUrl(data.pdf_url);
      setStage('ready');
    } catch (err) {
      console.error('[ResumeTailorSheet] PDF gen failed:', err);
      setError(`PDF generation failed: ${err.message}. Try again.`);
    } finally {
      setPdfLoading(false);
    }
  }

  const stageTitles = {
    analysis: 'Resume Analysis',
    'memory-check': 'Pilot is thinking…',
    'propose-direct': 'Ready to Go',
    chat: 'Tailor Your Resume',
    review: 'Review Changes',
    generating: 'Generating PDF',
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
            {(stage === 'chat' || stage === 'review' || stage === 'propose-direct') && (
              <button
                onClick={() => {
                  if (stage === 'chat') setStage('analysis');
                  else if (stage === 'propose-direct') setStage('analysis');
                  else if (stage === 'review') setStage('chat');
                }}
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
              Tailoring for: <span className="font-medium text-gray-700 dark:text-gray-300">
                {match.jobs.title} at {match.jobs.company}
              </span>
            </p>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="px-5 py-2.5 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {stage === 'analysis' && loadingAnalysis && (
            <div className="px-5 py-12 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Pilot is analyzing your resume...
              </p>
            </div>
          )}

          {stage === 'analysis' && !loadingAnalysis && (
            <AnalysisStage
              analysis={analysis}
              onFix={handleStartFix}
              onSkipToReview={handleSkipToReview}
            />
          )}

          {stage === 'memory-check' && (
            <MemoryCheck
              tailoredResumeId={tailoredResumeId}
              onComplete={handleMemoryCheckComplete}
              onError={() => setStage('chat')}
            />
          )}

          {stage === 'propose-direct' && (
            <ProposeDirect
              tailoredResumeId={tailoredResumeId}
              coverage={memoryResult?.coverage || []}
              gaps={memoryResult?.gaps || []}
              onDone={(accepted) => {
                if (accepted?.length) setChanges((prev) => [...prev, ...accepted]);
                setStage('review');
              }}
              onSwitchToChat={() => setStage('chat')}
            />
          )}

          {stage === 'chat' && (
            <div className="h-[60vh]">
              <ResumeChat
                tailoredResumeId={tailoredResumeId}
                onChangesProposed={(proposedChanges) => {
                  setChanges((prev) => [...prev, ...proposedChanges]);
                }}
                onFinalized={(convId) => {
                  if (convId) setConversationId(convId);
                  setStage('review');
                }}
              />
            </div>
          )}

          {stage === 'review' && (
            <ReviewStage
              tailoredVersion={tailoredVersion}
              changes={changes}
              onGeneratePdf={handleGeneratePdf}
              loading={pdfLoading}
            />
          )}

          {stage === 'ready' && (
            <ReadyStage
              pdfUrl={pdfUrl}
              onClose={onClose}
              entryPoint={entryPoint}
              conversationId={conversationId}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
