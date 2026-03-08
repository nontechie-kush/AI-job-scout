'use client';

/**
 * Onboarding — 3-step Pilot-led flow
 *
 * Step 1: Profile import (PDF primary, website secondary, paste tertiary)
 * Step 2: 3 quick preference taps (location, IC/lead, company stage)
 * Step 3: Pilot scanning narration → redirect to dashboard
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Globe, FileText, CheckCircle2, ChevronRight, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const TOTAL_STEPS = 3;

// ── Step 1: Profile Import ─────────────────────────────────────
function StepImport({ onNext, onProfileParsed }) {
  const [mode, setMode] = useState('idle'); // idle | parsing | done | error
  const [inputType, setInputType] = useState(null);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [parsedProfile, setParsedProfile] = useState(null);
  const [pilotLines, setPilotLines] = useState([]);
  const fileInputRef = useRef(null);

  const addLine = (line) => setPilotLines((prev) => [...prev, line]);

  const parseProfile = async (payload) => {
    setMode('parsing');
    setPilotLines([]);

    const linesByType = {
      pdf: ['Reading your resume...', 'Pulling out your experience...', 'Mapping your skills...', 'Got it.'],
      website: ['Hitting your portfolio...', 'Reading through your work...', 'Extracting what matters...', 'Done.'],
      paste: ['Going through what you shared...', 'Pulling out the signal...', 'Mapping your background...', 'Done.'],
    };
    const lines = linesByType[payload.get('type')] || linesByType.paste;

    // Stagger pilot narration lines while API runs in background
    const linePromise = (async () => {
      for (let i = 0; i < lines.length - 1; i++) {
        await new Promise((r) => setTimeout(r, 600 + i * 400));
        addLine(lines[i]);
      }
    })();

    try {
      const res = await fetch('/api/onboarding/parse-profile', { method: 'POST', body: payload });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Parse failed');

      await linePromise;
      addLine(lines[lines.length - 1]);
      await new Promise((r) => setTimeout(r, 400));

      setParsedProfile(data);
      onProfileParsed(data);
      setMode('done');
    } catch {
      await linePromise;
      addLine('Hmm. Something went sideways. Try again.');
      setMode('error');
    }
  };

  const handlePdfUpload = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      addLine("That file's too big. Keep it under 5MB.");
      return;
    }
    const isDocx = file.name?.toLowerCase().endsWith('.docx')
      || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    setInputType('pdf');
    const formData = new FormData();
    formData.append('type', isDocx ? 'docx' : 'pdf');
    formData.append('file', file);
    await parseProfile(formData);
  };

  const handleWebsite = async () => {
    if (!websiteUrl.trim()) return;
    setInputType('website');
    const formData = new FormData();
    formData.append('type', 'website');
    formData.append('url', websiteUrl.trim());
    await parseProfile(formData);
  };

  const handlePaste = async () => {
    if (pasteText.trim().length < 50) {
      addLine('Give me more to work with. Paste your full resume text.');
      return;
    }
    setInputType('paste');
    const formData = new FormData();
    formData.append('type', 'paste');
    formData.append('text', pasteText.trim());
    await parseProfile(formData);
  };

  // ── Idle / Error state ──
  if (mode === 'idle' || mode === 'error') {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-2">
            Pilot
          </p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
            Alright. I need to know what I'm working with.
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm leading-relaxed">
            Drop your resume — PDF works best.
          </p>
        </div>

        {/* Primary: PDF upload */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-violet-300 dark:border-violet-700 rounded-2xl p-6 flex flex-col items-center gap-3 hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all active:scale-[0.98]"
        >
          <div className="w-14 h-14 rounded-2xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
            <Upload className="w-6 h-6 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-800 dark:text-gray-200">Upload resume</p>
            <p className="text-gray-400 text-xs mt-1">PDF or Word (.docx) · Up to 5MB</p>
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handlePdfUpload(e.target.files[0])}
        />

        <p className="text-center text-gray-400 text-xs -mt-2">
          Tip: Export from LinkedIn → Me → Settings → Save to PDF
        </p>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
          <span className="text-gray-400 text-xs">or</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
        </div>

        {/* Secondary: Website URL */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="url"
              placeholder="Portfolio or website URL"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className="input-field pl-10"
              onKeyDown={(e) => e.key === 'Enter' && handleWebsite()}
            />
          </div>
          <button
            onClick={handleWebsite}
            disabled={!websiteUrl.trim()}
            className="btn-gradient px-4 rounded-xl text-white font-semibold text-sm disabled:opacity-40"
          >
            Go
          </button>
        </div>

        {/* Tertiary: Paste text */}
        <details>
          <summary className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer flex items-center gap-1.5 list-none select-none">
            <FileText className="w-3.5 h-3.5" />
            Paste resume text instead
          </summary>
          <div className="mt-3 flex flex-col gap-2">
            <textarea
              rows={5}
              placeholder="Paste your resume text here..."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              className="input-field resize-none text-sm"
            />
            <button
              onClick={handlePaste}
              disabled={pasteText.trim().length < 50}
              className="btn-gradient py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-40"
            >
              Parse this →
            </button>
          </div>
        </details>

        {mode === 'error' && pilotLines.length > 0 && (
          <p className="text-red-500 text-sm text-center">{pilotLines[pilotLines.length - 1]}</p>
        )}
      </div>
    );
  }

  // ── Parsing state ──
  if (mode === 'parsing') {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-2">
            Pilot
          </p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">On it.</h2>
        </div>
        <div className="card p-6 space-y-3 min-h-[160px]">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-5 h-5 spinner flex-shrink-0" />
            <span className="text-gray-500 dark:text-gray-400 text-xs">Reading your profile...</span>
          </div>
          {pilotLines.map((line, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="text-gray-500 dark:text-gray-400 text-sm pl-8"
            >
              {line}
            </motion.p>
          ))}
        </div>
      </div>
    );
  }

  // ── Done state ──
  if (mode === 'done' && parsedProfile) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        <div>
          <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-2">
            Pilot
          </p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
            Got it. Here's what I'm working with.
          </h2>
        </div>

        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span className="font-semibold text-gray-800 dark:text-gray-200">Profile read</span>
          </div>
          <div className="space-y-3">
            {parsedProfile.title && (
              <div className="flex gap-3">
                <span className="text-gray-400 text-sm w-20 shrink-0">Role</span>
                <span className="text-gray-900 dark:text-white text-sm font-medium">{parsedProfile.title}</span>
              </div>
            )}
            {parsedProfile.years_exp && (
              <div className="flex gap-3">
                <span className="text-gray-400 text-sm w-20 shrink-0">Experience</span>
                <span className="text-gray-900 dark:text-white text-sm font-medium">
                  {parsedProfile.years_exp} years
                </span>
              </div>
            )}
            {parsedProfile.skills?.length > 0 && (
              <div className="flex gap-3 items-start">
                <span className="text-gray-400 text-sm w-20 shrink-0 mt-0.5">Skills</span>
                <div className="flex flex-wrap gap-1.5">
                  {parsedProfile.skills.slice(0, 8).map((s) => (
                    <span
                      key={s}
                      className="tag-pill bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {parsedProfile.strongest_card && (
              <div className="flex gap-3 items-start">
                <span className="text-gray-400 text-sm w-20 shrink-0 mt-0.5">Your edge</span>
                <span className="text-gray-600 dark:text-gray-300 text-sm">{parsedProfile.strongest_card}</span>
              </div>
            )}
          </div>
          <p className="text-gray-400 text-xs">You can edit this in profile settings anytime.</p>
        </div>

        <button
          onClick={onNext}
          className="btn-gradient py-4 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2"
        >
          Good, what's next? <ChevronRight className="w-4 h-4" />
        </button>
      </motion.div>
    );
  }

  return null;
}

// ── Step 2: Target Roles + Preferences ────────────────────────
function StepPreferences({ onNext, onPrefsSet, jobSearchTitles }) {
  const suitable = jobSearchTitles?.suitable || [];
  const maybe    = jobSearchTitles?.maybe    || [];

  const [roles, setRoles] = useState(suitable.slice(0, 3));
  const [maybeAdded, setMaybeAdded] = useState([]); // user-opted-in maybe titles
  const [roleInput, setRoleInput] = useState('');
  const [prefs, setPrefs] = useState({ locations: [], ic_or_lead: null, stage: null });

  const addRole = () => {
    const trimmed = roleInput.trim();
    if (trimmed && roles.length < 5 && !roles.includes(trimmed)) {
      setRoles((r) => [...r, trimmed]);
    }
    setRoleInput('');
  };
  const removeRole = (r) => setRoles((prev) => prev.filter((x) => x !== r));

  const toggleMaybe = (title) => {
    if (roles.includes(title)) {
      // already added via suitable — remove
      setRoles((prev) => prev.filter((x) => x !== title));
      setMaybeAdded((prev) => prev.filter((x) => x !== title));
    } else if (roles.length < 5) {
      setRoles((prev) => [...prev, title]);
      setMaybeAdded((prev) => [...prev, title]);
    }
  };

  const toggleLocation = (val) =>
    setPrefs((p) => ({
      ...p,
      locations: p.locations.includes(val) ? p.locations.filter((l) => l !== val) : [...p.locations, val],
    }));
  const set = (key, val) => setPrefs((p) => ({ ...p, [key]: val }));
  const allSet = roles.length > 0 && prefs.locations.length > 0 && prefs.ic_or_lead && prefs.stage;

  const locationLabels = { india: 'India', us_canada: 'US / Canada', remote: 'Remote' };
  const pilotSummary = allSet
    ? `Looking for ${roles.slice(0, 2).join(' / ')}${roles.length > 2 ? ` +${roles.length - 2} more` : ''}. ${prefs.locations.map((l) => locationLabels[l]).join(' + ')}. ${
        prefs.ic_or_lead === 'ic' ? 'IC track.' : prefs.ic_or_lead === 'lead' ? 'Leadership.' : 'IC or lead.'
      } ${prefs.stage === 'startup' ? 'Early-stage.' : prefs.stage === 'growth' ? 'Growth.' : 'All stages.'} On it.`
    : null;

  // maybe titles not yet added
  const maybeUnselected = maybe.filter((t) => !roles.includes(t));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-2">
          Pilot
        </p>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">I mapped your search.</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">Confirm what looks right. Add more if needed.</p>
      </div>

      {/* Suitable titles — pre-selected */}
      <div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
          These look right for you
        </p>
        <div className="flex flex-wrap gap-2">
          {roles.map((r) => (
            <span
              key={r}
              className="flex items-center gap-1.5 bg-violet-600 text-white text-sm font-medium px-3 py-1.5 rounded-full"
            >
              {r}
              <button onClick={() => removeRole(r)} className="opacity-70 hover:opacity-100 leading-none">&times;</button>
            </span>
          ))}
        </div>
        {roles.length === 0 && (
          <p className="text-xs text-gray-400 mt-1">All removed — add titles below.</p>
        )}
      </div>

      {/* Maybe titles — opt-in */}
      {maybeUnselected.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Worth exploring?</p>
          <p className="text-xs text-gray-400 mb-2">Based on your background — tap to add</p>
          <div className="flex flex-wrap gap-2">
            {maybeUnselected.map((title) => (
              <button
                key={title}
                onClick={() => toggleMaybe(title)}
                disabled={roles.length >= 5}
                className="flex items-center gap-1 border border-dashed border-violet-300 dark:border-violet-700 text-violet-600 dark:text-violet-400 text-sm font-medium px-3 py-1.5 rounded-full hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors disabled:opacity-40"
              >
                <span className="text-base leading-none">+</span> {title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom add */}
      {roles.length < 5 && (
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Add your own</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Growth Lead, Chief of Staff…"
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addRole(); }
              }}
              className="input-field flex-1 text-sm"
            />
            <button
              onClick={addRole}
              disabled={!roleInput.trim()}
              className="btn-gradient px-4 rounded-xl text-white font-semibold text-sm disabled:opacity-40"
            >
              Add
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Up to 5 titles total.</p>
        </div>
      )}

      {/* Location — multi-select */}
      <div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Where?</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { val: 'india', label: '🇮🇳 India' },
            { val: 'us_canada', label: '🇺🇸 US / Canada' },
            { val: 'remote', label: '🌏 Remote anywhere' },
          ].map(({ val, label }) => (
            <button
              key={val}
              onClick={() => toggleLocation(val)}
              className={`py-3 px-2 rounded-xl text-xs font-medium border transition-all text-center ${
                prefs.locations.includes(val)
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* IC or Lead */}
      <div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">IC or leadership track?</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { val: 'ic', label: 'IC — head down, ship fast' },
            { val: 'lead', label: 'Lead — own a team' },
            { val: 'both', label: 'Open to both' },
          ].map(({ val, label }) => (
            <button
              key={val}
              onClick={() => set('ic_or_lead', val)}
              className={`py-3 px-2 rounded-xl text-xs font-medium border transition-all text-center leading-tight ${
                prefs.ic_or_lead === val
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Company Stage */}
      <div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">What kind of company?</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { val: 'startup', label: '🚀 Early-stage (Seed–A)' },
            { val: 'growth', label: '📈 Growth (B–D)' },
            { val: 'any', label: '⚡ Anything fast-moving' },
          ].map(({ val, label }) => (
            <button
              key={val}
              onClick={() => set('stage', val)}
              className={`py-3 px-2 rounded-xl text-xs font-medium border transition-all text-center leading-tight ${
                prefs.stage === val
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Pilot confirmation line */}
      <AnimatePresence>
        {pilotSummary && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-sm text-violet-600 dark:text-violet-400 font-medium"
          >
            {pilotSummary}
          </motion.p>
        )}
      </AnimatePresence>

      <button
        onClick={() => {
          onPrefsSet({ ...prefs, target_roles: roles });
          onNext();
        }}
        disabled={!allSet}
        className="btn-gradient py-4 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
      >
        Let's go <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Step 3: Pilot Scanning ─────────────────────────────────────
function StepScanning({ onFinish, parsedProfile, preferences }) {
  const [lines, setLines] = useState([]);
  const [phase, setPhase] = useState('scanning'); // scanning | done

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const firstName = parsedProfile?.name?.split(' ')[0] || 'Hey';

      const sourceMap = {
        india: 'Cutshort, Hirist, Naukri',
        us_canada: 'Wellfound, YC, Greenhouse',
        remote: 'Remote boards globally',
      };
      const locs = preferences?.locations || [];
      const locationLabel =
        locs.length === 0 ? 'every source I have' : locs.map((l) => sourceMap[l] || l).join(' + ');

      const stageLabel =
        preferences?.stage === 'startup'
          ? 'Focusing on early-stage — Seed through Series A.'
          : preferences?.stage === 'growth'
            ? 'Targeting growth-stage — Series B and beyond.'
            : 'Looking across all stages.';

      const trackLabel =
        preferences?.ic_or_lead === 'ic'
          ? 'IC roles only. No management titles.'
          : preferences?.ic_or_lead === 'lead'
            ? 'Leadership tracks. Team ownership roles.'
            : 'IC and lead. Full spread.';

      const targetRoles = preferences?.target_roles || [];
      const roleLabel = targetRoles.length > 0 ? targetRoles.join(', ') : 'roles matching your background';

      const scanLines = [
        `Alright, ${firstName}. Targeting ${roleLabel}.`,
        `Hitting ${locationLabel}.`,
        stageLabel,
        trackLabel,
        'Cross-referencing against your profile. Filtering the noise.',
        'Profile locked in. First scan queued.',
      ];

      // Show lines with stagger
      for (let i = 0; i < scanLines.length; i++) {
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, 600 + i * 300));
        setLines((prev) => [...prev, scanLines[i]]);
      }

      // Call save-preferences (non-blocking — don't await)
      fetch('/api/onboarding/save-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: parsedProfile, preferences }),
      }).catch(() => {});

      await new Promise((r) => setTimeout(r, 600));
      if (!cancelled) setPhase('done');
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-2">
          Pilot
        </p>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
          {phase === 'scanning' ? 'Scanning now.' : "You're in."}
        </h2>
      </div>

      <div className="card p-5 space-y-3 min-h-[200px]">
        {phase === 'scanning' && (
          <div className="flex items-center gap-3 mb-1">
            <div className="w-4 h-4 spinner flex-shrink-0" />
            <span className="text-gray-400 text-xs">Live scanning...</span>
          </div>
        )}
        {lines.map((line, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className={`text-sm ${
              i === lines.length - 1 && phase === 'done'
                ? 'text-gray-900 dark:text-white font-semibold'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {line}
          </motion.p>
        ))}
      </div>

      {phase === 'done' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            First scan runs in the background. Matches land within the hour — I'll notify you.
          </p>
          <button
            onClick={onFinish}
            className="btn-gradient w-full py-4 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Go to dashboard
          </button>
        </motion.div>
      )}
    </div>
  );
}

// ── Main Onboarding Page ──────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [parsedProfile, setParsedProfile] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace('/auth/login');
      else setReady(true);
    });
  }, []);

  if (!ready) return null;

  const next = () => setStep((s) => s + 1);
  const finish = () => router.replace('/dashboard');

  const variants = {
    enter: { opacity: 0, x: 40 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
  };

  return (
    <div className="h-dvh flex flex-col bg-gray-50 dark:bg-slate-950 overflow-hidden">
      {/* Progress header */}
      <div className="px-6 header-safe-top pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">CP</span>
            </div>
            <span className="text-gray-500 dark:text-gray-400 text-sm">Setup</span>
          </div>
          <span className="text-gray-400 text-sm">
            {step} / {TOTAL_STEPS}
          </span>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className="flex-1 h-1.5 rounded-full overflow-hidden bg-gray-200 dark:bg-slate-700">
              <motion.div
                className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full"
                initial={false}
                animate={{ width: i < step ? '100%' : '0%' }}
                transition={{ duration: 0.35 }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 px-6 overflow-y-auto pb-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            {step === 1 && <StepImport onNext={next} onProfileParsed={(p) => setParsedProfile(p)} />}
            {step === 2 && <StepPreferences onNext={next} onPrefsSet={(p) => setPreferences(p)} jobSearchTitles={parsedProfile?.job_search_titles} />}
            {step === 3 && (
              <StepScanning onFinish={finish} parsedProfile={parsedProfile} preferences={preferences} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
