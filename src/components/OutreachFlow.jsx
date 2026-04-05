'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, CheckCircle2, Bell, Linkedin, Copy, Check } from 'lucide-react';
import useStore from '@/store/useStore';

function formatLocalTime(isoString) {
  if (!isoString) return null;
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'shortGeneric',
    });
  } catch {
    return null;
  }
}

// Typing skeleton while draft loads
function TypingSkeleton() {
  return (
    <div className="space-y-2.5 py-2 animate-pulse">
      <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded-full w-full" />
      <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded-full w-[92%]" />
      <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded-full w-[85%]" />
      <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded-full w-[60%]" />
      <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded-full w-[78%]" />
      <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded-full w-[45%]" />
    </div>
  );
}

// STEPS: compose → opening → done | scheduled
const STEPS = ['compose', 'opening', 'done', 'scheduled'];

export default function OutreachFlow({ referral, onClose, onSent, onConfirmSend }) {
  const messageReferral = useStore((s) => s.messageReferral);
  const [step, setStep] = useState('compose');
  const [message, setMessage] = useState('');
  const [loadingDraft, setLoadingDraft] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [copied, setCopied] = useState(false);

  const localTime = formatLocalTime(referral?.send_time) || referral?.send_time_label || 'Tuesday 9am';

  // Pre-fetch draft immediately when sheet opens
  useEffect(() => {
    let cancelled = false;
    setLoadingDraft(true);
    fetch('/api/recruiters/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: referral?.id }),
    })
      .then(r => r.json())
      .then(d => { if (!cancelled && d.dm_body) setMessage(d.dm_body); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingDraft(false); });
    return () => { cancelled = true; };
  }, [referral?.id]);

  // Opening LinkedIn — copy + open compose URL, then mark done
  useEffect(() => {
    if (step !== 'opening') return;
    let cancelled = false;

    const prepare = async () => {
      if (message && navigator.clipboard) {
        try { await navigator.clipboard.writeText(message); } catch {}
      }
      if (cancelled) return;

      const vanity = referral?.linkedin_url?.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1];
      const composeUrl = vanity
        ? `https://www.linkedin.com/messaging/compose/?recipient=${vanity}`
        : referral?.linkedin_url;
      if (composeUrl) window.open(composeUrl, '_blank', 'noopener');

      setTimeout(() => { if (!cancelled) setStep('done'); }, 600);
    };

    prepare();
    return () => { cancelled = true; };
  }, [step]);

  const handleSendNow = async () => {
    if (onConfirmSend) {
      try { await onConfirmSend(message); } catch {}
    } else {
      messageReferral(referral);
    }
    setStep('opening');
  };

  const handleSetReminder = async () => {
    if (!referral?.send_time) return;
    setScheduling(true);
    try {
      await fetch('/api/recruiter-matches/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: referral.id,
          scheduled_at: referral.send_time,
          outreach_channel: referral.channel || 'linkedin',
          message,
        }),
      });
      setStep('scheduled');
    } catch {}
    finally { setScheduling(false); }
  };

  const handleCopyOnly = async () => {
    if (message && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={['done', 'scheduled'].includes(step) ? onClose : undefined}
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
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${referral?.avatarColor || 'bg-emerald-600'} flex items-center justify-center text-white font-semibold text-sm`}>
              {referral?.avatar}
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-sm">{referral?.name}</p>
              <p className="text-gray-400 text-xs">{referral?.company}</p>
            </div>
          </div>
          {!['done', 'scheduled'].includes(step) && (
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-5 py-5 pb-10">
          <AnimatePresence mode="wait">

            {/* ── Compose: Pilot's take + editor in one view ── */}
            {step === 'compose' && (
              <motion.div
                key="compose"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Pilot's take — compact */}
                {referral?.pilot_recommendation && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-3.5 py-3 border border-emerald-100 dark:border-emerald-800/40">
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1">Pilot&apos;s take</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-2">
                      {referral.pilot_recommendation}
                    </p>
                  </div>
                )}

                {/* Message editor */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      LinkedIn DM
                    </label>
                    {!loadingDraft && (
                      <span className="text-xs text-gray-400">{message.length} chars</span>
                    )}
                  </div>

                  {loadingDraft ? (
                    <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-3.5 h-3.5 spinner shrink-0" />
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Pilot is drafting your message…</p>
                      </div>
                      <TypingSkeleton />
                    </div>
                  ) : (
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={7}
                      className="input-field resize-none text-sm leading-relaxed"
                      placeholder="Write your message…"
                      autoFocus
                    />
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-2.5 pt-1">
                  {/* Primary: Copy & open LinkedIn */}
                  <button
                    onClick={handleSendNow}
                    disabled={!message || loadingDraft}
                    className="w-full py-3.5 rounded-2xl bg-[#0077b5] hover:bg-[#006097] text-white font-semibold text-sm flex items-center justify-center gap-2.5 disabled:opacity-40 transition-colors active:scale-[0.98]"
                  >
                    <Linkedin className="w-[18px] h-[18px]" />
                    Copy &amp; open LinkedIn
                  </button>

                  {/* Row: Copy only + Schedule */}
                  <div className="flex gap-2.5">
                    <button
                      onClick={handleCopyOnly}
                      disabled={!message || loadingDraft}
                      className="flex-1 py-3 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-30 active:scale-[0.97] transition-all"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copied!' : 'Copy text'}
                    </button>

                    {referral?.send_time && (
                      <button
                        onClick={handleSetReminder}
                        disabled={scheduling || loadingDraft || !message}
                        className="flex-1 py-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-30 active:scale-[0.97] transition-all"
                      >
                        <Bell className="w-4 h-4" />
                        {scheduling ? 'Setting…' : 'Remind me'}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Opening LinkedIn ── */}
            {step === 'opening' && (
              <motion.div
                key="opening"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center gap-4 py-8"
              >
                <div className="w-12 h-12 spinner" />
                <div className="text-center">
                  <p className="font-semibold text-gray-900 dark:text-white">Opening LinkedIn…</p>
                  <p className="text-gray-400 text-sm mt-1">Message copied — paste it in the DM box</p>
                </div>
              </motion.div>
            )}

            {/* ── Scheduled ── */}
            {step === 'scheduled' && (
              <motion.div
                key="scheduled"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-5 py-4 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-xl shadow-amber-500/30"
                >
                  <Bell className="w-9 h-9 text-white" />
                </motion.div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Reminder set</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-2 leading-relaxed">
                    Pilot will nudge you to DM <strong className="text-gray-800 dark:text-gray-200">{referral?.name}</strong> at{' '}
                    <strong className="text-gray-800 dark:text-gray-200">{localTime}</strong>
                  </p>
                </div>
                <button onClick={onClose} className="btn-gradient w-full py-4 rounded-xl text-white font-semibold text-sm">
                  Done
                </button>
              </motion.div>
            )}

            {/* ── Done ── */}
            {step === 'done' && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-5 py-4 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-500/30"
                >
                  <Send className="w-9 h-9 text-white" />
                </motion.div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Sent.</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-2 leading-relaxed">
                    Outreach to <strong className="text-gray-800 dark:text-gray-200">{referral?.name}</strong> at{' '}
                    <strong className="text-gray-800 dark:text-gray-200">{referral?.company}</strong> is done.
                  </p>
                </div>
                <div className="w-full card p-4 text-left space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <Bell className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">Follow-up reminder in <strong>5 days</strong> if no reply</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">Added to Follow-Ups tab</span>
                  </div>
                </div>
                <button onClick={onClose} className="btn-gradient w-full py-4 rounded-xl text-white font-semibold text-sm">
                  Done
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
