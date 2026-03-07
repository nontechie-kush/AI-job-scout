'use client';

import { useEffect } from 'react';
import useStore from '@/store/useStore';

export default function Providers({ children }) {
  const darkMode = useStore((s) => s.darkMode);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  return <>{children}</>;
}
