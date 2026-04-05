'use client';

/**
 * /dashboard/referrals
 *
 * Recruiter Targets + Follow-Ups.
 * Now supports multi-select + extension-powered LinkedIn automation.
 *
 * Flow:
 *   1. User taps "Select" → checkboxes appear on uncontacted cards
 *   2. User picks 1–15 contacts → sticky bar appears
 *   3. Tap CTA → ReviewSheet opens (notes editing, 300 char limit)
 *   4. "Start Automation" → queues jobs + triggers Chrome extension
 *   5. Progress shown live per contact
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Clock, ChevronRight, Bell, RefreshCw,
  Zap, Sparkles, CheckSquare, Square, X, Edit2, AlertTriangle,
  Chrome, CheckCircle2,
} from 'lucide-react';
import OutreachFlow from '@/components/OutreachFlow';
import CascadeConsentSheet from '@/components/CascadeConsentSheet';
import { createClient } from '@/lib/supabase/client';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_BATCH = 15;
const NOTE_MAX = 300;
const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID || 'kphfbkfdffodecfioadmbdogmmkgdbaj';

// ── Utils ─────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-emerald-600', 'bg-blue-600', 'bg-emerald-600', 'bg-amber-600',
  'bg-rose-600', 'bg-indigo-600', 'bg-cyan-600', 'bg-pink-600',
];
function avatarColor(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function formatMatch(rm) {
  const rec = rm.recruiters;
  const initials = rec.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return {
    id: rm.id,
    recruiterId: rec.id,
    name: rec.name,
    title: rec.title || 'Recruiter',
    company: rec.current_company || '',
    avatar: initials,
    avatarColor: avatarColor(rec.name),
    relevanceScore: rm.relevance_score,
    reasons: rm.match_reasons || [],
    status: rm.status,
    outreach_sent_at: rm.outreach_sent_at,
    reply_received_at: rm.reply_received_at,
    linkedin_url: rec.linkedin_url,
    placements_at: rec.placements_at || [],
    response_rate: rec.response_rate || 0,
    outreach_draft: rm.outreach_draft,
  };
}

function linkedinHandle(url = '') {
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/);
  return match ? match[1] : null;
}

function daysSince(isoDate) {
  if (!isoDate) return 0;
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24));
}

function isExtensionInstalled() {
  return typeof chrome !== 'undefined' && chrome.runtime && !!EXTENSION_ID;
}

function isMobileBrowser() {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

const CHROME_STORE_URL = 'https://chromewebstore.google.com/detail/careerpilot-%E2%80%94-job-search/kphfbkfdffodecfioadmbdogmmkgdbaj';

// ── Automation status helpers ─────────────────────────────────────────────────

const STATUS_LABEL = {
  pending:              'Queued',
  processing:           'Sending…',
  sent:                 'Sent',
  dm_sent:              'DM sent',
  dm_approved:          'DM approved',
  dm_pending_review:    'DM pending',
  connect_limit_hit:    'Connect limit',
  dm_limit_hit:         'DM limit',
  email_pending_review: 'Email pending',
  email_ready:          'Email ready',
  email_sent:           'Email sent',
  deferred:             'Parked',
  limit_hit:            'Limit hit',
  failed:               'Failed',
  interrupted:          'Interrupted',
  cancelled:            'Cancelled',
  already_pending:      'Already pending',
  profile_not_found:    'Not found',
  restricted:           'Restricted',
  account_restricted:   'Account restricted',
};
const STATUS_COLOR = {
  pending:              'text-emerald-600 dark:text-emerald-400',
  processing:           'text-amber-600 dark:text-amber-400',
  sent:                 'text-emerald-600 dark:text-emerald-400',
  dm_sent:              'text-emerald-600 dark:text-emerald-400',
  dm_approved:          'text-blue-500',
  dm_pending_review:    'text-amber-500',
  connect_limit_hit:    'text-amber-600 dark:text-amber-400',
  dm_limit_hit:         'text-orange-500',
  email_pending_review: 'text-amber-500',
  email_ready:          'text-blue-500',
  email_sent:           'text-emerald-600 dark:text-emerald-400',
  deferred:             'text-gray-400',
  limit_hit:            'text-red-500',
  failed:               'text-red-500',
  interrupted:          'text-orange-500',
  cancelled:            'text-gray-400',
  already_pending:      'text-blue-500',
  profile_not_found:    'text-red-500',
  restricted:           'text-orange-500',
  account_restricted:   'text-red-600',
};

// ── RecruiterCard ─────────────────────────────────────────────────────────────

function RecruiterCard({ match, selectionMode, selected, onToggleSelect, automationStatus, onEnterSelection }) {
  const isMessaged = match.status === 'messaged';
  const isReplied  = match.status === 'replied';
  const canSelect  = selectionMode && !isMessaged && !isReplied && linkedinHandle(match.linkedin_url);
  const canQuickSend = !selectionMode && !isMessaged && !isReplied;
  const jobStatus  = automationStatus?.[match.id];
  const longPressRef = useRef(null);

  // Long-press to enter selection mode
  const handleTouchStart = () => {
    if (selectionMode || isMessaged || isReplied || !linkedinHandle(match.linkedin_url)) return;
    longPressRef.current = setTimeout(() => {
      onEnterSelection?.(match.id);
    }, 500);
  };
  const handleTouchEnd = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  };

  return (
    <div
      className={`card p-4 transition-all ${selected ? 'ring-2 ring-emerald-500' : ''}`}
      onClick={canSelect ? () => onToggleSelect(match.id) : undefined}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox in selection mode */}
        {selectionMode && (
          <div className="shrink-0 mt-1">
            {canSelect ? (
              selected
                ? <CheckSquare className="w-5 h-5 text-emerald-600" />
                : <Square className="w-5 h-5 text-gray-300 dark:text-gray-600" />
            ) : (
              <Square className="w-5 h-5 text-gray-200 dark:text-gray-700 opacity-40" />
            )}
          </div>
        )}

        <div className={`w-12 h-12 rounded-full ${match.avatarColor} flex items-center justify-center text-white font-semibold text-sm shrink-0`}>
          {match.avatar}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/dashboard/referrals/${match.id}`} className="flex-1 min-w-0" onClick={e => selectionMode && e.preventDefault()}>
              <p className="font-semibold text-gray-900 dark:text-white text-sm leading-snug">{match.name}</p>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 truncate">{match.title}</p>
              {match.company && (
                <p className="text-emerald-600 dark:text-emerald-400 text-xs font-medium mt-0.5 truncate">@ {match.company}</p>
              )}
            </Link>
            <div className="flex items-center gap-1 shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{match.relevanceScore}%</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1 mt-2">
            {match.reasons.slice(0, 3).map((r) => (
              <span key={r} className="tag-pill bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] py-0.5">
                {r}
              </span>
            ))}
          </div>

          {/* Automation status inline */}
          {jobStatus && (
            <p className={`text-xs font-medium mt-2 ${STATUS_COLOR[jobStatus] || 'text-gray-400'}`}>
              {jobStatus === 'processing' && <span className="inline-block w-2 h-2 bg-amber-400 rounded-full mr-1.5 animate-pulse" />}
              {STATUS_LABEL[jobStatus] || jobStatus}
            </p>
          )}

          {!selectionMode && (
            <div className="flex items-center gap-2 mt-3">
              {isReplied ? (
                <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-xs font-medium">
                  <Send className="w-3.5 h-3.5" />Replied
                </div>
              ) : isMessaged ? (
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                  <Send className="w-3.5 h-3.5" />Message sent
                </div>
              ) : (
                <>
                  {linkedinHandle(match.linkedin_url) ? (
                    <button
                      onClick={() => onEnterSelection?.(match.id)}
                      className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition-colors active:scale-95"
                      title="Start outreach — connect, then DM/email fallback"
                    >
                      <Send className="w-3.5 h-3.5" />Outreach
                    </button>
                  ) : null}
                  <Link
                    href={`/dashboard/referrals/${match.id}`}
                    className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-xs"
                  >
                    View <ChevronRight className="w-3 h-3" />
                  </Link>
                </>
              )}
              {(isReplied || isMessaged) && (
                <Link
                  href={`/dashboard/referrals/${match.id}`}
                  className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-xs"
                >
                  View <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── FollowUpCard ──────────────────────────────────────────────────────────────

function FollowUpCard({ match }) {
  const [expanded, setExpanded] = useState(false);
  const since = daysSince(match.outreach_sent_at);
  const needsFollowUp = since >= 5 && !match.reply_received_at;

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${needsFollowUp ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
            {needsFollowUp
              ? <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              : <Send className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white text-sm">{match.name}</p>
            <p className="text-gray-400 text-xs">
              {match.company} · {needsFollowUp ? `No reply · ${since}d ago` : since === 0 ? 'Sent today' : `Sent ${since}d ago`}
            </p>
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-emerald-600 dark:text-emerald-400 text-xs font-medium shrink-0">
          {expanded ? 'Hide' : 'View'}
        </button>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-800 space-y-3">
              <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3">
                <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                  {match.outreach_draft
                    ? `Your message:\n\n${match.outreach_draft.slice(0, 200)}${match.outreach_draft.length > 200 ? '…' : ''}`
                    : 'Original outreach message.'}
                </p>
              </div>
              {needsFollowUp && match.linkedin_url && (
                <a
                  href={match.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-gradient py-3 px-4 rounded-xl text-white text-sm font-semibold flex items-center gap-2 w-full justify-center"
                >
                  <Send className="w-4 h-4" />Send Follow-Up on LinkedIn
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── CapsuleCard ───────────────────────────────────────────────────────────────

function CapsuleCard({ item, onOutreach, isSent }) {
  const rec = item.recruiter;
  const initials = rec.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const color = avatarColor(rec.name);

  return (
    <div className={`card p-4 border-emerald-100 dark:border-emerald-800/40 ${isSent ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <Link href={`/dashboard/referrals/${item.match_id}`} className="shrink-0">
          <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center text-white font-semibold text-sm`}>
            {initials}
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/dashboard/referrals/${item.match_id}`} className="block">
            <p className="font-semibold text-gray-900 dark:text-white text-sm">{rec.name}</p>
            <p className="text-gray-500 dark:text-gray-400 text-xs truncate">{rec.title} · {rec.company}</p>
          </Link>
          <p className="text-gray-600 dark:text-gray-300 text-xs mt-2 leading-relaxed line-clamp-2">
            {item.pilot_recommendation}
          </p>
          <div className="flex items-center gap-2 mt-3">
            {isSent ? (
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                <Send className="w-3.5 h-3.5" />Sent
              </div>
            ) : (
              <button
                onClick={() => onOutreach({
                  id: item.match_id, name: rec.name, company: rec.company,
                  linkedin_url: rec.linkedin_url, avatar: initials, avatarColor: color,
                  pilot_recommendation: item.pilot_recommendation,
                  send_time: item.send_time, send_time_label: item.send_time_label,
                  channel: item.channel,
                })}
                className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition-colors active:scale-95"
              >
                <Zap className="w-3.5 h-3.5" />Reach out
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ReviewSheet ───────────────────────────────────────────────────────────────

// Try to push fresh tokens to the extension and verify it responds
async function pushTokenAndVerify() {
  if (!EXTENSION_ID || typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return { ok: false, reason: 'no_runtime' };
  }
  try {
    const sb = createClient();
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.access_token) {
      return { ok: false, reason: 'no_session' };
    }

    // Send PILOT_SET_TOKEN and wait for response (3s timeout — service worker needs time to wake)
    const delivered = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 3000);
      chrome.runtime.sendMessage(EXTENSION_ID, {
        type: 'PILOT_SET_TOKEN',
        token: session.access_token,
        refresh_token: session.refresh_token || '',
      }, (response) => {
        clearTimeout(timeout);
        if (chrome.runtime?.lastError) {
          console.warn('[CareerPilot] Token push failed:', chrome.runtime.lastError.message);
          resolve(false);
        } else {
          console.log('[CareerPilot] Token push delivered:', response);
          resolve(true);
        }
      });
    });

    return { ok: delivered, session, reason: delivered ? null : 'no_response' };
  } catch (err) {
    console.warn('[CareerPilot] Token push error:', err.message);
    return { ok: false, reason: 'error' };
  }
}

function ReviewSheet({ selectedMatches, onClose, onStartAutomation }) {
  const [notes, setNotes] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [starting, setStarting] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [extensionInstalled, setExtensionInstalled] = useState(isExtensionInstalled());
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [connectionIssue, setConnectionIssue] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef(null);
  const isMobile = isMobileBrowser();

  // Poll for extension installation after user clicks install
  useEffect(() => {
    if (!polling) return;
    pollRef.current = setInterval(() => {
      if (isExtensionInstalled()) {
        setExtensionInstalled(true);
        setPolling(false);
        setShowInstallModal(false);
        clearInterval(pollRef.current);
      }
    }, 2000);
    // Stop polling after 60s
    const timeout = setTimeout(() => {
      setPolling(false);
      clearInterval(pollRef.current);
    }, 60000);
    return () => { clearInterval(pollRef.current); clearTimeout(timeout); };
  }, [polling]);

  // Fetch AI-generated notes for all selected matches
  useEffect(() => {
    async function fetchDrafts() {
      const results = {};
      await Promise.all(
        selectedMatches.map(async (match) => {
          try {
            const res = await fetch('/api/recruiters/outreach', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ match_id: match.id, mode: 'connect_only' }),
            });
            const json = await res.json();
            if (!res.ok || !json.connection_note) {
              results[match.id] = { connection_note: null, dm_subject: '', dm_body: '', error: json.error || 'Generation failed' };
            } else {
              results[match.id] = {
                connection_note: json.connection_note,
                dm_subject: json.dm_subject || '',
                dm_body: json.dm_body || '',
              };
            }
          } catch {
            results[match.id] = { connection_note: null, dm_subject: '', dm_body: '', error: 'Network error' };
          }
        })
      );
      setNotes(results);
    }
    fetchDrafts();
  }, [selectedMatches]);

  function applyToAll(note) {
    const updated = {};
    selectedMatches.forEach(m => {
      updated[m.id] = { ...notes[m.id], connection_note: note, error: undefined };
    });
    setNotes(prev => ({ ...prev, ...updated }));
  }

  function retryDraft(match) {
    setNotes(prev => ({ ...prev, [match.id]: undefined }));
    // Re-trigger fetch for this one match
    fetch('/api/recruiters/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: match.id, mode: 'connect_only' }),
    }).then(async res => {
      const json = await res.json();
      if (!res.ok || !json.connection_note) {
        setNotes(prev => ({ ...prev, [match.id]: { connection_note: null, dm_subject: '', dm_body: '', error: json.error || 'Generation failed' } }));
      } else {
        setNotes(prev => ({ ...prev, [match.id]: { connection_note: json.connection_note, dm_subject: json.dm_subject || '', dm_body: json.dm_body || '' } }));
      }
    }).catch(() => {
      setNotes(prev => ({ ...prev, [match.id]: { connection_note: null, dm_subject: '', dm_body: '', error: 'Network error' } }));
    });
  }

  async function handleStart() {
    setStarting(true);
    setConnectionIssue(false);

    const jobs = selectedMatches.map(match => ({
      match_id:        match.id,
      linkedin_handle: linkedinHandle(match.linkedin_url),
      connection_note: ((notes[match.id]?.connection_note) ?? '').slice(0, NOTE_MAX),
      dm_subject:      notes[match.id]?.dm_subject || '',
      dm_body:         notes[match.id]?.dm_body || '',
    })).filter(j => j.linkedin_handle);

    try {
      // Queue jobs in DB first — extension polls every 15s and will pick these up
      await fetch('/api/outreach/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobs, source: 'extension' }),
      });

      // Best-effort: push fresh token + start signal to extension
      // If this fails, extension will still pick up jobs via alarm polling
      const preflight = await pushTokenAndVerify();
      if (preflight.ok) {
        try {
          chrome.runtime.sendMessage(EXTENSION_ID, {
            type: 'PILOT_START_AUTOMATION',
            token: preflight.session?.access_token || '',
            refresh_token: preflight.session?.refresh_token || '',
          }, () => { void chrome.runtime?.lastError; });
        } catch {}
      } else {
        console.warn('[CareerPilot] Extension push failed — jobs queued, extension will pick up via polling');
        setConnectionIssue(true);
      }

      onStartAutomation(jobs, !preflight.ok);
      setLaunched(true);
      setTimeout(() => {
        onClose();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 1500);
    } catch (err) {
      console.error(err);
      setStarting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 z-50 flex items-end"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full bg-white dark:bg-slate-900 rounded-t-2xl max-h-[90dvh] flex flex-col relative"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
      >
        {/* Launched confirmation overlay */}
        {launched && (
          <div className="absolute inset-0 z-10 bg-white dark:bg-slate-900 rounded-t-2xl flex flex-col items-center justify-center gap-4 px-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center"
            >
              <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </motion.div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">Pilot is on it.</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              {selectedMatches.length} connect request{selectedMatches.length !== 1 ? 's' : ''} queued. Check the progress bar above.
            </p>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 dark:border-slate-800">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white text-base">Review connection requests</h2>
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
              {selectedMatches.length} LinkedIn connect{selectedMatches.length !== 1 ? 's' : ''} · Edit notes before Pilot sends
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Notes list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Channel explainer */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-800/40">
            <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
              <strong>Connect</strong> = connection request with your note (200 char limit on LinkedIn).
              If connects max out, Pilot will offer to switch to <strong>DMs</strong> or <strong>email</strong> instead.
            </p>
          </div>

          {selectedMatches.map((match, i) => {
              const noteData = notes[match.id];
              const note = noteData?.connection_note ?? '';
              const isFailed = noteData !== undefined && noteData.connection_note === null;
              const isPending = noteData === undefined;
              const overLimit = note.length > NOTE_MAX;
              const isEditing = editingId === match.id;

              return (
                <div key={match.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full ${match.avatarColor} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                      {match.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{match.name}</p>
                      <p className="text-xs text-gray-400 truncate">{match.company}</p>
                    </div>
                    {!isPending && !isFailed && (
                      <button
                        onClick={() => setEditingId(isEditing ? null : match.id)}
                        className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 shrink-0"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                    )}
                  </div>

                  {isPending ? (
                    <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
                      <div className="w-3.5 h-3.5 spinner shrink-0" />
                      <p className="text-xs text-gray-400">Writing note…</p>
                    </div>
                  ) : isFailed ? (
                    <div className="space-y-1">
                      <textarea
                        placeholder="Write your own note (max 300 chars)…"
                        value={note}
                        onChange={e => setNotes(prev => ({
                          ...prev,
                          [match.id]: { ...prev[match.id], connection_note: e.target.value, error: undefined },
                        }))}
                        className={`w-full text-sm bg-gray-50 dark:bg-slate-800 border rounded-xl p-3 resize-none text-gray-900 dark:text-white outline-none focus:ring-2 ${overLimit ? 'border-red-400 focus:ring-red-400/30' : 'border-gray-200 dark:border-slate-700 focus:ring-emerald-400/30'}`}
                        rows={3}
                        maxLength={300}
                        autoFocus
                      />
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium ${overLimit ? 'text-red-500' : 'text-gray-400'}`}>{note.length}/{NOTE_MAX}</span>
                        <button onClick={() => retryDraft(match)} className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          Retry AI ↺
                        </button>
                      </div>
                    </div>
                  ) : isEditing ? (
                    <div className="space-y-1">
                      <textarea
                        value={note}
                        onChange={e => setNotes(prev => ({
                          ...prev,
                          [match.id]: { ...prev[match.id], connection_note: e.target.value },
                        }))}
                        className={`w-full text-sm bg-gray-50 dark:bg-slate-800 border rounded-xl p-3 resize-none text-gray-900 dark:text-white outline-none focus:ring-2 ${overLimit ? 'border-red-400 focus:ring-red-400/30' : 'border-gray-200 dark:border-slate-700 focus:ring-emerald-400/30'}`}
                        rows={4}
                        maxLength={300}
                      />
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium ${overLimit ? 'text-red-500' : 'text-gray-400'}`}>
                          {note.length}/{NOTE_MAX}
                          {overLimit && ' — too long'}
                        </span>
                        {i === 0 && selectedMatches.length > 1 && (
                          <button
                            onClick={() => applyToAll(note)}
                            className="text-xs text-emerald-600 dark:text-emerald-400 font-medium"
                          >
                            Apply to all
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3">
                      <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">{note}</p>
                      {overLimit && (
                        <p className="text-red-500 text-xs mt-1">Tap edit — note exceeds 300 chars</p>
                      )}
                      <p className="text-gray-400 text-[10px] mt-1.5">{note.length}/{NOTE_MAX}</p>
                    </div>
                  )}
                </div>
              );
            })}

          {/* Disclaimer */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              <strong>What happens:</strong> Pilot opens LinkedIn in your Chrome browser and sends connection requests with the notes above.
              We never store your LinkedIn password.
              LinkedIn may restrict accounts that send too many — keep it genuine.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="px-5 pb-4 pt-3 border-t border-gray-100 dark:border-slate-800 space-y-2">
          {isMobile ? (
            /* ── Mobile: automation not available ── */
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center space-y-1">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                Automation requires a desktop browser
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-300">
                Open CareerPilot on your laptop or desktop to automate LinkedIn outreach.
              </p>
            </div>
          ) : !extensionInstalled ? (
            /* ── Desktop, no extension ── */
            <div className="space-y-2">
              <button
                onClick={() => {
                  window.open(CHROME_STORE_URL, '_blank');
                  setShowInstallModal(true);
                  setPolling(true);
                }}
                className="btn-gradient w-full py-4 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2"
              >
                <Chrome className="w-4 h-4" />
                Install Extension to Automate
              </button>
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                One-time setup — takes 10 seconds
              </p>

              {/* Install detection modal */}
              {showInstallModal && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    {polling ? (
                      <div className="w-4 h-4 spinner shrink-0 mt-0.5" />
                    ) : (
                      <Chrome className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                        {polling ? 'Waiting for installation…' : 'Installed the extension?'}
                      </p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-300 mt-0.5">
                        {polling
                          ? 'Click "Add to Chrome" on the Web Store page. We\'ll detect it automatically.'
                          : 'If you\'ve installed it, refresh this page to continue.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => window.location.reload()}
                      className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
                    >
                      I&apos;ve installed it — refresh
                    </button>
                    <button
                      onClick={() => { setShowInstallModal(false); setPolling(false); }}
                      className="py-2 px-3 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-500 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── Desktop, extension installed ── */
            <button
              onClick={handleStart}
              disabled={starting || Object.keys(notes).length < selectedMatches.length || selectedMatches.some(m => ((notes[m.id]?.connection_note) ?? '').length > NOTE_MAX)}
              className="btn-gradient w-full py-4 rounded-xl text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {starting ? (
                <><div className="w-4 h-4 spinner" />Connecting to extension…</>
              ) : (
                <>Send Connects — {selectedMatches.length} request{selectedMatches.length !== 1 ? 's' : ''}</>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── AutomationProgressBanner ──────────────────────────────────────────────────

function AutomationProgressBanner({ statuses, onDismiss, extensionWarning }) {
  const [confirmStop, setConfirmStop] = useState(false);
  const total   = Object.keys(statuses).length;
  const vals    = Object.values(statuses);
  const connected = vals.filter(s => s === 'sent').length;
  const dmSent   = vals.filter(s => s === 'dm_sent').length;
  const emailSent = vals.filter(s => s === 'email_sent').length;
  const sent    = connected + dmSent + emailSent;
  const deferred = vals.filter(s => s === 'deferred').length;
  const failed  = vals.filter(s => ['failed', 'limit_hit', 'interrupted', 'cancelled', 'account_restricted'].includes(s)).length;
  const running = vals.some(s => s === 'pending' || s === 'processing');
  const inCascade = vals.some(s => ['connect_limit_hit', 'dm_pending_review', 'dm_approved', 'dm_limit_hit', 'email_pending_review', 'email_ready'].includes(s));

  const handleXClick = () => {
    if (running) {
      setConfirmStop(true);
    } else {
      onDismiss();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-5 mb-3"
    >
      <div className={`rounded-xl p-4 border ${running ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40'}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {running ? (
              <div className="w-3 h-3 rounded-full bg-emerald-600 animate-pulse" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            )}
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {running ? 'Pilot is sending…' : inCascade ? 'Waiting for your input…' : 'Automation complete'}
            </p>
          </div>
          <button onClick={handleXClick} className="p-1" title={running ? 'Stop automation' : 'Dismiss'}>
            <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        {/* Stop confirmation */}
        {confirmStop && (
          <div className="mb-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-900 dark:text-white mb-1">Stop automation?</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2.5">
              {total - sent - failed} request{total - sent - failed !== 1 ? 's' : ''} still pending. You&apos;ll need to restart the flow to send them.
            </p>
            <div className="flex gap-2">
              <button
                onClick={onDismiss}
                className="flex-1 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors"
              >
                Stop
              </button>
              <button
                onClick={() => setConfirmStop(false)}
                className="flex-1 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 text-xs font-semibold"
              >
                Keep running
              </button>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-600 dark:text-gray-300">
          {running || inCascade ? (
            <>{sent} sent · {failed > 0 ? `${failed} failed · ` : ''}{total - sent - failed} remaining</>
          ) : (
            <>
              {connected > 0 && <>{connected} connected</>}
              {dmSent > 0 && <>{connected > 0 ? ' · ' : ''}{dmSent} DMs sent</>}
              {emailSent > 0 && <>{(connected + dmSent) > 0 ? ' · ' : ''}{emailSent} emailed</>}
              {deferred > 0 && <>{sent > 0 ? ' · ' : ''}{deferred} deferred</>}
              {failed > 0 && <>{(sent + deferred) > 0 ? ' · ' : ''}{failed} failed</>}
            </>
          )}
        </p>
        {/* Progress bar */}
        <div className="mt-2 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-500"
            style={{ width: `${(sent / total) * 100}%` }}
          />
        </div>

        {/* Extension warning */}
        {extensionWarning && running && sent === 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
            Extension didn&apos;t respond instantly — jobs are queued. It should pick them up within 15 seconds.
            If nothing happens, try refreshing this page.
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReferralsPage() {
  const [matches, setMatches]         = useState([]);
  const [capsule, setCapsule]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [capsuleLoading, setCapsuleLoading] = useState(false);
  const [error, setError]             = useState(null);
  const [tab, setTab]                 = useState('targets');
  const [activeMatch, setActiveMatch] = useState(null);
  const [sending, setSending]         = useState(false);

  // Selection + automation state
  const [selectionMode, setSelectionMode]   = useState(false);
  const [selectedIds, setSelectedIds]       = useState(new Set());
  const [reviewOpen, setReviewOpen]         = useState(false);
  const [automationStatus, setAutomationStatus] = useState({}); // matchId → status string
  const [showProgress, setShowProgress]     = useState(false);
  const [extensionWarning, setExtensionWarning] = useState(false); // extension didn't respond but jobs are queued
  const pollRef = useRef(null); // interval ref for cleanup

  // Cascade state
  const [cascadeData, setCascadeData]       = useState(null); // { connect_limit_hit: N, ... }
  const [cascadeJobs, setCascadeJobs]       = useState([]); // jobs needing review
  const [showCascade, setShowCascade]       = useState(false);
  const cascadePollRef = useRef(null);

  const loadMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [matchRes, capRes] = await Promise.all([
        fetch('/api/recruiters/match', { cache: 'no-store' }),
        fetch('/api/recruiters/recommend', { cache: 'no-store' }),
      ]);
      const matchJson = await matchRes.json();
      const capJson   = await capRes.json();
      if (!matchRes.ok) throw new Error(matchJson.error || 'Failed to load');
      setMatches((matchJson.matches || []).map(formatMatch));
      setCapsule(capJson.capsule || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMoreCapsule = useCallback(async () => {
    setCapsuleLoading(true);
    try {
      const res  = await fetch('/api/recruiters/recommend', { cache: 'no-store' });
      const json = await res.json();
      setCapsule(json.capsule || []);
    } finally {
      setCapsuleLoading(false);
    }
  }, []);

  useEffect(() => { loadMatches(); }, [loadMatches]);

  // ── Cascade detection polling ──────────────────────────────────────────────
  const checkCascade = useCallback(async () => {
    try {
      const res = await fetch('/api/outreach/queue-status', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();

      if (json.cascade) {
        setCascadeData(json.cascade);
        // Auto-show cascade sheet if there are actionable cascade states
        const hasActionable = (json.cascade.connect_limit_hit > 0) ||
          (json.cascade.dm_pending_review > 0) ||
          (json.cascade.dm_limit_hit > 0) ||
          (json.cascade.email_pending_review > 0);
        if (hasActionable && !showCascade) {
          // Fetch job details for cascade review cards
          try {
            const supabase = createClient();
            const { data: cJobs } = await supabase
              .from('outreach_queue')
              .select('id, status, outreach_method, dm_subject, dm_body, email_subject, email_body, recruiter_match_id, recruiter_matches(recruiters(name, title, current_company, linkedin_url))')
              .in('status', ['dm_pending_review', 'email_pending_review'])
              .order('queue_position', { ascending: true });

            const formatted = (cJobs || []).map(j => {
              const rec = j.recruiter_matches?.recruiters || {};
              const initials = (rec.name || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
              return {
                ...j,
                name: rec.name || 'Unknown',
                company: rec.current_company || '',
                linkedin_url: rec.linkedin_url || '',
                avatar: initials,
                avatarColor: avatarColor(rec.name || ''),
              };
            });
            setCascadeJobs(formatted);
          } catch {}
          setShowCascade(true);
        }
      } else {
        setCascadeData(null);
      }
    } catch {}
  }, [showCascade]);

  // Poll for cascade every 10s when automation is active
  useEffect(() => {
    if (!showProgress) return;
    checkCascade();
    cascadePollRef.current = setInterval(checkCascade, 10000);
    return () => { if (cascadePollRef.current) clearInterval(cascadePollRef.current); };
  }, [showProgress, checkCascade]);

  // Cleanup cascade poll
  useEffect(() => () => { if (cascadePollRef.current) clearInterval(cascadePollRef.current); }, []);

  const handleCascadeRefresh = () => {
    checkCascade();
    loadMatches();
  };

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function exitSelection() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  function handleStartAutomation(jobs, extensionUnreachable = false) {
    if (extensionUnreachable) setExtensionWarning(true);
    // Initialise status for each queued job
    const queuedMatchIds = new Set(jobs.map(j => j.match_id));
    const initial = {};
    jobs.forEach(j => { initial[j.match_id] = 'pending'; });
    setAutomationStatus(initial);
    setShowProgress(true);
    exitSelection();

    // Clear any previous poll
    if (pollRef.current) clearInterval(pollRef.current);

    let attempts = 0;
    const MAX_POLLS = 72; // stop after 6 min (72 × 5s) regardless

    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res  = await fetch('/api/outreach/queue-status', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();

        // Only track statuses for THIS batch
        const batchStatuses = {};
        for (const id of queuedMatchIds) {
          if (json.statuses?.[id]) batchStatuses[id] = json.statuses[id];
        }
        setAutomationStatus(batchStatuses);

        const allResolved = [...queuedMatchIds].every(
          id => batchStatuses[id] && !['pending', 'processing'].includes(batchStatuses[id])
        );
        if (allResolved || attempts >= MAX_POLLS) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {}
    }, 5000);
  }

  // Cleanup poll on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const capsuleIds     = new Set(capsule.map(c => c.match_id));
  const targets        = matches.filter(m => m.status === 'pending' && !capsuleIds.has(m.id));
  const followUps      = matches.filter(m => m.status === 'messaged');
  const pendingFUps    = followUps.filter(m => !m.reply_received_at && daysSince(m.outreach_sent_at) >= 5);
  const capsuleSentIds = new Set(matches.filter(m => m.status !== 'pending').map(m => m.id));
  const allCapsuleSent = capsule.length > 0 && capsule.every(c => capsuleSentIds.has(c.match_id));

  // Only uncontacted matches with a LinkedIn URL are selectable
  const selectableTargets = targets.filter(m => linkedinHandle(m.linkedin_url));
  const selectedMatches   = matches.filter(m => selectedIds.has(m.id));
  const atBatchLimit      = selectedIds.size >= MAX_BATCH;

  const handleConfirmSend = async (message) => {
    if (!activeMatch) return;
    setSending(true);
    try {
      await fetch('/api/recruiter-matches/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeMatch.id, status: 'messaged', message }),
      });
      setMatches(prev =>
        prev.map(m => m.id === activeMatch.id ? { ...m, status: 'messaged', outreach_draft: message } : m)
      );
    } finally {
      setSending(false);
    }
  };

  // Enter selection mode from long-press on a card
  const handleEnterSelection = (matchId) => {
    setSelectionMode(true);
    setTab('targets');
    setSelectedIds(new Set([matchId]));
  };

  return (
    <>
      <div className="page-enter">
        {/* Header */}
        <div className="px-5 pt-6 pb-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 sticky top-0 z-20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Referrals</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
                {loading ? 'Loading…' : `${matches.length} matches · ${followUps.length} messaged`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {pendingFUps.length > 0 && !selectionMode && (
                <button
                  onClick={() => setTab('followups')}
                  className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full text-xs font-semibold"
                >
                  <Bell className="w-3.5 h-3.5" />{pendingFUps.length} follow-up{pendingFUps.length !== 1 ? 's' : ''}
                </button>
              )}
              {!selectionMode ? (
                <>
                  {selectableTargets.length > 1 && (
                    <button
                      onClick={() => { setSelectionMode(true); setTab('targets'); }}
                      className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold active:scale-95 transition-transform"
                    >
                      <Send className="w-3.5 h-3.5" />Batch Outreach
                    </button>
                  )}
                  <button onClick={loadMatches} className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                    <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </>
              ) : (
                <button onClick={exitSelection} className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-sm font-medium px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-800">
                  <X className="w-4 h-4" />Cancel
                </button>
              )}
            </div>
          </div>

          {/* Selection mode hint */}
          {selectionMode && (
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 flex-1">
                {selectedIds.size === 0
                  ? 'Tap cards to select — Pilot will send connection requests with a note'
                  : `${selectedIds.size} selected${atBatchLimit ? ` (max ${MAX_BATCH})` : ''}`}
              </p>
              {selectableTargets.length > 0 && selectedIds.size < selectableTargets.length && (
                <button
                  onClick={() => {
                    const all = new Set(selectableTargets.slice(0, MAX_BATCH).map(m => m.id));
                    setSelectedIds(all);
                  }}
                  className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap"
                >
                  Select all
                </button>
              )}
            </div>
          )}

          {!selectionMode && (
            <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
              {[
                { id: 'targets',  label: `Targets (${targets.length + capsule.length})` },
                { id: 'followups',label: `Follow-Ups (${followUps.length})` },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    tab === t.id
                      ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Automation progress banner */}
        <AnimatePresence>
          {showProgress && Object.keys(automationStatus).length > 0 && (
            <AutomationProgressBanner
              statuses={automationStatus}
              extensionWarning={extensionWarning}
              onDismiss={() => {
                setShowProgress(false);
                // Tell extension to stop polling
                try {
                  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                    chrome.runtime.sendMessage(EXTENSION_ID, { type: 'PILOT_STOP_AUTOMATION' });
                  }
                } catch {}
              }}
            />
          )}
        </AnimatePresence>

        {/* Cascade action banner — re-open cascade sheet */}
        {!showCascade && cascadeData && (cascadeData.connect_limit_hit > 0 || cascadeData.dm_pending_review > 0 || cascadeData.dm_limit_hit > 0) && (
          <div className="mx-5 mb-3">
            <button
              onClick={() => setShowCascade(true)}
              className="w-full rounded-xl p-3.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
            >
              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {cascadeData.connect_limit_hit > 0 ? 'Connects maxed — switch to DMs?' :
                   cascadeData.dm_limit_hit > 0 ? 'DMs maxed — switch to email?' :
                   `${cascadeData.dm_pending_review} DMs ready for review`}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Tap to continue</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
            </button>
          </div>
        )}

        <div className="px-5 py-4 space-y-3">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-16">
              <div className="w-8 h-8 spinner" />
              <p className="text-gray-400 text-sm">Finding your recruiter matches…</p>
            </div>
          )}

          {!loading && error && (
            <div className="card p-5 text-center space-y-2">
              <p className="text-gray-500 dark:text-gray-400 font-medium">Hit a wall.</p>
              <p className="text-gray-400 text-sm">{error}</p>
              <button onClick={loadMatches} className="text-emerald-600 text-sm font-semibold">Try again</button>
            </div>
          )}

          {/* Targets tab */}
          {!loading && !error && (tab === 'targets' || selectionMode) && (
            <>
              {/* Capsule section — hidden in selection mode */}
              {!selectionMode && capsule.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-500" />
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Pilot&apos;s picks for today</p>
                  </div>
                  {capsule.map(item => (
                    <CapsuleCard key={item.match_id} item={item} onOutreach={setActiveMatch} isSent={capsuleSentIds.has(item.match_id)} />
                  ))}
                  {allCapsuleSent && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="card p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-100 dark:border-emerald-800/40"
                    >
                      <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            You sent {capsule.length} DM{capsule.length !== 1 ? 's' : ''}. That&apos;s more than 90% of job seekers do in a week. — Pilot
                          </p>
                          <button onClick={fetchMoreCapsule} disabled={capsuleLoading}
                            className="mt-3 flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60"
                          >
                            {capsuleLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                            {capsuleLoading ? 'Loading…' : 'Send 3 more →'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  <div className="border-t border-gray-100 dark:border-slate-800 pt-3">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">All matches</p>
                  </div>
                </div>
              )}

              {targets.length === 0 && !capsule.length && (
                <div className="text-center py-16">
                  <div className="text-4xl mb-3">🎯</div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No targets yet</p>
                  <p className="text-gray-400 text-sm mt-1">Complete your profile and we&apos;ll find the right recruiters.</p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {targets.map(match => (
                <RecruiterCard
                  key={match.id}
                  match={match}
                  onOutreach={setActiveMatch}
                  selectionMode={selectionMode}
                  selected={selectedIds.has(match.id)}
                  onToggleSelect={(id) => {
                    if (!selectedIds.has(id) && atBatchLimit) return;
                    toggleSelect(id);
                  }}
                  automationStatus={automationStatus[match.id]}
                  onEnterSelection={handleEnterSelection}
                />
              ))}
              </div>
            </>
          )}

          {/* Follow-Ups tab */}
          {!loading && !error && tab === 'followups' && !selectionMode && (
            <>
              {followUps.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-4xl mb-3">📭</div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No outreach sent yet</p>
                  <p className="text-gray-400 text-sm mt-1">People you message will appear here</p>
                </div>
              ) : (
                <>
                  {pendingFUps.length > 0 && (
                    <p className="text-amber-600 dark:text-amber-400 text-xs font-medium">
                      {pendingFUps.length} need a follow-up
                    </p>
                  )}
                  {followUps.map(match => <FollowUpCard key={match.id} match={match} />)}
                </>
              )}
            </>
          )}
        </div>

        {/* Bottom padding so sticky bar doesn't cover last card */}
        {selectionMode && <div className="h-24" />}
      </div>

      {/* Sticky selection bar */}
      <AnimatePresence>
        {selectionMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 right-0 z-40 px-5"
            style={{ paddingBottom: '16px', left: '240px' }}
          >
            <div className="max-w-[1100px] mx-auto px-8">
              <button
                onClick={() => setReviewOpen(true)}
                className="btn-gradient w-full py-4 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-xl"
              >
                <Send className="w-4 h-4" />
                Review &amp; Connect with {selectedIds.size} {selectedIds.size === 1 ? 'person' : 'people'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Review sheet — rendered in a portal so it sits above the bottom nav */}
      {reviewOpen && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          <ReviewSheet
            selectedMatches={selectedMatches}
            onClose={() => setReviewOpen(false)}
            onStartAutomation={handleStartAutomation}
          />
        </AnimatePresence>,
        document.body
      )}

      {/* Single outreach modal (existing flow) */}
      <AnimatePresence>
        {activeMatch && (
          <OutreachFlow
            referral={activeMatch}
            onClose={() => setActiveMatch(null)}
            onSent={() => setActiveMatch(null)}
            onConfirmSend={handleConfirmSend}
          />
        )}
      </AnimatePresence>

      {/* Cascade consent sheet */}
      <AnimatePresence>
        {showCascade && cascadeData && (
          <CascadeConsentSheet
            cascade={cascadeData}
            jobs={cascadeJobs}
            onClose={() => setShowCascade(false)}
            onRefresh={handleCascadeRefresh}
          />
        )}
      </AnimatePresence>
    </>
  );
}
