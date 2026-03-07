'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const THRESHOLD = 65; // px pulled before triggering refresh

export function usePullToRefresh(onRefresh) {
  const [pullY, setPullY] = useState(0);       // 0–THRESHOLD (for indicator scale)
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef(null);
  const pullingRef = useRef(false);

  const handleTouchStart = useCallback((e) => {
    // Only activate if already scrolled to top
    if (window.scrollY > 0) return;
    startYRef.current = e.touches[0].clientY;
    pullingRef.current = true;
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!pullingRef.current || startYRef.current === null) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta <= 0) { setPullY(0); return; }
    // Dampen: feels natural, not 1:1 with finger
    setPullY(Math.min(THRESHOLD, delta * 0.5));
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (!pullingRef.current) return;
    pullingRef.current = false;
    startYRef.current = null;

    if (pullY >= THRESHOLD) {
      setRefreshing(true);
      setPullY(0);
      try { await onRefresh(); } finally { setRefreshing(false); }
    } else {
      setPullY(0);
    }
  }, [pullY, onRefresh]);

  useEffect(() => {
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { pullY, refreshing, progress: pullY / THRESHOLD }; // progress 0–1
}
