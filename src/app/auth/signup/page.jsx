'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError('Please fill in all fields.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.replace('/onboarding');
  };

  const handleGoogleSignup = async () => {
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
        scopes: 'email profile',
      },
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-gray-50 dark:bg-slate-950">
      {/* Compact hero — logo + tagline only */}
      <div
        className="bg-gradient-to-br from-violet-600 to-blue-600 flex flex-col items-center justify-end pb-6 px-6 relative overflow-hidden"
        style={{ minHeight: 'calc(6rem + env(safe-area-inset-top, 0px))', paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="absolute inset-0 bg-black/10" />
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative flex items-center gap-2"
        >
          <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
            <span className="text-white font-bold text-xs">CP</span>
          </div>
          <span className="text-white font-semibold text-base">CareerPilot</span>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="flex-1 px-6 -mt-5"
      >
        <div className="card p-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-0.5">Create account</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-5">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-violet-600 dark:text-violet-400 font-medium">
              Sign in
            </Link>
          </p>

          {/* Google — primary path */}
          <button
            onClick={handleGoogleSignup}
            disabled={loading}
            className="w-full py-3.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 font-medium text-sm hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
            <span className="text-gray-400 text-xs">or</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
          </div>

          {/* Email form — secondary path */}
          <form onSubmit={handleSignup} className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                placeholder="Email address"
                value={form.email}
                onChange={update('email')}
                className="input-field pl-10"
                autoComplete="email"
              />
            </div>

            <div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={form.password}
                  onChange={update('password')}
                  className="input-field pl-10 pr-12"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-gray-400 text-xs mt-1.5 ml-1">At least 6 characters</p>
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="btn-gradient w-full py-4 rounded-xl text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><span className="spinner w-4 h-4" /> Creating account…</>
              ) : (
                'Get started'
              )}
            </button>
          </form>

          {/* Value props — above the fold where they can convince */}
          <div className="mt-5 pt-4 border-t border-gray-100 dark:border-slate-800 space-y-2.5">
            {[
              { icon: '🎯', text: 'AI finds high-fit jobs every 4 hours' },
              { icon: '✉️', text: 'Drafts recruiter messages in your voice' },
              { icon: '📋', text: 'Your pipeline updates itself' },
            ].map((f) => (
              <div key={f.icon} className="flex items-center gap-3">
                <span className="text-base">{f.icon}</span>
                <span className="text-gray-600 dark:text-gray-300 text-sm">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-gray-400 text-xs mt-4 pb-8">
          By signing up, you agree to our{' '}
          <Link href="/terms" className="underline hover:text-gray-600">Terms</Link>
          {' '}and{' '}
          <Link href="/privacy" className="underline hover:text-gray-600">Privacy Policy</Link>
        </p>
      </motion.div>
    </div>
  );
}
