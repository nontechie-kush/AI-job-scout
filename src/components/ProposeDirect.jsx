'use client';

/**
 * ProposeDirect — shown when ALL gaps are covered from memory.
 *
 * Displays pre-drafted bullets from the memory-check result.
 * User can:
 *   - Accept each bullet (calls apply-changes)
 *   - Edit a bullet inline
 *   - Reject a bullet (drops it)
 *   - "Actually, let's chat" escape hatch → opens chat instead
 *
 * Props:
 *   tailoredResumeId — UUID
 *   coverage         — [{gap_index, covered, proposed_bullet, target_entry_hint, evidence[]}]
 *   gaps             — the original gap list (indexed by gap_index)
 *   onDone           — (acceptedChanges[]) => void → move to review
 *   onSwitchToChat   — () => void → user wants to chat instead
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check, X, Edit3, Save, MessageCircle, FileText, Sparkles,
} from 'lucide-react';

export default function ProposeDirect({
  tailoredResumeId,
  coverage = [],
  gaps = [],
  onDone,
  onSwitchToChat,
}) {
  // Only covered gaps have proposed bullets
  const proposed = coverage
    .filter((c) => c.covered && c.proposed_bullet)
    .map((c, idx) => ({
      id: `direct_${idx}`,
      gap: gaps[c.gap_index]?.gap || '',
      bullet: c.proposed_bullet,
      targetHint: c.target_entry_hint || '',
      evidence: c.evidence || [],
    }));

  const [items, setItems] = useState(
    proposed.map((p) => ({ ...p, status: 'pending', editedBullet: p.bullet })),
  );
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  function accept(id) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: 'accepted' } : it)));
  }
  function reject(id) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: 'rejected' } : it)));
  }
  function startEdit(id) {
    setEditingId(id);
  }
  function saveEdit(id, newText) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, editedBullet: newText, status: 'accepted' } : it,
      ),
    );
    setEditingId(null);
  }

  const acceptedItems = items.filter((it) => it.status === 'accepted');

  async function handleDone() {
    if (!acceptedItems.length) {
      // Nothing accepted — just move on
      onDone?.([]);
      return;
    }

    setSaving(true);
    try {
      // Map accepted items into the change format expected by apply-changes
      const changes = acceptedItems.map((it) => ({
        id: it.id,
        action: 'add',
        section: 'experience',
        entry_hint: it.targetHint,
        after: it.editedBullet,
      }));

      const res = await fetch('/api/ai/resume-apply-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tailored_resume_id: tailoredResumeId,
          accepted_changes: changes,
        }),
      });
      if (!res.ok) throw new Error('Failed to apply changes');
      onDone?.(changes);
    } catch (err) {
      console.error('[ProposeDirect]', err);
      // Still move on — review stage will show what actually stuck
      onDone?.([]);
    } finally {
      setSaving(false);
    }
  }

  const pendingCount = items.filter((it) => it.status === 'pending').length;

  return (
    <div className="px-5 py-6 space-y-4">
      {/* Hero */}
      <div className="text-center space-y-2">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-semibold"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Wrote these from memory
        </motion.div>
        <p className="text-sm text-gray-600 dark:text-gray-300 max-w-sm mx-auto leading-relaxed">
          I pulled these straight from what you&apos;ve told me before. Accept, edit, or skip.
        </p>
      </div>

      {/* Bullet cards */}
      <div className="space-y-3">
        {items.map((item) => {
          const isEditing = editingId === item.id;
          const isAccepted = item.status === 'accepted';
          const isRejected = item.status === 'rejected';

          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`rounded-xl border overflow-hidden ${
                isAccepted
                  ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10'
                  : isRejected
                    ? 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/40 opacity-60'
                    : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800'
              }`}
            >
              {/* Gap label */}
              <div className="px-3 pt-3">
                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Addresses: {item.gap}
                </p>
              </div>

              {/* Bullet */}
              <div className="px-3 py-2">
                {isEditing ? (
                  <InlineEditor
                    initial={item.editedBullet}
                    onSave={(text) => saveEdit(item.id, text)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                    {item.editedBullet}
                  </p>
                )}
              </div>

              {/* Evidence (collapsed, small) */}
              {item.evidence.length > 0 && !isRejected && (
                <div className="px-3 pb-2">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">
                    Based on: {item.evidence[0].fact}
                  </p>
                </div>
              )}

              {/* Target hint */}
              {item.targetHint && !isRejected && (
                <div className="px-3 pb-2">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
                    Target: {item.targetHint}
                  </p>
                </div>
              )}

              {/* Action row */}
              {!isEditing && !isAccepted && !isRejected && (
                <div className="flex border-t border-gray-100 dark:border-slate-700">
                  <button
                    onClick={() => accept(item.id)}
                    className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" /> Accept
                  </button>
                  <div className="w-px bg-gray-100 dark:bg-slate-700" />
                  <button
                    onClick={() => startEdit(item.id)}
                    className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <div className="w-px bg-gray-100 dark:bg-slate-700" />
                  <button
                    onClick={() => reject(item.id)}
                    className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" /> Skip
                  </button>
                </div>
              )}

              {/* Status pill */}
              {isAccepted && !isEditing && (
                <div className="px-3 py-2 border-t border-emerald-100 dark:border-emerald-800/30 flex items-center justify-between">
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                    ✓ Accepted
                  </p>
                  <button
                    onClick={() => startEdit(item.id)}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Edit again
                  </button>
                </div>
              )}
              {isRejected && (
                <div className="px-3 py-2 border-t border-gray-100 dark:border-slate-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">— Skipped</p>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Bottom actions */}
      <div className="space-y-2 pt-2">
        <button
          onClick={handleDone}
          disabled={saving || pendingCount > 0}
          className="btn-gradient w-full py-3.5 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <FileText className="w-4 h-4" />
          {pendingCount > 0
            ? `Decide on ${pendingCount} more`
            : acceptedItems.length > 0
              ? `Done — Review & Generate (${acceptedItems.length} change${acceptedItems.length !== 1 ? 's' : ''})`
              : 'Continue to review'}
        </button>
        <button
          onClick={onSwitchToChat}
          className="w-full py-3 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
        >
          <MessageCircle className="w-4 h-4" />
          Not quite right? Chat with Pilot instead
        </button>
      </div>
    </div>
  );
}

// ── Inline editor ───────────────────────────────────────────────

function InlineEditor({ initial, onSave, onCancel }) {
  const [text, setText] = useState(initial);

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
        rows={3}
        className="w-full px-2.5 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onSave(text)}
          disabled={!text.trim()}
          className="flex-1 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" /> Save
        </button>
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 text-xs font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
