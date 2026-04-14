'use client';

/**
 * ResumeChat — conversational Q&A sub-component for the Resume Tailor Service.
 *
 * Used inside ResumeTailorSheet's 'chat' stage.
 * Handles message list, text input, inline diff cards for proposed changes.
 *
 * Props:
 *   tailoredResumeId — UUID of the tailored resume being edited
 *   onChangesProposed — (changes[]) => void — called when Pilot proposes changes
 *   onFinalized — () => void — called when conversation reaches 'finalized' stage
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Loader2, Check, X, ArrowRight, FileText,
} from 'lucide-react';

function DiffCard({ change, onAccept, onReject }) {
  return (
    <div className="mt-2 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
      {change.before && (
        <div className="px-3 py-2 bg-red-50 dark:bg-red-900/15 border-b border-gray-200 dark:border-slate-700">
          <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-0.5">Replace</p>
          <p className="text-xs text-gray-600 dark:text-gray-300 line-through">{change.before}</p>
        </div>
      )}
      <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-900/15">
        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-0.5">
          {change.action === 'add' ? 'Add' : 'With'}
        </p>
        <p className="text-xs text-gray-700 dark:text-gray-200">{change.after}</p>
      </div>
      <div className="flex border-t border-gray-200 dark:border-slate-700">
        <button
          onClick={() => onAccept(change)}
          className="flex-1 py-2 flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
        >
          <Check className="w-3.5 h-3.5" /> Accept
        </button>
        <div className="w-px bg-gray-200 dark:bg-slate-700" />
        <button
          onClick={() => onReject(change)}
          className="flex-1 py-2 flex items-center justify-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Skip
        </button>
      </div>
    </div>
  );
}

export default function ResumeChat({ tailoredResumeId, onChangesProposed, onFinalized }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [started, setStarted] = useState(false);
  const [acceptedChanges, setAcceptedChanges] = useState([]);
  const [handledChangeIds, setHandledChangeIds] = useState(new Set());
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Start conversation automatically
  useEffect(() => {
    if (!started && tailoredResumeId) {
      setStarted(true);
      sendMessage('Start');
    }
  }, [tailoredResumeId]);

  async function sendMessage(text) {
    if (!text.trim() || loading) return;

    // Don't show "Start" as a user message
    if (text !== 'Start') {
      setMessages((prev) => [...prev, { role: 'user', text }]);
    }
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/resume-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tailored_resume_id: tailoredResumeId,
          message: text,
          conversation_id: conversationId,
        }),
      });

      if (!res.ok) throw new Error('Failed');
      const data = await res.json();

      setConversationId(data.conversation_id);
      setMessages((prev) => [
        ...prev,
        {
          role: 'pilot',
          text: data.response,
          proposed_changes: data.proposed_changes || [],
        },
      ]);

      if (data.proposed_changes?.length > 0) {
        onChangesProposed?.(data.proposed_changes);
      }

      if (data.stage === 'finalized') {
        onFinalized?.(data.conversation_id);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'pilot', text: 'Hit a wall trying to process that. Try again?' },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleAcceptChange(change) {
    setAcceptedChanges((prev) => [...prev, change]);
    setHandledChangeIds((prev) => new Set([...prev, change.id]));
    // Apply the change immediately via API
    fetch('/api/ai/resume-apply-changes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tailored_resume_id: tailoredResumeId,
        accepted_changes: [change],
      }),
    });
  }

  function handleRejectChange(change) {
    setHandledChangeIds((prev) => new Set([...prev, change.id]));
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                  msg.role === 'user'
                    ? 'bg-emerald-500 text-white rounded-br-md'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-200 rounded-bl-md'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                {/* Proposed changes as inline diff cards */}
                {msg.proposed_changes?.map((change) => (
                  handledChangeIds.has(change.id) ? (
                    <div key={change.id} className="mt-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-slate-700/50">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {acceptedChanges.find((c) => c.id === change.id) ? '✓ Accepted' : '— Skipped'}
                      </p>
                    </div>
                  ) : (
                    <DiffCard
                      key={change.id}
                      change={change}
                      onAccept={handleAcceptChange}
                      onReject={handleRejectChange}
                    />
                  )
                ))}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-gray-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* "Done" button — appears after at least one change is accepted */}
      {acceptedChanges.length > 0 && !loading && (
        <div className="px-4 py-2 border-t border-gray-100 dark:border-slate-800">
          <button
            onClick={() => onFinalized?.(conversationId)}
            className="w-full py-3 rounded-xl bg-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Done — Review &amp; Generate Resume ({acceptedChanges.length} change{acceptedChanges.length !== 1 ? 's' : ''})
          </button>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="px-4 py-3 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900"
      >
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell Pilot about your experience..."
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2.5 rounded-xl bg-emerald-500 text-white disabled:opacity-40 hover:bg-emerald-600 transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
