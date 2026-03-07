-- ============================================================
-- CareerPilot AI — Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Order matters: referenced tables must exist before foreign keys.
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── USERS ───────────────────────────────────────────────────
-- Extends Supabase auth.users. Created automatically on signup via trigger.
CREATE TABLE public.users (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT UNIQUE NOT NULL,
  name                TEXT,
  avatar_url          TEXT,

  -- Job preferences (denormalized for fast reads)
  target_roles        TEXT[]      DEFAULT '{}',
  locations           TEXT[]      DEFAULT '{}',
  remote_pref         TEXT        DEFAULT 'open'    CHECK (remote_pref IN ('remote_only','hybrid','onsite_ok','open')),
  salary_min          INT,
  salary_max          INT,
  salary_currency     TEXT        DEFAULT 'INR',
  visa_needed         BOOLEAN     DEFAULT FALSE,
  ic_or_lead          TEXT        DEFAULT 'either' CHECK (ic_or_lead IN ('ic','lead','either')),
  company_stage       TEXT[]      DEFAULT '{}',     -- seed|series_a|series_b|growth|public

  -- Pilot AI personality
  pilot_mode          TEXT        DEFAULT 'steady' CHECK (pilot_mode IN ('steady','coach','hype','unfiltered')),

  -- Notification settings
  notif_cadence       TEXT        DEFAULT 'every_4h' CHECK (notif_cadence IN ('every_4h','daily','urgent_only','manual')),
  notif_push          BOOLEAN     DEFAULT FALSE,
  push_endpoint       TEXT,
  push_p256dh         TEXT,
  push_auth_key       TEXT,

  -- Onboarding
  onboarding_completed BOOLEAN   DEFAULT FALSE,
  onboarding_step      INT        DEFAULT 0,

  -- Engagement tracking
  search_day_count    INT         DEFAULT 0,
  streak_count        INT         DEFAULT 0,
  last_active_at      TIMESTAMPTZ,

  -- Timestamps
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create user row on Supabase auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_row" ON public.users
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ── PROFILES ────────────────────────────────────────────────
-- Parsed resume / LinkedIn / website data
CREATE TABLE public.profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source          TEXT NOT NULL CHECK (source IN ('pdf','website','text','linkedin_pdf')),
  raw_text        TEXT,
  storage_path    TEXT,             -- Supabase Storage path for PDF
  filename        TEXT,
  parsed_json     JSONB,            -- { name, title, skills[], companies[], education, seniority, strongest_card, years_exp, keywords[] }
  claude_model    TEXT,
  parsed_at       TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own" ON public.profiles
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_profiles_user ON public.profiles(user_id);

-- ── JOBS ────────────────────────────────────────────────────
-- All scraped job listings from all sources
CREATE TABLE public.jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id         TEXT,                    -- ID from source platform
  source              TEXT NOT NULL,           -- cutshort|hirist|hirect|wellfound|yc|topstartups|naukri|iimjobs|arc|remotive|greenhouse|lever|ashby
  title               TEXT NOT NULL,
  company             TEXT NOT NULL,
  company_domain      TEXT,                    -- stripe.com, razorpay.com
  description         TEXT,
  requirements        TEXT[]      DEFAULT '{}',
  salary_min          INT,
  salary_max          INT,
  salary_currency     TEXT        DEFAULT 'INR',
  location            TEXT,
  remote_type         TEXT        CHECK (remote_type IN ('remote','hybrid','onsite')),
  apply_url           TEXT,
  apply_type          TEXT        CHECK (apply_type IN ('greenhouse','lever','ashby','linkedin','taleo','workday','external')),
  company_stage       TEXT        CHECK (company_stage IN ('seed','series_a','series_b','growth','public','unknown')),
  department          TEXT,                    -- engineering|product|design|sales|marketing

  -- Intelligence fields
  posted_at           TIMESTAMPTZ,             -- ORIGINAL posting date from source
  first_seen_at       TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at        TIMESTAMPTZ DEFAULT NOW(),
  repost_count        INT         DEFAULT 0,
  applicant_count     INT,                     -- nullable — not all sources provide this
  description_hash    TEXT,                    -- SHA hash for repost detection
  is_ghost            BOOLEAN     DEFAULT FALSE, -- flagged if no pipeline movement in 90d
  is_active           BOOLEAN     DEFAULT TRUE,

  raw_html            TEXT,                    -- original scraped content (for re-parsing)
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_jobs_source_external ON public.jobs(source, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_jobs_company_domain ON public.jobs(company_domain);
CREATE INDEX idx_jobs_active ON public.jobs(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_jobs_posted ON public.jobs(posted_at DESC);

CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- No RLS on jobs — they are public data, not user-specific.
-- API routes apply service role for writes, anon for reads.

-- ── JOB INTELLIGENCE ────────────────────────────────────────
-- Culture, hiring signals, salary data per company
CREATE TABLE public.job_intelligence (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_domain          TEXT NOT NULL UNIQUE,  -- keyed by domain, not job_id

  -- Glassdoor data
  glassdoor_rating        NUMERIC(2,1),
  glassdoor_recommend_pct INT,
  glassdoor_ceo_approval  INT,
  glassdoor_wlb_score     NUMERIC(2,1),
  glassdoor_culture_score NUMERIC(2,1),

  -- AmbitionBox data (India-specific)
  ambitionbox_rating      NUMERIC(2,1),
  ambitionbox_wlb_score   NUMERIC(2,1),
  ambitionbox_growth_score NUMERIC(2,1),
  ambitionbox_recommend_pct INT,

  -- Claude synthesis
  culture_summary         TEXT,                  -- 1-2 sentence Pilot read
  top_positives           TEXT[]  DEFAULT '{}',  -- max 2
  top_warnings            TEXT[]  DEFAULT '{}',  -- max 1
  interview_process       TEXT,
  common_complaints       TEXT,

  -- Hiring signals
  hiring_velocity_30d     INT,                   -- roles posted in last 30 days
  salary_data_json        JSONB,                 -- { p25, p50, p75, currency }

  refreshed_at            TIMESTAMPTZ DEFAULT NOW(),
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_intelligence_domain ON public.job_intelligence(company_domain);

-- ── JOB MATCHES ─────────────────────────────────────────────
-- Per-user job scoring + feedback
CREATE TABLE public.job_matches (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  job_id            UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,

  match_score       INT         NOT NULL CHECK (match_score BETWEEN 0 AND 100),
  match_reasons     TEXT[]      DEFAULT '{}',
  gap_analysis      TEXT[]      DEFAULT '{}',
  profile_hash      TEXT,                        -- hash of profile used for this score (for cache invalidation)

  status            TEXT        DEFAULT 'pending' CHECK (status IN ('pending','viewed','applied','dismissed','saved')),
  dismissed_reason  TEXT        CHECK (dismissed_reason IN ('already_applied','too_senior','too_junior','wrong_industry','wrong_company','location','not_interested')),

  scored_at         TIMESTAMPTZ DEFAULT NOW(),
  viewed_at         TIMESTAMPTZ,
  feedback_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_job_matches_user_job ON public.job_matches(user_id, job_id);
CREATE INDEX idx_job_matches_user_status ON public.job_matches(user_id, status);
CREATE INDEX idx_job_matches_score ON public.job_matches(user_id, match_score DESC);

ALTER TABLE public.job_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_matches_own" ON public.job_matches
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── RECRUITERS ──────────────────────────────────────────────
-- Manually curated + auto-discovered recruiter database
CREATE TABLE public.recruiters (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  linkedin_url        TEXT UNIQUE,
  current_company     TEXT,
  title               TEXT,
  type                TEXT        CHECK (type IN ('agency','inhouse','independent')),
  email               TEXT,
  follower_count      INT         DEFAULT 0,

  -- Matching dimensions
  specialization      TEXT[]      DEFAULT '{}',  -- pm|engineering|design|leadership|sales
  seniority_levels    TEXT[]      DEFAULT '{}',  -- junior|mid|senior|lead|csuite
  industry_focus      TEXT[]      DEFAULT '{}',  -- fintech|saas|ai|travel|ecomm|general
  geography           TEXT[]      DEFAULT '{}',  -- india|us|canada|global
  cities              TEXT[]      DEFAULT '{}',  -- bangalore|mumbai|delhi|remote|bay_area|toronto

  -- Performance (computed by flywheel cron)
  response_rate       NUMERIC(5,2) DEFAULT 0,    -- 0-100
  avg_reply_days      NUMERIC(5,1),
  placements_at       TEXT[]      DEFAULT '{}',  -- company names they've placed at

  last_active_at      TIMESTAMPTZ,
  manually_curated    BOOLEAN     DEFAULT TRUE,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recruiters_geography ON public.recruiters USING GIN(geography);
CREATE INDEX idx_recruiters_specialization ON public.recruiters USING GIN(specialization);
CREATE INDEX idx_recruiters_response_rate ON public.recruiters(response_rate DESC);

CREATE TRIGGER recruiters_updated_at
  BEFORE UPDATE ON public.recruiters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RECRUITER MATCHES ────────────────────────────────────────
-- Per-user recruiter recommendations + outreach tracking
CREATE TABLE public.recruiter_matches (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recruiter_id      UUID NOT NULL REFERENCES public.recruiters(id) ON DELETE CASCADE,
  job_id            UUID REFERENCES public.jobs(id) ON DELETE SET NULL,  -- optional context

  relevance_score   INT         NOT NULL CHECK (relevance_score BETWEEN 0 AND 100),
  match_reasons     TEXT[]      DEFAULT '{}',
  outreach_draft    TEXT,

  status            TEXT        DEFAULT 'pending' CHECK (status IN ('pending','messaged','replied','no_response','placed')),
  outreach_sent_at  TIMESTAMPTZ,
  reply_received_at TIMESTAMPTZ,
  gmail_thread_id   TEXT,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_recruiter_matches_user_recruiter ON public.recruiter_matches(user_id, recruiter_id);
CREATE INDEX idx_recruiter_matches_user ON public.recruiter_matches(user_id);

ALTER TABLE public.recruiter_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recruiter_matches_own" ON public.recruiter_matches
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER recruiter_matches_updated_at
  BEFORE UPDATE ON public.recruiter_matches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── PIPELINE ────────────────────────────────────────────────
-- Unified application + outreach + prospect tracking
CREATE TABLE public.pipeline (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  job_id            UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  recruiter_id      UUID REFERENCES public.recruiters(id) ON DELETE SET NULL,

  type              TEXT NOT NULL CHECK (type IN ('application','outreach','prospect')),
  stage             TEXT NOT NULL DEFAULT 'applied'
                    CHECK (stage IN ('applied','confirmed','messaged','replied','interviewing','offer','rejected','ghosted','prospect')),

  -- Denormalized for display (survives job/recruiter deletion)
  company           TEXT NOT NULL,
  role_title        TEXT,
  company_logo_char TEXT,
  company_logo_color TEXT,

  -- Tracking
  applied_at        TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at  TIMESTAMPTZ DEFAULT NOW(),
  gmail_thread_id   TEXT,
  calendar_event_id TEXT,

  -- Source of this card
  source            TEXT DEFAULT 'manual'
                    CHECK (source IN ('auto','manual','gmail','calendar','truecaller_call','user_self_report')),

  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pipeline_user ON public.pipeline(user_id);
CREATE INDEX idx_pipeline_stage ON public.pipeline(user_id, stage);
CREATE INDEX idx_pipeline_gmail ON public.pipeline(gmail_thread_id) WHERE gmail_thread_id IS NOT NULL;

ALTER TABLE public.pipeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pipeline_own" ON public.pipeline
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER pipeline_updated_at
  BEFORE UPDATE ON public.pipeline
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── GMAIL TOKENS ────────────────────────────────────────────
-- Encrypted OAuth tokens — NEVER expose via API
CREATE TABLE public.gmail_tokens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  access_token      TEXT NOT NULL,   -- encrypted with pgcrypto
  refresh_token     TEXT NOT NULL,   -- encrypted with pgcrypto
  token_expiry      TIMESTAMPTZ NOT NULL,
  scope             TEXT,
  connected_at      TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at    TIMESTAMPTZ
);

-- RLS: only service role can access (no user-level read)
ALTER TABLE public.gmail_tokens ENABLE ROW LEVEL SECURITY;
-- Intentionally no user policy — accessed only via service role from server

-- ── SCRAPER CIRCUIT BREAKERS ────────────────────────────────
-- Track health of each job source
CREATE TABLE public.scraper_status (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source        TEXT NOT NULL UNIQUE,
  state         TEXT NOT NULL DEFAULT 'closed' CHECK (state IN ('closed','open','half_open')),
  failure_count INT DEFAULT 0,
  last_success  TIMESTAMPTZ,
  last_failure  TIMESTAMPTZ,
  opened_at     TIMESTAMPTZ,    -- when circuit opened
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with all sources
INSERT INTO public.scraper_status (source) VALUES
  ('greenhouse'),('lever'),('ashby'),('wellfound'),('yc'),
  ('cutshort'),('hirist'),('hirect'),('topstartups'),('nextleap'),
  ('naukri'),('iimjobs'),('arc'),('remotive'),('glassdoor'),('ambitionbox');

-- ── NOTIFICATIONS ────────────────────────────────────────────
-- Push notification queue
CREATE TABLE public.notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('action_reminder','signal_alert','re_engagement','offboarding')),
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  action_url    TEXT,
  payload_json  JSONB DEFAULT '{}',
  scheduled_at  TIMESTAMPTZ DEFAULT NOW(),
  sent_at       TIMESTAMPTZ,
  opened_at     TIMESTAMPTZ,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','opened'))
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_pending ON public.notifications(status, scheduled_at) WHERE status = 'pending';

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_own" ON public.notifications
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── FLYWHEEL SIGNALS ─────────────────────────────────────────
-- Anonymised aggregate learning data
CREATE TABLE public.flywheel_signals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_type           TEXT NOT NULL CHECK (signal_type IN ('job_outcome','recruiter_response','company_rejection','dismissal_reason','archetype_match')),
  profile_archetype_hash TEXT,         -- SHA of (seniority+top_skills+education_tier) — NOT user_id
  company_domain        TEXT,
  job_source            TEXT,
  outcome               TEXT,          -- interview|offer|rejected|ghosted|no_response
  dismissed_reason      TEXT,          -- for dismissal_reason signals
  time_to_outcome_days  INT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_flywheel_type ON public.flywheel_signals(signal_type);
CREATE INDEX idx_flywheel_archetype ON public.flywheel_signals(profile_archetype_hash);
-- No RLS — written by service role, no user reads

-- ============================================================
-- END OF SCHEMA
-- ============================================================
