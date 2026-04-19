'use client';

/**
 * TailorV2Review — single-screen v2 pipeline UX inside ResumeTailorSheet.
 *
 * Flow:
 *   - mounts, fires POST /api/ai/resume-tailor-v2 (or detects reuse offer)
 *   - shows Pilot narration while passes run
 *   - on result, renders: positioning + key themes at top, then per-role
 *     "before / after" bullet pairs with citation chips, then optional
 *     dropped-atoms section, then Generate PDF CTA.
 *
 * Props:
 *   matchId           — string
 *   baseResume        — original structured_resume (for diff)
 *   onPdfReady(url)   — called after PDF generation succeeds
 */

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Loader2, FileText, Download, ChevronDown, ChevronUp,
  Quote, RotateCcw, AlertTriangle, CheckCircle2, Info,
} from 'lucide-react';

const NARRATION = [
  'Reading the job description…',
  'Picking the story for this one…',
  'Choosing your strongest atoms…',
  'Writing bullets in your voice…',
  'Double-checking every number…',
];

function Narration() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, NARRATION.length - 1)), 1800);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="px-5 py-12 flex flex-col items-center gap-4">
      <div className="relative">
        <Sparkles className="w-10 h-10 text-emerald-500 animate-pulse" />
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="text-sm text-gray-600 dark:text-gray-300 text-center"
        >
          {NARRATION[i]}
        </motion.p>
      </AnimatePresence>
      <div className="flex gap-1.5 mt-1">
        {NARRATION.map((_, idx) => (
          <div
            key={idx}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              idx <= i ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-slate-700'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function ReuseOffer({ result, onUseReused, onRegenerate }) {
  const totalBullets = result.bullets_by_role.reduce((s, r) => s + r.bullets.length, 0);
  return (
    <div className="px-5 py-6 space-y-4">
      <div className="card p-4 bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              You've tailored for this kind of role recently.
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
              Pilot already wrote {totalBullets} bullets for the
              <span className="font-medium"> {result.cluster.cluster_id}</span> story.
              Reuse them, or burn a fresh pass.
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <button
          onClick={onUseReused}
          className="btn-gradient w-full py-3.5 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2"
        >
          <FileText className="w-4 h-4" /> Use these bullets
        </button>
        <button
          onClick={onRegenerate}
          className="w-full py-3 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" /> Regenerate from scratch
        </button>
      </div>
    </div>
  );
}

function BulletPair({ originalText, composed }) {
  const [showCites, setShowCites] = useState(false);
  const v = composed.validation || {};
  const isClean = v.ok !== false;
  const isOver = v.over_budget;
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <p className="text-sm text-gray-800 dark:text-gray-100 leading-relaxed">
            {composed.text}
          </p>
          <div className="flex items-center gap-3 mt-1">
            {!isClean && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-3 h-3" /> needs review
              </span>
            )}
            {isOver && (
              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                {v.word_count}w (over 22)
              </span>
            )}
            {(composed.cited_atom_ids || []).length > 0 && (
              <button
                onClick={() => setShowCites((s) => !s)}
                className="text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <Quote className="w-2.5 h-2.5" />
                {composed.cited_atom_ids.length} source{composed.cited_atom_ids.length > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showCites && (composed.source_atom_facts || []).length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="ml-2 pl-3 border-l-2 border-blue-200 dark:border-blue-800 space-y-1 py-1">
              {composed.source_atom_facts.map((fact, i) => (
                <p key={i} className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed italic">
                  "{fact}"
                </p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {originalText && originalText !== composed.text && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500 line-through leading-snug pl-2">
          was: {originalText}
        </p>
      )}
    </div>
  );
}

function RoleBlock({ role, originalEntry }) {
  return (
    <div className="card p-3.5 space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          {role.role}
        </p>
        <p className="text-xs text-gray-500">{role.company}</p>
      </div>
      <div className="space-y-3 pl-1 border-l-2 border-emerald-200 dark:border-emerald-800/60">
        {role.bullets.map((b, i) => (
          <div key={i} className="pl-3">
            <BulletPair
              composed={b}
              originalText={originalEntry?.bullets?.[i]?.text}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TailorV2Review({ matchId, baseResume, onPdfReady }) {
  const [phase, setPhase] = useState('loading'); // loading | reuse_offer | review | error | generating
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showDropped, setShowDropped] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Run the orchestrator on mount
  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/ai/resume-tailor-v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ match_id: matchId }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Failed (${res.status})`);
        }
        const data = await res.json();
        if (cancelled) return;
        setResult(data);
        setPhase(data.reused ? 'reuse_offer' : 'review');
      } catch (e) {
        if (cancelled) return;
        console.error('[TailorV2Review]', e);
        setError(e.message);
        setPhase('error');
      }
    })();
    return () => { cancelled = true; };
  }, [matchId]);

  async function regenerateFresh() {
    setPhase('loading');
    try {
      // Force a fresh pass by deleting the cached brief (and forcing kbv check):
      // simpler approach — just call the route again. The reuse-check window is
      // 14 days though, so we hint-bypass by deleting the brief id link client-side
      // is impossible. Instead, the orchestrator will re-detect reuse. Workaround:
      // ask the server to skip reuse via a hint in a follow-up build. For now we
      // surface the same result; user can edit via chat if needed.
      const res = await fetch('/api/ai/resume-tailor-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Force-Fresh': '1' },
        body: JSON.stringify({ match_id: matchId, force_fresh: true }),
      });
      const data = await res.json();
      setResult(data);
      setPhase(data.reused ? 'reuse_offer' : 'review');
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  }

  async function handleGeneratePdf() {
    if (!result?.tailored_resume_id) return;
    setPdfLoading(true);
    try {
      const res = await fetch('/api/ai/resume-generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tailored_resume_id: result.tailored_resume_id,
          template: 'clean',
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'PDF generation failed');
      }
      const data = await res.json();
      onPdfReady?.(data.pdf_url);
    } catch (e) {
      setError(`PDF generation failed: ${e.message}`);
    } finally {
      setPdfLoading(false);
    }
  }

  // Index original experience entries by company+role for diffing.
  const originalByRole = useMemo(() => {
    const map = new Map();
    for (const e of baseResume?.experience || []) {
      map.set(`${(e.company || '').toLowerCase()}::${(e.title || '').toLowerCase()}`, e);
    }
    return map;
  }, [baseResume]);

  if (phase === 'loading') return <Narration />;

  if (phase === 'error') {
    return (
      <div className="px-5 py-8 space-y-3">
        <div className="card p-4 bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                Hit a wall — not you, it's me.
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'reuse_offer') {
    return (
      <ReuseOffer
        result={result}
        onUseReused={() => setPhase('review')}
        onRegenerate={regenerateFresh}
      />
    );
  }

  // review phase
  const stats = result.stats || {};
  const dropped = result.selection_dropped || [];

  return (
    <div className="px-5 py-5 space-y-5">
      {/* Story brief at the top */}
      <div className="card p-4 bg-gradient-to-br from-emerald-50/60 to-blue-50/40 dark:from-emerald-900/10 dark:to-blue-900/10">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Pilot's angle for this job
          </p>
        </div>
        <p className="text-[13px] text-gray-700 dark:text-gray-200 leading-relaxed">
          {result.brief?.positioning}
        </p>
        {result.brief?.key_themes?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {result.brief.key_themes.map((t) => (
              <span
                key={t}
                className="tag-pill bg-white/70 dark:bg-slate-800/60 text-gray-700 dark:text-gray-300 text-[10px] border border-gray-200 dark:border-slate-700"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Stats strip */}
      <div className="flex items-center gap-4 text-[11px] text-gray-500 dark:text-gray-400 border-y border-gray-100 dark:border-slate-800 py-2">
        <span><strong className="text-gray-700 dark:text-gray-200">{stats.bullets_total}</strong> bullets</span>
        <span><strong className="text-gray-700 dark:text-gray-200">{stats.atoms_selected}/{stats.atoms_total}</strong> atoms used</span>
        {stats.bullets_failed > 0 && (
          <span className="text-amber-600 dark:text-amber-400">
            <strong>{stats.bullets_failed}</strong> need review
          </span>
        )}
      </div>

      {/* Per-role bullet blocks */}
      <div className="space-y-3">
        {result.bullets_by_role.map((role) => {
          const key = `${(role.company || '').toLowerCase()}::${(role.role || '').toLowerCase()}`;
          return (
            <RoleBlock
              key={key}
              role={role}
              originalEntry={originalByRole.get(key)}
            />
          );
        })}
      </div>

      {/* Dropped atoms (collapsible audit) */}
      {dropped.length > 0 && (
        <div className="border-t border-gray-100 dark:border-slate-800 pt-3">
          <button
            onClick={() => setShowDropped((s) => !s)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            {showDropped ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <Info className="w-3.5 h-3.5" />
            {dropped.length} atom{dropped.length > 1 ? 's' : ''} left out
          </button>
          <AnimatePresence>
            {showDropped && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-1.5 pl-1">
                  {dropped.map((d) => (
                    <div key={d.id} className="flex items-start gap-2 text-[11px]">
                      <span className="font-mono text-gray-400 mt-0.5">[{d.reason}]</span>
                      <span className="text-gray-500 dark:text-gray-400 leading-snug flex-1">
                        {d.fact}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Generate PDF */}
      <button
        onClick={handleGeneratePdf}
        disabled={pdfLoading}
        className="btn-gradient w-full py-3.5 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {pdfLoading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Generating PDF…</>
        ) : (
          <><FileText className="w-4 h-4" /> Generate PDF</>
        )}
      </button>
    </div>
  );
}
