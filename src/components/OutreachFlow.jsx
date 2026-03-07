'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Edit3, Send, ArrowRight, CheckCircle2, Bell, Mail, Linkedin, Clock } from 'lucide-react';
import useStore from '@/store/useStore';

// Format send_time ISO → "Tue, 8:50 AM IST" using device timezone
function formatLocalTime(isoString) {
  if (!isoString) return null;
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'shortGeneric', // "India Time" → falls back to "GMT+5:30" on old browsers
    });
  } catch {
    return null;
  }
}

function LoadingStep({ message, submessage }) {
  return (
    <motion.div
      key="loading"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col items-center gap-4 py-8"
    >
      <div className="w-12 h-12 spinner" />
      <div className="text-center">
        <p className="font-semibold text-gray-900 dark:text-white">{message}</p>
        {submessage && <p className="text-gray-400 text-sm mt-1">{submessage}</p>}
      </div>
    </motion.div>
  );
}

function LinkedInPreview({ message, to }) {
  return (
    <div className="rounded-xl border-2 border-[#0077b5] bg-white dark:bg-slate-800 overflow-hidden">
      <div className="bg-[#0077b5] px-4 py-3 flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center">
          <span className="text-[#0077b5] text-[8px] font-black">in</span>
        </div>
        <span className="text-white text-sm font-medium">LinkedIn Message</span>
      </div>
      <div className="px-4 py-2 border-b border-gray-200 dark:border-slate-700">
        <span className="text-gray-400 text-xs">To: </span>
        <span className="text-gray-800 dark:text-gray-200 text-xs font-medium">{to}</span>
      </div>
      <div className="px-4 py-3">
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
          {message.length > 300 ? message.slice(0, 300) + '…' : message}
        </p>
      </div>
    </div>
  );
}

// STEPS: recommendation → opening → editor → preview → success | reminder_set
const STEPS = ['recommendation', 'opening', 'editor', 'preview', 'success', 'reminder_set'];

export default function OutreachFlow({ referral, onClose, onSent, onConfirmSend }) {
  const messageReferral = useStore((s) => s.messageReferral);
  const [step, setStep] = useState('recommendation');
  const [message, setMessage] = useState('');
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [openingStatus, setOpeningStatus] = useState('copying'); // 'copying' | 'opening'

  // Local timezone-formatted send time
  const localTime = formatLocalTime(referral?.send_time) || referral?.send_time_label || 'Tuesday 9am';

  // Fetch draft when moving past recommendation
  useEffect(() => {
    if (step === 'editor' && !message) {
      setLoadingDraft(true);
      fetch('/api/recruiters/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: referral?.id }),
      })
        .then(r => r.json())
        .then(d => { if (d.draft) setMessage(d.draft); })
        .catch(() => {})
        .finally(() => setLoadingDraft(false));
    }
  }, [step]);

  // Opening LinkedIn tab — fetch draft, copy to clipboard, open compose URL
  useEffect(() => {
    if (step !== 'opening') return;
    setOpeningStatus('copying');
    let cancelled = false;

    const prepare = async () => {
      let msg = message;
      if (!msg) {
        try {
          const r = await fetch('/api/recruiters/outreach', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ match_id: referral?.id }),
          });
          const d = await r.json();
          if (d.draft) { msg = d.draft; if (!cancelled) setMessage(d.draft); }
        } catch {}
      }

      if (msg && navigator.clipboard) {
        try { await navigator.clipboard.writeText(msg); } catch {}
      }

      if (cancelled) return;
      setOpeningStatus('opening');

      const vanity = referral?.linkedin_url?.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1];
      const composeUrl = vanity
        ? `https://www.linkedin.com/messaging/compose/?recipient=${vanity}`
        : referral?.linkedin_url;
      if (composeUrl) window.open(composeUrl, '_blank', 'noopener');

      setTimeout(() => { if (!cancelled) setStep('editor'); }, 600);
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
    setStep('success');
    onSent?.();
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
      setStep('reminder_set');
    } catch {}
    finally { setScheduling(false); }
  };

  const handleSkip = () => onClose?.();

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={['success', 'reminder_set'].includes(step) ? onClose : undefined}
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
            <div className={`w-10 h-10 rounded-full ${referral?.avatarColor || 'bg-violet-600'} flex items-center justify-center text-white font-semibold text-sm`}>
              {referral?.avatar}
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-sm">{referral?.name}</p>
              <p className="text-gray-400 text-xs">{referral?.company}</p>
            </div>
          </div>
          {!['success', 'reminder_set'].includes(step) && (
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-5 py-5 pb-10">
          <AnimatePresence mode="wait">

            {/* ── Step: Pilot's Recommendation ── */}
            {step === 'recommendation' && (
              <motion.div
                key="recommendation"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Pilot's take */}
                <div className="bg-violet-50 dark:bg-violet-900/20 rounded-2xl p-4 border border-violet-100 dark:border-violet-800/40">
                  <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider mb-2">Pilot's take</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                    {referral?.pilot_recommendation || `${referral?.name} looks like a strong match for your target roles.`}
                  </p>
                </div>

                {/* Best window — with reason */}
                <div className="rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-slate-800">
                    <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{localTime}</p>
                        <div className="flex items-center gap-1">
                          {referral?.channel === 'email'
                            ? <Mail className="w-3.5 h-3.5 text-blue-500" />
                            : <Linkedin className="w-3.5 h-3.5 text-[#0077b5]" />
                          }
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {referral?.channel === 'email' ? 'Email' : 'LinkedIn DM'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-2.5">
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      Recruiters check LinkedIn Tue–Thu mornings. Messages sent at 9am are <span className="font-semibold text-gray-700 dark:text-gray-300">3× more likely to be read</span> the same day.
                    </p>
                  </div>
                </div>

                {/* Actions — 2 CTAs max */}
                <button
                  onClick={handleSetReminder}
                  disabled={scheduling || !referral?.send_time}
                  className="btn-gradient w-full py-4 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Bell className="w-4 h-4" />
                  {scheduling ? 'Setting reminder…' : `Remind me ${localTime}`}
                </button>

                <button
                  onClick={() => setStep('opening')}
                  className="w-full py-3.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Write &amp; send now
                </button>

                <button
                  onClick={handleSkip}
                  className="w-full text-center text-gray-400 text-sm py-1"
                >
                  Skip
                </button>
              </motion.div>
            )}

            {/* ── Step: Opening LinkedIn ── */}
            {step === 'opening' && (
              <LoadingStep
                key="opening"
                message={openingStatus === 'copying' ? 'Copying message body…' : 'Opening LinkedIn DM…'}
                submessage={openingStatus === 'copying' ? 'Paste it straight into the message box' : `Opening compose for ${referral?.name}`}
              />
            )}

            {/* ── Step: Message editor ── */}
            {step === 'editor' && (
              <motion.div
                key="editor"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-sm text-violet-600 dark:text-violet-400 font-medium">
                  <Edit3 className="w-4 h-4" />
                  Pilot-drafted — review and edit
                </div>

                {message && (
                  <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    Message copied — just paste it in LinkedIn
                  </div>
                )}

                {loadingDraft ? (
                  <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                    <div className="w-4 h-4 spinner" /> Writing your message…
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Message</label>
                      <span className="text-xs text-gray-400">{message.length} chars</span>
                    </div>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={8}
                      className="input-field resize-none text-sm leading-relaxed"
                      placeholder="Loading draft…"
                    />
                  </div>
                )}

                <button
                  onClick={() => setStep('preview')}
                  disabled={!message}
                  className="btn-gradient w-full py-4 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  Preview message <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {/* ── Step: Preview ── */}
            {step === 'preview' && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Ready to send — looks good?
                </div>

                <LinkedInPreview message={message} to={referral?.name} />

                <button
                  onClick={handleSendNow}
                  className="btn-gradient w-full py-4 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Mark as sent
                </button>

                <button
                  onClick={() => setStep('editor')}
                  className="w-full py-3 text-gray-500 dark:text-gray-400 text-sm text-center"
                >
                  Edit message
                </button>
              </motion.div>
            )}

            {/* ── Step: Reminder set ── */}
            {step === 'reminder_set' && (
              <motion.div
                key="reminder_set"
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
                    <strong className="text-gray-800 dark:text-gray-200">{localTime}</strong> — your message is drafted and waiting.
                  </p>
                </div>

                <div className="w-full card p-4 text-left space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <Bell className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      Reminder at <strong>{localTime}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">Draft saved — edit anytime before sending</span>
                  </div>
                </div>

                <button onClick={onClose} className="btn-gradient w-full py-4 rounded-xl text-white font-semibold text-sm">
                  Done
                </button>

                <button
                  onClick={() => setStep('editor')}
                  className="w-full text-center text-violet-600 dark:text-violet-400 text-sm font-medium py-1"
                >
                  Preview draft message
                </button>
              </motion.div>
            )}

            {/* ── Step: Success ── */}
            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-5 py-4 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-xl shadow-blue-500/30"
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
                    <Bell className="w-4 h-4 text-violet-500 shrink-0" />
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
