'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BarChart2, GripVertical, Calendar, RefreshCw, Plus, X, Mail } from 'lucide-react';
import { usePipeline } from '@/hooks/usePipeline';
import { stages } from '@/data/pipeline';

// ── Deterministic company color ──────────────────────────────

function companyColor(name) {
  const colors = [
    'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
    'bg-rose-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500',
  ];
  let hash = 0;
  for (const c of (name || '')) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

// ── Add card modal ────────────────────────────────────────────

function AddCardModal({ onAdd, onClose }) {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!company.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/pipeline/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: company.trim(), role_title: role.trim(), type: 'application', stage: 'applied' }),
      });
      if (!res.ok) throw new Error('Failed to add');
      onAdd();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.div
        className="relative w-full bg-white dark:bg-slate-900 rounded-t-2xl px-5 pt-5"
        style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom, 32px))' }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-gray-900 dark:text-white">Add to pipeline</p>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Company *"
            className="input-field"
            autoFocus
          />
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Role title (optional)"
            className="input-field"
          />
        </div>

        <button
          onClick={handleAdd}
          disabled={!company.trim() || saving}
          className="btn-gradient w-full py-3.5 rounded-xl text-white font-semibold text-sm mt-4 disabled:opacity-50"
        >
          {saving ? 'Adding…' : 'Add to Applied'}
        </button>
      </motion.div>
    </div>
  );
}

// ── Pipeline card ─────────────────────────────────────────────

function PipelineCard({ card, onDragStart, onDragEnd }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e) => {
    e.dataTransfer.setData('cardId', card.id);
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
    onDragStart?.(card.id);
  };

  const logoChar = card.company_logo_char || (card.company || '?')[0].toUpperCase();
  const logoColor = companyColor(card.company);
  const isAutoDetected = card.source === 'gmail';

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={() => { setIsDragging(false); onDragEnd?.(); }}
      className={`kanban-card bg-white dark:bg-slate-800 rounded-xl p-3 border border-gray-100 dark:border-slate-700 shadow-sm select-none ${isDragging ? 'is-dragging opacity-50' : ''}`}
    >
      <div className="flex items-start gap-2">
        <div className={`w-8 h-8 rounded-lg ${logoColor} flex items-center justify-center text-white font-bold text-xs shrink-0`}>
          {logoChar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className="font-semibold text-gray-900 dark:text-white text-xs leading-snug">{card.company}</p>
            {isAutoDetected && (
              <span className="shrink-0 text-[9px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded-full">
                Auto
              </span>
            )}
          </div>
          {card.role_title && (
            <p className="text-gray-500 dark:text-gray-400 text-[11px] truncate mt-0.5">{card.role_title}</p>
          )}
        </div>
        <GripVertical className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0 mt-0.5" />
      </div>

      <div className="mt-2">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
          <span className="text-gray-400 text-[11px]">
            {card.last_activity_at
              ? new Date(card.last_activity_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Kanban column ─────────────────────────────────────────────

function KanbanColumn({ stage, cards, onDrop }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const stageConfig = stages.find((s) => s.id === stage);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const cardId = e.dataTransfer.getData('cardId');
        onDrop(cardId, stage);
      }}
      className={`kanban-column shrink-0 w-44 rounded-2xl transition-all ${
        isDragOver
          ? 'ring-2 ring-violet-400 ring-offset-2 dark:ring-offset-slate-950 bg-violet-50 dark:bg-violet-900/10'
          : 'bg-gray-100 dark:bg-slate-800/50'
      }`}
    >
      {/* Column header */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${stageConfig?.dotColor}`} />
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{stageConfig?.label}</span>
          </div>
          <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${stageConfig?.color} ${stageConfig?.textColor}`}>
            {cards.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div className="px-2 pb-3 space-y-2 min-h-[80px]">
        {cards.map((card) => (
          <PipelineCard key={card.id} card={card} />
        ))}
        {isDragOver && cards.length === 0 && (
          <div className="h-16 border-2 border-dashed border-violet-300 dark:border-violet-700 rounded-xl flex items-center justify-center">
            <span className="text-violet-400 text-xs font-medium">Drop here</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Gmail connect banner ──────────────────────────────────────

function GmailBanner({ onConnect, status }) {
  if (status === 'loading') return null;
  if (status === 'connected') return null;

  return (
    <div className="mx-5 mb-3 card p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/50">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
          <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Auto-track applications</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
            Connect Gmail to detect ATS emails and update your pipeline automatically.
          </p>
        </div>
      </div>
      <button
        onClick={onConnect}
        className="mt-3 w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold active:bg-blue-700 transition-colors"
      >
        Connect Gmail
      </button>
      <p className="mt-2 text-[11px] text-gray-400 text-center">
        Read-only access · No emails stored
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function TrackerPage() {
  const { pipeline, total, loading, refresh } = usePipeline();
  const [gmailStatus, setGmailStatus] = useState('loading');
  const [showAddModal, setShowAddModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);

  // Check gmail connect status
  useEffect(() => {
    fetch('/api/gmail/status')
      .then((r) => r.json())
      .then((d) => setGmailStatus(d.connected ? 'connected' : 'disconnected'))
      .catch(() => setGmailStatus('disconnected'));
  }, []);

  // Handle gmail=connected|denied|error query param (returned from OAuth callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gmail = params.get('gmail');
    if (gmail === 'connected') {
      setGmailStatus('connected');
      setToast({ type: 'success', msg: 'Gmail connected — syncing now…' });
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      // Auto-sync
      fetch('/api/gmail/sync', { method: 'POST' }).then(() => refresh());
    } else if (gmail === 'denied') {
      setToast({ type: 'info', msg: 'Gmail access skipped.' });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (gmail === 'error') {
      setToast({ type: 'error', msg: 'Gmail connect failed — try again.' });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleGmailConnect = async () => {
    const res = await fetch('/api/gmail/auth');
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/gmail/sync', { method: 'POST' });
      await refresh();
      setToast({ type: 'success', msg: 'Pipeline synced.' });
    } catch {
      setToast({ type: 'error', msg: 'Sync failed — try again.' });
    } finally {
      setSyncing(false);
    }
  };

  const handleDrop = useCallback(async (cardId, newStage) => {
    // Optimistic update handled by re-fetch; PATCH persists to DB
    await fetch('/api/pipeline/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cardId, stage: newStage }),
    });
    refresh();
  }, [refresh]);

  const byStage = stages.reduce((acc, s) => {
    acc[s.id] = pipeline.filter((c) => c.stage === s.id);
    return acc;
  }, {});

  const activeCount = pipeline.filter((c) => !['rejected', 'ghosted'].includes(c.stage)).length;

  return (
    <div className="page-enter min-h-dvh">
      {/* Header */}
      <div className="px-5 header-safe-top pb-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Pipeline Tracker</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
              {loading ? '—' : `${activeCount} active · ${total} total`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {gmailStatus === 'connected' && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center"
                title="Sync Gmail"
              >
                <RefreshCw className={`w-4 h-4 text-gray-500 dark:text-gray-400 ${syncing ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={() => setShowAddModal(true)}
              className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center"
              title="Add manually"
            >
              <Plus className="w-4 h-4 text-white" />
            </button>
            <BarChart2 className="w-5 h-5 text-violet-500" />
          </div>
        </div>

        {/* Stage summary pills */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-none">
          {stages.map((s) => {
            const count = byStage[s.id]?.length || 0;
            if (!count) return null;
            return (
              <div
                key={s.id}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${s.color} ${s.textColor}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${s.dotColor}`} />
                {count} {s.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Gmail connect banner */}
      <div className="pt-3">
        <GmailBanner onConnect={handleGmailConnect} status={gmailStatus} />
      </div>

      {/* Stats */}
      {!loading && total > 0 && (
        <div className="px-5 pb-3">
          <div className="card p-4">
            <div className="grid grid-cols-3 gap-2 text-center divide-x divide-gray-100 dark:divide-slate-800">
              {[
                { label: 'Applied', value: (byStage.applied?.length || 0) + (byStage.confirmed?.length || 0), emoji: '📝' },
                { label: 'In Progress', value: (byStage.replied?.length || 0) + (byStage.interviewing?.length || 0), emoji: '🔄' },
                { label: 'Offers', value: byStage.offer?.length || 0, emoji: '🎉' },
              ].map((s) => (
                <div key={s.label} className="px-1">
                  <div className="text-lg">{s.emoji}</div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{s.value}</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="spinner w-6 h-6" />
        </div>
      ) : total === 0 ? (
        <div className="text-center py-16 px-5">
          <div className="text-4xl mb-3">📋</div>
          <p className="font-semibold text-gray-700 dark:text-gray-300">Pipeline is empty</p>
          <p className="text-gray-400 text-sm mt-1 leading-relaxed">
            Apply to jobs and they&apos;ll appear here.<br />
            Or tap + to add manually.
          </p>
        </div>
      ) : (
        <>
          <div className="px-5 pb-2">
            <p className="text-gray-400 text-xs text-center">← Swipe · Drag cards between columns →</p>
          </div>

          {/* Kanban board */}
          <div className="kanban-scroll scrollbar-none pb-4">
            <div className="flex gap-3 px-5 min-w-max">
              {stages.map((s) => (
                <KanbanColumn
                  key={s.id}
                  stage={s.id}
                  cards={byStage[s.id] || []}
                  onDrop={handleDrop}
                />
              ))}
              <div className="w-4 shrink-0" />
            </div>
          </div>
        </>
      )}

      {/* Add card modal */}
      {showAddModal && (
        <AddCardModal
          onAdd={() => { refresh(); setShowAddModal(false); }}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg text-white ${
          toast.type === 'success' ? 'bg-emerald-600' :
          toast.type === 'error' ? 'bg-red-600' : 'bg-gray-800'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
