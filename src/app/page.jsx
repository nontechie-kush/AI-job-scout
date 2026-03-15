'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

const PILOT_LINES = [
  "Yeah, I see you.",
  "Poke me again. I dare you.",
  "Alright. I'm paying attention.",
  "You done? Let's get to work.",
  "I don't flinch. Just so you know.",
  "Still here. Waiting on you.",
  "That's it. Good. Now sign up.",
];

const IDLE_LINES = [
  "Your next job is already out there.",
  "I find. You decide.",
  "No spray-and-pray. Just signal.",
  "Built different. For people who want different.",
];

export default function SplashPage() {
  const router = useRouter();
  const [pokeCount, setPokeCount] = useState(0);
  const [pilotLine, setPilotLine] = useState(null);
  const [isPoking, setIsPoking] = useState(false);
  const [idleLineIndex, setIdleLineIndex] = useState(0);
  const [checking, setChecking] = useState(true);
  const pokeCountRef = useRef(0);

  // Check auth on mount — redirect if already logged in
  useEffect(() => {
    const supabase = createClient();
    const timeout = setTimeout(() => setChecking(false), 800);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout);
      if (session) {
        supabase
          .from('users')
          .select('onboarding_completed')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            if (data?.onboarding_completed) {
              router.replace('/dashboard');
            } else {
              router.replace('/onboarding');
            }
          });
      } else {
        setChecking(false);
      }
    }).catch(() => {
      clearTimeout(timeout);
      setChecking(false);
    });
  }, [router]);

  // Cycle idle lines
  useEffect(() => {
    if (checking) return;
    const interval = setInterval(() => {
      if (!pilotLine) {
        setIdleLineIndex((i) => (i + 1) % IDLE_LINES.length);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [checking, pilotLine]);

  // Clear pilot line after a delay
  useEffect(() => {
    if (!pilotLine) return;
    const t = setTimeout(() => setPilotLine(null), 3000);
    return () => clearTimeout(t);
  }, [pilotLine]);

  function handlePoke() {
    if (isPoking) return;
    setIsPoking(true);
    pokeCountRef.current += 1;
    setPokeCount(pokeCountRef.current);

    const lineIndex = Math.min(pokeCountRef.current - 1, PILOT_LINES.length - 1);
    setPilotLine(PILOT_LINES[lineIndex]);

    setTimeout(() => setIsPoking(false), 400);
  }

  if (checking) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-violet-400"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950 relative overflow-hidden select-none">
      {/* Background orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Brand name */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="mb-12 text-center"
      >
        <h1 className="text-2xl font-bold text-white tracking-tight">
          CareerPilot<span className="text-violet-400"> AI</span>
        </h1>
      </motion.div>

      {/* Pilot speech bubble */}
      <div className="h-12 mb-6 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {pilotLine ? (
            <motion.div
              key={pilotLine}
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-white/10 border border-white/15 backdrop-blur-sm rounded-2xl px-5 py-2.5"
            >
              <p className="text-white text-sm font-medium">{pilotLine}</p>
            </motion.div>
          ) : (
            <motion.p
              key={`idle-${idleLineIndex}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="text-gray-500 text-sm"
            >
              {IDLE_LINES[idleLineIndex]}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Pilot character — tap to poke */}
      <motion.button
        onClick={handlePoke}
        whileTap={{ scale: 0.88 }}
        animate={isPoking ? {
          rotate: [0, -8, 8, -5, 5, 0],
          scale: [1, 1.12, 0.95, 1.06, 0.98, 1],
        } : {
          y: [0, -6, 0],
        }}
        transition={isPoking ? {
          duration: 0.4,
          ease: 'easeInOut',
        } : {
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="relative w-32 h-32 focus:outline-none cursor-pointer"
        aria-label="Poke Pilot"
      >
        {/* Glow ring */}
        <motion.div
          className="absolute inset-0 rounded-full bg-violet-500/25"
          animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.15, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Pilot avatar */}
        <div className="relative w-full h-full rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-violet-500/40">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Helmet */}
            <circle cx="32" cy="28" r="18" fill="white" fillOpacity="0.15" stroke="white" strokeOpacity="0.4" strokeWidth="1.5"/>
            {/* Visor */}
            <path d="M20 28 Q20 20 32 20 Q44 20 44 28 Q44 36 32 38 Q20 36 20 28Z" fill="white" fillOpacity="0.25"/>
            {/* Face */}
            <circle cx="27" cy="27" r="2" fill="white" fillOpacity="0.9"/>
            <circle cx="37" cy="27" r="2" fill="white" fillOpacity="0.9"/>
            {/* Smile */}
            <path d="M27 33 Q32 37 37 33" stroke="white" strokeOpacity="0.8" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
            {/* Suit collar */}
            <path d="M20 44 Q24 40 32 40 Q40 40 44 44 L46 56 Q32 60 18 56 Z" fill="white" fillOpacity="0.2"/>
            {/* Chest badge */}
            <rect x="28" y="45" width="8" height="5" rx="1" fill="white" fillOpacity="0.4"/>
          </svg>
        </div>

        {/* Tap hint on first visit */}
        {pokeCount === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ delay: 1.5, duration: 1.5, repeat: 3 }}
            className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap"
          >
            <span className="text-gray-500 text-xs">tap me</span>
          </motion.div>
        )}
      </motion.button>

      {/* Value props — always visible */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="mt-10 flex flex-col items-center gap-5 px-6 max-w-xs w-full"
      >
        {/* Hook */}
        <div className="text-center">
          <p className="text-white font-semibold text-lg leading-snug">
            Pilot handles the boring parts.
          </p>
          <p className="text-gray-400 text-sm mt-1 leading-relaxed">
            So you spend your time preparing — not searching.
          </p>
        </div>

        {/* Props */}
        <div className="flex flex-col gap-2.5 w-full">
          {[
            {
              icon: '🌐',
              label: 'Jobs, auto-searched',
              sub: 'Every portal. Every 4 hours. Only the best matches land in your feed.',
            },
            {
              icon: '🤝',
              label: 'Referrals, auto-ranked',
              sub: 'Quality recruiters and hiring managers — sorted by who\'ll actually respond.',
            },
            {
              icon: '⚡',
              label: 'Applications, pre-filled',
              sub: 'Pilot researches the role and writes your answers. You just review and send.',
            },
          ].map(({ icon, label, sub }) => (
            <div key={label} className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5">
              <span className="text-xl mt-0.5">{icon}</span>
              <div>
                <p className="text-white text-sm font-semibold">{label}</p>
                <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={() => router.push('/auth/signup')}
          className="btn-gradient w-full py-4 rounded-2xl text-white font-semibold text-base shadow-lg shadow-violet-500/30"
        >
          Start free →
        </button>
        <button
          onClick={() => router.push('/auth/login')}
          className="text-gray-500 text-sm hover:text-gray-400 transition-colors -mt-1"
        >
          Already have an account
        </button>
      </motion.div>
    </div>
  );
}
