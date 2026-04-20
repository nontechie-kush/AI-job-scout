'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Eye, EyeOff, Upload, Globe, FileText, ChevronRight,
  CheckCircle2, AlertCircle, Shield, Sun, Moon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import useStore from '@/store/useStore';

// ── Shared ────────────────────────────────────────────────────
function GreenBtn({ onClick, disabled, children, type = 'button', className = '' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-3.5 rounded-xl bg-emerald-600 text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2 transition-colors hover:bg-emerald-700 active:scale-[0.98] ${className}`}
    >
      {children}
    </button>
  );
}

function extractEmailFromText(text) {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : '';
}

async function extractTextFromPdf(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const rawText = decoder.decode(uint8);
    const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) return emailMatch[0];
    const matches = rawText.match(/\(([^)]{1,200})\)/g);
    if (matches) {
      const text = matches.map(m => m.slice(1, -1)).join(' ');
      return extractEmailFromText(text);
    }
    return '';
  } catch {
    return '';
  }
}

// ══════════════════════════════════════════════════════════════
// INNER COMPONENT (needs useSearchParams)
// ══════════════════════════════════════════════════════════════
function SignupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const darkMode = useStore((s) => s.darkMode);
  const toggleDarkMode = useStore((s) => s.toggleDarkMode);

  // Determine initial phase from URL params (coming from landing page)
  const methodParam = searchParams.get('method');
  const hasImportData = typeof window !== 'undefined' && sessionStorage.getItem('careerpilot_import');

  // If coming from landing page with a file/url, go straight to account creation
  const initialPhase = (methodParam === 'pdf' || methodParam === 'website') && hasImportData ? 'account' : (methodParam === 'manual' ? 'manual' : 'import');

  const [phase, setPhase] = useState(initialPhase);

  // Import state
  const [importMethod, setImportMethod] = useState(methodParam || null);
  const [heldFile, setHeldFile] = useState(null);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [extractedEmail, setExtractedEmail] = useState('');
  const [fileName, setFileName] = useState('');

  // Manual path state
  const [manualData, setManualData] = useState({ name: '', title: '', years_exp: '', skills: '', summary: '' });

  // Account state
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Processing state
  const [pilotLines, setPilotLines] = useState([]);
  const [processingDone, setProcessingDone] = useState(false);
  const [processingError, setProcessingError] = useState(false);

  const fileInputRef = useRef(null);
  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // Load import data from sessionStorage (set by landing page)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('careerpilot_import');
      if (stored) {
        const data = JSON.parse(stored);
        if (data.method) setImportMethod(data.method);
        if (data.url) setWebsiteUrl(data.url);
        if (data.fileName) setFileName(data.fileName);
        if (data.text) setPasteText(data.text);
        if (data.showPaste) setPhase('import'); // paste method needs text entry
      }
      // Try to get file from landing page
      if (window.__careerpilot_file) {
        setHeldFile(window.__careerpilot_file);
        setFileName(window.__careerpilot_file.name);
        // Try to extract email
        if (window.__careerpilot_file.name?.toLowerCase().endsWith('.pdf')) {
          extractTextFromPdf(window.__careerpilot_file).then(email => {
            if (email) {
              setExtractedEmail(email);
              setForm(f => ({ ...f, email }));
            }
          });
        }
        delete window.__careerpilot_file;
      }
    } catch {}
  }, []);

  // Drag & drop
  const [dragOver, setDragOver] = useState(false);
  const handleDragOver = useCallback((e) => { e.preventDefault(); setDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setDragOver(false), []);
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  }, []);

  const handleFileSelected = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('File too large. Keep it under 5MB.'); return; }
    const ext = file.name?.toLowerCase();
    if (!ext.endsWith('.pdf') && !ext.endsWith('.docx')) { setError('Please upload a PDF or DOCX file.'); return; }
    setError('');
    setHeldFile(file);
    setFileName(file.name);
    setImportMethod('pdf');
    if (ext.endsWith('.pdf')) {
      const email = await extractTextFromPdf(file);
      if (email) {
        setExtractedEmail(email);
        setForm(f => ({ ...f, email }));
      }
    }
    setPhase('account');
  };

  const handleWebsiteSubmit = () => {
    const url = websiteUrl.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) setWebsiteUrl('https://' + url);
    setImportMethod('website');
    setPhase('account');
  };

  const handlePasteSubmit = () => {
    if (pasteText.trim().length < 50) { setError('Please paste more text — at least a few sentences.'); return; }
    setError('');
    setImportMethod('paste');
    setPhase('account');
  };

  const handleManualSubmit = () => {
    if (!manualData.name.trim() || !manualData.title.trim()) { setError('Name and title are required.'); return; }
    setError('');
    setImportMethod('manual');
    setPhase('account');
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError('Please fill in all fields.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    setError('');

    const { data: signUpData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (authError) { setError(authError.message); setLoading(false); return; }
    if (!signUpData?.session) {
      setLoading(false);
      setError('Check your email and confirm your account, then sign in.');
      return;
    }
    await runParsing();
  };

  const handleGoogleSignup = async () => {
    if (importMethod && importMethod !== 'manual') {
      const importData = { method: importMethod };
      if (importMethod === 'website') importData.url = websiteUrl.trim();
      if (importMethod === 'paste') importData.text = pasteText.trim();
      if (importMethod === 'pdf') importData.needsReupload = true;
      sessionStorage.setItem('careerpilot_import', JSON.stringify(importData));
    }
    if (importMethod === 'manual') {
      sessionStorage.setItem('careerpilot_manual', JSON.stringify(manualData));
    }

    setLoading(true);
    // Preserve the redirect destination (e.g. rolepitch flow) through OAuth round-trip
    const redirectParam = searchParams.get('redirect') || '';
    const stepParam = searchParams.get('step') || '';
    const trParam = searchParams.get('tr') || '';
    const sourceParam = searchParams.get('source') || '';
    let nextUrl = '/dashboard';
    if (redirectParam) {
      const qs = new URLSearchParams();
      if (stepParam) qs.set('step', stepParam);
      if (trParam) qs.set('tr', trParam);
      if (sourceParam) qs.set('source', sourceParam);
      nextUrl = redirectParam + (qs.toString() ? '?' + qs.toString() : '');
    }
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(nextUrl)}`,
        scopes: 'email profile',
      },
    });
    if (authError) { setError(authError.message); setLoading(false); }
  };

  const runParsing = async () => {
    setPhase('processing');
    setPilotLines([]);
    setProcessingDone(false);
    setProcessingError(false);

    const linesByType = {
      pdf: ['Reading your resume...', 'Pulling out your experience...', 'Mapping your skills...', 'Got it.'],
      website: ['Hitting your portfolio...', 'Reading through your work...', 'Extracting what matters...', 'Done.'],
      paste: ['Going through what you shared...', 'Pulling out the signal...', 'Mapping your background...', 'Done.'],
      manual: ['Saving your details...', 'Building your profile...', 'Done.'],
    };
    const lines = linesByType[importMethod] || linesByType.paste;

    const linePromise = (async () => {
      for (let i = 0; i < lines.length - 1; i++) {
        await new Promise((r) => setTimeout(r, 600 + i * 400));
        setPilotLines((prev) => [...prev, lines[i]]);
      }
    })();

    try {
      if (importMethod === 'manual') {
        await linePromise;
        setPilotLines((prev) => [...prev, lines[lines.length - 1]]);
        await new Promise((r) => setTimeout(r, 400));
        sessionStorage.setItem('careerpilot_manual', JSON.stringify(manualData));
        setProcessingDone(true);
        return;
      }

      const fd = new FormData();
      if (importMethod === 'pdf' && heldFile) {
        const isDocx = heldFile.name?.toLowerCase().endsWith('.docx');
        fd.append('type', isDocx ? 'docx' : 'pdf');
        fd.append('file', heldFile);
      } else if (importMethod === 'website') {
        fd.append('type', 'website');
        fd.append('url', websiteUrl.trim().startsWith('http') ? websiteUrl.trim() : 'https://' + websiteUrl.trim());
      } else if (importMethod === 'paste') {
        fd.append('type', 'paste');
        fd.append('text', pasteText.trim());
      }

      const res = await fetch('/api/onboarding/parse-profile', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Parse failed');

      await linePromise;
      setPilotLines((prev) => [...prev, lines[lines.length - 1]]);
      await new Promise((r) => setTimeout(r, 400));
      setProcessingDone(true);
    } catch {
      await linePromise;
      setPilotLines((prev) => [...prev, 'Something went sideways. No worries — you can redo this.']);
      setProcessingError(true);
    }
  };

  const goToOnboarding = () => router.replace('/onboarding?skip=1');

  // ── Style helpers ──
  const inputCls = `w-full rounded-xl px-4 py-3 text-sm outline-none transition-all ${darkMode ? 'bg-[hsl(240,5%,8%)] border border-white/[0.08] text-white placeholder:text-slate-600 focus:ring-1 focus:ring-emerald-400/40' : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20'}`;

  return (
    <div className={`min-h-dvh flex flex-col transition-colors ${darkMode ? 'bg-slate-950' : 'bg-white'}`}
      style={{ fontFamily: "'Outfit', -apple-system, sans-serif" }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between w-full max-w-[520px] mx-auto px-5 pt-6 pb-2">
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

      {/* ── Main content ── */}
      <div className={`flex-1 flex flex-col items-center px-5 py-4 overflow-y-auto ${darkMode ? 'bg-slate-950' : 'bg-white'}`}>

        <div className="w-full max-w-[520px]">
          <AnimatePresence mode="wait">

            {/* ── PHASE 1: IMPORT ── */}
            {phase === 'import' && (
              <motion.div key="import" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>
                <h2 className={`text-2xl font-bold mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Get started</h2>
                <p className={`text-sm mb-6 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                  Import your profile — we&apos;ll handle the rest.{' '}
                  <Link href="/auth/login" className="text-emerald-600 font-medium hover:text-emerald-700">
                    Already have an account?
                  </Link>
                </p>

                {/* Upload */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`w-full rounded-2xl p-7 flex flex-col items-center gap-3 transition-all active:scale-[0.98] ${dragOver ? 'scale-[1.01]' : ''}`}
                  style={{
                    background: darkMode ? (dragOver ? 'rgba(16,185,129,0.05)' : 'hsl(240 5% 7%)') : (dragOver ? 'rgba(16,185,129,0.04)' : '#fafafa'),
                    border: `2px dashed ${dragOver ? 'rgba(16,185,129,0.6)' : (darkMode ? 'rgba(255,255,255,0.1)' : '#d1d5db')}`,
                  }}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${darkMode ? 'bg-emerald-400/10' : 'bg-emerald-50'}`}>
                    <Upload className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="text-center">
                    <p className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>Drop your resume here</p>
                    <p className={`text-xs mt-1 ${darkMode ? 'text-slate-500' : 'text-gray-500'}`}>PDF or Word (.docx) · Up to 5MB</p>
                  </div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
                />

                <p className={`text-center text-[11px] mt-2.5 flex items-center justify-center gap-1 ${darkMode ? 'text-slate-600' : 'text-gray-400'}`}>
                  <Shield className="w-3 h-3" /> Encrypted. Never shared.
                </p>

                {/* Divider */}
                <div className="flex items-center gap-3 my-5">
                  <div className={`flex-1 h-px ${darkMode ? 'bg-white/[0.07]' : 'bg-gray-200'}`} />
                  <span className={`text-xs ${darkMode ? 'text-slate-600' : 'text-gray-400'}`}>or import from</span>
                  <div className={`flex-1 h-px ${darkMode ? 'bg-white/[0.07]' : 'bg-gray-200'}`} />
                </div>

                {/* Website URL */}
                <div className="flex gap-2 mb-3">
                  <div className="relative flex-1">
                    <Globe className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`} />
                    <input
                      type="url"
                      placeholder="Portfolio or website URL"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleWebsiteSubmit()}
                      className={`${inputCls} pl-10`}
                    />
                  </div>
                  <button
                    onClick={handleWebsiteSubmit}
                    disabled={!websiteUrl.trim()}
                    className="px-4 rounded-xl bg-emerald-600 text-white font-bold text-sm disabled:opacity-40 hover:bg-emerald-700 transition-colors"
                  >
                    Go
                  </button>
                </div>

                {/* Paste */}
                <details className="group mb-4">
                  <summary className={`text-sm cursor-pointer flex items-center gap-1.5 list-none select-none transition-colors ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-gray-500 hover:text-gray-700'}`}>
                    <FileText className="w-3.5 h-3.5" /> Paste resume text instead
                  </summary>
                  <div className="mt-3 flex flex-col gap-2">
                    <textarea
                      rows={4}
                      placeholder="Paste your resume or profile text here..."
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      className={`${inputCls} resize-none`}
                    />
                    <GreenBtn onClick={handlePasteSubmit} disabled={pasteText.trim().length < 50}>
                      Continue
                    </GreenBtn>
                  </div>
                </details>

                {/* Manual */}
                <button
                  onClick={() => setPhase('manual')}
                  className={`w-full text-center text-xs py-2 ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Don&apos;t have a resume? <span className="underline underline-offset-2">Fill in details manually</span>
                </button>

                <p className={`text-center text-[10px] mt-3 ${darkMode ? 'text-slate-600' : 'text-gray-400'}`}>
                  LinkedIn user? Go to Settings → Save as PDF → upload here
                </p>

                {error && (
                  <p className="text-red-500 text-xs text-center mt-3 flex items-center justify-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {error}
                  </p>
                )}
              </motion.div>
            )}

            {/* ── PHASE: MANUAL ── */}
            {phase === 'manual' && (
              <motion.div key="manual" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>
                <button onClick={() => setPhase('import')} className={`text-xs mb-4 flex items-center gap-1 ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-gray-500 hover:text-gray-700'}`}>
                  ← Back to import
                </button>
                <h2 className={`text-2xl font-bold mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Tell us about yourself</h2>
                <p className={`text-sm mb-6 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>We&apos;ll build your profile from this.</p>

                <div className="space-y-3">
                  {[
                    { key: 'name', label: 'Full name *', placeholder: 'John Doe', type: 'text' },
                    { key: 'title', label: 'Current or target title *', placeholder: 'Product Manager, Software Engineer, etc.', type: 'text' },
                    { key: 'years_exp', label: 'Years of experience', placeholder: 'e.g. 5', type: 'number' },
                    { key: 'skills', label: 'Key skills', placeholder: 'e.g. Python, Product Strategy, SQL, Figma', type: 'text' },
                  ].map(({ key, label, placeholder, type }) => (
                    <div key={key}>
                      <label className={`block text-xs font-medium mb-1.5 uppercase tracking-wider ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>{label}</label>
                      <input
                        type={type}
                        placeholder={placeholder}
                        value={manualData[key]}
                        onChange={(e) => setManualData(d => ({ ...d, [key]: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                  ))}
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 uppercase tracking-wider ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>Brief summary</label>
                    <textarea
                      rows={3}
                      placeholder="A few sentences about your experience..."
                      value={manualData.summary}
                      onChange={(e) => setManualData(d => ({ ...d, summary: e.target.value }))}
                      className={`${inputCls} resize-none`}
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-red-500 text-xs text-center mt-3 flex items-center justify-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {error}
                  </p>
                )}

                <div className="mt-4">
                  <GreenBtn onClick={handleManualSubmit} disabled={!manualData.name.trim() || !manualData.title.trim()}>
                    Continue → Create account
                  </GreenBtn>
                </div>
              </motion.div>
            )}

            {/* ── PHASE 2: ACCOUNT ── */}
            {phase === 'account' && (
              <motion.div key="account" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>
                <button onClick={() => { setPhase('import'); setImportMethod(null); setError(''); }} className={`text-xs mb-4 flex items-center gap-1 ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-gray-500 hover:text-gray-700'}`}>
                  ← Change import
                </button>

                {/* What was imported */}
                <div className={`rounded-xl p-3 flex items-center gap-3 mb-5 ${darkMode ? 'bg-[hsl(240,5%,8%)] border border-emerald-400/20' : 'bg-emerald-50 border border-emerald-200'}`}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {importMethod === 'pdf' && `${fileName || 'Resume uploaded'}`}
                      {importMethod === 'website' && `${websiteUrl}`}
                      {importMethod === 'paste' && 'Text pasted'}
                      {importMethod === 'manual' && `${manualData.name} · ${manualData.title}`}
                    </span>
                    <span className={`text-xs ml-2 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>Ready to parse</span>
                  </div>
                </div>

                <h2 className={`text-2xl font-bold mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Create your account</h2>
                <p className={`text-sm mb-5 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                  {extractedEmail ? `We found ${extractedEmail} in your resume.` : 'Then we\'ll parse your profile and get you started.'}
                  {' '}
                  <Link href="/auth/login" className="text-emerald-600 font-medium hover:text-emerald-700">
                    Already have an account?
                  </Link>
                </p>

                {/* Google */}
                <button
                  onClick={handleGoogleSignup}
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

                <div className="flex items-center gap-3 my-5">
                  <div className={`flex-1 h-px ${darkMode ? 'bg-white/[0.07]' : 'bg-gray-200'}`} />
                  <span className={`text-xs ${darkMode ? 'text-slate-600' : 'text-gray-400'}`}>or</span>
                  <div className={`flex-1 h-px ${darkMode ? 'bg-white/[0.07]' : 'bg-gray-200'}`} />
                </div>

                {/* Email/password */}
                <form onSubmit={handleSignup} className="space-y-3">
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 uppercase tracking-wider ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>Email</label>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={update('email')}
                      autoComplete="email"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 uppercase tracking-wider ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Min. 6 characters"
                        value={form.password}
                        onChange={update('password')}
                        autoComplete="new-password"
                        className={`${inputCls} pr-11`}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'}`}>
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <p className="text-red-500 text-xs text-center flex items-center justify-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {error}
                    </p>
                  )}

                  <GreenBtn type="submit" disabled={loading}>
                    {loading ? <><span className="spinner w-4 h-4" /> Creating account…</> : 'Get started →'}
                  </GreenBtn>
                </form>

              </motion.div>
            )}

            {/* ── PHASE 3: PROCESSING ── */}
            {phase === 'processing' && (
              <motion.div key="processing" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-2">Pilot</p>
                <h2 className={`text-2xl font-bold mb-5 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {processingDone ? 'Got it. You\'re in.' : processingError ? 'Hit a wall.' : 'On it.'}
                </h2>

                <div className={`rounded-2xl p-5 space-y-3 min-h-[160px] border ${darkMode ? 'bg-[hsl(240,5%,8%)] border-white/[0.07]' : 'bg-gray-50 border-gray-200'}`}>
                  {!processingDone && !processingError && (
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-4 h-4 spinner flex-shrink-0" />
                      <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>Reading your profile...</span>
                    </div>
                  )}
                  {pilotLines.map((line, i) => (
                    <motion.p key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}
                      className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                      {line}
                    </motion.p>
                  ))}
                </div>

                {processingDone && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-3">
                    <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Profile saved. Let&apos;s set your preferences.</p>
                    <GreenBtn onClick={goToOnboarding}>
                      Set preferences <ChevronRight className="w-4 h-4" />
                    </GreenBtn>
                  </motion.div>
                )}

                {processingError && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-3">
                    <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>No worries — you can redo this in onboarding.</p>
                    <GreenBtn onClick={() => router.replace('/onboarding')}>
                      Continue to onboarding <ChevronRight className="w-4 h-4" />
                    </GreenBtn>
                  </motion.div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        <p className={`text-center text-xs mt-8 ${darkMode ? 'text-slate-600' : 'text-gray-400'}`}>
          By signing up, you agree to our{' '}
          <Link href="/terms" className="underline underline-offset-2 hover:text-gray-600">Terms</Link>
          {' & '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-gray-600">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN PAGE (Suspense wrapper for useSearchParams)
// ══════════════════════════════════════════════════════════════
export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupInner />
    </Suspense>
  );
}
