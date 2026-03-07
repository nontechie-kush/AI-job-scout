'use client';

/**
 * /dashboard/referrals
 *
 * Recruiter Targets + Follow-Ups tab.
 * Fetches real recruiter_matches from /api/recruiters/match.
 *
 * Tabs:
 *   Targets — pending/uncontacted matches, sorted by relevance_score
 *   Follow-Ups — messaged matches with no reply after 5+ days
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Clock, ChevronRight, Users, Bell, RefreshCw, Zap, Sparkles } from 'lucide-react';
import OutreachFlow from '@/components/OutreachFlow';

// ── Deterministic avatar color from string ────────────────────────────────
const AVATAR_COLORS = [
  'bg-violet-600', 'bg-blue-600', 'bg-emerald-600', 'bg-amber-600',
  'bg-rose-600', 'bg-indigo-600', 'bg-cyan-600', 'bg-pink-600',
];
function avatarColor(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// ── Format a DB recruiter_match into UI shape ─────────────────────────────
function formatMatch(rm) {
  const rec = rm.recruiters;
  const initials = rec.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return {
    id: rm.id,            // match UUID — used for navigation + API calls
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

// ── How many days since outreach ──────────────────────────────────────────
function daysSince(isoDate) {
  if (!isoDate) return 0;
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24));
}

// ── Components ────────────────────────────────────────────────────────────

function RecruiterCard({ match, onOutreach }) {
  const isMessaged = match.status === 'messaged';
  const isReplied = match.status === 'replied';

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-full ${match.avatarColor} flex items-center justify-center text-white font-semibold text-sm shrink-0`}>
          {match.avatar}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/dashboard/referrals/${match.id}`} className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white text-sm leading-snug">{match.name}</p>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 truncate">
                {match.title} · {match.company}
              </p>
            </Link>
            <div className="flex items-center gap-1 shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{match.relevanceScore}%</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1 mt-2">
            {match.reasons.slice(0, 3).map((r) => (
              <span key={r} className="tag-pill bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-[10px] py-0.5">
                {r}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-3">
            {isReplied ? (
              <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-xs font-medium">
                <Send className="w-3.5 h-3.5" />
                Replied
              </div>
            ) : isMessaged ? (
              <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                <Send className="w-3.5 h-3.5" />
                Message sent
              </div>
            ) : (
              <button
                onClick={() => onOutreach(match)}
                className="flex items-center gap-1.5 bg-violet-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-violet-700 transition-colors active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                Start Outreach
              </button>
            )}
            <Link
              href={`/dashboard/referrals/${match.id}`}
              className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-xs"
            >
              View profile <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

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
              : <Send className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            }
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white text-sm">{match.name}</p>
            <p className="text-gray-400 text-xs">
              {match.company} · {needsFollowUp ? `No reply · ${since}d ago` : since === 0 ? 'Sent today' : `Sent ${since} day${since !== 1 ? 's' : ''} ago`}
            </p>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-violet-600 dark:text-violet-400 text-xs font-medium shrink-0"
        >
          {expanded ? 'Hide' : 'View'}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
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
                  <Send className="w-4 h-4" />
                  Send Follow-Up on LinkedIn
                </a>
              )}
              {!needsFollowUp && (
                <p className="text-xs text-gray-400 text-center">
                  Follow-up reminder will appear after 5 days if no reply
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
// ── Daily capsule card ─────────────────────────────────────────────────────

function CapsuleCard({ item, onOutreach, isSent }) {
  const rec = item.recruiter;
  const initials = rec.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const color = avatarColor(rec.name);

  return (
    <div className={`card p-4 border-violet-100 dark:border-violet-800/40 ${isSent ? 'opacity-60' : ''}`}>
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

          {/* Pilot's take */}
          <p className="text-gray-600 dark:text-gray-300 text-xs mt-2 leading-relaxed line-clamp-2">
            {item.pilot_recommendation}
          </p>

          <div className="flex items-center gap-2 mt-3">
            {isSent ? (
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                <Send className="w-3.5 h-3.5" />
                Sent
              </div>
            ) : (
              <button
                onClick={() => onOutreach({
                  id: item.match_id,
                  name: rec.name,
                  company: rec.company,
                  linkedin_url: rec.linkedin_url,
                  avatar: initials,
                  avatarColor: color,
                  pilot_recommendation: item.pilot_recommendation,
                  send_time: item.send_time,
                  send_time_label: item.send_time_label,
                  channel: item.channel,
                })}
                className="flex items-center gap-1.5 bg-violet-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-violet-700 transition-colors active:scale-95"
              >
                <Zap className="w-3.5 h-3.5" />
                Reach out
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReferralsPage() {
  const [matches, setMatches] = useState([]);
  const [capsule, setCapsule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [capsuleLoading, setCapsuleLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('targets');
  const [activeMatch, setActiveMatch] = useState(null);
  const [sending, setSending] = useState(false);

  const loadMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [matchRes, capRes] = await Promise.all([
        fetch('/api/recruiters/match', { cache: 'no-store' }),
        fetch('/api/recruiters/recommend', { cache: 'no-store' }),
      ]);
      const matchJson = await matchRes.json();
      const capJson = await capRes.json();
      if (!matchRes.ok) throw new Error(matchJson.error || 'Failed to load');
      setMatches((matchJson.matches || []).map(formatMatch));
      setCapsule(capJson.capsule || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch next batch of Pilot picks (without reloading all matches)
  const fetchMoreCapsule = useCallback(async () => {
    setCapsuleLoading(true);
    try {
      const res = await fetch('/api/recruiters/recommend', { cache: 'no-store' });
      const json = await res.json();
      setCapsule(json.capsule || []);
    } finally {
      setCapsuleLoading(false);
    }
  }, []);

  useEffect(() => { loadMatches(); }, [loadMatches]);

  const capsuleIds = new Set(capsule.map((c) => c.match_id));
  const targets = matches.filter((m) => m.status === 'pending' && !capsuleIds.has(m.id));
  // Follow-ups = ALL messaged people (not just 5+ days) so user can see who they contacted
  const followUps = matches.filter((m) => m.status === 'messaged');
  const pendingFollowUps = followUps.filter(m => !m.reply_received_at && daysSince(m.outreach_sent_at) >= 5);

  // Check if all capsule picks have been actioned (sent)
  const capsuleSentIds = new Set(
    matches.filter(m => m.status !== 'pending').map(m => m.id)
  );
  const allCapsuleSent = capsule.length > 0 && capsule.every(c => capsuleSentIds.has(c.match_id));

  const handleConfirmSend = async (message) => {
    if (!activeMatch) return;
    setSending(true);
    try {
      await fetch('/api/recruiter-matches/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeMatch.id, status: 'messaged', message }),
      });
      // Optimistically update local state
      setMatches((prev) =>
        prev.map((m) => m.id === activeMatch.id ? { ...m, status: 'messaged', outreach_draft: message } : m),
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="page-enter">
        {/* Header */}
        <div className="px-5 header-safe-top pb-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 sticky top-0 z-20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Referrals</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
                {loading ? 'Loading…' : `${matches.length} matches · ${matches.filter((m) => m.status === 'messaged').length} messaged`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {pendingFollowUps.length > 0 && (
                <button
                  onClick={() => setTab('followups')}
                  className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full text-xs font-semibold"
                >
                  <Bell className="w-3.5 h-3.5" />
                  {pendingFollowUps.length} follow-up{pendingFollowUps.length !== 1 ? 's' : ''}
                </button>
              )}
              <button
                onClick={loadMatches}
                className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
            {[
              { id: 'targets', label: `Targets (${targets.length + capsule.length})` },
              { id: 'followups', label: `Follow-Ups (${followUps.length})` },
            ].map((t) => (
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
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center gap-3 py-16">
              <div className="w-8 h-8 spinner" />
              <p className="text-gray-400 text-sm">Finding your recruiter matches…</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="card p-5 text-center space-y-2">
              <p className="text-gray-500 dark:text-gray-400 font-medium">Hit a wall.</p>
              <p className="text-gray-400 text-sm">{error}</p>
              <button onClick={loadMatches} className="text-violet-600 text-sm font-semibold">
                Try again
              </button>
            </div>
          )}

          {/* Targets tab */}
          {!loading && !error && tab === 'targets' && (
            <>
              {/* Daily capsule */}
              {capsule.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-violet-500" />
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Pilot's picks for today</p>
                  </div>
                  {capsule.map(item => (
                    <CapsuleCard
                      key={item.match_id}
                      item={item}
                      onOutreach={setActiveMatch}
                      isSent={capsuleSentIds.has(item.match_id)}
                    />
                  ))}

                  {/* All capsule picks sent — motivate + offer more */}
                  {allCapsuleSent && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="card p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-100 dark:border-emerald-800/40"
                    >
                      <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            You sent {capsule.length} DM{capsule.length !== 1 ? 's' : ''}. That's more than 90% of job seekers do in a week. — Pilot
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Keep the momentum going. Send 3 more.
                          </p>
                          <button
                            onClick={fetchMoreCapsule}
                            disabled={capsuleLoading}
                            className="mt-3 flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60"
                          >
                            {capsuleLoading ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Zap className="w-3.5 h-3.5" />
                            )}
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

              {targets.length > 0 && !capsule.length && (
                <div className="card p-4 bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-900/20 dark:to-blue-900/20 border-violet-100 dark:border-violet-800/50">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-violet-500" />
                    <p className="text-sm font-semibold text-violet-800 dark:text-violet-300">
                      {targets.length} recruiter{targets.length !== 1 ? 's' : ''} matched to your profile
                    </p>
                  </div>
                  <p className="text-violet-600 dark:text-violet-400 text-xs mt-1">
                    Ranked by geography · specialization · seniority · reply rate
                  </p>
                </div>
              )}

              {targets.length === 0 && (
                <div className="text-center py-16">
                  <div className="text-4xl mb-3">🎯</div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No targets yet</p>
                  <p className="text-gray-400 text-sm mt-1">Complete your profile and we'll find the right recruiters.</p>
                </div>
              )}

              {targets.map((match) => (
                <RecruiterCard
                  key={match.id}
                  match={match}
                  onOutreach={setActiveMatch}
                />
              ))}
            </>
          )}

          {/* Follow-Ups tab */}
          {!loading && !error && tab === 'followups' && (
            <>
              {followUps.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-4xl mb-3">📭</div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No outreach sent yet</p>
                  <p className="text-gray-400 text-sm mt-1">People you message will appear here</p>
                </div>
              ) : (
                <>
                  {pendingFollowUps.length > 0 && (
                    <p className="text-amber-600 dark:text-amber-400 text-xs font-medium">
                      {pendingFollowUps.length} need a follow-up
                    </p>
                  )}
                  {followUps.map((match) => (
                    <FollowUpCard key={match.id} match={match} />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Outreach modal */}
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
    </>
  );
}
