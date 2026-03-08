'use client';

/**
 * JobSearchTitlesModal
 *
 * Opens from dashboard nudge "Seeing wrong roles? Update search →"
 * Shows current target_roles + unselected maybe titles + free text input.
 * Saves: PATCH /api/profile with { target_roles, job_search_titles }
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2 } from 'lucide-react';

export default function JobSearchTitlesModal({ onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [currentRoles, setCurrentRoles] = useState([]);
  const [maybeAll, setMaybeAll] = useState([]);
  const [customInput, setCustomInput] = useState('');

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then(({ user, profile }) => {
        setCurrentRoles(user?.target_roles || []);
        setMaybeAll(profile?.job_search_titles?.maybe || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const removeRole = (r) => setCurrentRoles((prev) => prev.filter((x) => x !== r));

  const addMaybe = (title) => {
    if (!currentRoles.includes(title) && currentRoles.length < 5) {
      setCurrentRoles((prev) => [...prev, title]);
    }
  };

  const addCustom = () => {
    const trimmed = customInput.trim();
    if (trimmed && !currentRoles.includes(trimmed) && currentRoles.length < 5) {
      setCurrentRoles((prev) => [...prev, trimmed]);
    }
    setCustomInput('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Build updated job_search_titles: move newly added maybe titles to suitable
      const updatedMaybe = maybeAll.filter((t) => !currentRoles.includes(t));
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_roles: currentRoles,
          job_search_titles: { maybe: updatedMaybe },
        }),
      });
      setSaved(true);
      setTimeout(() => { onSaved?.(); onClose(); }, 1500);
    } catch {
      setSaving(false);
    }
  };

  const maybeUnselected = maybeAll.filter((t) => !currentRoles.includes(t));

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col justify-end"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />

        <motion.div
          className="relative bg-white dark:bg-slate-900 rounded-t-3xl px-5 pt-5 pb-10 safe-bottom shadow-xl max-h-[85vh] overflow-y-auto"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        >
          <div className="w-10 h-1 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-5" />

          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>

          {saved ? (
            <div className="flex flex-col items-center text-center py-6 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="font-bold text-gray-900 dark:text-white text-lg">Search updated</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">New matches will reflect this.</p>
            </div>
          ) : loading ? (
            <div className="py-12 flex justify-center">
              <div className="w-5 h-5 spinner" />
            </div>
          ) : (
            <>
              <div className="mb-6">
                <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-1">Pilot</p>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Update your search</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Remove roles that don't fit. Add ones I missed.</p>
              </div>

              {/* Current active roles */}
              <div className="mb-5">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Currently searching for</p>
                {currentRoles.length === 0 ? (
                  <p className="text-sm text-gray-400">No roles — add some below.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {currentRoles.map((r) => (
                      <span
                        key={r}
                        className="flex items-center gap-1.5 bg-violet-600 text-white text-sm font-medium px-3 py-1.5 rounded-full"
                      >
                        {r}
                        <button onClick={() => removeRole(r)} className="opacity-70 hover:opacity-100 leading-none">&times;</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Unselected maybe titles */}
              {maybeUnselected.length > 0 && (
                <div className="mb-5">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Pilot's suggestions</p>
                  <p className="text-xs text-gray-400 mb-2">Based on your background — tap to add</p>
                  <div className="flex flex-wrap gap-2">
                    {maybeUnselected.map((title) => (
                      <button
                        key={title}
                        onClick={() => addMaybe(title)}
                        disabled={currentRoles.length >= 5}
                        className="flex items-center gap-1 border border-dashed border-violet-300 dark:border-violet-700 text-violet-600 dark:text-violet-400 text-sm font-medium px-3 py-1.5 rounded-full hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors disabled:opacity-40"
                      >
                        <span className="text-base leading-none">+</span> {title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom add */}
              {currentRoles.length < 5 && (
                <div className="mb-6">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Add custom title</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Chief of Staff, VP Product…"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
                      className="input-field flex-1 text-sm"
                    />
                    <button
                      onClick={addCustom}
                      disabled={!customInput.trim()}
                      className="btn-gradient px-4 rounded-xl text-white font-semibold text-sm disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Up to 5 titles total.</p>
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={saving || currentRoles.length === 0}
                className="w-full py-4 rounded-xl bg-violet-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <span className="w-4 h-4 spinner" /> : 'Save search →'}
              </button>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
