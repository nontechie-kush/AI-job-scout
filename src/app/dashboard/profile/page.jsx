'use client';

/**
 * /dashboard/profile
 *
 * Real user data from /api/profile.
 * Sections:
 *   1. User header + stats
 *   2. Profile summary (parsed resume)
 *   3. Job preferences (editable)
 *   4. Pilot mode selector
 *   5. Notifications (cadence + push)
 *   6. Gmail status
 *   7. Dark mode + logout
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  User, FileText, Target, Mail, LogOut, Upload,
  ChevronRight, Moon, Sun, Check, Bell, BellOff,
  RefreshCw, Zap, Briefcase, MapPin, DollarSign,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import useStore from '@/store/useStore';
import PushPrompt from '@/components/PushPrompt';

// ── Helpers ───────────────────────────────────────────────────────────────

function Toggle({ on, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
        on ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-slate-700'
      } disabled:opacity-50`}
    >
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
        on ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
  );
}

function ChipRow({ options, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            onClick={() => onToggle(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              active
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function SingleChipRow({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            value === opt.value
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Pilot mode data ───────────────────────────────────────────────────────
const PILOT_MODES = [
  { value: 'steady', label: 'Steady', desc: 'Clean. Efficient. Just what matters.' },
  { value: 'coach', label: 'Coach', desc: 'Explains the why. Context + reasoning.' },
  { value: 'hype', label: 'Hype', desc: 'Your biggest fan. Full energy.' },
  { value: 'unfiltered', label: 'Unfiltered', desc: 'Raw truth. No softening.' },
];

const CADENCES = [
  { value: 'every_4h', label: 'Every 4 hours' },
  { value: 'daily', label: 'Daily digest' },
  { value: 'urgent_only', label: 'Signals only' },
  { value: 'manual', label: "I'll check" },
];

const REMOTE_PREFS = [
  { value: 'remote_only', label: 'Remote only' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite_ok', label: 'On-site ok' },
  { value: 'open', label: 'Open to all' },
];

const IC_LEAD = [
  { value: 'ic', label: 'IC track' },
  { value: 'lead', label: 'Lead track' },
  { value: 'either', label: 'Either' },
];

const COMPANY_STAGES = [
  { value: 'seed', label: 'Seed' },
  { value: 'series_a', label: 'Series A' },
  { value: 'series_b', label: 'Series B' },
  { value: 'growth', label: 'Growth' },
  { value: 'public', label: 'Public' },
];

// ── Main page ─────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [disconnectingGmail, setDisconnectingGmail] = useState(false);

  // Local editable preferences state
  const [prefs, setPrefs] = useState(null);
  const [prefsDirty, setPrefsDirty] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/profile', { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) {
        setData(json);
        setPrefs({
          pilot_mode: json.user.pilot_mode || 'steady',
          notif_cadence: json.user.notif_cadence || 'every_4h',
          target_roles: json.user.target_roles || [],
          locations: json.user.locations || [],
          remote_pref: json.user.remote_pref || 'open',
          salary_min: json.user.salary_min || '',
          salary_max: json.user.salary_max || '',
          salary_currency: json.user.salary_currency || 'INR',
          ic_or_lead: json.user.ic_or_lead || 'either',
          company_stage: json.user.company_stage || [],
        });
        setPrefsDirty(false);
      }
    } catch (e) {
      console.error('[profile]', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const updatePref = (key, value) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    setPrefsDirty(true);
  };

  const toggleArray = (key, value) => {
    setPrefs((p) => {
      const arr = p[key] || [];
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
      return { ...p, [key]: next };
    });
    setPrefsDirty(true);
  };

  const savePrefs = async () => {
    setSaving(true);
    try {
      const body = { ...prefs };
      if (body.salary_min !== '') body.salary_min = parseInt(body.salary_min, 10) || null;
      else body.salary_min = null;
      if (body.salary_max !== '') body.salary_max = parseInt(body.salary_max, 10) || null;
      else body.salary_max = null;

      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setPrefsDirty(false);
      await loadProfile();
    } finally {
      setSaving(false);
    }
  };

  // Quick-save a single field immediately (pilot mode, cadence)
  const quickSave = async (field, value) => {
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/auth/login');
  };

  const handleDisablePush = async () => {
    await fetch('/api/notifications/subscribe', { method: 'DELETE' });
    setData((d) => d ? { ...d, user: { ...d.user, notif_push: false } } : d);
  };

  const handleDisconnectGmail = async () => {
    setDisconnectingGmail(true);
    try {
      await fetch('/api/gmail/status', { method: 'DELETE' });
      setData((d) => d ? { ...d, gmail: { connected: false, last_synced_at: null } } : d);
    } finally {
      setDisconnectingGmail(false);
    }
  };

  const handleConnectGmail = async () => {
    const res = await fetch('/api/gmail/auth');
    const { url } = await res.json();
    if (url) window.location.href = url;
  };

  if (loading || !data || !prefs) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-8 h-8 spinner" />
      </div>
    );
  }

  const { user, profile, gmail, stats } = data;
  const initials = user.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user.email?.[0]?.toUpperCase() || 'U';

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
  const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="page-enter min-h-dvh bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="px-5 pt-6 pb-6 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Profile</h1>
          <button
            onClick={loadProfile}
            className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center"
          >
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* User card */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold text-xl">
            {initials}
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900 dark:text-white capitalize">
              {user.name || 'User'}
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{user.email}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Pilot Active · {PILOT_MODES.find((m) => m.value === prefs.pilot_mode)?.label || 'Steady'} mode
              </span>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { label: 'Applied', value: stats.applied },
            { label: 'Outreach', value: stats.messaged },
            { label: 'Pipeline', value: stats.pipeline },
          ].map((s) => (
            <div key={s.label} className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-gray-900 dark:text-white">{s.value}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="px-5 py-5 space-y-4">

        {/* Profile summary */}
        {profile && (
          <motion.div variants={item} className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-gray-500" />
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Profile Summary
              </p>
            </div>
            {profile.seniority && (
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{profile.seniority}</p>
            )}
            {profile.years_exp && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{profile.years_exp} years experience</p>
            )}
            {profile.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {profile.skills.map((s) => (
                  <span key={s} className="tag-pill bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 text-xs">
                    {s}
                  </span>
                ))}
              </div>
            )}
            {profile.strongest_card && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
                Strongest card: {profile.strongest_card}
              </p>
            )}
            {profile.parsed_at && (
              <p className="text-gray-400 text-xs mt-2">
                Parsed {new Date(profile.parsed_at).toLocaleDateString()} · {profile.source}
              </p>
            )}
            <button
              onClick={() => router.push('/onboarding')}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Update resume / portfolio
            </button>
          </motion.div>
        )}

        {/* Job preferences */}
        <motion.div variants={item} className="card p-4 space-y-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Job Preferences
          </p>

          {/* Location */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <MapPin className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Location</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {['india', 'usa', 'canada', 'uk', 'europe', 'thailand', 'china', 'anywhere'].map((loc) => {
                const labels = { india: 'India', usa: 'USA', canada: 'Canada', uk: 'UK', europe: 'Europe', thailand: 'Thailand', china: 'China', anywhere: 'Anywhere' };
                const active = prefs.locations.includes(loc);
                return (
                  <button key={loc} onClick={() => toggleArray('locations', loc)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${active ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400'}`}>
                    {labels[loc]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Remote pref */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Briefcase className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Work style</p>
            </div>
            <SingleChipRow options={REMOTE_PREFS} value={prefs.remote_pref} onChange={(v) => updatePref('remote_pref', v)} />
          </div>

          {/* IC / Lead */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <User className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Track</p>
            </div>
            <SingleChipRow options={IC_LEAD} value={prefs.ic_or_lead} onChange={(v) => updatePref('ic_or_lead', v)} />
          </div>

          {/* Company stage */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Company stage</p>
            </div>
            <ChipRow options={COMPANY_STAGES} selected={prefs.company_stage} onToggle={(v) => toggleArray('company_stage', v)} />
          </div>

          {/* Salary */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <DollarSign className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Salary range ({prefs.salary_currency})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <input
                  type="number"
                  placeholder="Min"
                  value={prefs.salary_min}
                  onChange={(e) => updatePref('salary_min', e.target.value)}
                  className="input-field text-sm py-2"
                />
              </div>
              <span className="text-gray-400 text-sm shrink-0">–</span>
              <div className="flex-1 min-w-0">
                <input
                  type="number"
                  placeholder="Max"
                  value={prefs.salary_max}
                  onChange={(e) => updatePref('salary_max', e.target.value)}
                  className="input-field text-sm py-2"
                />
              </div>
              <select
                value={prefs.salary_currency}
                onChange={(e) => updatePref('salary_currency', e.target.value)}
                className="input-field !w-20 shrink-0 text-xs py-2"
              >
                {['INR', 'USD', 'CAD', 'GBP', 'EUR'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Save button */}
          {prefsDirty && (
            <button
              onClick={savePrefs}
              disabled={saving}
              className="btn-gradient w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {saving ? <><div className="w-4 h-4 spinner" /> Saving…</> : <><Check className="w-4 h-4" /> Save Preferences</>}
            </button>
          )}
        </motion.div>

        {/* Pilot mode */}
        <motion.div variants={item} className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-emerald-500" />
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Pilot Mode
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PILOT_MODES.map((mode) => {
              const active = prefs.pilot_mode === mode.value;
              return (
                <button
                  key={mode.value}
                  onClick={() => {
                    updatePref('pilot_mode', mode.value);
                    quickSave('pilot_mode', mode.value);
                  }}
                  className={`p-3 rounded-xl text-left transition-all border ${
                    active
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-gray-50 dark:bg-slate-800 border-transparent text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <p className={`text-sm font-semibold ${active ? 'text-white' : ''}`}>{mode.label}</p>
                  <p className={`text-[11px] mt-0.5 ${active ? 'text-emerald-200' : 'text-gray-400'}`}>{mode.desc}</p>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Notifications */}
        <motion.div variants={item} className="card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-gray-500" />
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Notifications
            </p>
          </div>

          {/* Push toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Push notifications</p>
              <p className="text-xs text-gray-400">
                {data.user.notif_push ? 'Enabled — Pilot will reach you.' : 'Off — tap to enable'}
              </p>
            </div>
            {data.user.notif_push ? (
              <button
                onClick={handleDisablePush}
                className="flex items-center gap-1 text-xs text-red-500 font-medium"
              >
                <BellOff className="w-3.5 h-3.5" /> Disable
              </button>
            ) : (
              <button
                onClick={() => setShowPushPrompt(true)}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400"
              >
                Enable
              </button>
            )}
          </div>

          {/* Cadence */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Notification frequency</p>
            <div className="grid grid-cols-2 gap-2">
              {CADENCES.map((c) => {
                const active = prefs.notif_cadence === c.value;
                return (
                  <button
                    key={c.value}
                    onClick={() => {
                      updatePref('notif_cadence', c.value);
                      quickSave('notif_cadence', c.value);
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      active
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Gmail */}
        <motion.div variants={item} className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-4 h-4 text-gray-500" />
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Gmail Sync
            </p>
          </div>
          {gmail.connected ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Connected</span>
                </div>
                {gmail.last_synced_at && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Last sync: {new Date(gmail.last_synced_at).toLocaleString()}
                  </p>
                )}
              </div>
              <button
                onClick={handleDisconnectGmail}
                disabled={disconnectingGmail}
                className="text-xs text-red-500 font-medium disabled:opacity-50"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Not connected</p>
                <p className="text-xs text-gray-400 mt-0.5">Auto-track application status from ATS emails</p>
              </div>
              <button
                onClick={handleConnectGmail}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"
              >
                Connect <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </motion.div>

        {/* Dark mode */}
        <motion.div variants={item} className="card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                {darkMode ? <Moon className="w-4 h-4 text-gray-400" /> : <Sun className="w-4 h-4 text-gray-600" />}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Dark Mode</p>
                <p className="text-xs text-gray-400">{darkMode ? 'Currently on' : 'Currently off'}</p>
              </div>
            </div>
            <Toggle on={darkMode} onChange={toggleDarkMode} />
          </div>
        </motion.div>

        {/* Logout */}
        <motion.div variants={item} className="card p-4">
          {showLogout ? (
            <div className="space-y-3">
              <p className="text-sm text-center text-gray-700 dark:text-gray-300 font-medium">
                Log out of CareerPilot?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogout(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-semibold"
                >
                  Log Out
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowLogout(true)}
              className="w-full flex items-center gap-3 py-1 text-red-500 dark:text-red-400"
            >
              <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <LogOut className="w-4 h-4 text-red-500" />
              </div>
              <span className="text-sm font-medium">Log Out</span>
            </button>
          )}
        </motion.div>

        <div className="text-center pb-4">
          <p className="text-gray-400 text-xs">CareerPilot AI · All phases complete</p>
        </div>
      </motion.div>

      {/* Push prompt overlay */}
      {showPushPrompt && (
        <div className="fixed inset-0 z-50">
          <PushPrompt forceShow onSubscribed={() => {
            setShowPushPrompt(false);
            loadProfile();
          }} />
        </div>
      )}
    </div>
  );
}
