'use client';

/**
 * CascadeConsentSheet — Unified bottom sheet for all cascade transitions.
 *
 * Screens:
 *   connect_limit  — Connects exhausted. Switch to DMs?
 *   dm_review      — Swipeable cards: edit subject + body, approve each DM
 *   dm_limit       — DMs exhausted. Switch to email?
 *   email_review   — Swipeable cards: edit email subject + body
 *   deferred       — Some recruiters parked (no email found)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import {
  X, MessageSquare, Mail, Clock, ChevronLeft, ChevronRight,
  Send, Linkedin, Copy, Check, AlertTriangle, CheckCircle2,
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

function linkedinComposeUrl(linkedinUrl) {
  const vanity = linkedinUrl?.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1];
  return vanity
    ? `https://www.linkedin.com/messaging/compose/?recipient=${vanity}`
    : linkedinUrl;
}

// ── SwipeableCard ────────────────────────────────────────────────────────────

function SwipeableCard({
  job,
  type, // 'dm' | 'email'
  onApprove,
  onCopyAndOpen,
  isActive,
}) {
  const [subject, setSubject] = useState(
    type === 'email' ? (job.email_subject || '') : (job.dm_subject || '')
  );
  const [body, setBody] = useState(
    type === 'email' ? (job.email_body || job.dm_body || '') : (job.dm_body || '')
  );
  const [copied, setCopied] = useState(false);

  const handleCopyAndOpen = async () => {
    const fullText = subject ? `${subject}\n\n${body}` : body;
    if (navigator.clipboard) {
      try { await navigator.clipboard.writeText(fullText); } catch {}
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    if (type === 'dm' && job.linkedin_url) {
      window.open(linkedinComposeUrl(job.linkedin_url), '_blank', 'noopener');
    }

    onCopyAndOpen?.({
      job_id: job.id,
      ...(type === 'email'
        ? { email_subject: subject, email_body: body }
        : { dm_subject: subject, dm_body: body }),
    });
  };

  const handleApprove = () => {
    onApprove?.({
      job_id: job.id,
      approved: true,
      ...(type === 'email'
        ? { email_subject: subject, email_body: body }
        : { dm_subject: subject, dm_body: body }),
    });
  };

  if (!isActive) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="space-y-3"
    >
      {/* Recruiter header */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full ${job.avatarColor || 'bg-emerald-600'} flex items-center justify-center text-white font-semibold text-sm`}>
          {job.avatar || job.name?.[0] || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 dark:text-white text-sm">{job.name}</p>
          <p className="text-gray-400 text-xs truncate">{job.company}</p>
        </div>
      </div>

      {/* Subject */}
      <div>
        <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">
          Subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="input-field text-sm"
          placeholder={type === 'email' ? 'Email subject…' : 'DM subject…'}
        />
      </div>

      {/* Body */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Message
          </label>
          <span className="text-[10px] text-gray-400">{body.length} chars</span>
        </div>
        {!job.dm_body && !job.email_body && type === 'dm' && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">
            Couldn&apos;t generate an AI draft — please type your message below.
          </p>
        )}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={type === 'email' ? 8 : 6}
          className="input-field resize-none text-sm leading-relaxed"
          placeholder={type === 'email' ? 'Email body…' : 'DM message…'}
        />
      </div>

      {/* Actions */}
      <div className="space-y-2">
        {type === 'dm' ? (
          <>
            {/* Primary: Copy & open LinkedIn */}
            <button
              onClick={handleCopyAndOpen}
              disabled={!body}
              className="w-full py-3 rounded-2xl bg-[#0077b5] hover:bg-[#006097] text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-colors active:scale-[0.98]"
            >
              {copied ? <Check className="w-4 h-4" /> : <Linkedin className="w-4 h-4" />}
              {copied ? 'Copied! Opening LinkedIn…' : 'Copy & open LinkedIn'}
            </button>
            {/* Secondary: Approve for automation */}
            <button
              onClick={handleApprove}
              disabled={!body}
              className="w-full py-2.5 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-30 active:scale-[0.97] transition-all"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Approve for automation
            </button>
          </>
        ) : (
          <>
            {/* Primary: Send email */}
            <button
              onClick={handleApprove}
              disabled={!body || !subject}
              className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-colors active:scale-[0.98]"
            >
              <Mail className="w-4 h-4" />
              Send email
            </button>
            {/* Secondary: Copy */}
            <button
              onClick={handleCopyAndOpen}
              disabled={!body}
              className="w-full py-2.5 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-30 active:scale-[0.97] transition-all"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy text'}
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ── Screen: Connect Limit Hit ────────────────────────────────────────────────

function ConnectLimitScreen({ count, onSwitchToDM, onDefer, loading }) {
  return (
    <div className="space-y-5 py-2">
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Connect requests maxed out</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1.5 leading-relaxed">
            LinkedIn hit the limit. <strong className="text-gray-800 dark:text-gray-200">{count} {count === 1 ? 'person is' : 'people are'}</strong> still waiting.
            Switch to DMs instead?
          </p>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3.5 border border-blue-100 dark:border-blue-800/40">
        <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
          <strong>DMs</strong> go directly to their inbox — higher visibility than connection requests.
          You&apos;ll review each message before sending.
        </p>
      </div>

      <div className="space-y-2.5">
        <button
          onClick={onSwitchToDM}
          disabled={loading}
          className="w-full py-3.5 rounded-2xl bg-[#0077b5] hover:bg-[#006097] text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors active:scale-[0.98]"
        >
          <MessageSquare className="w-4 h-4" />
          {loading ? 'Switching…' : 'Switch to DMs'}
        </button>
        <button
          onClick={onDefer}
          disabled={loading}
          className="w-full py-3 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-30 active:scale-[0.97] transition-all"
        >
          <Clock className="w-4 h-4" />
          Wait &amp; retry later
        </button>
      </div>
    </div>
  );
}

// ── Screen: DM Limit Hit ─────────────────────────────────────────────────────

function DMLimitScreen({ count, onSwitchToEmail, onDefer, loading }) {
  return (
    <div className="space-y-5 py-2">
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
          <MessageSquare className="w-8 h-8 text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">DMs hit the wall</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1.5 leading-relaxed">
            <strong className="text-gray-800 dark:text-gray-200">{count} {count === 1 ? 'person' : 'people'}</strong> left.
            Want to draft cold emails instead?
          </p>
        </div>
      </div>

      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3.5 border border-emerald-100 dark:border-emerald-800/40">
        <p className="text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">
          Emails are sent from <strong>your Gmail</strong> — they come from your actual address, not CareerPilot.
          Recruiters with no email on file will be parked for later.
        </p>
      </div>

      <div className="space-y-2.5">
        <button
          onClick={onSwitchToEmail}
          disabled={loading}
          className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors active:scale-[0.98]"
        >
          <Mail className="w-4 h-4" />
          {loading ? 'Switching…' : 'Draft emails'}
        </button>
        <button
          onClick={onDefer}
          disabled={loading}
          className="w-full py-3 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-30 active:scale-[0.97] transition-all"
        >
          <Clock className="w-4 h-4" />
          Wait &amp; retry later
        </button>
      </div>
    </div>
  );
}

// ── Screen: Deferred ─────────────────────────────────────────────────────────

function DeferredScreen({ count, onClose }) {
  return (
    <div className="space-y-5 py-2">
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
          <Clock className="w-8 h-8 text-gray-500 dark:text-gray-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {count} {count === 1 ? 'recruiter' : 'recruiters'} parked
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1.5 leading-relaxed">
            No email on file for {count === 1 ? 'this recruiter' : 'these recruiters'}.
            You can try again later when LinkedIn limits reset — usually next day.
          </p>
        </div>
      </div>

      <button
        onClick={onClose}
        className="w-full py-3.5 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
      >
        Got it
      </button>
    </div>
  );
}

// ── Screen: DM Choice (Review & Edit Each vs Send All) ──────────────────────

function DMChoiceScreen({ jobs, onReviewEach, onSendAll, onDefer, loading }) {
  return (
    <div className="space-y-5 py-2">
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <MessageSquare className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {jobs.length} {jobs.length === 1 ? 'DM' : 'DMs'} ready
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1.5 leading-relaxed">
            {jobs.some(j => j.dm_body)
              ? 'Pilot drafted messages for each recruiter. Review them one by one, or send all at once.'
              : 'Connection failed for these profiles. Review and type a DM for each one.'}
          </p>
        </div>
      </div>

      {/* Preview first message */}
      {jobs[0]?.dm_body && (
        <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3.5 border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-7 h-7 rounded-full ${jobs[0].avatarColor || 'bg-emerald-600'} flex items-center justify-center text-white font-semibold text-[10px]`}>
              {jobs[0].avatar || jobs[0].name?.[0] || '?'}
            </div>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{jobs[0].name}</p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-3">
            {jobs[0].dm_body}
          </p>
          {jobs.length > 1 && (
            <p className="text-[10px] text-gray-400 mt-2">+{jobs.length - 1} more</p>
          )}
        </div>
      )}

      <div className="space-y-2.5">
        <button
          onClick={onReviewEach}
          disabled={loading}
          className="w-full py-3.5 rounded-2xl bg-[#0077b5] hover:bg-[#006097] text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors active:scale-[0.98]"
        >
          <ChevronRight className="w-4 h-4" />
          Review &amp; edit each
        </button>
        {jobs.some(j => j.dm_body) && (
          <button
            onClick={onSendAll}
            disabled={loading}
            className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors active:scale-[0.98]"
          >
            <Send className="w-4 h-4" />
            {loading ? 'Approving…' : 'Send all'}
          </button>
        )}
        <button
          onClick={onDefer}
          disabled={loading}
          className="w-full py-2.5 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-30 active:scale-[0.97] transition-all"
        >
          <Clock className="w-4 h-4" />
          Skip for now
        </button>
      </div>
    </div>
  );
}

// ── Screen: Email Choice (Review & Edit Each vs Send All) ───────────────────

function EmailChoiceScreen({ jobs, onReviewEach, onSendAll, loading }) {
  return (
    <div className="space-y-5 py-2">
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <Mail className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {jobs.length} {jobs.length === 1 ? 'email' : 'emails'} ready
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1.5 leading-relaxed">
            Cold emails drafted from your Gmail.
            Review each one, or send all at once.
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        <button
          onClick={onReviewEach}
          disabled={loading}
          className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors active:scale-[0.98]"
        >
          <ChevronRight className="w-4 h-4" />
          Review &amp; edit each
        </button>
        <button
          onClick={onSendAll}
          disabled={loading}
          className="w-full py-3 rounded-2xl bg-[#0077b5] hover:bg-[#006097] text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors active:scale-[0.98]"
        >
          <Send className="w-4 h-4" />
          {loading ? 'Sending…' : 'Send all'}
        </button>
      </div>
    </div>
  );
}

// ── Screen: Review Cards (DM or Email) ───────────────────────────────────────

function ReviewCardsScreen({ jobs, type, onDone, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [approvedIds, setApprovedIds] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);

  const total = jobs.length;
  const remaining = total - approvedIds.size;

  const handleApprove = async (approval) => {
    // Send single approval to API
    try {
      await fetch('/api/outreach/approve-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvals: [{ ...approval, approved: true }] }),
      });
      setApprovedIds(prev => new Set([...prev, approval.job_id]));

      // Auto-advance to next card
      if (currentIndex < total - 1) {
        setTimeout(() => setCurrentIndex(i => i + 1), 300);
      }
    } catch (err) {
      console.error('Approve failed:', err);
    }
  };

  const handleCopyAndOpen = (data) => {
    // Mark as manually sent — update status to dm_sent
    fetch('/api/outreach/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: data.job_id,
        status: type === 'dm' ? 'dm_sent' : 'email_sent',
        result_detail: 'manual_send',
      }),
    }).catch(() => {});

    setApprovedIds(prev => new Set([...prev, data.job_id]));
    if (currentIndex < total - 1) {
      setTimeout(() => setCurrentIndex(i => i + 1), 300);
    }
  };

  const allDone = approvedIds.size === total;

  return (
    <div className="space-y-4">
      {/* Progress indicator */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {type === 'dm' ? 'Review DMs' : 'Review emails'} · {currentIndex + 1}/{total}
        </p>
        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          {approvedIds.size} done
        </p>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-emerald-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${(approvedIds.size / total) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Card navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4 text-gray-500" />
        </button>

        <div className="flex-1 flex gap-1 justify-center">
          {jobs.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentIndex
                  ? 'bg-emerald-500'
                  : approvedIds.has(jobs[i].id)
                    ? 'bg-emerald-300 dark:bg-emerald-700'
                    : 'bg-gray-300 dark:bg-slate-600'
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => setCurrentIndex(i => Math.min(total - 1, i + 1))}
          disabled={currentIndex === total - 1}
          className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Current card */}
      <AnimatePresence mode="wait">
        {jobs.map((job, i) => (
          <SwipeableCard
            key={job.id}
            job={job}
            type={type}
            isActive={i === currentIndex}
            onApprove={handleApprove}
            onCopyAndOpen={handleCopyAndOpen}
          />
        ))}
      </AnimatePresence>

      {/* All done */}
      {allDone && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-center border border-emerald-100 dark:border-emerald-800/40"
        >
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            All {total} {type === 'dm' ? 'DMs' : 'emails'} handled
          </p>
          <button
            onClick={() => onDone?.()}
            className="mt-3 btn-gradient px-6 py-2.5 rounded-xl text-white text-sm font-semibold"
          >
            Done
          </button>
        </motion.div>
      )}
    </div>
  );
}

// ── Main: CascadeConsentSheet ────────────────────────────────────────────────

export default function CascadeConsentSheet({ cascade, jobs, onClose, onRefresh }) {
  // cascade: { connect_limit_hit: N, dm_pending_review: N, dm_limit_hit: N, email_pending_review: N }
  // jobs: full job objects with recruiter info for card rendering

  const [screen, setScreen] = useState(null); // auto-detected
  const [loading, setLoading] = useState(false);
  const [dmJobs, setDmJobs] = useState([]);
  const [emailJobs, setEmailJobs] = useState([]);
  const [deferredCount, setDeferredCount] = useState(0);

  // Auto-detect which screen to show based on cascade state
  useEffect(() => {
    if (!cascade) return;

    if (cascade.connect_limit_hit > 0) {
      setScreen('connect_limit');
    } else if (cascade.dm_pending_review > 0) {
      const pending = (jobs || []).filter(j => j.status === 'dm_pending_review');
      setDmJobs(pending);
      // Show choice screen if drafts are ready, otherwise wait
      const hasDrafts = pending.length > 0 && pending.some(j => j.dm_body);
      setScreen(hasDrafts ? 'dm_choice' : 'dm_review');
    } else if (cascade.dm_limit_hit > 0) {
      setScreen('dm_limit');
    } else if (cascade.email_pending_review > 0) {
      const pending = (jobs || []).filter(j => j.status === 'email_pending_review');
      setEmailJobs(pending);
      const hasDrafts = pending.length > 0 && pending.some(j => j.email_body);
      setScreen(hasDrafts ? 'email_choice' : 'email_review');
    } else {
      setScreen(null);
    }
  }, [cascade, jobs]);

  const handleSwitchToDM = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/outreach/cascade-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve_dm' }),
      });
      const json = await res.json();
      if (json.ok) {
        // Refresh to get updated jobs with DM drafts, then show choice screen
        onRefresh?.();
      }
    } catch (err) {
      console.error('Switch to DM failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendAllDMs = async () => {
    setLoading(true);
    try {
      const approvals = dmJobs.map(j => ({
        job_id: j.id,
        approved: true,
        dm_subject: j.dm_subject || '',
        dm_body: j.dm_body || '',
      }));
      await fetch('/api/outreach/approve-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvals }),
      });
      onRefresh?.();
      onClose?.();
    } catch (err) {
      console.error('Send all DMs failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendAllEmails = async () => {
    setLoading(true);
    try {
      const approvals = emailJobs.map(j => ({
        job_id: j.id,
        approved: true,
        email_subject: j.email_subject || j.dm_subject || '',
        email_body: j.email_body || j.dm_body || '',
      }));
      await fetch('/api/outreach/approve-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvals }),
      });
      onRefresh?.();
      onClose?.();
    } catch (err) {
      console.error('Send all emails failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToEmail = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/outreach/cascade-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve_email' }),
      });
      const json = await res.json();
      if (json.ok) {
        if (json.deferred > 0) {
          setDeferredCount(json.deferred);
        }
        onRefresh?.();
      }
    } catch (err) {
      console.error('Switch to email failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDefer = async () => {
    setLoading(true);
    try {
      await fetch('/api/outreach/cascade-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'defer' }),
      });
      onClose?.();
    } catch (err) {
      console.error('Defer failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewDone = () => {
    // Check if there are deferred jobs to show
    if (deferredCount > 0) {
      setScreen('deferred');
    } else {
      onClose?.();
      onRefresh?.();
    }
  };

  if (!screen) return null;

  const title = {
    connect_limit: 'Outreach Update',
    dm_choice: 'DM Automation',
    dm_review: 'Review DMs',
    dm_limit: 'Outreach Update',
    email_choice: 'Email Automation',
    email_review: 'Review Emails',
    deferred: 'Parked',
  }[screen];

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative w-full max-w-[430px] bg-white dark:bg-slate-900 rounded-t-3xl max-h-[92dvh] overflow-y-auto"
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-300 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-800">
          <h2 className="font-bold text-gray-900 dark:text-white text-base">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-5 pb-10">
          <AnimatePresence mode="wait">
            {screen === 'connect_limit' && (
              <motion.div key="cl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ConnectLimitScreen
                  count={cascade?.connect_limit_hit || 0}
                  onSwitchToDM={handleSwitchToDM}
                  onDefer={handleDefer}
                  loading={loading}
                />
              </motion.div>
            )}

            {screen === 'dm_choice' && (
              <motion.div key="dmc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <DMChoiceScreen
                  jobs={dmJobs}
                  onReviewEach={() => setScreen('dm_review')}
                  onSendAll={handleSendAllDMs}
                  onDefer={handleDefer}
                  loading={loading}
                />
              </motion.div>
            )}

            {screen === 'dm_review' && (
              <motion.div key="dmr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ReviewCardsScreen
                  jobs={dmJobs}
                  type="dm"
                  onDone={handleReviewDone}
                  onClose={onClose}
                />
              </motion.div>
            )}

            {screen === 'dm_limit' && (
              <motion.div key="dl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <DMLimitScreen
                  count={cascade?.dm_limit_hit || 0}
                  onSwitchToEmail={handleSwitchToEmail}
                  onDefer={handleDefer}
                  loading={loading}
                />
              </motion.div>
            )}

            {screen === 'email_choice' && (
              <motion.div key="ec" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <EmailChoiceScreen
                  jobs={emailJobs}
                  onReviewEach={() => setScreen('email_review')}
                  onSendAll={handleSendAllEmails}
                  loading={loading}
                />
              </motion.div>
            )}

            {screen === 'email_review' && (
              <motion.div key="er" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ReviewCardsScreen
                  jobs={emailJobs}
                  type="email"
                  onDone={handleReviewDone}
                  onClose={onClose}
                />
              </motion.div>
            )}

            {screen === 'deferred' && (
              <motion.div key="def" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <DeferredScreen
                  count={deferredCount}
                  onClose={onClose}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
