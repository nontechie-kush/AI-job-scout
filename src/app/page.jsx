'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useInView } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import {
  Upload, Globe, FileText, ArrowRight, ChevronRight,
  CheckCircle, Zap, Shield, Briefcase, Users, Send,
  Star, Clock, BarChart3, Sun, Moon,
} from 'lucide-react';
import useStore from '@/store/useStore';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: 'easeOut' },
});

// ── Navbar ────────────────────────────────────────────────────
function Navbar({ onSignIn }) {
  const [scrolled, setScrolled] = useState(false);
  const darkMode = useStore((s) => s.darkMode);
  const toggleDarkMode = useStore((s) => s.toggleDarkMode);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 px-5 py-3.5 flex items-center justify-between lg:px-8 transition-all ${scrolled ? 'lp-nav-scrolled shadow-sm' : ''}`}
      style={{ background: scrolled ? (darkMode ? 'rgba(15,15,20,0.92)' : 'rgba(255,255,255,0.92)') : 'transparent', backdropFilter: scrolled ? 'blur(20px)' : 'none' }}>
      <div className={`flex items-center gap-2.5 font-bold text-base tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>
        <div className="w-[26px] h-[26px] rounded-[7px] bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-[13px] font-extrabold text-white">
          C
        </div>
        CareerPilot
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={toggleDarkMode}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${darkMode ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
          title={darkMode ? 'Light mode' : 'Dark mode'}
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button
          onClick={onSignIn}
          className={`px-4 py-2 text-[13px] font-medium transition-colors rounded-lg ${darkMode ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
        >
          Sign in
        </button>
      </div>
    </nav>
  );
}

// ── Outcome Cards (replaces dashboard screenshot) ────────────
const outcomeJobs = [
  {
    role: 'Product Manager',
    co: 'Stripe',
    location: 'SF · Remote',
    fit: 'Great fit',
    fitColor: 'text-emerald-600 bg-emerald-50',
    fitColorDark: 'text-emerald-400 bg-emerald-400/10',
    tags: ['Application ready', 'Referral found'],
  },
  {
    role: 'Growth Lead',
    co: 'Razorpay',
    location: 'Bangalore',
    fit: 'Great fit',
    fitColor: 'text-emerald-600 bg-emerald-50',
    fitColorDark: 'text-emerald-400 bg-emerald-400/10',
    tags: ['Application ready', '2 referral paths'],
  },
  {
    role: 'Sr. Frontend Engineer',
    co: 'Vercel',
    location: 'Remote · $170–210K',
    fit: 'Good fit',
    fitColor: 'text-amber-600 bg-amber-50',
    fitColorDark: 'text-amber-400 bg-amber-400/10',
    tags: ['Drafting application…'],
  },
];

function OutcomeVisual() {
  const darkMode = useStore((s) => s.darkMode);
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
      className="w-full max-w-md mx-auto xl:mx-0"
    >
      <div className={`rounded-2xl overflow-hidden border ${darkMode ? 'border-white/10 shadow-2xl' : 'border-gray-200 shadow-xl shadow-gray-200/50'}`}
        style={{ background: darkMode ? 'hsl(240 4% 10%)' : '#fff' }}>
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-2.5 border-b ${darkMode ? 'border-white/[0.08]' : 'border-gray-100'}`}
          style={{ background: darkMode ? 'hsl(240 5% 7%)' : '#fafafa' }}>
          <span className={`text-[11px] font-semibold tracking-wide uppercase ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
            Your matched jobs
          </span>
          <span className="text-[10px] font-medium text-emerald-600 flex items-center gap-1.5">
            <span className="w-[5px] h-[5px] rounded-full bg-emerald-500 animate-blink" />
            12 new today
          </span>
        </div>

        <div className="p-3 space-y-2">
          {outcomeJobs.map((j) => (
            <div key={j.role} className={`rounded-xl p-3.5 border ${darkMode ? 'border-white/[0.08]' : 'border-gray-100'}`}
              style={{ background: darkMode ? 'hsl(240 5% 7%)' : '#fafafa' }}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className={`text-sm font-semibold tracking-tight leading-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>{j.role}</div>
                  <div className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>{j.co} · {j.location}</div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ml-2.5 shrink-0 ${darkMode ? j.fitColorDark : j.fitColor}`}>
                  {j.fit}
                </span>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {j.tags.map((t) => (
                  <span key={t} className={`text-[10.5px] px-2 py-0.5 rounded-[5px] flex items-center gap-1 ${darkMode ? 'bg-white/[0.04] text-slate-400' : 'bg-gray-100 text-gray-600'}`}>
                    {t.startsWith('Drafting') ? <Clock className="w-2.5 h-2.5 text-amber-500" /> : <CheckCircle className="w-2.5 h-2.5 text-emerald-500" />}
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Hero with Import UI ──────────────────────────────────────
function HeroSection({ onFileSelected, onWebsiteSubmit }) {
  const darkMode = useStore((s) => s.darkMode);
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [error, setError] = useState('');

  const handleDragOver = useCallback((e) => { e.preventDefault(); setDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setDragOver(false), []);
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, []);

  const handleFile = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('File too large. Keep it under 5MB.'); return; }
    const ext = file.name?.toLowerCase();
    if (!ext.endsWith('.pdf') && !ext.endsWith('.docx')) { setError('Please upload a PDF or DOCX file.'); return; }
    setError('');
    onFileSelected(file);
  };

  const handleWebsite = () => {
    const url = websiteUrl.trim();
    if (!url) return;
    onWebsiteSubmit(url.startsWith('http') ? url : 'https://' + url);
  };

  return (
    <section className="relative pt-28 pb-10 xl:pt-0 xl:pb-0 px-5 xl:px-0">
      <div className="relative">
        {/* Tagline */}
        <motion.div
          {...fadeUp(0)}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium mb-5 ${darkMode ? 'bg-emerald-400/10 border border-emerald-400/20 text-emerald-400' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}
        >
          <Zap className="w-3 h-3" />
          20+ job sites scanned every 4 hours
        </motion.div>

        {/* Headline — outcome focused */}
        <motion.h1
          {...fadeUp(0.06)}
          className={`text-[28px] sm:text-[34px] xl:text-[44px] font-extrabold tracking-[-0.04em] leading-[1.12] mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}
        >
          Matched jobs, right people,{' '}
          <br className="hidden sm:block" />
          drafted applications.{' '}
          <br />
          <span className="text-emerald-600">Every morning.</span>
        </motion.h1>

        <motion.p
          {...fadeUp(0.12)}
          className={`text-[15px] leading-relaxed max-w-md mb-7 ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}
        >
          Import your profile once. CareerPilot scans job sites, finds the right people at each company, and drafts your applications. You just review and apply.
        </motion.p>

        {/* ── Import UI — right in the hero ── */}
        <motion.div {...fadeUp(0.18)} className="max-w-md">
          {/* Primary: Upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`w-full rounded-2xl p-5 flex items-center gap-4 transition-all active:scale-[0.98] group text-left ${dragOver ? 'scale-[1.01]' : ''} ${darkMode ? 'hover:bg-white/[0.04]' : 'hover:bg-emerald-50/50'}`}
            style={{
              background: darkMode
                ? (dragOver ? 'rgba(16,185,129,0.05)' : 'hsl(240 5% 7%)')
                : (dragOver ? 'rgba(16,185,129,0.04)' : '#fafafa'),
              border: `2px dashed ${dragOver
                ? 'rgba(16,185,129,0.6)'
                : (darkMode ? 'rgba(255,255,255,0.1)' : '#d1d5db')}`,
            }}
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${darkMode ? 'bg-emerald-400/10' : 'bg-emerald-50'}`}>
              <Upload className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>Upload resume or portfolio</p>
              <p className={`text-xs mt-0.5 ${darkMode ? 'text-slate-500' : 'text-gray-500'}`}>PDF or Word · Drag & drop or click</p>
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />

          {/* Secondary: Website URL */}
          <div className="flex gap-2 mt-3">
            <div className="relative flex-1">
              <Globe className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`} />
              <input
                type="url"
                placeholder="Or paste portfolio / website URL"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleWebsite()}
                className={`w-full rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition-all ${darkMode ? 'bg-[hsl(240,5%,8%)] border border-white/[0.08] text-white placeholder:text-slate-600 focus:ring-1 focus:ring-emerald-400/40' : 'bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30'}`}
              />
            </div>
            <button
              onClick={handleWebsite}
              disabled={!websiteUrl.trim()}
              className="px-4 rounded-xl bg-emerald-600 text-white font-bold text-sm disabled:opacity-40 hover:bg-emerald-700 transition-colors"
            >
              Go
            </button>
          </div>

          {/* Tertiary links */}
          <div className={`flex items-center gap-4 mt-3 text-xs ${darkMode ? 'text-slate-500' : 'text-gray-500'}`}>
            <button
              onClick={() => {
                sessionStorage.setItem('careerpilot_import', JSON.stringify({ method: 'paste', showPaste: true }));
                window.location.href = '/auth/signup?method=paste';
              }}
              className={`flex items-center gap-1 hover:underline ${darkMode ? 'hover:text-slate-300' : 'hover:text-gray-700'}`}
            >
              <FileText className="w-3 h-3" /> Paste text
            </button>
            <span className={darkMode ? 'text-slate-700' : 'text-gray-300'}>|</span>
            <button
              onClick={() => window.location.href = '/auth/signup?method=manual'}
              className={`hover:underline ${darkMode ? 'hover:text-slate-300' : 'hover:text-gray-700'}`}
            >
              No resume? Fill in details
            </button>
          </div>

          {error && (
            <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-red-500" /> {error}
            </p>
          )}

          <p className={`text-[11px] mt-3 flex items-center gap-1.5 ${darkMode ? 'text-slate-600' : 'text-gray-400'}`}>
            <Shield className="w-3 h-3" />
            Encrypted. Never shared. Free for 14 days.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

// ── Trust Strip ──────────────────────────────────────────────
const portals = [
  'LinkedIn', 'Greenhouse', 'Lever', 'Naukri', 'Wellfound',
  'Remotive', 'YC Jobs', 'Cutshort', 'Ashby', 'Hirect',
  'Arc', 'IIMJobs', 'Instahyre', 'TopStartups',
];

function TrustStrip() {
  const darkMode = useStore((s) => s.darkMode);
  return (
    <section className={`py-6 border-y overflow-hidden ${darkMode ? 'border-white/[0.06]' : 'border-gray-100'}`}>
      <p className={`text-center text-[11px] font-medium uppercase tracking-widest mb-4 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>
        Scanning jobs from
      </p>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3 animate-portal-scroll" style={{ width: 'max-content' }}>
          {[...portals, ...portals].map((name, i) => (
            <span
              key={`${name}-${i}`}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border whitespace-nowrap ${darkMode ? 'border-white/[0.06] bg-white/[0.02]' : 'border-gray-100 bg-white'}`}
            >
              <Globe className={`w-3 h-3 shrink-0 ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
              <span className={`text-[13px] font-medium ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>{name}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── What You Get — 3 outcome blocks ──────────────────────────
const outcomes = [
  {
    icon: Briefcase,
    title: 'Jobs found for you',
    desc: '20+ sites scanned every 4 hours. Only roles that match your profile show up.',
    stat: '20+',
    statLabel: 'job sites',
  },
  {
    icon: Users,
    title: 'Right people at every company',
    desc: 'Hiring managers and recruiters matched to each job. Ready to message via LinkedIn or email.',
    stat: '1-click',
    statLabel: 'outreach',
  },
  {
    icon: FileText,
    title: 'Applications drafted from your resume',
    desc: 'Cover letters, bios, and screening answers — pre-written. You review, tweak, submit.',
    stat: '< 2 min',
    statLabel: 'per apply',
  },
];

function OutcomesSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const darkMode = useStore((s) => s.darkMode);

  return (
    <section className="py-16 lg:py-20 px-5 lg:px-8 max-w-6xl mx-auto" ref={ref}>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        className="text-center mb-10"
      >
        <h2 className={`text-[24px] lg:text-[32px] font-bold tracking-[-0.03em] leading-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          You open your phone to this. Every day.
        </h2>
        <p className={`text-sm mt-2 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
          No searching. No scrolling job sites. No cold-emailing strangers.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {outcomes.map((o, i) => (
          <motion.div
            key={o.title}
            initial={{ opacity: 0, y: 18 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className={`rounded-2xl p-6 border relative overflow-hidden ${darkMode ? 'border-white/[0.08] bg-[hsl(240,4%,8%)]' : 'border-gray-100 bg-white shadow-sm'}`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${darkMode ? 'bg-emerald-400/10' : 'bg-emerald-50'}`}>
              <o.icon className={`w-5 h-5 ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
            </div>
            <h3 className={`text-[15px] font-bold tracking-tight mb-1.5 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{o.title}</h3>
            <p className={`text-[13px] leading-relaxed mb-4 ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>{o.desc}</p>
            <div className={`pt-3 border-t ${darkMode ? 'border-white/[0.06]' : 'border-gray-100'}`}>
              <span className={`text-lg font-bold ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{o.stat}</span>
              <span className={`text-xs ml-1.5 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>{o.statLabel}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ── Referrals — Unified Section ──────────────────────────────
function ReferralsSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const darkMode = useStore((s) => s.darkMode);

  return (
    <section className="py-16 lg:py-20 px-5 lg:px-8 max-w-6xl mx-auto" ref={ref}>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        className="mb-8"
      >
        <p className={`text-[11px] font-semibold tracking-widest uppercase mb-2 ${darkMode ? 'text-violet-400' : 'text-violet-600'}`}>
          Your unfair advantage
        </p>
        <h2 className={`text-[24px] lg:text-[32px] font-bold tracking-[-0.03em] leading-tight max-w-lg ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          For every job: the right person to reach out to. For your career: a curated recruiter network.
        </h2>
        <p className={`text-sm mt-2 max-w-lg ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
          You don&apos;t have to search LinkedIn to find people. CareerPilot identifies hiring managers per job and curates recruiters matched to your profile.
        </p>
      </motion.div>

      {/* Visual: Job → Person connections + Message preview */}
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Left: Job → Person connections (3 cols) */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className={`lg:col-span-3 rounded-2xl border p-5 ${darkMode ? 'border-white/[0.08] bg-[hsl(240,4%,8%)]' : 'border-gray-100 bg-white shadow-sm'}`}
        >
          <h3 className={`text-[14px] font-bold tracking-tight mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Hiring contacts per matched job
          </h3>
          <div className="space-y-3">
            {[
              { job: 'Product Manager', co: 'Stripe · SF', person: 'Sarah Chen', title: 'Eng Manager', initials: 'SC', color: 'bg-violet-500', status: 'Likely to respond', statusColor: 'text-emerald-600' },
              { job: 'Growth Lead', co: 'Razorpay · Bangalore', person: 'Meera K.', title: 'Product Lead', initials: 'MK', color: 'bg-blue-500', status: 'Active this week', statusColor: 'text-emerald-600' },
              { job: 'Sr. Engineer', co: 'Vercel · Remote', person: 'Alex T.', title: 'VP Engineering', initials: 'AT', color: 'bg-emerald-500', status: 'Likely to respond', statusColor: 'text-emerald-600' },
            ].map((item) => (
              <div key={item.job} className="flex items-center gap-0">
                <div className={`flex-1 rounded-xl border p-3 ${darkMode ? 'border-white/[0.08] bg-[hsl(240,5%,7%)]' : 'border-gray-100 bg-gray-50'}`}>
                  <div className={`text-[12px] font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{item.job}</div>
                  <div className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>{item.co}</div>
                </div>
                <div className="w-6 flex items-center justify-center shrink-0">
                  <div className={`w-full border-t border-dashed ${darkMode ? 'border-violet-400/40' : 'border-violet-300'}`} />
                </div>
                <div className={`flex-1 rounded-xl border p-3 ${darkMode ? 'border-violet-400/20 bg-violet-400/[0.04]' : 'border-violet-200 bg-violet-50/50'}`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className={`w-6 h-6 rounded-full ${item.color} flex items-center justify-center text-[8px] font-bold text-white`}>{item.initials}</div>
                    <div>
                      <div className={`text-[12px] font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{item.person}</div>
                      <div className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>{item.title}</div>
                    </div>
                  </div>
                  <span className={`text-[9px] flex items-center gap-1 mt-1 ${item.statusColor}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right: Message preview (2 cols) */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
          className={`lg:col-span-2 rounded-2xl border p-5 ${darkMode ? 'border-white/[0.08] bg-[hsl(240,4%,8%)]' : 'border-gray-100 bg-white shadow-sm'}`}
        >
          <h3 className={`text-[14px] font-bold tracking-tight mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Ready-to-send message
          </h3>

          <div className={`rounded-xl border overflow-hidden ${darkMode ? 'border-white/[0.08]' : 'border-gray-200'}`}>
            <div className={`flex items-center gap-2.5 p-3 border-b ${darkMode ? 'border-white/[0.06] bg-[hsl(240,5%,7%)]' : 'border-gray-100 bg-gray-50'}`}>
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-[9px] font-bold text-white">RP</div>
              <div className="flex-1">
                <div className={`text-[12px] font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Ravi Patel</div>
                <div className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Sr. Recruiter · Razorpay</div>
              </div>
            </div>
            <div className="p-3">
              <p className={`text-[11px] leading-relaxed italic ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>
                &ldquo;Hi Ravi, I saw Razorpay is scaling the growth team. 4 years driving product-led growth at Series B–D. Would love to chat about the Growth Lead role...&rdquo;
              </p>
            </div>
            <div className={`flex border-t ${darkMode ? 'border-white/[0.06]' : 'border-gray-100'}`}>
              <button className={`flex-1 py-2.5 text-[11px] font-semibold flex items-center justify-center gap-1.5 border-r transition-colors ${darkMode ? 'text-blue-400 border-white/[0.06] hover:bg-blue-400/5' : 'text-blue-600 border-gray-100 hover:bg-blue-50'}`}>
                <span className="text-[9px] font-bold">in</span> LinkedIn
              </button>
              <button className={`flex-1 py-2.5 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${darkMode ? 'text-emerald-400 hover:bg-emerald-400/5' : 'text-emerald-600 hover:bg-emerald-50'}`}>
                <Send className="w-3 h-3" /> Email
              </button>
            </div>
          </div>

          <p className={`text-[10px] text-center mt-3 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>
            Personalized per recruiter · Your tone, your style
          </p>
        </motion.div>
      </div>
    </section>
  );
}

// ── How It Works ─────────────────────────────────────────────
const steps = [
  { num: '1', title: 'Import your profile', desc: 'Upload resume, paste a portfolio URL, or fill in details. Takes 2 minutes.', icon: Upload },
  { num: '2', title: 'CareerPilot gets to work', desc: 'Starts scanning 20+ job sites. Matches roles, finds contacts, drafts applications.', icon: Zap },
  { num: '3', title: 'Review and apply', desc: 'Open your feed. Check matches, tweak drafts, reach out to the right people. Apply in one tap.', icon: CheckCircle },
];

function HowItWorksSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const darkMode = useStore((s) => s.darkMode);

  return (
    <section id="how" className="py-16 lg:py-20 px-5 lg:px-8 max-w-6xl mx-auto" ref={ref}>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        className="text-center mb-10"
      >
        <h2 className={`text-[24px] lg:text-[32px] font-bold tracking-[-0.03em] leading-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Two minutes of setup. Then it runs.
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {steps.map((s, i) => (
          <motion.div
            key={s.num}
            initial={{ opacity: 0, y: 18 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className="text-center"
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${darkMode ? 'bg-emerald-400/10 border border-emerald-400/20' : 'bg-emerald-50 border border-emerald-100'}`}>
              <s.icon className={`w-5 h-5 ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
            </div>
            <span className={`text-[11px] font-bold ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>Step {s.num}</span>
            <h3 className={`text-[15px] font-bold tracking-tight mt-1 mb-1.5 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{s.title}</h3>
            <p className={`text-[13px] leading-relaxed ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>{s.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ── Always Running ───────────────────────────────────────────
const runningFeatures = [
  { label: 'Fresh matches every morning', icon: Briefcase },
  { label: 'New contacts every week', icon: Users },
  { label: 'Applications pre-drafted', icon: FileText },
  { label: 'Outreach timed optimally', icon: Clock },
];

function AlwaysRunningSection() {
  const darkMode = useStore((s) => s.darkMode);
  return (
    <section className="py-16 lg:py-20 px-5 lg:px-8 max-w-6xl mx-auto">
      <div className={`rounded-2xl p-8 lg:p-12 text-center relative overflow-hidden border ${darkMode ? 'border-white/[0.08] bg-[hsl(240,4%,8%)]' : 'border-gray-100 bg-gradient-to-b from-emerald-50/50 to-white'}`}>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-5 ${darkMode ? 'bg-emerald-400/10' : 'bg-emerald-100'}`}>
          <Zap className={`w-5 h-5 ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
        </div>
        <h3 className={`text-[22px] lg:text-[28px] font-bold tracking-[-0.03em] mb-2.5 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Always running in the background
        </h3>
        <p className={`text-sm leading-relaxed mb-7 max-w-md mx-auto ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
          While you sleep, interview, or take a break — CareerPilot keeps scanning, matching, and drafting. Open your phone to a fresh feed.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          {runningFeatures.map((c) => (
            <span
              key={c.label}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-medium border ${darkMode ? 'border-white/[0.08] bg-[hsl(240,5%,7%)] text-slate-300' : 'border-gray-200 bg-white text-gray-700 shadow-sm'}`}
            >
              <c.icon className={`w-3.5 h-3.5 ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
              {c.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Final CTA ────────────────────────────────────────────────
function FinalCTA({ onCTA }) {
  const darkMode = useStore((s) => s.darkMode);
  return (
    <section id="cta" className="py-16 lg:py-20 px-5 lg:px-8 text-center max-w-6xl mx-auto">
      <h2 className={`text-[26px] lg:text-[36px] font-extrabold tracking-[-0.04em] leading-[1.1] mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
        Your next role is closer<br />than you think.
      </h2>
      <p className={`text-sm mb-6 max-w-md mx-auto ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
        Stop scrolling job sites. Let CareerPilot find the right opportunities, the right people, and draft your applications.
      </p>
      <button
        onClick={onCTA}
        className="inline-flex items-center justify-center gap-2 py-[14px] px-7 rounded-xl bg-emerald-600 text-white font-bold text-[15px] transition-all active:scale-[0.97] hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 mb-3"
      >
        Get started — free for 14 days
        <ArrowRight className="w-4 h-4" />
      </button>
      <p className={`text-[11px] flex items-center justify-center gap-1.5 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>
        <Shield className="w-3 h-3" />
        No credit card required
      </p>
    </section>
  );
}

// ── Sticky mobile bar ────────────────────────────────────────
function StickyBar({ onCTA }) {
  const [show, setShow] = useState(false);
  const darkMode = useStore((s) => s.darkMode);
  useEffect(() => {
    const fn = () => {
      const ctaSection = document.getElementById('cta');
      if (ctaSection) {
        const rect = ctaSection.getBoundingClientRect();
        const ctaVisible = rect.top < window.innerHeight && rect.bottom > 0;
        setShow(window.scrollY > 400 && !ctaVisible);
      } else {
        setShow(window.scrollY > 400);
      }
    };
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 border-t flex gap-2.5 px-5 py-3 transition-transform duration-300 xl:hidden ${show ? 'translate-y-0' : 'translate-y-full'}`}
      style={{
        background: darkMode ? 'rgba(15,15,20,0.95)' : 'rgba(255,255,255,0.95)',
        borderColor: darkMode ? 'rgba(255,255,255,0.08)' : '#e5e7eb',
        backdropFilter: 'blur(20px)',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <button
        onClick={onCTA}
        className="flex-1 py-3.5 rounded-xl bg-emerald-600 text-white font-bold text-sm text-center transition-opacity active:opacity-85 flex items-center justify-center gap-2"
      >
        Get started — free
      </button>
      <a
        href="#how"
        className={`py-3.5 px-4 rounded-xl border text-[13px] font-medium flex items-center active:opacity-80 ${darkMode ? 'bg-white/[0.06] border-white/10 text-slate-400' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
      >
        How?
      </a>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const darkMode = useStore((s) => s.darkMode);

  useEffect(() => {
    const supabase = createClient();
    const timeout = setTimeout(() => setChecking(false), 800);
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout);
      if (session) {
        supabase.from('users').select('onboarding_completed').eq('id', session.user.id).single()
          .then(({ data }) => {
            router.replace(data?.onboarding_completed ? '/dashboard' : '/onboarding');
          });
      } else {
        setChecking(false);
      }
    }).catch(() => { clearTimeout(timeout); setChecking(false); });
  }, [router]);

  const goSignup = () => router.push('/auth/signup');
  const goSignIn = () => router.push('/auth/login');

  // Handle file import from hero → store in sessionStorage → go to signup
  const handleFileSelected = (file) => {
    // Store file info — actual file can't go in sessionStorage, user re-uploads on signup page
    sessionStorage.setItem('careerpilot_import', JSON.stringify({
      method: 'pdf',
      fileName: file.name,
      needsReupload: false,
    }));
    // We need to pass the file — store it in a module-level ref and navigate
    window.__careerpilot_file = file;
    router.push('/auth/signup?method=pdf');
  };

  const handleWebsiteSubmit = (url) => {
    sessionStorage.setItem('careerpilot_import', JSON.stringify({
      method: 'website',
      url,
    }));
    router.push('/auth/signup?method=website');
  };

  if (checking) {
    return (
      <div className={`min-h-dvh flex items-center justify-center ${darkMode ? 'bg-slate-950' : 'bg-white'}`}>
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-500"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-20 xl:pb-0 transition-colors ${darkMode ? 'bg-slate-950 text-white' : 'bg-white text-gray-900'}`}
      style={{ fontFamily: "'Outfit', -apple-system, sans-serif" }}>
      <Navbar onSignIn={goSignIn} />

      {/* Hero + Outcome visual: side-by-side on desktop */}
      <div className="max-w-6xl mx-auto xl:grid xl:grid-cols-2 xl:gap-12 xl:items-center xl:px-8 xl:pt-32">
        <HeroSection onFileSelected={handleFileSelected} onWebsiteSubmit={handleWebsiteSubmit} />
        <div className="px-5 mt-6 xl:mt-0 xl:px-0">
          <OutcomeVisual />
        </div>
      </div>

      {/* Trust strip — job sites we scan */}
      <div className="mt-10">
        <TrustStrip />
      </div>

      {/* What you get */}
      <OutcomesSection />

      {/* Divider */}
      <div className={`h-px mx-5 lg:max-w-6xl lg:mx-auto ${darkMode ? 'bg-white/[0.06]' : 'bg-gray-100'}`} />

      {/* Referrals */}
      <ReferralsSection />

      <div className={`h-px mx-5 lg:max-w-6xl lg:mx-auto ${darkMode ? 'bg-white/[0.06]' : 'bg-gray-100'}`} />

      {/* How it works */}
      <HowItWorksSection />

      <div className={`h-px mx-5 lg:max-w-6xl lg:mx-auto ${darkMode ? 'bg-white/[0.06]' : 'bg-gray-100'}`} />

      {/* Always running */}
      <AlwaysRunningSection />

      {/* Final CTA */}
      <FinalCTA onCTA={goSignup} />

      <footer className={`border-t py-7 px-5 text-center ${darkMode ? 'border-white/[0.06]' : 'border-gray-100'}`}>
        <p className={`text-[11px] leading-snug ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>
          © 2026 CareerPilot<br />
          Built for people who&apos;d rather interview than job hunt.
        </p>
      </footer>

      <StickyBar onCTA={goSignup} />
    </div>
  );
}
