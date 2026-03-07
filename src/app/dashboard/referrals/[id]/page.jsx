'use client';

/**
 * /dashboard/referrals/[id]
 *
 * Recruiter match detail page.
 * [id] is the recruiter_match UUID (not recruiter UUID).
 *
 * On mount:
 *   1. Loads recruiter_match from /api/recruiters/match (scoped to this user).
 *   2. If outreach_draft is null, calls /api/recruiters/outreach to generate one.
 *   3. Shows recruiter profile, placement history, response rate, and draft.
 */

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Lightbulb, Users, MessageSquare,
  ExternalLink, Send, CheckCircle2, Star, Zap,
} from 'lucide-react';
import OutreachFlow from '@/components/OutreachFlow';

// ── Deterministic avatar color ────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-violet-600', 'bg-blue-600', 'bg-emerald-600', 'bg-amber-600',
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
    linkedin_url: rec.linkedin_url,
    placements_at: rec.placements_at || [],
    response_rate: rec.response_rate || 0,
    avg_reply_days: rec.avg_reply_days,
    specialization: rec.specialization || [],
    type: rec.type || 'agency',
    outreach_draft: rm.outreach_draft,
  };
}

function TypeLabel({ type }) {
  const labels = { inhouse: 'In-house', agency: 'Agency', independent: 'Independent' };
  const colors = {
    inhouse: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    agency: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    independent: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
  };
  return (
    <span className={`tag-pill ${colors[type] || colors.agency} text-[10px] py-0.5`}>
      {labels[type] || type}
    </span>
  );
}

export default function ReferralDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [match, setMatch] = useState(null);
  const [draft, setDraft] = useState('');
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOutreach, setShowOutreach] = useState(false);

  // Fetch the specific match by loading all matches
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/recruiters/match', { cache: 'no-store' });
        const json = await res.json();
        const found = (json.matches || []).find((m) => m.id === id);
        if (found) {
          const formatted = formatMatch(found);
          setMatch(formatted);
          if (found.outreach_draft) {
            setDraft(found.outreach_draft);
          }
        }
      } catch (e) {
        console.error('[referrals/[id]]', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // Generate draft on demand if not cached
  useEffect(() => {
    if (!match || draft || draftLoading || draftError) return;
    if (match.status === 'messaged') return;

    async function generateDraft() {
      setDraftLoading(true);
      setDraftError(null);
      try {
        const res = await fetch('/api/recruiters/outreach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ match_id: id }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Generation failed');
        setDraft(json.draft || '');
        setMatch((prev) => prev ? { ...prev, outreach_draft: json.draft } : prev);
      } catch (e) {
        setDraftError('Pilot hit a wall on this one. Tap to retry.');
      } finally {
        setDraftLoading(false);
      }
    }

    generateDraft();
  }, [match, id, draft, draftLoading, draftError]);

  const handleConfirmSend = async (message) => {
    await fetch('/api/recruiter-matches/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: match.id, status: 'messaged', message }),
    });
    setMatch((prev) => prev ? { ...prev, status: 'messaged' } : prev);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-8 h-8 spinner" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3">
        <p className="text-gray-500 dark:text-gray-400">Recruiter not found</p>
        <button onClick={() => router.back()} className="text-violet-600 text-sm font-medium">
          Go back
        </button>
      </div>
    );
  }

  const isMessaged = match.status === 'messaged';

  return (
    <>
      <div className="page-enter min-h-dvh bg-gray-50 dark:bg-slate-950">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center justify-between px-5 header-safe-top pb-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1 text-gray-600 dark:text-gray-400 font-medium text-sm"
            >
              <ChevronLeft className="w-5 h-5" /> Referrals
            </button>
            {match.linkedin_url && (
              <a
                href={match.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center"
              >
                <ExternalLink className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </a>
            )}
          </div>

          {/* Profile card */}
          <div className="px-5 pb-6">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full ${match.avatarColor} flex items-center justify-center text-white font-bold text-lg shrink-0`}>
                {match.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">{match.name}</h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{match.title}</p>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{match.company}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <TypeLabel type={match.type} />
                  {match.reasons.map((r) => (
                    <span key={r} className="tag-pill bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-[10px] py-0.5">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Relevance bar */}
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 bg-gray-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${match.relevanceScore}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
              <span className="text-sm font-bold text-violet-600 dark:text-violet-400 shrink-0">
                {match.relevanceScore}% relevant
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          {/* Stats row */}
          {(match.response_rate > 0 || match.avg_reply_days || match.placements_at.length > 0) && (
            <div className="grid grid-cols-3 gap-3">
              {match.response_rate > 0 && (
                <div className="card p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <Star className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-base font-bold text-gray-900 dark:text-white">{match.response_rate}%</span>
                  </div>
                  <p className="text-gray-400 text-[10px]">Reply rate</p>
                </div>
              )}
              {match.avg_reply_days && (
                <div className="card p-3 text-center">
                  <p className="text-base font-bold text-gray-900 dark:text-white">{match.avg_reply_days}d</p>
                  <p className="text-gray-400 text-[10px]">Avg reply</p>
                </div>
              )}
              {match.placements_at.length > 0 && (
                <div className="card p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <Zap className="w-3.5 h-3.5 text-violet-500" />
                    <span className="text-base font-bold text-gray-900 dark:text-white">{match.placements_at.length}</span>
                  </div>
                  <p className="text-gray-400 text-[10px]">Placements</p>
                </div>
              )}
            </div>
          )}

          {/* Placements */}
          {match.placements_at.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-gray-500" />
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Known Placements
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {match.placements_at.map((co) => (
                  <span key={co} className="tag-pill bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 text-xs">
                    {co}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Why this recruiter */}
          <div className="card p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/50">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Why this recruiter?
              </p>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
              {match.reasons.join(' · ')}
            </p>
            {match.specialization.length > 0 && (
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                Specializes in {match.specialization.join(', ')}.
              </p>
            )}
          </div>

          {/* Outreach angle */}
          <div className="card p-4 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/50">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Pilot&apos;s Angle
              </p>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
              {match.response_rate >= 70
                ? `${match.name.split(' ')[0]} has a ${match.response_rate}% reply rate — worth reaching out directly. Reference their ${match.placements_at.slice(0, 2).join(' / ') || 'placements'}.`
                : match.placements_at.length > 0
                  ? `Lead with a placement they've made at ${match.placements_at[0]} — shows you did your research.`
                  : `Keep it short and direct. Reference their specialization in ${match.specialization.join(' and ')}.`}
            </p>
          </div>

          {/* AI-drafted message */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-gray-500" />
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Pilot-Drafted Message
              </p>
            </div>

            {draftLoading && (
              <div className="flex items-center gap-2 py-4 text-gray-400">
                <div className="w-5 h-5 spinner" />
                <span className="text-sm">Drafting your outreach…</span>
              </div>
            )}

            {draftError && (
              <div className="space-y-2">
                <p className="text-sm text-gray-400">{draftError}</p>
                <button
                  onClick={() => { setDraftError(null); }}
                  className="text-violet-600 text-sm font-semibold"
                >
                  Retry
                </button>
              </div>
            )}

            {!draftLoading && !draftError && draft && (
              <>
                <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3">
                  <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                    {draft.length > 280 ? draft.slice(0, 280) + '…' : draft}
                  </p>
                </div>
                <p className="text-gray-400 text-xs mt-2">
                  Full message shown during outreach — you can edit before sending.
                </p>
              </>
            )}

            {!draftLoading && !draftError && !draft && (
              <p className="text-sm text-gray-400">
                {isMessaged ? 'Message sent. Waiting for reply.' : 'Draft will appear when you start outreach.'}
              </p>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="px-5 pb-28">
          {isMessaged ? (
            <div className="w-full py-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              Message Sent — Follow-up in 5 days
            </div>
          ) : (
            <button
              onClick={() => setShowOutreach(true)}
              className="btn-gradient w-full py-4 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {draftLoading ? 'Preparing outreach…' : 'Start Outreach Session'}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showOutreach && (
          <OutreachFlow
            referral={{ ...match, suggestedMessage: draft }}
            onClose={() => setShowOutreach(false)}
            onSent={() => setShowOutreach(false)}
            onConfirmSend={handleConfirmSend}
          />
        )}
      </AnimatePresence>
    </>
  );
}
