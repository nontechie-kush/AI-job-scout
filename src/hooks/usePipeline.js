'use client';

/**
 * usePipeline — fetches user's pipeline from /api/pipeline/list
 *
 * Usage:
 *   const { pipeline, activeCount, total, loading, refresh } = usePipeline()
 */

import { useState, useEffect, useCallback } from 'react';

export function usePipeline() {
  const [pipeline, setPipeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPipeline = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/pipeline/list');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPipeline(data.pipeline || []);
    } catch (err) {
      setError(err.message);
      setPipeline([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  const activeCount = pipeline.filter(
    (p) => !['rejected', 'ghosted'].includes(p.stage),
  ).length;

  return {
    pipeline,
    activeCount,
    total: pipeline.length,
    loading,
    error,
    refresh: fetchPipeline,
  };
}
