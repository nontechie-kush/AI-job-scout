'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: 'easeOut' },
});

// ── Navbar ────────────────────────────────────────────────────
function Navbar({ onCTA }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 glass-nav border-b px-5 py-3.5 flex items-center justify-between lg:px-8 transition-all ${scrolled ? 'border-white/10' : 'border-transparent'}`}>
      <div className="flex items-center gap-2.5 font-bold text-base tracking-tight text-white">
        <div className="w-[26px] h-[26px] rounded-[7px] bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center text-[13px] font-extrabold text-slate-950">
          ⌘
        </div>
        CareerPilot
      </div>
      <button
        onClick={onCTA}
        className="px-4 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-slate-300 text-[13px] font-medium transition-colors hover:bg-white/10 hidden sm:block"
      >
        Get early access
      </button>
    </nav>
  );
}

// ── Hero ──────────────────────────────────────────────────────
function HeroSection({ onCTA }) {
  return (
    <section className="relative pt-28 pb-8 text-center xl:text-left xl:pt-0 xl:pb-0 overflow-hidden px-5 xl:px-0">
      <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-[360px] h-[360px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(74,222,128,0.08) 0%, transparent 70%)' }} />
      <div className="relative">
        <motion.div
          {...fadeUp(0)}
          className="inline-flex items-center gap-1.5 px-3 py-1 pr-3.5 rounded-full bg-green-400/10 border border-green-400/20 text-xs text-green-400 font-medium mb-6"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-blink" />
          Scanning jobs right now
        </motion.div>

        <motion.h1
          {...fadeUp(0.06)}
          className="text-[38px] xl:text-[56px] font-extrabold tracking-[-0.045em] leading-[1.05] mb-4 text-white"
        >
          Never search{' '}
          <br className="hidden lg:block" />
          <span className="text-gradient-hero">for jobs</span> again.
        </motion.h1>

        <motion.p
          {...fadeUp(0.12)}
          className="text-[15px] leading-relaxed text-slate-400 max-w-md mx-auto xl:mx-0 mb-7"
        >
          CareerPilot finds jobs, identifies referrals, and drafts applications — automatically. You review. You submit. That&apos;s it.
        </motion.p>

        <motion.button
          {...fadeUp(0.18)}
          onClick={onCTA}
          className="inline-flex items-center justify-center gap-2 w-full max-w-[320px] xl:w-auto py-[15px] px-7 rounded-xl bg-green-400 text-slate-950 font-bold text-[15px] glow-primary transition-transform active:scale-[0.97] hover:bg-green-300"
        >
          Start your autopilot →
        </motion.button>

        <motion.p
          {...fadeUp(0.22)}
          className="mt-3.5 text-xs text-slate-500 flex items-center justify-center xl:justify-start gap-1.5"
        >
          🔒 Scans 20+ job boards every 4 hours
        </motion.p>
      </div>
    </section>
  );
}

// ── Dashboard Preview ─────────────────────────────────────────
const jobs = [
  { role: 'Product Manager', co: 'Stripe · SF · $180–220K', score: 92, hi: true, tags: ['Draft ready', 'Recruiter found'] },
  { role: 'Sr. Frontend Engineer', co: 'Vercel · Remote · $170–210K', score: 89, hi: true, tags: ['Draft ready', '2 referral paths'] },
  { role: 'Product Designer', co: 'Linear · Remote · $150–190K', score: 78, hi: false, tags: ['Drafting…'] },
];
const activity = [
  { time: '10:14', msg: 'Found PM role at <b>Notion</b>' },
  { time: '10:16', msg: 'Drafted app for <b>Stripe</b>' },
  { time: '10:18', msg: 'Found recruiter at <b>Vercel</b>' },
  { time: '10:22', msg: '3 new matches at <b>Figma</b>' },
];
const referrals = [
  { initials: 'AK', name: 'Anika Kapoor', role: 'Eng Manager, Stripe', pct: 87 },
  { initials: 'JL', name: 'James Liu', role: 'Recruiter, Vercel', pct: 74 },
  { initials: 'SM', name: 'Sara Mitchell', role: 'Design Lead, Linear', pct: 69 },
];

function DashboardPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.32, ease: 'easeOut' }}
      className="mx-5 mt-6 xl:mx-0 xl:mt-0"
    >
      <div className="rounded-2xl overflow-hidden dash-shadow border border-white/10" style={{ background: 'hsl(240 4% 10%)' }}>
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.08]" style={{ background: 'hsl(240 5% 7%)' }}>
          <div className="flex gap-1.5">
            {[0,1,2].map(i => <span key={i} className="w-[9px] h-[9px] rounded-full bg-white/10" />)}
          </div>
          <span className="font-mono text-[10px] font-medium text-green-400 flex items-center gap-1.5">
            <span className="w-[5px] h-[5px] rounded-full bg-green-400 animate-blink" />
            Autopilot active
          </span>
        </div>

        <div className="p-3.5 xl:grid xl:grid-cols-3 xl:gap-4">
          {/* Job feed */}
          <div className="lg:col-span-2">
            <p className="font-mono text-[9px] font-medium tracking-widest uppercase text-slate-500 mb-2.5">Job Feed — 12 new</p>
            <div className="space-y-2">
              {jobs.map((j) => (
                <div key={j.role} className="rounded-[11px] p-3.5 border border-white/[0.08]" style={{ background: 'hsl(240 5% 7%)' }}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-sm font-semibold tracking-tight leading-tight text-white">{j.role}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{j.co}</div>
                    </div>
                    <span className={`font-mono text-xs font-medium px-2 py-0.5 rounded-md ml-2.5 shrink-0 ${j.hi ? 'text-green-400 bg-green-400/10' : 'text-amber-400 bg-amber-400/10'}`}>
                      {j.score}%
                    </span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {j.tags.map((t) => (
                      <span key={t} className="text-[10.5px] px-2 py-0.5 rounded-[5px] bg-white/[0.04] text-slate-400 flex items-center gap-1">
                        {t.startsWith('Drafting') ? '⟳' : <span className="text-green-400 text-[10px]">✓</span>}
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="mt-3.5 pt-3.5 border-t border-white/[0.08] xl:mt-0 xl:pt-0 xl:border-t-0 xl:border-l xl:border-white/[0.08] xl:pl-4">
            <p className="font-mono text-[9px] font-medium tracking-widest uppercase text-slate-500 mb-2.5">Activity</p>
            <div className="space-y-2 mb-4">
              {activity.map((a) => (
                <div key={a.time} className="flex gap-2 items-start">
                  <span className="font-mono text-[10px] text-slate-500 min-w-[38px] pt-px">{a.time}</span>
                  <span className="text-xs text-slate-400 leading-snug" dangerouslySetInnerHTML={{ __html: a.msg.replace(/<b>(.*?)<\/b>/g, '<span class="text-white font-medium">$1</span>') }} />
                </div>
              ))}
            </div>
            <div className="pt-3.5 border-t border-white/[0.08]">
              <p className="font-mono text-[9px] font-medium tracking-widest uppercase text-slate-500 mb-2.5">Referrals</p>
              {referrals.map((r) => (
                <div key={r.initials} className="flex items-center gap-2.5 py-2 border-b border-white/[0.06] last:border-b-0">
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-semibold text-slate-400 shrink-0">{r.initials}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-white">{r.name}</div>
                    <div className="text-[10px] text-slate-500 truncate">{r.role}</div>
                  </div>
                  <span className="font-mono text-[11px] text-green-400 font-medium shrink-0">{r.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Problem Section ───────────────────────────────────────────
const problems = [
  { num: '01', title: 'Endless scrolling', desc: 'LinkedIn, Greenhouse, Lever, Wellfound — every day, same boards, mostly the same listings.' },
  { num: '02', title: 'Repetitive applications', desc: 'Same info, different format. Copy, paste, tweak, repeat. For every single company.' },
  { num: '03', title: 'Cold outreach that dies', desc: 'You message recruiters with no idea who\'s responsive or even hiring for your role.' },
];

function ProblemSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <section className="py-[72px] px-5 lg:px-8 max-w-7xl mx-auto" ref={ref}>
      <p className="font-mono text-[10px] font-medium tracking-widest uppercase text-green-400 mb-2.5">The problem</p>
      <h2 className="text-[26px] lg:text-[36px] font-bold tracking-[-0.035em] leading-[1.15] mb-2.5 text-white">
        Job searching is<br />a full-time job.
      </h2>
      <p className="text-sm text-slate-400 leading-relaxed mb-8 max-w-md">
        You spend more time searching than interviewing. CareerPilot fixes that.
      </p>
      <div className="grid gap-2.5 lg:grid-cols-3">
        {problems.map((p, i) => (
          <motion.div
            key={p.num}
            initial={{ opacity: 0, y: 18 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="border border-white/[0.08] rounded-[14px] p-6 relative overflow-hidden"
            style={{ background: 'hsl(240 4% 10%)' }}
          >
            <span className="absolute top-3 right-4 font-mono text-4xl font-bold text-white/[0.03]">{p.num}</span>
            <h3 className="text-base font-semibold tracking-tight mb-1.5 text-white">{p.title}</h3>
            <p className="text-[13px] text-slate-500 leading-relaxed">{p.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ── Features Section ──────────────────────────────────────────
const features = [
  { icon: '🔍', title: 'Jobs auto-discovered', desc: '20+ job boards scanned every 4 hours. Only roles matching your profile, skills, and preferences surface. No noise.' },
  { icon: '🤝', title: 'Referrals ranked', desc: 'For every match, we find internal contacts and recruiters — ranked by response probability — with outreach messages ready.' },
  { icon: '✍️', title: 'Applications drafted', desc: 'AI writes tailored cover letters and fills applications from your resume. Review, tweak, submit.' },
];

function FeaturesSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <section className="py-[72px] px-5 lg:px-8 max-w-7xl mx-auto" ref={ref}>
      <p className="font-mono text-[10px] font-medium tracking-widest uppercase text-green-400 mb-2.5">What you get</p>
      <h2 className="text-[26px] lg:text-[36px] font-bold tracking-[-0.035em] leading-[1.15] mb-2.5 text-white">
        Three systems running for you.
      </h2>
      <p className="text-sm text-slate-400 leading-relaxed mb-8 max-w-md">
        Working in the background so you don&apos;t have to.
      </p>
      <div className="grid gap-2.5 lg:grid-cols-3">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 18 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="border border-white/[0.08] rounded-[14px] p-6 relative overflow-hidden"
            style={{ background: 'hsl(240 4% 10%)' }}
          >
            <div className="absolute top-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-green-400 to-transparent opacity-20" />
            <div className="w-9 h-9 rounded-[9px] bg-green-400/10 flex items-center justify-center text-base mb-4">
              {f.icon}
            </div>
            <h3 className="text-base font-semibold tracking-tight mb-1.5 text-white">{f.title}</h3>
            <p className="text-[13px] text-slate-500 leading-relaxed">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ── How It Works ──────────────────────────────────────────────
const steps = [
  { icon: '📄', num: '01', title: 'Upload your resume', desc: 'Drop your resume. Set role, location, and salary preferences.' },
  { icon: '⚙️', num: '02', title: 'Autopilot starts', desc: 'CareerPilot starts scanning boards and building your match feed.' },
  { icon: '📋', num: '03', title: 'Review your feed', desc: 'Check matched jobs, drafted apps, and referral suggestions.' },
  { icon: '🚀', num: '04', title: 'Submit and connect', desc: 'Approve applications and send referral messages in one tap.' },
];

function HowItWorksSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <section id="how" className="py-[72px] px-5 lg:px-8 max-w-7xl mx-auto" ref={ref}>
      <p className="font-mono text-[10px] font-medium tracking-widest uppercase text-green-400 mb-2.5">How it works</p>
      <h2 className="text-[26px] lg:text-[36px] font-bold tracking-[-0.035em] leading-[1.15] mb-2.5 text-white">
        Five minutes of setup.<br />Then autopilot.
      </h2>
      <div className="relative mt-8">
        <div className="absolute left-[19px] top-6 bottom-6 w-px bg-white/[0.08] lg:hidden" />
        <div className="space-y-0 lg:grid lg:grid-cols-2 lg:gap-x-16">
          {steps.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 18 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="flex gap-4 items-start py-4 relative"
            >
              <div className="w-10 h-10 rounded-full border border-white/10 bg-white/[0.04] flex items-center justify-center text-[15px] shrink-0 relative z-10">
                {s.icon}
              </div>
              <div className="flex-1 pt-1">
                <span className="font-mono text-[10px] text-green-400 font-medium">{s.num}</span>
                <h3 className="text-[15px] font-semibold tracking-tight mt-1 mb-1 text-white">{s.title}</h3>
                <p className="text-[13px] text-slate-500 leading-snug">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Automation Section ────────────────────────────────────────
const chips = [
  { label: 'LinkedIn', color: 'bg-green-400' },
  { label: 'Greenhouse', color: 'bg-blue-400' },
  { label: 'Drafting', color: 'bg-amber-400' },
  { label: 'Referrals', color: 'bg-violet-400' },
];

function AutomationSection() {
  return (
    <section className="py-[72px] px-5 lg:px-8 max-w-7xl mx-auto">
      <div className="border border-white/[0.08] rounded-2xl p-8 text-center relative overflow-hidden"
        style={{ background: 'hsl(240 4% 10%)' }}>
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[300px] h-[200px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(74,222,128,0.05) 0%, transparent 70%)' }} />
        <h3 className="text-[22px] lg:text-[28px] font-bold tracking-[-0.03em] mt-2.5 mb-2.5 relative text-white">Always running</h3>
        <p className="text-xl font-bold tracking-tight mb-2.5 relative text-white">Your AI agent never stops.</p>
        <p className="text-[13px] text-slate-400 leading-relaxed mb-7 max-w-md mx-auto relative">
          While you sleep, interview, or take a break — CareerPilot keeps scanning, matching, and drafting. Open your phone to a fresh feed.
        </p>
        <div className="flex flex-wrap gap-2 justify-center relative">
          {chips.map((c, i) => (
            <span
              key={c.label}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-[9px] border border-white/[0.08] font-mono text-[11px] text-slate-400 animate-chip-float"
              style={{ background: 'hsl(240 5% 7%)', animationDelay: `${i * 0.4}s` }}
            >
              <span className={`w-[5px] h-[5px] rounded-full ${c.color}`} />
              {c.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Final CTA ─────────────────────────────────────────────────
function FinalCTA({ onCTA }) {
  return (
    <section id="cta" className="py-[72px] px-5 lg:px-8 text-center max-w-7xl mx-auto">
      <h2 className="text-[30px] lg:text-[42px] font-extrabold tracking-[-0.04em] leading-[1.1] mb-2.5 text-white">
        Put your search<br />on autopilot.
      </h2>
      <p className="text-sm text-slate-400 mb-6">Stop scrolling. Start interviewing.</p>
      <button
        onClick={onCTA}
        className="inline-flex items-center justify-center gap-2 w-full max-w-[320px] xl:w-auto py-[15px] px-7 rounded-xl bg-green-400 text-slate-950 font-bold text-[15px] glow-primary transition-transform active:scale-[0.97] hover:bg-green-300 mb-3"
      >
        Get early access — free →
      </button>
      <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
        🔒 No credit card · Cancel anytime
      </p>
    </section>
  );
}

// ── Sticky mobile bar ─────────────────────────────────────────
function StickyBar({ onCTA }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const fn = () => setShow(window.scrollY > 400);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 glass-sticky border-t border-white/[0.08] flex gap-2.5 px-5 py-3 transition-transform duration-300 xl:hidden ${show ? 'translate-y-0' : 'translate-y-full'}`}
      style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
      <button
        onClick={onCTA}
        className="flex-1 py-3.5 rounded-[10px] bg-green-400 text-slate-950 font-bold text-sm text-center transition-opacity active:opacity-85"
      >
        Get early access →
      </button>
      <a href="#how"
        className="py-3.5 px-4 rounded-[10px] bg-white/[0.06] border border-white/10 text-slate-400 text-[13px] font-medium flex items-center active:bg-white/10">
        How?
      </a>
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────
function Divider() {
  return <div className="h-px bg-white/[0.06] mx-5 lg:max-w-7xl lg:mx-auto" />;
}

// ── Main Page ─────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

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

  if (checking) {
    return (
      <div className="min-h-dvh flex items-center justify-center lp-root">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-green-400"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="lp-root min-h-screen pb-20 xl:pb-0">
      <Navbar onCTA={goSignup} />

      {/* Hero + Dashboard: side-by-side on desktop */}
      <div className="max-w-7xl mx-auto xl:grid xl:grid-cols-2 xl:gap-12 xl:items-center xl:px-8 xl:pt-32">
        <HeroSection onCTA={goSignup} />
        <DashboardPreview />
      </div>

      <Divider />
      <ProblemSection />
      <Divider />
      <FeaturesSection />
      <Divider />
      <HowItWorksSection />
      <Divider />
      <AutomationSection />
      <FinalCTA onCTA={goSignup} />

      <footer className="border-t border-white/[0.06] py-7 px-5 text-center">
        <p className="text-[11px] text-slate-500 leading-snug">
          © 2026 CareerPilot<br />
          Built for people who&apos;d rather interview than job hunt.
        </p>
      </footer>

      <StickyBar onCTA={goSignup} />
    </div>
  );
}
