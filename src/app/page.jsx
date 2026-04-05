'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useInView } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import {
  Upload, Globe, FileText, ArrowRight,
  CheckCircle, Zap, Shield, Briefcase, Users, Send,
  Clock, Sun, Moon,
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

// ── Hero comparison — single rotating slot ────────────────────
const comparisonRows = [
  { without: 'Spend hours searching for relevant jobs across portals', with: '50k+ roles auto-searched. Every 6 hours. The entire web.' },
  { without: 'Send random connect requests on Linkedin everyday', with: '1000+ Verified recruiter list. 1 click reachout.' },
  { without: 'Bombard everyone at the target company for a referral', with: 'Top 3 key company connects to seek referral. Period.' },
  { without: 'Spend hours on filling job applications. Copy-paste. Repeat.', with: 'Automate boring tasks. Focus on Interview prep.' },
];

function RotatingComparison() {
  const darkMode = useStore((s) => s.darkMode);
  const [active, setActive] = useState(0);
  const [phase, setPhase] = useState('enter'); // 'enter' | 'strike' | 'reveal'
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });

  useEffect(() => {
    if (!inView) return;
    let t1, t2, t3;

    const runCycle = () => {
      setPhase('enter');
      t1 = setTimeout(() => setPhase('strike'), 1500);
      t2 = setTimeout(() => setPhase('reveal'), 2800);
      t3 = setTimeout(() => {
        setActive((p) => (p + 1) % comparisonRows.length);
      }, 6000);
    };

    runCycle();
    const iv = setInterval(runCycle, 6000);
    return () => { clearInterval(iv); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [inView]);

  const row = comparisonRows[active];

  return (
    <div ref={ref} className="text-center min-h-[80px] flex flex-col items-center justify-center">
      {/* Without — with animated strikethrough */}
      <div className="mb-2.5 px-4">
        <motion.span
          key={`w-${active}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            textDecorationLine: phase === 'strike' || phase === 'reveal' ? 'line-through' : 'none',
            textDecorationColor: darkMode ? 'rgba(248,113,113,0.6)' : 'rgba(248,113,113,0.7)',
            textDecorationThickness: '1.5px',
            textDecorationStyle: 'solid',
            transition: 'text-decoration-line 0.3s ease',
          }}
          className={`text-[16px] sm:text-[18px] ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}
        >
          {row.without}
        </motion.span>
      </div>

      {/* With — slides up after strike */}
      <motion.div
        key={`r-${active}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{
          opacity: phase === 'reveal' ? 1 : 0,
          y: phase === 'reveal' ? 0 : 10,
        }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="flex items-start justify-center gap-2 px-4"
      >
        <CheckCircle className={`w-[18px] h-[18px] shrink-0 mt-0.5 ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
        <span className={`text-[16px] sm:text-[18px] font-semibold ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>
          {row.with}
        </span>
      </motion.div>

      {/* Progress dots */}
      <div className="flex items-center gap-2.5 mt-5">
        {comparisonRows.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i === active
                ? `w-6 ${darkMode ? 'bg-emerald-400' : 'bg-emerald-600'}`
                : `w-1.5 ${darkMode ? 'bg-white/15' : 'bg-gray-300'}`
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ── Hero — centered single column ─────────────────────────────
function HeroSection() {
  const darkMode = useStore((s) => s.darkMode);

  return (
    <section className="pt-24 lg:pt-32 pb-4 lg:pb-6 px-5 lg:px-8 max-w-3xl mx-auto">
      {/* ── Centered headline ── */}
      <div className="text-center mb-8 lg:mb-10">
        <motion.p
          {...fadeUp(0)}
          className={`text-[11px] font-semibold tracking-[0.16em] uppercase mb-3 ${darkMode ? 'text-emerald-400/70' : 'text-emerald-600/70'}`}
        >
          CareerPilot AI
        </motion.p>

        <motion.h1
          {...fadeUp(0.04)}
          className={`text-[34px] sm:text-[48px] xl:text-[58px] font-extrabold tracking-[-0.04em] leading-[1.05] ${darkMode ? 'text-white' : 'text-gray-900'}`}
        >
          Right Jobs. Right Outreach.{' '}
          <br className="hidden sm:block" />
          <span className="text-emerald-600">10x Faster.</span>
        </motion.h1>
      </div>

      {/* ── Centered rotating comparison ── */}
      <motion.div {...fadeUp(0.1)} className="mb-10">
        <RotatingComparison />
      </motion.div>

      {/* ── CTAs ── */}
      <motion.div {...fadeUp(0.15)} className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
        <button
          onClick={() => window.location.href = '/auth/signup'}
          className="px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[15px] transition-all active:scale-[0.97] flex items-center gap-2 shadow-lg shadow-emerald-600/20"
        >
          Get your CareerPilot <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
          className={`px-8 py-3.5 rounded-xl font-semibold text-[15px] transition-all border ${darkMode ? 'border-white/[0.1] text-slate-300 hover:bg-white/[0.04]' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
        >
          See how it works
        </button>
      </motion.div>
    </section>
  );
}

// ── Trust Strip ──────────────────────────────────────────────
const portals = [
  'Greenhouse', 'Lever', 'Naukri', 'Wellfound',
  'Remotive', 'YC Jobs', 'Cutshort', 'Ashby', 'Hirect',
  'Arc', 'IIMJobs', 'Instahyre', 'TopStartups',
];

const recruiterProfiles = [
  'VP Sales, Google', 'Talent Acquisition, Amazon', 'CPO, Razorpay',
  'Director - Product, Netflix', 'CTO, Zerodha', 'Tech Recruiter, Microsoft',
  'Hiring Manager, Flipkart', 'Business Head, Reliance',
];

function TrustStrip() {
  const darkMode = useStore((s) => s.darkMode);
  return (
    <section className={`py-8 border-y ${darkMode ? 'border-white/[0.06]' : 'border-gray-100'}`}>
      <div className="max-w-3xl mx-auto px-6">
        {/* Scanning jobs */}
        <p className={`text-center text-[11px] font-medium uppercase tracking-widest mb-3 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>
          Scanning jobs from
        </p>
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {portals.map((name) => (
            <span
              key={`p-${name}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium ${darkMode ? 'bg-white/[0.04] text-slate-400' : 'bg-gray-50 text-gray-500'}`}
            >
              <Globe className={`w-3 h-3 shrink-0 ${darkMode ? 'text-emerald-400/60' : 'text-emerald-600/50'}`} />
              {name}
            </span>
          ))}
        </div>

        {/* Curating connections */}
        <p className={`text-center text-[11px] font-medium uppercase tracking-widest mb-3 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>
          Curating connections
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {recruiterProfiles.map((profile) => (
            <span
              key={`r-${profile}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium ${darkMode ? 'bg-white/[0.04] text-slate-400' : 'bg-gray-50 text-gray-500'}`}
            >
              <Users className={`w-3 h-3 shrink-0 ${darkMode ? 'text-emerald-400/60' : 'text-emerald-600/50'}`} />
              {profile}
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
    title: '50k+ roles auto-searched',
    desc: 'Every 6 hours, across the entire web. Only roles that match your profile show up.',
    stat: '50k+',
    statLabel: 'roles scanned',
  },
  {
    icon: Users,
    title: 'Instant Outreach — 1000+ recruiters for you',
    desc: 'Handpicked recruiters matched to your profile. Plus top 3 referral contacts per role.',
    stat: '1-click',
    statLabel: 'reachout',
  },
  {
    icon: FileText,
    title: 'Applications on autopilot',
    desc: 'Cover letters, bios, screening answers — auto-drafted from your resume. You review and send.',
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
          You wake up to this. Every day.
        </h2>
        <p className={`text-sm mt-2 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
          No searching. No scrolling job portals. No cold-emailing strangers.
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

// ── Outreach — Animated Demo Section ─────────────────────────
const demoRecruiters = [
  { name: 'Priya Sharma', title: 'VP Sales · Google', initials: 'PS', color: 'bg-blue-500', match: 92 },
  { name: 'Ravi Patel', title: 'Head of Talent · Razorpay', initials: 'RP', color: 'bg-amber-500', match: 88 },
  { name: 'Sarah Chen', title: 'Director Hiring · Netflix', initials: 'SC', color: 'bg-red-500', match: 85 },
  { name: 'Amit Verma', title: 'Tech Recruiter · Microsoft', initials: 'AV', color: 'bg-emerald-500', match: 82 },
  { name: 'Meera K.', title: 'Talent Partner · Sequoia', initials: 'MK', color: 'bg-emerald-500', match: 79 },
];

function OutreachDemo() {
  const darkMode = useStore((s) => s.darkMode);
  const [step, setStep] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [typedText, setTypedText] = useState('');
  const [selectedRole, setSelectedRole] = useState(false);
  const [selectedRecruiters, setSelectedRecruiters] = useState([]);
  const noteText = 'Hi Priya, I noticed Google is scaling the growth team. With 5 years in product-led growth, I\'d love to connect...';
  const linkedinNote = 'Hi Priya,\n\nI admire your work scaling growth teams at Google. With 5 years driving product-led growth at Series B\u2013D startups, I\'d love to connect and exchange notes!\n\nBest,\nKushendra';
  const [linkedinTyped, setLinkedinTyped] = useState('');

  useEffect(() => {
    if (!inView) return;
    let timeouts = [];

    const run = () => {
      // Reset
      setStep(0); setSelectedRole(false); setSelectedRecruiters([]); setTypedText(''); setLinkedinTyped('');

      // Step 0: Show role list, cursor clicks "Growth Manager"
      timeouts.push(setTimeout(() => setSelectedRole(true), 1200));

      // Step 1: Recruiter list appears
      timeouts.push(setTimeout(() => setStep(1), 2200));

      // Step 2: Select recruiters one by one
      timeouts.push(setTimeout(() => setSelectedRecruiters([0]), 3200));
      timeouts.push(setTimeout(() => setSelectedRecruiters([0, 1]), 3800));
      timeouts.push(setTimeout(() => setSelectedRecruiters([0, 1, 2]), 4400));

      // Step 3: AI curates note + Start Outreach
      timeouts.push(setTimeout(() => setStep(2), 5400));

      // Type the note
      for (let i = 0; i < noteText.length; i++) {
        timeouts.push(setTimeout(() => setTypedText(noteText.slice(0, i + 1)), 5800 + i * 25));
      }

      // Step 3: Click start outreach → LinkedIn profile appears
      const s3 = 5800 + noteText.length * 25 + 800;
      timeouts.push(setTimeout(() => setStep(3), s3));

      // Step 4: "Add a note" modal → type the LinkedIn note
      const s4 = s3 + 1500;
      timeouts.push(setTimeout(() => setStep(4), s4));
      for (let i = 0; i < linkedinNote.length; i++) {
        timeouts.push(setTimeout(() => setLinkedinTyped(linkedinNote.slice(0, i + 1)), s4 + 300 + i * 20));
      }

      // Step 5: Send → toast
      const s5 = s4 + 300 + linkedinNote.length * 20 + 1000;
      timeouts.push(setTimeout(() => setStep(5), s5));

      // Restart cycle
      timeouts.push(setTimeout(run, s5 + 4000));
    };

    run();
    return () => timeouts.forEach(clearTimeout);
  }, [inView]);

  const cardBg = darkMode ? 'border-white/[0.08] bg-[hsl(240,4%,8%)]' : 'border-gray-100 bg-white shadow-sm';
  const cardInner = darkMode ? 'border-white/[0.06] bg-[hsl(240,5%,7%)]' : 'border-gray-100 bg-gray-50';

  // Which phase is active: 0 = role/recruiters, 1 = AI note, 2 = LinkedIn
  const phase = step <= 1 ? 0 : step === 2 ? 1 : 2;

  return (
    <div ref={ref} className={`rounded-2xl border p-3 sm:p-5 overflow-hidden relative ${cardBg}`}>

      {/* Fixed-height stage — all panels absolutely positioned, crossfade via opacity */}
      <div className="relative h-[320px] sm:h-[580px]">

        {/* Panel 0: Role selection + Recruiter list */}
        <motion.div
          animate={{ opacity: phase === 0 ? 1 : 0 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0"
          style={{ pointerEvents: phase === 0 ? 'auto' : 'none' }}
        >
          <p className={`text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider mb-2 sm:mb-3 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>
            Select a role
          </p>
          <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">
            {['Product Manager', 'Growth Manager', 'Data Analyst'].map((role) => (
              <motion.div
                key={role}
                animate={role === 'Growth Manager' && selectedRole ? { scale: [1, 0.95, 1] } : {}}
                transition={{ duration: 0.2 }}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-[12px] font-medium border transition-all ${
                  role === 'Growth Manager' && selectedRole
                    ? (darkMode ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-400 ring-2 ring-emerald-400/30' : 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200')
                    : (darkMode ? 'border-white/[0.08] text-slate-400' : 'border-gray-200 text-gray-500')
                }`}
              >
                {role}
              </motion.div>
            ))}
          </div>

          {/* Recruiter list — appears after role selected */}
          <motion.div
            animate={{ opacity: step >= 1 ? 1 : 0, y: step >= 1 ? 0 : 10 }}
            transition={{ duration: 0.4 }}
          >
            {step >= 1 && (
              <>
                <p className={`text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider mb-2 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>
                  Matched recruiters
                </p>
                <div className="space-y-1 sm:space-y-1.5">
                  {demoRecruiters.map((r, i) => (
                    <motion.div
                      key={r.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-lg sm:rounded-xl border transition-all ${
                        selectedRecruiters.includes(i)
                          ? (darkMode ? 'border-emerald-400/30 bg-emerald-400/[0.06] ring-1 ring-emerald-400/20' : 'border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-200')
                          : cardInner
                      }`}
                    >
                      <div className={`w-3 h-3 sm:w-2.5 sm:h-2.5 rounded border-2 shrink-0 flex items-center justify-center ${
                        selectedRecruiters.includes(i)
                          ? 'border-emerald-500 bg-emerald-500'
                          : (darkMode ? 'border-white/20' : 'border-gray-300')
                      }`}>
                        {selectedRecruiters.includes(i) && (
                          <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} width="8" height="8" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5L4.5 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                          </motion.svg>
                        )}
                      </div>
                      <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full ${r.color} flex items-center justify-center text-[8px] sm:text-[9px] font-bold text-white shrink-0`}>
                        {r.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[11px] sm:text-[12px] font-semibold truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>{r.name}</div>
                        <div className={`text-[9px] sm:text-[10px] truncate ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>{r.title}</div>
                      </div>
                      <div className={`text-[10px] sm:text-[11px] font-bold shrink-0 ${r.match >= 85 ? 'text-emerald-600' : (darkMode ? 'text-slate-400' : 'text-gray-500')}`}>
                        {r.match}%
                      </div>
                    </motion.div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>

        {/* Panel 1: AI curating note */}
        <motion.div
          animate={{ opacity: phase === 1 ? 1 : 0 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0"
          style={{ pointerEvents: phase === 1 ? 'auto' : 'none' }}
        >
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className={`text-[11px] sm:text-[12px] font-semibold ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
              Pilot is crafting personalized notes...
            </p>
          </div>
          <div className={`rounded-lg sm:rounded-xl border p-2.5 sm:p-3 mb-3 sm:mb-4 ${cardInner}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-500 flex items-center justify-center text-[8px] sm:text-[9px] font-bold text-white">PS</div>
              <div>
                <div className={`text-[11px] sm:text-[12px] font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Priya Sharma</div>
                <div className={`text-[9px] sm:text-[10px] ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>VP Sales · Google</div>
              </div>
            </div>
            <div className={`rounded-lg p-2 sm:p-2.5 min-h-[40px] sm:min-h-[48px] ${darkMode ? 'bg-white/[0.03]' : 'bg-white'}`}>
              <p className={`text-[10px] sm:text-[11px] leading-relaxed ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>
                {typedText}<span className="animate-pulse">|</span>
              </p>
            </div>
          </div>
          <motion.button
            animate={{ scale: step === 2 ? [1, 1.03, 1] : 1 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="w-full py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-emerald-600 text-white text-[12px] sm:text-[13px] font-bold flex items-center justify-center gap-2"
          >
            <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Start Outreach Automation
          </motion.button>
        </motion.div>

        {/* Panel 2: LinkedIn automation */}
        <motion.div
          animate={{ opacity: phase === 2 ? 1 : 0 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 overflow-y-auto scrollbar-none"
          style={{ pointerEvents: phase === 2 ? 'auto' : 'none' }}
        >
          {/* Pilot running banner */}
          <div
            className={`flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-4 py-1.5 sm:py-2.5 rounded-lg mb-2 sm:mb-4 ${darkMode ? 'bg-emerald-400/10 border border-emerald-400/20' : 'bg-emerald-50 border border-emerald-200'}`}
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className={`text-[9px] sm:text-[12px] font-semibold leading-tight ${darkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
              Pilot is automating — opening profiles, adding notes, sending requests...
            </span>
          </div>

          {/* LinkedIn profile card */}
          <div className="rounded-lg sm:rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
            {/* Cover + avatar */}
            <div className="h-8 sm:h-20 bg-gradient-to-r from-[#1a3a5c] to-[#2d5f8a] relative">
              <div className="absolute -bottom-4 sm:-bottom-6 left-2.5 sm:left-4">
                <div className="w-8 h-8 sm:w-14 sm:h-14 rounded-full bg-blue-500 border-2 sm:border-[3px] border-white flex items-center justify-center text-[10px] sm:text-[16px] font-bold text-white shadow-md">
                  PS
                </div>
              </div>
            </div>
            <div className="pt-5 sm:pt-8 pb-2 sm:pb-3 px-2.5 sm:px-4">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <span className="text-[11px] sm:text-[15px] font-bold text-gray-900">Priya Sharma</span>
                <svg className="w-3 h-3 sm:w-4 sm:h-4" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#0a66c2"/><path d="M4.5 8L7 10.5L11.5 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span className="text-[9px] sm:text-[12px] text-gray-500">· 2nd</span>
              </div>
              <p className="text-[9px] sm:text-[12px] text-gray-600 mt-0.5 line-clamp-1">VP Sales at Google | Scaling growth teams across APAC</p>
              <p className="text-[8px] sm:text-[11px] text-gray-500">Mumbai, India · <span className="text-[#0a66c2] font-medium">Contact info</span></p>
              <p className="text-[8px] sm:text-[11px] text-gray-500">12,340 followers</p>

              {/* Action buttons */}
              <div className="flex items-center gap-1 sm:gap-2 mt-1.5 sm:mt-3 flex-wrap">
                <span className="px-2.5 sm:px-4 py-0.5 sm:py-1.5 rounded-full bg-[#0a66c2] text-white text-[9px] sm:text-[12px] font-semibold">Message</span>
                {step >= 5
                  ? <span className="px-2.5 sm:px-4 py-0.5 sm:py-1.5 rounded-full border border-gray-400 text-[9px] sm:text-[12px] font-semibold text-gray-600 flex items-center gap-1">
                      <svg className="w-2 h-2 sm:w-3 sm:h-3" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M8 4V8.5H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      Pending
                    </span>
                  : <span className="px-2.5 sm:px-4 py-0.5 sm:py-1.5 rounded-full border border-[#0a66c2] text-[9px] sm:text-[12px] font-semibold text-[#0a66c2]">Connect</span>
                }
                <span className="px-2.5 sm:px-4 py-0.5 sm:py-1.5 rounded-full border border-gray-400 text-[9px] sm:text-[12px] font-semibold text-gray-600">More</span>
              </div>
            </div>
          </div>

          {/* LinkedIn "Add a note" modal */}
          <motion.div
            animate={{ opacity: step < 5 ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            className="mt-2 sm:mt-4 rounded-lg sm:rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden"
            style={{ pointerEvents: step < 5 ? 'auto' : 'none' }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-2.5 sm:px-5 pt-2 sm:pt-4 pb-1 sm:pb-3">
              <h3 className="text-[11px] sm:text-[16px] font-semibold text-gray-900">Add a note to your invitation</h3>
              <span className="text-gray-400 text-[14px] sm:text-[18px] cursor-default">×</span>
            </div>

            <div className="px-2.5 sm:px-5 pb-2 sm:pb-4">
              <p className="text-[9px] sm:text-[13px] text-gray-600 mb-1.5 sm:mb-3 leading-relaxed">
                Personalize your invitation to <strong>Priya Sharma</strong> by adding a note.
              </p>

              {/* Textarea */}
              <div className="border border-gray-900 rounded-md overflow-hidden mb-0.5">
                <div className="p-1.5 sm:p-3 min-h-[44px] sm:min-h-[80px] text-[9px] sm:text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {step >= 4 && linkedinTyped ? (
                    <span>{linkedinTyped}<span className="animate-pulse">|</span></span>
                  ) : (
                    <span className="text-gray-400">Ex: We know each other from...</span>
                  )}
                </div>
              </div>
              <p className="text-right text-[8px] sm:text-[11px] text-gray-500 mb-1 sm:mb-3">
                {linkedinTyped.length}/300
              </p>

              {/* Bottom buttons */}
              <div className="flex items-center justify-end">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-[9px] sm:text-[13px] font-semibold text-gray-500">Cancel</span>
                  <motion.span
                    animate={{ backgroundColor: linkedinTyped.length > 20 ? '#0a66c2' : '#e5e7eb', color: linkedinTyped.length > 20 ? '#ffffff' : '#9ca3af' }}
                    className="px-2.5 sm:px-5 py-0.5 sm:py-1.5 rounded-full text-[9px] sm:text-[13px] font-semibold"
                  >
                    Send
                  </motion.span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Green toast — "Invitation sent" */}
          <motion.div
            animate={{ opacity: step >= 5 ? 1 : 0, y: step >= 5 ? 0 : 10 }}
            transition={{ duration: 0.3 }}
            className="mt-2 sm:mt-4 flex items-center gap-1.5 sm:gap-3 px-2 sm:px-4 py-1.5 sm:py-3 bg-white rounded-lg sm:rounded-xl border border-gray-200 shadow-lg"
            style={{ pointerEvents: step >= 5 ? 'auto' : 'none' }}
          >
            <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
              <svg className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" viewBox="0 0 16 16" fill="none"><path d="M4 8L7 11L12 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className="text-[9px] sm:text-[13px] text-gray-800 font-medium">Invitation sent to Priya Sharma.</span>
            <span className="ml-auto text-gray-400 text-[10px] sm:text-[14px]">×</span>
          </motion.div>

          {/* Progress indicator */}
          <motion.div
            animate={{ opacity: step >= 5 ? 1 : 0 }}
            transition={{ duration: 0.3, delay: 0.5 }}
            className={`mt-1.5 sm:mt-3 flex items-center justify-center gap-1.5 sm:gap-3 px-2 sm:px-4 py-1 sm:py-2 rounded-lg ${darkMode ? 'bg-white/[0.03]' : 'bg-gray-50'}`}
          >
            <span className={`text-[10px] sm:text-[12px] font-medium whitespace-nowrap ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>Pilot: 1 of 3 sent</span>
            <div className={`flex-1 h-1 sm:h-1.5 rounded-full max-w-[80px] sm:max-w-[120px] ${darkMode ? 'bg-white/10' : 'bg-gray-200'}`}>
              <motion.div
                animate={{ width: step >= 5 ? '33%' : '0%' }}
                transition={{ duration: 1 }}
                className="h-full rounded-full bg-emerald-500"
              />
            </div>
            <span className={`text-[9px] sm:text-[11px] whitespace-nowrap ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>Moving to next...</span>
          </motion.div>
        </motion.div>

      </div>

      {/* Step indicator dots */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-2.5 sm:mt-4">
        {['Select role', 'Pick recruiters', 'AI drafts note', 'Auto-send'].map((label, i) => {
          const stepMap = [0, 1, 2, 3];
          const isActive = step >= stepMap[i] && (i === 3 ? step >= 3 : step < stepMap[i + 1] || i === 3);
          const isPast = i < 3 ? step >= stepMap[i + 1] : step >= 5;
          return (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 ${isPast ? (darkMode ? 'text-emerald-400' : 'text-emerald-600') : isActive ? (darkMode ? 'text-white' : 'text-gray-900') : (darkMode ? 'text-slate-600' : 'text-gray-300')}`}>
                <div className={`w-1.5 h-1.5 rounded-full transition-colors ${isPast ? 'bg-emerald-500' : isActive ? (darkMode ? 'bg-white' : 'bg-gray-900') : (darkMode ? 'bg-slate-600' : 'bg-gray-300')}`} />
                <span className="text-[9px] font-medium hidden sm:inline">{label}</span>
              </div>
              {i < 3 && <div className={`w-4 h-px ${darkMode ? 'bg-white/10' : 'bg-gray-200'}`} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OutreachSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const darkMode = useStore((s) => s.darkMode);

  return (
    <section className="py-16 lg:py-20 px-5 lg:px-8 max-w-4xl mx-auto" ref={ref}>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        className="text-center mb-8"
      >
        <p className={`text-[11px] font-semibold tracking-widest uppercase mb-2 ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
          1 click outreach
        </p>
        <h2 className={`text-[24px] lg:text-[32px] font-bold tracking-[-0.03em] leading-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Select. Automate. Connect.
        </h2>
        <p className={`text-sm mt-2 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
          Pick recruiters matched to your profile. Pilot crafts the note and sends connect requests on LinkedIn — automatically.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, delay: 0.15 }}
      >
        <OutreachDemo />
      </motion.div>
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
    <section id="how-it-works" className="py-16 lg:py-20 px-5 lg:px-8 max-w-6xl mx-auto" ref={ref}>
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

      <HeroSection />

      <TrustStrip />

      {/* Outreach */}
      <OutreachSection />

      {/* Divider */}
      <div className={`h-px mx-5 lg:max-w-6xl lg:mx-auto ${darkMode ? 'bg-white/[0.06]' : 'bg-gray-100'}`} />

      {/* What you get */}
      <OutcomesSection />

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
