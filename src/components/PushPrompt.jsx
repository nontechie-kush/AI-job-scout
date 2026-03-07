'use client';

/**
 * PushPrompt — native-feeling push permission request.
 *
 * Shows after 3 seconds on dashboard if:
 *   - Browser supports push
 *   - Notification.permission === 'default' (not yet decided)
 *   - iOS: only shown if already in standalone mode (PWA installed)
 *
 * Pilot voice: "Only when something actually matters."
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

// forceShow — skip delay and iOS checks (used from settings/profile page)
export default function PushPrompt({ onSubscribed, forceShow = false }) {
  const [show, setShow] = useState(!!forceShow);
  const [step, setStep] = useState('prompt'); // 'prompt' | 'requesting' | 'done'

  useEffect(() => {
    if (forceShow) { setShow(true); return; }

    // Feature check
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'default') return;

    // VAPID key must be configured
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;

    // iOS requires PWA standalone mode for push
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone;
    if (isIOS && !isStandalone) return;

    // Show after 3 seconds
    const t = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(t);
  }, [forceShow]);

  const handleEnable = async () => {
    setStep('requesting');
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setShow(false);
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      });

      // Save to server — fire and forget (non-blocking)
      fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      }).catch(console.error);

      setStep('done');
      setTimeout(() => {
        setShow(false);
        onSubscribed?.();
      }, 1800);
    } catch (err) {
      console.error('[PushPrompt]', err);
      setShow(false);
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-50 flex items-end pointer-events-none">
          <div
            className="absolute inset-0 bg-black/30 pointer-events-auto"
            onClick={() => setShow(false)}
          />
          <motion.div
            className="relative w-full bg-white dark:bg-slate-900 rounded-t-2xl px-5 pt-5 pointer-events-auto"
            style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom, 32px))' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            <button
              onClick={() => setShow(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>

            {step === 'done' ? (
              <div className="text-center py-6">
                <p className="text-3xl mb-2">✓</p>
                <p className="font-semibold text-gray-900 dark:text-white">Pilot will reach you.</p>
                <p className="text-sm text-gray-400 mt-1">Only when it matters.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-11 h-11 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                    <Bell className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">
                      Pilot wants to reach you
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Only when something actually matters.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mb-5">
                  {[
                    { icon: '📨', text: 'When they reply to your application' },
                    { icon: '📅', text: 'Interview invites from ATS emails' },
                    { icon: '🎯', text: 'New high-fit matches (you set the cadence)' },
                  ].map((item) => (
                    <div
                      key={item.text}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800"
                    >
                      <span className="text-lg">{item.icon}</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{item.text}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleEnable}
                  disabled={step === 'requesting'}
                  className="btn-gradient w-full py-3.5 rounded-xl text-white font-semibold text-sm disabled:opacity-70"
                >
                  {step === 'requesting' ? 'Setting up…' : 'Turn on notifications'}
                </button>
                <button
                  onClick={() => setShow(false)}
                  className="w-full mt-2 py-2.5 text-sm text-gray-400"
                >
                  Not now
                </button>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
