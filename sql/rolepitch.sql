-- RolePitch schema additions
-- Run in Supabase SQL editor.
--
-- Adds job_descriptions table so RolePitch can run the tailoring pipeline
-- without creating fake job_matches rows. CareerPilot matches auto-create
-- a linked job_descriptions row via source_match_id.

-- ─── 1. job_descriptions — lightweight JD store ───────────────────────────

CREATE TABLE IF NOT EXISTS job_descriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  title       TEXT NOT NULL,
  company     TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL,

  -- 'pasted' = user typed/pasted it in RolePitch
  -- 'scraped' = fetch-jd succeeded
  -- 'careerpilot_match' = auto-created from a job_matches row
  source      TEXT NOT NULL DEFAULT 'pasted'
                CHECK (source IN ('pasted', 'scraped', 'careerpilot_match')),

  -- nullable back-reference to CareerPilot job_matches (for linked rows)
  source_match_id UUID REFERENCES job_matches(id) ON DELETE SET NULL,

  -- cluster fields — populated by ensureJobCluster (same as jobs table)
  cluster_id          TEXT,
  seniority_band      TEXT,
  cluster_confidence  NUMERIC(3,2),

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE job_descriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own job_descriptions"
  ON job_descriptions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own job_descriptions"
  ON job_descriptions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own job_descriptions"
  ON job_descriptions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own job_descriptions"
  ON job_descriptions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_jd_user ON job_descriptions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jd_source_match ON job_descriptions (source_match_id);

-- ─── 2. Add jd_id to tailored_resumes ────────────────────────────────────
-- Nullable so existing CareerPilot rows (which have match_id) are unaffected.
-- New RolePitch tailors set jd_id; existing CareerPilot tailors keep match_id.

ALTER TABLE tailored_resumes
  ADD COLUMN IF NOT EXISTS jd_id UUID REFERENCES job_descriptions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tr_jd ON tailored_resumes (user_id, jd_id);

-- ─── 3. onboarding_source on users ───────────────────────────────────────
-- Tracks which funnel the user came through. Useful for analytics + pricing.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_source TEXT
    CHECK (onboarding_source IN ('careerpilot', 'rolepitch'))
    DEFAULT 'careerpilot';
