'use client';

/**
 * useJobs — fetches and manages user's job matches from /api/jobs/matches
 *
 * Usage:
 *   const { matches, total, loading, error, refresh, dismiss, save, markApplied } = useJobs()
 *   const { matches } = useJobs({ status: 'saved', minScore: 70, limit: 10 })
 */

import { useState, useEffect, useCallback } from 'react';

export function useJobs({ status = 'pending', limit = 20, offset = 0, minScore = 0 } = {}) {
  const [matches, setMatches] = useState([]);
  const [total, setTotal] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [excellentCount, setExcellentCount] = useState(0);
  const [goodCount, setGoodCount] = useState(0);
  const [othersCount, setOthersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        status,
        limit: String(limit),
        offset: String(offset),
        min_score: String(minScore),
      });
      const res = await fetch(`/api/jobs/matches?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMatches(data.matches || []);
      setTotal(data.total || 0);
      setNewCount(data.new_count || 0);
      setExcellentCount(data.excellent_count || 0);
      setGoodCount(data.good_count || 0);
      setOthersCount(data.others_count || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [status, limit, offset, minScore]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  // Dismiss a job — optimistic remove + API call
  const dismiss = useCallback(async (matchId, reason = 'not_interested') => {
    setMatches((prev) => prev.filter((m) => m.id !== matchId));
    setTotal((prev) => Math.max(0, prev - 1));
    await fetch('/api/jobs/matches', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: matchId, status: 'dismissed', dismissed_reason: reason }),
    });
  }, []);

  // Save a job — optimistic status update
  const save = useCallback(async (matchId) => {
    setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, status: 'saved' } : m)));
    await fetch('/api/jobs/matches', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: matchId, status: 'saved' }),
    });
  }, []);

  // Mark as applied — optimistic status update
  const markApplied = useCallback(async (matchId) => {
    setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, status: 'applied' } : m)));
    await fetch('/api/jobs/matches', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: matchId, status: 'applied' }),
    });
  }, []);

  // Mark as viewed (called when user opens a job card)
  const markViewed = useCallback(async (matchId) => {
    await fetch('/api/jobs/matches', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: matchId, status: 'viewed' }),
    });
  }, []);

  return {
    matches,
    total,
    newCount,
    excellentCount,
    goodCount,
    othersCount,
    loading,
    error,
    refresh: fetchMatches,
    dismiss,
    save,
    markApplied,
    markViewed,
  };
}
