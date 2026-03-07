'use client';

/**
 * PreApplySheet — intercepts the Apply tap with a two-tier experience.
 *
 * TIER 1 (Full Pilot): Desktop Chrome + extension (nudge shown)
 * TIER 2 (Pilot Kit): Any device — sequential card kit, one copy per item
 *
 * Three internal stages:
 *   'preview'    — Portal breakdown (Pilot writes vs. You do), "Prepare Kit" CTA
 *   'generating' — Claude is writing…
 *   'ready'      — Sequential cards:
 *                    - Cover Letter
 *                    - Professional Bio
 *                    - One card per real screening answer (if ATS questions fetched)
 *                    - Grouped screening Q&A card (if generated/fallback)
 *                    - Live Answer card (always last — paste any form question)
 *
 * Props:
 *   match      — full match object (match.jobs.apply_type, match.jobs.company, etc.)
 *   onClose    — () => void
 *   onApplied  — () => void  (called after user opens portal)
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Zap, CheckCircle2, ArrowRight, ChevronLeft, ChevronRight,
  Copy, Check, ExternalLink, Loader2, Monitor, MessageSquare,
} from 'lucide-react';

// ── Portal flow map ─────────────────────────────────────────────────────────

const PORTAL_FLOWS = {
  greenhouse: {
    label: 'Greenhouse',
    avgMinutes: 8,
    pilotItems: ['Cover letter', 'Screening answers', 'Professional bio'],
    userItems: ['Upload resume (PDF)', 'Work authorization', 'Submit'],
  },
  lever: {
    label: 'Lever',
    avgMinutes: 7,
    pilotItems: ['Cover letter', 'Screening answers'],
    userItems: ['Upload resume (PDF)', 'Work authorization', 'Submit'],
  },
  ashby: {
    label: 'Ashby',
    avgMinutes: 6,
    pilotItems: ['Cover letter', 'Screening answers'],
    userItems: ['Upload resume (PDF)', 'Submit'],
  },
  linkedin: {
    label: 'LinkedIn Easy Apply',
    avgMinutes: 3,
    pilotItems: ['Screening answers'],
    userItems: ['Profile confirmation', 'Submit'],
  },
  workday: {
    label: 'Workday',
    avgMinutes: 20,
    pilotItems: ['Cover letter', 'Screening answers'],
    userItems: ['Create account', 'Work history (manual)', 'Upload resume', 'Submit'],
    warning: "Workday requires manual history entry — Pilot can't skip that part.",
  },
  taleo: {
    label: 'Taleo',
    avgMinutes: 25,
    pilotItems: ['Cover letter', 'Screening answers'],
    userItems: ['Create account', 'Work history', 'Upload resume', 'Submit'],
    warning: 'Taleo has the most steps of any portal — Pilot still handles all the writing.',
  },
  naukri: {
    label: 'Naukri',
    avgMinutes: 5,
    pilotItems: ['Cover note', 'Screening answers (if any)'],
    userItems: ['Resume (from your Naukri profile)', 'Submit'],
    note: "Naukri apply sends your profile + Pilot's cover note. If the company uses their own portal, Pilot detects it and prepares for that instead.",
  },
  iimjobs: {
    label: 'IIMJobs',
    avgMinutes: 6,
    pilotItems: ['Cover note', 'Screening answers (if any)'],
    userItems: ['Resume (from your IIMJobs profile)', 'Submit'],
    note: "IIMJobs apply sends your profile + Pilot's cover note. If the company uses their own portal, Pilot detects it and prepares for that instead.",
  },
  external: {
    label: 'External Portal',
    avgMinutes: 15,
    pilotItems: ['Cover letter', 'Screening answers (if applicable)'],
    userItems: ["Portal-specific steps (Pilot hasn't mapped this one yet)"],
  },
};

function getPortalFlow(applyType) {
  return PORTAL_FLOWS[applyType] || PORTAL_FLOWS.external;
}

// ── Device detection ────────────────────────────────────────────────────────

function isDesktopChrome() {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  const isChrome = /Chrome\//.test(ua) && !/Chromium\/|Edg\/|OPR\//.test(ua);
  const isMobile = /Android|iPhone|iPad|iPod/.test(ua) || window.innerWidth < 768;
  return isChrome && !isMobile;
}

function supportsDPIP() {
  return typeof window !== 'undefined' && 'documentPictureInPicture' in window;
}

// ── Copy button ─────────────────────────────────────────────────────────────

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available — silently fail
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
        copied
          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
          : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 active:bg-gray-200 dark:active:bg-slate-700'
      }`}
    >
      {copied ? (
        <><Check className="w-3 h-3" /> Copied</>
      ) : (
        <><Copy className="w-3 h-3" /> {label}</>
      )}
    </button>
  );
}

// ── Kit card builder ─────────────────────────────────────────────────────────
//
// Card types:
//   text       — plain text content (cover letter, bio)
//   single_qa  — one specific Q&A pair (real ATS questions — copy just the answer)
//   qa         — grouped Q&A (generated fallback)
//   live        — live answer input (always last card)

function buildKitCards(kit) {
  const cards = [];

  if (kit.cover_letter) {
    const isNativeIndia = kit.apply_context === 'naukri_native' || kit.apply_context === 'iimjobs_native';
    cards.push({
      id: 'cover',
      label: isNativeIndia ? 'Cover Note' : 'Cover Letter',
      type: 'text',
      text: kit.cover_letter,
    });
  }

  if (kit.bio) {
    cards.push({ id: 'bio', label: 'Professional Bio', type: 'text', text: kit.bio });
  }

  if (kit.screening_qa?.length) {
    if (kit.has_real_questions) {
      // Real questions fetched from ATS API — one card per answer
      // User goes through cards one by one matching each form field
      kit.screening_qa.forEach((qa, i) => {
        cards.push({
          id: `qa_${i}`,
          label: qa.question,                     // full question as card header
          type: 'single_qa',
          question: qa.question,
          text: qa.answer,                        // copy just the answer
        });
      });
    } else {
      // Generated questions — grouped into one card
      cards.push({
        id: 'qa',
        label: `Screening Answers (${kit.screening_qa.length})`,
        type: 'qa',
        items: kit.screening_qa.map((q) => ({ q: q.question, a: q.answer })),
        text: kit.screening_qa.map((q) => `Q: ${q.question}\nA: ${q.answer}`).join('\n\n'),
      });
    }
  }

  // Live Answer card — always last, for any unexpected questions on the form
  cards.push({
    id: 'live',
    label: 'Any other questions?',
    type: 'live',
    text: '',
  });

  return cards;
}

// ── Live Answer Card (React) ─────────────────────────────────────────────────

function LiveAnswerCard({ matchId }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAnswer = async () => {
    const q = question.trim();
    if (!q) return;
    setLoading(true);
    setAnswer('');
    try {
      const res = await fetch('/api/ai/answer-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: matchId, question: q }),
      });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setAnswer(data.answer || '');
    } catch {
      setAnswer('Hit a wall — try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAnswer();
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
        See a question on the form? Paste it here — Pilot answers it instantly.
      </p>
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Paste a question from the form…"
        rows={3}
        className="w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
      />
      <button
        onClick={handleAnswer}
        disabled={!question.trim() || loading}
        className="btn-gradient w-full py-2.5 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Answering…</>
        ) : (
          <>Answer it <ArrowRight className="w-4 h-4" /></>
        )}
      </button>
      {answer && (
        <div className="card p-3 space-y-2.5">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
            {answer}
          </p>
          <CopyButton text={answer} label="Copy answer" />
        </div>
      )}
    </div>
  );
}

// ── DPIP Kit window ──────────────────────────────────────────────────────────

async function openDPIPKit(kitCards, matchId) {
  if (!supportsDPIP()) return false;
  try {
    const pip = await window.documentPictureInPicture.requestWindow({
      width: 380,
      height: 560,
    });

    pip.document.documentElement.classList.toggle(
      'dark',
      document.documentElement.classList.contains('dark'),
    );

    const style = pip.document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, sans-serif; }
      body { background: #f9fafb; color: #111; padding: 0; height: 100vh; display: flex; flex-direction: column; }
      .dark body { background: #0f172a; color: #f1f5f9; }
      .header { padding: 14px 16px 10px; border-bottom: 1px solid #e5e7eb; }
      .dark .header { border-color: #1e293b; }
      .header-meta { font-size: 10px; font-weight: 700; color: #7c3aed; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px; }
      .real-badge { font-size: 9px; font-weight: 700; background: #d1fae5; color: #065f46; padding: 1px 5px; border-radius: 4px; text-transform: uppercase; }
      .dark .real-badge { background: #064e3b; color: #6ee7b7; }
      .header-title { font-size: 13px; font-weight: 700; margin-top: 3px; line-height: 1.35; }
      .counter { font-size: 11px; color: #9ca3af; margin-top: 2px; }
      .card-area { flex: 1; overflow-y: auto; padding: 14px 16px; }
      .card-label { font-size: 10px; font-weight: 700; color: #7c3aed; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
      .card-text { font-size: 13px; line-height: 1.6; color: #374151; white-space: pre-wrap; }
      .dark .card-text { color: #d1d5db; }
      .qa-q { font-size: 11px; font-weight: 600; color: #6b7280; margin-bottom: 6px; line-height: 1.4; }
      .qa-a { font-size: 13px; line-height: 1.6; color: #374151; }
      .dark .qa-a { color: #d1d5db; }
      .single-q { font-size: 11px; font-weight: 600; color: #6b7280; margin-bottom: 8px; line-height: 1.4; border-bottom: 1px solid #f3f4f6; padding-bottom: 8px; }
      .dark .single-q { color: #94a3b8; border-color: #1e293b; }
      .nav { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px 14px; border-top: 1px solid #e5e7eb; gap: 8px; }
      .dark .nav { border-color: #1e293b; }
      .nav-btn { flex: 1; padding: 8px; border: none; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; background: #ede9fe; color: #6d28d9; }
      .dark .nav-btn { background: #2e1065; color: #a78bfa; }
      .nav-btn:disabled { opacity: 0.3; cursor: default; }
      .copy-btn { flex: 1; padding: 8px; border: none; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; background: #7c3aed; color: white; }
      .copy-btn.copied { background: #059669; }
      /* Live card styles */
      .live-hint { font-size: 11px; color: #9ca3af; margin-bottom: 10px; line-height: 1.5; }
      .live-input { width: 100%; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; font-size: 12px; color: #374151; resize: vertical; font-family: inherit; background: white; }
      .dark .live-input { border-color: #334155; background: #1e293b; color: #f1f5f9; }
      .live-input:focus { outline: 2px solid #7c3aed; outline-offset: -1px; }
      .live-btn { margin-top: 8px; width: 100%; padding: 9px; border: none; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; background: #7c3aed; color: white; transition: opacity 0.15s; }
      .live-btn:disabled { opacity: 0.45; cursor: default; }
      .live-answer { margin-top: 10px; font-size: 12px; line-height: 1.6; color: #374151; white-space: pre-wrap; min-height: 0; }
      .dark .live-answer { color: #d1d5db; }
      .live-copy { margin-top: 8px; padding: 7px 12px; border: none; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; background: #f3f4f6; color: #374151; display: none; }
      .dark .live-copy { background: #1e293b; color: #d1d5db; }
    `;
    pip.document.head.appendChild(style);

    let currentIdx = 0;

    function render() {
      const card = kitCards[currentIdx];

      if (card.type === 'live') {
        pip.document.body.innerHTML = `
          <div class="header">
            <div class="header-meta">Pilot Kit</div>
            <div class="header-title">Any other questions?</div>
            <div class="counter">${currentIdx + 1} of ${kitCards.length}</div>
          </div>
          <div class="card-area">
            <p class="live-hint">See a question on the form? Paste it here — Pilot answers it.</p>
            <textarea id="live-input" class="live-input" placeholder="Paste a question from the form…" rows="3"></textarea>
            <button id="live-btn" class="live-btn">Answer it →</button>
            <div id="live-answer" class="live-answer"></div>
            <button id="live-copy" class="live-copy">Copy answer</button>
          </div>
          <div class="nav">
            <button class="nav-btn" id="prev" ${currentIdx === 0 ? 'disabled' : ''}>← Prev</button>
            <div style="flex:1"></div>
            <button class="nav-btn" id="next" disabled>—</button>
          </div>
        `;

        pip.document.getElementById('prev')?.addEventListener('click', () => {
          if (currentIdx > 0) { currentIdx--; render(); }
        });

        const liveBtn = pip.document.getElementById('live-btn');
        liveBtn?.addEventListener('click', async () => {
          const question = pip.document.getElementById('live-input')?.value?.trim();
          if (!question) return;
          liveBtn.textContent = 'Answering…';
          liveBtn.disabled = true;
          pip.document.getElementById('live-answer').textContent = '';
          pip.document.getElementById('live-copy').style.display = 'none';

          try {
            const res = await fetch('/api/ai/answer-question', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ match_id: matchId, question }),
            });
            const data = await res.json();
            const answer = data.answer || 'Could not generate — try again.';
            pip.document.getElementById('live-answer').textContent = answer;

            const copyBtn = pip.document.getElementById('live-copy');
            copyBtn.style.display = 'block';
            copyBtn.onclick = async () => {
              await pip.navigator.clipboard.writeText(answer).catch(() => {});
              copyBtn.textContent = 'Copied ✓';
              setTimeout(() => { copyBtn.textContent = 'Copy answer'; }, 2000);
            };
          } catch {
            pip.document.getElementById('live-answer').textContent = 'Hit a wall — try again.';
          } finally {
            liveBtn.textContent = 'Answer it →';
            liveBtn.disabled = false;
          }
        });

        return;
      }

      // All other card types
      const isRealBadge = card.type === 'single_qa';
      pip.document.body.innerHTML = `
        <div class="header">
          <div class="header-meta">
            Pilot Kit
            ${isRealBadge ? '<span class="real-badge">Real question</span>' : ''}
          </div>
          <div class="header-title">${card.label}</div>
          <div class="counter">${currentIdx + 1} of ${kitCards.length}</div>
        </div>
        <div class="card-area">
          ${card.type === 'single_qa'
            ? `<div class="single-q">${card.question}</div><div class="card-text">${card.text}</div>`
            : card.type === 'qa'
              ? card.items.map(({ q, a }) => `
                  <div style="margin-bottom:14px">
                    <div class="qa-q">${q}</div>
                    <div class="qa-a">${a}</div>
                  </div>
                `).join('')
              : `<div class="card-text">${card.text}</div>`
          }
        </div>
        <div class="nav">
          <button class="nav-btn" id="prev" ${currentIdx === 0 ? 'disabled' : ''}>← Prev</button>
          <button class="copy-btn" id="copy">Copy</button>
          <button class="nav-btn" id="next" ${currentIdx === kitCards.length - 1 ? 'disabled' : ''}>Next →</button>
        </div>
      `;

      pip.document.getElementById('prev')?.addEventListener('click', () => {
        if (currentIdx > 0) { currentIdx--; render(); }
      });
      pip.document.getElementById('next')?.addEventListener('click', () => {
        if (currentIdx < kitCards.length - 1) { currentIdx++; render(); }
      });
      pip.document.getElementById('copy')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        // For single_qa: copy just the answer (not the question)
        const textToCopy = card.type === 'qa'
          ? card.items.map(({ q, a }) => `Q: ${q}\nA: ${a}`).join('\n\n')
          : card.text;
        await pip.navigator.clipboard.writeText(textToCopy).catch(() => {});
        btn.textContent = 'Copied ✓';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
      });
    }

    render();
    return true;
  } catch {
    return false;
  }
}

// ── Stage: Preview ───────────────────────────────────────────────────────────

function PreviewStage({ job, flow, onPrepare, onClose }) {
  const desktop = isDesktopChrome();

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto pb-2">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider">
              ⚡ Applying via {flow.label}
            </p>
            <p className="font-bold text-gray-900 dark:text-white text-base mt-0.5 leading-snug">
              {job.title}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{job.company}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {flow.warning && (
          <div className="mb-4 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">{flow.warning}</p>
          </div>
        )}
        {flow.note && (
          <div className="mb-4 px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">{flow.note}</p>
          </div>
        )}

        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
            Pilot writes
          </p>
          <div className="space-y-1.5">
            {flow.pilotItems.map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
            You do
          </p>
          <div className="space-y-1.5">
            {flow.userItems.map((item) => (
              <div key={item} className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-sm text-gray-500 dark:text-gray-400">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 mb-4">
          <div>
            <p className="text-xs text-violet-600 dark:text-violet-400 font-medium">Est. time</p>
            <p className="text-sm font-bold text-violet-700 dark:text-violet-300">~{flow.avgMinutes} min</p>
          </div>
          <div className="h-8 w-px bg-violet-200 dark:bg-violet-800" />
          <div>
            <p className="text-xs text-violet-600 dark:text-violet-400 font-medium">With Pilot</p>
            <p className="text-sm font-bold text-violet-700 dark:text-violet-300">~90% faster</p>
          </div>
          <div className="h-8 w-px bg-violet-200 dark:bg-violet-800" />
          <div>
            <p className="text-xs text-violet-600 dark:text-violet-400 font-medium">Pilot handles</p>
            <p className="text-sm font-bold text-violet-700 dark:text-violet-300">
              {flow.pilotItems.length} of {flow.pilotItems.length + flow.userItems.length} steps
            </p>
          </div>
        </div>

        {desktop && (
          <div className="px-3 py-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 flex items-center gap-3">
            <Monitor className="w-4 h-4 text-violet-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Full Pilot coming soon</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Extension will auto-fill the form for you</p>
            </div>
          </div>
        )}
      </div>

      <div className="pt-4 shrink-0">
        <button
          onClick={onPrepare}
          className="btn-gradient w-full py-3.5 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2"
        >
          <Zap className="w-4 h-4" />
          Prepare my application
        </button>
        {!desktop && (
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-2.5 leading-relaxed">
            On desktop Chrome, Pilot fills the form for you.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Stage: Generating ────────────────────────────────────────────────────────

function GeneratingStage({ applyType }) {
  const isKnownATS = ['greenhouse', 'lever', 'ashby'].includes(applyType);
  const isIndianBoard = ['naukri', 'iimjobs'].includes(applyType);
  const lines = isKnownATS
    ? [
        'Reading the job description…',
        `Fetching real form questions from ${PORTAL_FLOWS[applyType]?.label || 'the portal'}…`,
        'Writing your answers…',
        'Drafting cover letter…',
        'Finishing up…',
      ]
    : isIndianBoard
    ? [
        'Reading the job description…',
        `Checking if ${PORTAL_FLOWS[applyType]?.label} links to a company portal…`,
        'Preparing your cover note…',
        'Drafting screening answers…',
        'Finishing up…',
      ]
    : [
        'Reading the job description…',
        'Pulling your profile…',
        'Writing cover letter…',
        'Drafting screening answers…',
        'Finishing up…',
      ];

  const [lineIdx, setLineIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setLineIdx((i) => Math.min(i + 1, lines.length - 1)), 900);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full py-10 gap-5">
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
          <Zap className="w-8 h-8 text-violet-600 dark:text-violet-400" />
        </div>
        <Loader2 className="w-5 h-5 text-violet-500 animate-spin absolute -top-1 -right-1" />
      </div>
      <div className="text-center">
        <p className="font-semibold text-gray-900 dark:text-white">Pilot is writing…</p>
        <AnimatePresence mode="wait">
          <motion.p
            key={lineIdx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="text-sm text-gray-500 dark:text-gray-400 mt-1"
          >
            {lines[lineIdx]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Stage: Ready ─────────────────────────────────────────────────────────────

function ReadyStage({ kit, job, matchId, onOpenPortal }) {
  const cards = buildKitCards(kit);
  const [idx, setIdx] = useState(0);
  const [dpipOpen, setDpipOpen] = useState(false);
  const dpipSupported = supportsDPIP();

  const card = cards[idx];
  const isLive = card?.type === 'live';

  const handleDPIP = async () => {
    const opened = await openDPIPKit(cards, matchId);
    if (opened) setDpipOpen(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex-1 min-w-0 pr-3">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider">
              Pilot Kit · {job.company}
            </p>
            {(card?.type === 'single_qa' || card?.type === 'qa') && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                kit.question_source === 'ats_api'
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                  : kit.question_source === 'db'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
              }`}>
                {kit.question_source === 'ats_api'
                  ? '✓ from form'
                  : kit.question_source === 'db'
                  ? '✓ verified'
                  : 'generated'}
              </span>
            )}
          </div>
          <p className="font-bold text-gray-900 dark:text-white text-sm mt-0.5 leading-snug line-clamp-2">
            {isLive ? 'Any other questions?' : card?.label}
          </p>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500 font-medium shrink-0">
          {idx + 1} / {cards.length}
        </span>
      </div>

      {/* Card content */}
      <div className="flex-1 overflow-y-auto mb-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.15 }}
            className={isLive ? '' : 'card p-4 space-y-3'}
          >
            {isLive ? (
              <LiveAnswerCard matchId={matchId} />
            ) : card?.type === 'single_qa' ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 leading-relaxed border-b border-gray-100 dark:border-slate-800 pb-2">
                  {card.question}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {card.text}
                </p>
              </div>
            ) : card?.type === 'qa' ? (
              card.items.map(({ q, a }, i) => (
                <div key={i} className={i > 0 ? 'pt-3 border-t border-gray-100 dark:border-slate-800' : ''}>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Q: {q}</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{a}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {card?.text}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Nav + copy (hidden for live card — it has its own copy) */}
      {!isLive && (
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center disabled:opacity-30 transition-opacity"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
          <div className="flex-1">
            <CopyButton
              text={card?.text || ''}
              label={card?.type === 'single_qa' ? 'Copy answer' : 'Copy this'}
            />
          </div>
          <button
            onClick={() => setIdx((i) => Math.min(cards.length - 1, i + 1))}
            disabled={idx === cards.length - 1}
            className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center disabled:opacity-30 transition-opacity"
          >
            <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      )}

      {/* Live card nav (prev only, no copy) */}
      {isLive && (
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center transition-opacity"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
          <div className="flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-slate-800">
            <MessageSquare className="w-3 h-3 text-violet-500 shrink-0" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Live Q&A</span>
          </div>
          <div className="w-9 h-9" /> {/* spacer */}
        </div>
      )}

      {/* Pinned bottom */}
      <div className="shrink-0 pt-1">
        {dpipSupported && !dpipOpen && (
          <button
            onClick={handleDPIP}
            className="mb-3 w-full py-2.5 rounded-xl border border-violet-200 dark:border-violet-800 text-sm font-medium text-violet-600 dark:text-violet-400 flex items-center justify-center gap-2 active:bg-violet-50 dark:active:bg-violet-900/20 transition-colors"
          >
            <Monitor className="w-4 h-4" />
            Keep Kit visible while applying
          </button>
        )}
        {dpipOpen && (
          <p className="text-center text-xs text-emerald-600 dark:text-emerald-400 mb-3 font-medium">
            ✓ Pilot Kit floating — switch to the portal tab
          </p>
        )}

        <button
          onClick={onOpenPortal}
          className="btn-gradient w-full py-3.5 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          Open {PORTAL_FLOWS[job.apply_type]?.label || 'Portal'}
        </button>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-2">
          {kit.question_source === 'ats_api'
            ? '✓ Questions fetched from live form'
            : kit.question_source === 'db'
            ? '✓ Questions from verified company data'
            : 'Questions generated from job description'}
        </p>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function PreApplySheet({ match, onClose, onApplied }) {
  const cacheKey = `pilot_kit_${match?.id}`;

  // Restore cached kit so reopening is instant — no regeneration needed
  const cachedKit = (() => {
    if (typeof window === 'undefined') return null;
    try { return JSON.parse(sessionStorage.getItem(cacheKey)); } catch { return null; }
  })();

  const [stage, setStage] = useState(cachedKit ? 'ready' : 'preview');
  const [kit, setKit] = useState(cachedKit);
  const [error, setError] = useState(null);

  const job = match?.jobs;
  const flow = getPortalFlow(job?.apply_type);

  const handlePrepare = async () => {
    setStage('generating');
    setError(null);
    try {
      const res = await fetch('/api/ai/draft-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: match.id }),
      });
      if (!res.ok) throw new Error('Pilot hit a wall — try again in a moment');
      const data = await res.json();
      // Cache so reopening is instant
      try { sessionStorage.setItem(cacheKey, JSON.stringify(data)); } catch {}
      setKit(data);
      setStage('ready');
    } catch (err) {
      setError(err.message);
      setStage('preview');
    }
  };

  const handleOpenPortal = () => {
    if (job?.apply_url) window.open(job.apply_url, '_blank');
    onApplied?.();
    onClose?.();
  };

  if (!job) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <motion.div
        className="absolute inset-0 bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={stage === 'generating' ? undefined : onClose}
      />

      <motion.div
        className="relative bg-white dark:bg-slate-900 rounded-t-2xl px-5 pt-5 flex flex-col"
        style={{
          paddingBottom: 'max(28px, env(safe-area-inset-bottom, 28px))',
          maxHeight: '92dvh',
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      >
        <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-slate-700 mx-auto mb-4 shrink-0" />

        {error && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 shrink-0">
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {stage === 'preview' && (
              <motion.div
                key="preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full overflow-y-auto"
              >
                <PreviewStage job={job} flow={flow} onPrepare={handlePrepare} onClose={onClose} />
              </motion.div>
            )}
            {stage === 'generating' && (
              <motion.div
                key="generating"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full"
              >
                <GeneratingStage applyType={job?.apply_type} />
              </motion.div>
            )}
            {stage === 'ready' && kit && (
              <motion.div
                key="ready"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full overflow-y-auto"
              >
                <ReadyStage
                  kit={kit}
                  job={job}
                  matchId={match.id}
                  onOpenPortal={handleOpenPortal}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
