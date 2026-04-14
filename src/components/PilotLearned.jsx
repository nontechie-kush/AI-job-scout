'use client';

/**
 * PilotLearned — small card shown in the Ready stage.
 *
 * Polls /api/ai/resume-memory-learned for nuggets extracted from the
 * conversation that just ended. Extraction happens in the background after
 * the chat finalizes, so this card may start empty and fill in a moment later.
 *
 * Props:
 *   conversationId — UUID or null (hide card if null)
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Sparkles } from 'lucide-react';

const MAX_POLL_ATTEMPTS = 6;    // 6 × 1.5s = 9s total
const POLL_INTERVAL_MS = 1500;

export default function PilotLearned({ conversationId }) {
  const [nuggets, setNuggets] = useState(null);
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!conversationId) return;

    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(
          `/api/ai/resume-memory-learned?conversation_id=${conversationId}`,
        );
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        if (cancelled) return;

        if (data.nuggets?.length > 0) {
          setNuggets(data.nuggets);
          return; // done
        }

        attemptsRef.current += 1;
        if (attemptsRef.current < MAX_POLL_ATTEMPTS) {
          setTimeout(poll, POLL_INTERVAL_MS);
        } else {
          setNuggets([]); // gave up
        }
      } catch {
        attemptsRef.current += 1;
        if (attemptsRef.current < MAX_POLL_ATTEMPTS) {
          setTimeout(poll, POLL_INTERVAL_MS);
        } else {
          setNuggets([]);
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  // Still polling — show quiet placeholder
  if (nuggets === null) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
        className="w-full mt-2 p-3 rounded-xl bg-gradient-to-br from-purple-500/10 to-emerald-500/10 border border-purple-200/50 dark:border-purple-800/30"
      >
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          >
            <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </motion.div>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            Pilot is saving what you taught it…
          </p>
        </div>
      </motion.div>
    );
  }

  // No nuggets extracted — stay silent (the chat didn't have durable facts)
  if (nuggets.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full mt-2 p-4 rounded-xl bg-gradient-to-br from-purple-500/10 via-emerald-500/10 to-blue-500/10 border border-purple-200/50 dark:border-purple-800/30"
      >
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Pilot just got smarter
          </p>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-300 mb-2.5 leading-relaxed">
          I learned {nuggets.length} new thing{nuggets.length !== 1 ? 's' : ''} about you.
          Next resume will be faster.
        </p>
        <ul className="space-y-1.5">
          {nuggets.slice(0, 5).map((n) => (
            <li
              key={n.id}
              className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed flex items-start gap-1.5"
            >
              <span className="text-purple-500 dark:text-purple-400 mt-0.5">•</span>
              <span>
                {n.fact}
                {(n.company || n.role) && (
                  <span className="text-gray-500 dark:text-gray-500 ml-1">
                    {[n.role, n.company].filter(Boolean).join(' · ')}
                  </span>
                )}
              </span>
            </li>
          ))}
          {nuggets.length > 5 && (
            <li className="text-xs text-gray-500 dark:text-gray-400 italic pl-3.5">
              + {nuggets.length - 5} more
            </li>
          )}
        </ul>
      </motion.div>
    </AnimatePresence>
  );
}
