'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Eye, EyeOff, Sun, Moon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import useStore from '@/store/useStore';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const darkMode = useStore((s) => s.darkMode);
  const toggleDarkMode = useStore((s) => s.toggleDarkMode);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const inputCls = `w-full rounded-xl px-4 py-3 text-sm outline-none transition-all ${darkMode ? 'bg-[hsl(240,5%,8%)] border border-white/[0.08] text-white placeholder:text-slate-600 focus:ring-1 focus:ring-emerald-400/40' : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20'}`;

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) { setError(authError.message); setLoading(false); return; }

    const { data: userRow } = await supabase
      .from('users')
      .select('onboarding_completed')
      .single();

    router.replace(userRow?.onboarding_completed ? '/dashboard' : '/onboarding');
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
        scopes: 'email profile',
      },
    });
    if (authError) { setError(authError.message); setLoading(false); }
  };

  const handleForgotPassword = async () => {
    if (!email) { setError('Enter your email first.'); return; }
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setError('');
    setResetSent(true);
  };

  return (
    <div className={`min-h-dvh flex flex-col lg:flex-row transition-colors ${darkMode ? 'bg-slate-950' : 'bg-white'}`}
      style={{ fontFamily: "'Outfit', -apple-system, sans-serif" }}>

      {/* ── Left panel — desktop only ── */}
      <div className={`hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col justify-between p-10 xl:p-14 relative overflow-hidden ${darkMode ? 'bg-[hsl(240,7%,5%)]' : 'bg-gradient-to-br from-emerald-50 to-white'}`}>
        <Link href="/" className={`flex items-center gap-2.5 font-bold text-base tracking-tight w-fit ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          <div className="w-[28px] h-[28px] rounded-[8px] bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-[14px] font-extrabold text-white">
            C
          </div>
          CareerPilot
        </Link>

        <div className="relative">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-6 ${darkMode ? 'bg-emerald-400/10 border border-emerald-400/20 text-emerald-400' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-blink" />
              Pilot is scanning right now
            </div>

            <h1 className={`text-[40px] xl:text-[48px] font-extrabold tracking-[-0.045em] leading-[1.06] mb-5 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Welcome{' '}
              <span className="text-emerald-600">back.</span>
            </h1>

            <p className={`text-[15px] leading-relaxed max-w-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
              Your pipeline, recruiter outreach, and job matches are waiting.
            </p>
          </motion.div>
        </div>

        <p className={`text-xs ${darkMode ? 'text-slate-600' : 'text-gray-400'}`}>
          By continuing, you agree to our Terms &amp; Privacy Policy
        </p>
      </div>

      {/* ── Right panel ── */}
      <div className={`flex-1 flex flex-col items-center justify-center px-5 py-10 lg:py-0 ${darkMode ? 'bg-slate-950' : 'bg-white'}`}>

        {/* Mobile header */}
        <div className="flex items-center justify-between w-full max-w-[400px] mb-8 lg:hidden">
          <Link href="/" className={`flex items-center gap-2 font-bold text-base tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            <div className="w-[26px] h-[26px] rounded-[7px] bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-[13px] font-extrabold text-white">
              C
            </div>
            CareerPilot
          </Link>
          <button
            onClick={toggleDarkMode}
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${darkMode ? 'text-slate-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="w-full max-w-[400px]"
        >
          <h2 className={`text-2xl font-bold mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Sign in</h2>
          <p className={`text-sm mb-7 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="text-emerald-600 font-medium hover:text-emerald-700">
              Sign up
            </Link>
          </p>

          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className={`block text-xs font-medium mb-1.5 uppercase tracking-wider ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className={inputCls}
              />
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1.5 uppercase tracking-wider ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className={`${inputCls} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={handleForgotPassword}
                className={`text-xs transition-colors ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Forgot password?
              </button>
            </div>

            {resetSent && (
              <p className="text-emerald-600 text-xs text-center">Reset link sent — check your inbox.</p>
            )}
            {error && <p className="text-red-500 text-xs text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-colors hover:bg-emerald-700 active:scale-[0.98] mt-1"
            >
              {loading ? (
                <><span className="spinner w-4 h-4" /> Signing in…</>
              ) : (
                'Sign in →'
              )}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className={`flex-1 h-px ${darkMode ? 'bg-white/[0.07]' : 'bg-gray-200'}`} />
            <span className={`text-xs ${darkMode ? 'text-slate-600' : 'text-gray-400'}`}>or</span>
            <div className={`flex-1 h-px ${darkMode ? 'bg-white/[0.07]' : 'bg-gray-200'}`} />
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className={`w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2.5 disabled:opacity-50 transition-colors ${darkMode ? 'bg-[hsl(240,5%,10%)] border border-white/[0.09] text-white' : 'bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100'}`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <p className={`text-center text-xs mt-7 lg:hidden ${darkMode ? 'text-slate-600' : 'text-gray-400'}`}>
            By continuing, you agree to our Terms &amp; Privacy Policy
          </p>
        </motion.div>
      </div>
    </div>
  );
}
